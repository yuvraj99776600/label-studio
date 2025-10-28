"""
FSM Transitions for Project model.

This module defines declarative transitions for the Project entity,
replacing the previous signal-based approach with explicit, testable transitions.
"""

from typing import Any, Dict

from fsm.registry import register_state_transition
from fsm.state_choices import ProjectStateChoices
from fsm.transitions import ModelChangeTransition, TransitionContext


@register_state_transition('project', 'project_created', triggers_on_create=True, triggers_on_update=False)
class ProjectCreatedTransition(ModelChangeTransition):
    """
    Transition when a new project is created.

    This is the initial state transition that occurs when a project is
    first saved to the database.

    Trigger: Automatically on creation (triggers_on_create=True, triggers_on_update=False)
    """

    @property
    def target_state(self) -> str:
        return ProjectStateChoices.CREATED

    def should_execute(self, context: TransitionContext) -> bool:
        """Only execute on creation, never on updates."""
        return self.is_creating

    def get_reason(self, context: TransitionContext) -> str:
        """Return detailed reason for project creation."""
        return 'Project created'

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
        # Settings changes keep the current state
        # We can't access context here as it's not set yet, so we default to CREATED
        # The actual state record will reflect the proper before/after states
        return ProjectStateChoices.CREATED

    def should_execute(self, context: TransitionContext) -> bool:
        """Only execute on updates, never on creation."""
        return not self.is_creating

    def get_reason(self, context: TransitionContext) -> str:
        """Return detailed reason for project settings change."""
        return 'Project settings changed'

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
        Post-transition hook for settings changes.

        Settings changes are recorded but don't require additional processing in LSO.
        """
        pass
