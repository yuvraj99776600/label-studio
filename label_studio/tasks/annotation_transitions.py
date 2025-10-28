"""
FSM Transitions for Annotation model.

This module defines declarative transitions for the Annotation entity.
Annotation transitions can update related task states via post_transition_hooks.
"""

from typing import Any, Dict

from fsm.registry import register_state_transition
from fsm.state_choices import AnnotationStateChoices
from fsm.transitions import ModelChangeTransition, StateModelType, TransitionContext


@register_state_transition('annotation', 'annotation_submitted', triggers_on_create=True)
class AnnotationSubmittedTransition(ModelChangeTransition):
    """
    Transition when an annotation is submitted.

    This is the default transition for newly created annotations.

    Trigger: Automatically on creation (triggers_on_create=True)
    """

    @property
    def target_state(self) -> str:
        return AnnotationStateChoices.SUBMITTED

    def get_reason(self, context: TransitionContext) -> str:
        """Return detailed reason for annotation submission."""
        return 'Annotation submitted for review'

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
        """
        Post-transition hook for annotation submission.

        In LSO, task state management is minimal. In LSE, task state changes
        are handled by TaskCompletionStrategy.
        """
        pass


@register_state_transition('annotation', 'annotation_updated', triggers_on_create=False, triggers_on_update=True)
class AnnotationUpdatedTransition(ModelChangeTransition):
    """
    Transition when an annotation is updated.

    Updates keep the annotation in SUBMITTED state.

    Trigger: On update (triggers_on_create=False, triggers_on_update=True)
    """

    @property
    def target_state(self) -> str:
        return AnnotationStateChoices.SUBMITTED

    def get_reason(self, context: TransitionContext) -> str:
        """Return detailed reason for annotation update."""
        return 'Annotation updated'

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Execute annotation update transition."""
        annotation = context.entity

        return {
            'reason': 'Annotation updated',
            'task_id': annotation.task_id,
            'project_id': annotation.project_id,
            'updated_by_id': getattr(annotation, 'updated_by_id', None),
            'changed_fields': list(self.changed_fields.keys()) if self.changed_fields else [],
        }

    def post_transition_hook(self, context: TransitionContext, state_record: StateModelType) -> None:
        """Post-transition hook for annotation updates."""
        pass
