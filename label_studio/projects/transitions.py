"""
FSM Transitions for Project model.

This module defines declarative transitions for the Project entity,
replacing the previous signal-based approach with explicit, testable transitions.
"""

from typing import Any, Dict

from fsm.registry import register_state_transition
from fsm.state_choices import ProjectStateChoices
from fsm.transitions import ModelChangeTransition, TransitionContext


@register_state_transition('project', 'project_created', triggers_on_create=True)
class ProjectCreatedTransition(ModelChangeTransition):
    """
    Transition when a new project is created.

    This is the initial state transition that occurs when a project is
    first saved to the database.

    Trigger: Automatically on creation (triggers_on_create=True)
    """

    @property
    def target_state(self) -> str:
        return ProjectStateChoices.CREATED

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """
        Execute project creation transition.

        Args:
            context: Transition context containing project and user information

        Returns:
            Context data to store with the state record
        """
        project = context.entity

        return {
            'reason': 'Project created',
            'organization_id': project.organization_id,
            'title': project.title,
            'created_by_id': project.created_by_id if project.created_by_id else None,
            'label_config_present': bool(project.label_config),
        }


@register_state_transition(
    'project',
    'project_settings_changed',
    triggers_on_create=False,
    triggers_on=[
        'maximum_annotations',
        'overlap_cohort_percentage',
        'show_overlap_first',
        'skip_queue',
    ],
)
class ProjectSettingsChangedTransition(ModelChangeTransition):
    """
    Transition when project settings that affect task states change.

    This transition is triggered when settings like maximum_annotations,
    overlap_cohort_percentage, show_overlap_first, or skip_queue change,
    as these affect how tasks are completed and their FSM states.

    Trigger: Any of the state-affecting fields change (declaratively defined)
    """

    @property
    def target_state(self) -> str:
        # Keep current state - this is a metadata update, not a state change
        # The actual task state recalculation is handled by handle_project_settings_change
        return self.context.current_state if self.context.current_state else ProjectStateChoices.CREATED

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """
        Execute project settings change transition.

        Args:
            context: Transition context containing project and user information

        Returns:
            Context data including which fields changed
        """
        project = context.entity

        # Identify which state-affecting fields changed
        changed_settings = {}
        for field_name, field_data in self.changed_fields.items():
            if field_name in [
                'maximum_annotations',
                'overlap_cohort_percentage',
                'show_overlap_first',
                'skip_queue',
            ]:
                changed_settings[field_name] = field_data

        return {
            'reason': 'Project settings changed',
            'organization_id': project.organization_id,
            'changed_settings': changed_settings,
            'maximum_annotations': project.maximum_annotations,
            'overlap_cohort_percentage': project.overlap_cohort_percentage,
            'show_overlap_first': project.show_overlap_first,
            'skip_queue': project.skip_queue,
        }

    def post_transition_hook(self, context: TransitionContext, state_record) -> None:
        """
        After recording the settings change, trigger task state recalculation.

        This ensures that existing task states are updated to reflect the new
        project settings.
        """
        # Import here to avoid circular dependency
        try:
            from lse_fsm.task_completion_strategy import handle_project_settings_change

            project = context.entity
            changed_fields = list(self.changed_fields.keys())

            # Trigger task state recalculation for affected tasks
            handle_project_settings_change(project, changed_fields)
        except ImportError:
            # In OSS Label Studio, task state recalculation may not exist
            # This is fine - the transition still records the change
            pass


@register_state_transition('project', 'project_published', triggers_on=['is_published'])
class ProjectPublishedTransition(ModelChangeTransition):
    """
    Transition when a project is published to annotators.

    This transition is triggered when the is_published field changes from
    False to True, indicating the project is now available for annotation work.

    Note: This was intended functionality in the FSM design but was never
    actually implemented in the signal-based approach. We're adding it here
    as an improvement.

    Trigger: is_published field changes (declaratively defined)
    """

    @property
    def target_state(self) -> str:
        return ProjectStateChoices.PUBLISHED

    def should_execute(self, context: TransitionContext) -> bool:
        """Execute when is_published changes from False to True"""
        if self.is_creating:
            return False

        # Check if is_published changed to True
        if 'is_published' in self.changed_fields:
            old_val = self.changed_fields['is_published']['old']
            new_val = self.changed_fields['is_published']['new']
            return not old_val and new_val

        return False

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """
        Execute project published transition.

        Args:
            context: Transition context containing project and user information

        Returns:
            Context data to store with the state record
        """
        project = context.entity

        return {
            'reason': 'Project published to annotators',
            'organization_id': project.organization_id,
            'title': project.title,
            'task_count': project.num_tasks if hasattr(project, 'num_tasks') else 0,
            'published_by_id': context.current_user.id if context.current_user else None,
        }


@register_state_transition('project', 'project_unpublished', triggers_on=['is_published'])
class ProjectUnpublishedTransition(ModelChangeTransition):
    """
    Transition when a project is unpublished (removed from annotator access).

    This transition is triggered when the is_published field changes from
    True to False, indicating the project is no longer available for annotation work.

    Note: This was intended functionality in the FSM design but was never
    actually implemented in the signal-based approach. We're adding it here
    as an improvement.

    Trigger: is_published field changes (declaratively defined)
    """

    @property
    def target_state(self) -> str:
        # When unpublished, return to IN_PROGRESS or CREATED depending on context
        # For simplicity, return to IN_PROGRESS if tasks exist, otherwise CREATED
        project = self.context.entity if self.context else None
        if project and hasattr(project, 'num_tasks') and project.num_tasks > 0:
            return ProjectStateChoices.IN_PROGRESS
        return ProjectStateChoices.CREATED

    def should_execute(self, context: TransitionContext) -> bool:
        """Execute when is_published changes from True to False"""
        if self.is_creating:
            return False

        # Check if is_published changed to False
        if 'is_published' in self.changed_fields:
            old_val = self.changed_fields['is_published']['old']
            new_val = self.changed_fields['is_published']['new']
            return old_val and not new_val

        return False

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """
        Execute project unpublished transition.

        Args:
            context: Transition context containing project and user information

        Returns:
            Context data to store with the state record
        """
        project = context.entity

        return {
            'reason': 'Project unpublished (removed from annotator access)',
            'organization_id': project.organization_id,
            'title': project.title,
            'task_count': project.num_tasks if hasattr(project, 'num_tasks') else 0,
            'unpublished_by_id': context.current_user.id if context.current_user else None,
        }

