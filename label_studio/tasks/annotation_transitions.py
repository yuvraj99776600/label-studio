"""
FSM Transitions for Annotation model.

This module defines declarative transitions for the Annotation entity.

Note: Annotation transitions have complex logic including:
- Task state updates via post_transition_hooks
- TaskCompletionStrategy evaluation for task state changes
- Review workflow integration
"""

from typing import Any, Dict

from fsm.registry import register_state_transition
from fsm.state_choices import AnnotationStateChoices
from fsm.transitions import ModelChangeTransition, TransitionContext, StateModelType


@register_state_transition('annotation', 'annotation_submitted', triggers_on_create=True)
class AnnotationSubmittedTransition(ModelChangeTransition):
    """
    Transition when an annotation is submitted.

    This is the default transition for newly created annotations.
    If the annotation has _created_from_draft flag, the created_from_draft
    transition will be used instead.

    Trigger: Automatically on creation (triggers_on_create=True)
    """

    @property
    def target_state(self) -> str:
        return AnnotationStateChoices.SUBMITTED

    def should_execute(self, context: TransitionContext) -> bool:
        """Only execute if not created from draft."""
        annotation = context.entity
        return not (hasattr(annotation, '_created_from_draft') and annotation._created_from_draft)

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Execute annotation submission transition."""
        annotation = context.entity

        return {
            'reason': 'Annotation submitted for review',
            'task_id': annotation.task_id,
            'project_id': annotation.project_id,
            'completed_by_id': annotation.completed_by_id,
            'lead_time': annotation.lead_time,
        }

    def post_transition_hook(self, context: TransitionContext, state_record: StateModelType) -> None:
        """Handle task state updates and completion strategy."""
        annotation = context.entity
        task = annotation.task
        user = context.current_user

        # If this is the first annotation on the task, transition task state
        try:
            from fsm.state_manager import get_state_manager

            StateManager = get_state_manager()
            task_current_state = StateManager.get_current_state(task)

            if task_current_state == 'CREATED':
                # Task should transition to ANNOTATION_IN_PROGRESS
                StateManager.execute_transition(
                    entity=task,
                    transition_name='task_annotation_started',
                    transition_data={'annotation_id': annotation.id},
                    user=user,
                    organization_id=context.organization_id,
                )
        except Exception:
            # Log error but don't fail the annotation transition
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                'Failed to update task state on annotation submission',
                extra={
                    'event': 'fsm.task_state_update_failed',
                    'annotation_id': annotation.id,
                    'task_id': annotation.task_id,
                },
                exc_info=True,
            )

        # Use task completion strategy to evaluate if task state should change
        try:
            # Only in LSE
            from lse_fsm.task_completion_strategy import TaskCompletionStrategy

            TaskCompletionStrategy.handle_annotation_change(annotation, user=user)
        except ImportError:
            pass


@register_state_transition('annotation', 'annotation_created_from_draft', triggers_on_create=True)
class AnnotationCreatedFromDraftTransition(ModelChangeTransition):
    """
    Transition when an annotation is created from a draft.

    This transition is used when an annotation has the _created_from_draft flag set.

    Trigger: Automatically on creation when _created_from_draft is True
    """

    @property
    def target_state(self) -> str:
        return AnnotationStateChoices.PENDING

    def should_execute(self, context: TransitionContext) -> bool:
        """Only execute if created from draft."""
        annotation = context.entity
        return hasattr(annotation, '_created_from_draft') and annotation._created_from_draft

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Execute annotation creation from draft transition."""
        annotation = context.entity

        context_data = {
            'reason': 'Annotation created from draft',
            'task_id': annotation.task_id,
            'project_id': annotation.project_id,
            'completed_by_id': annotation.completed_by_id,
        }

        # Add draft_id if available
        if hasattr(annotation, '_source_draft_id'):
            context_data['draft_id'] = annotation._source_draft_id

        return context_data

    def post_transition_hook(self, context: TransitionContext, state_record: StateModelType) -> None:
        """Handle task state updates and completion strategy."""
        annotation = context.entity
        task = annotation.task
        user = context.current_user

        # If this is the first annotation on the task, transition task state
        try:
            from fsm.state_manager import get_state_manager

            StateManager = get_state_manager()
            task_current_state = StateManager.get_current_state(task)

            if task_current_state == 'CREATED':
                # Task should transition to ANNOTATION_IN_PROGRESS
                StateManager.execute_transition(
                    entity=task,
                    transition_name='task_annotation_started',
                    transition_data={'annotation_id': annotation.id},
                    user=user,
                    organization_id=context.organization_id,
                )
        except Exception:
            # Log error but don't fail the annotation transition
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                'Failed to update task state on annotation from draft',
                extra={
                    'event': 'fsm.task_state_update_failed',
                    'annotation_id': annotation.id,
                    'task_id': annotation.task_id,
                },
                exc_info=True,
            )

        # Use task completion strategy to evaluate if task state should change
        try:
            # Only in LSE
            from lse_fsm.task_completion_strategy import TaskCompletionStrategy

            TaskCompletionStrategy.handle_annotation_change(annotation, user=user)
        except ImportError:
            pass


@register_state_transition('annotation', 'annotation_updated', triggers_on_create=False, triggers_on_update=True)
class AnnotationUpdatedTransition(ModelChangeTransition):
    """
    Transition when an annotation is updated.

    This transition is triggered on any annotation update.

    Trigger: On update (triggers_on_create=False, triggers_on_update=True)
    """

    @property
    def target_state(self) -> str:
        return AnnotationStateChoices.UPDATED

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Execute annotation update transition."""
        annotation = context.entity

        return {
            'reason': 'Annotation updated after review feedback',
            'task_id': annotation.task_id,
            'project_id': annotation.project_id,
            'updated_by_id': getattr(annotation, 'updated_by_id', None),
            'changed_fields': list(self.changed_fields.keys()),
        }

    def post_transition_hook(self, context: TransitionContext, state_record: StateModelType) -> None:
        """Handle task completion strategy evaluation."""
        annotation = context.entity
        user = context.current_user

        # Check if annotation is in REJECTED state - skip task evaluation if so
        try:
            from fsm.state_manager import get_state_manager
            from core.current_request import CurrentContext

            StateManager = get_state_manager()
            annotation_state = StateManager.get_current_state(annotation)

            # Also check for review rejection in progress
            review_rejection_in_progress = CurrentContext.get('review_rejection_in_progress', False)

            if annotation_state != AnnotationStateChoices.REJECTED and not review_rejection_in_progress:
                # Use task completion strategy to evaluate if task state should change
                try:
                    # Only in LSE
                    from lse_fsm.task_completion_strategy import TaskCompletionStrategy

                    TaskCompletionStrategy.handle_annotation_change(annotation, user=user)
                except ImportError:
                    pass
        except Exception:
            # Log error but don't fail the annotation transition
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                'Failed to evaluate task completion strategy on annotation update',
                extra={
                    'event': 'fsm.task_completion_strategy_failed',
                    'annotation_id': annotation.id,
                    'task_id': annotation.task_id,
                },
                exc_info=True,
            )

