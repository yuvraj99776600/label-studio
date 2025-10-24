"""
FSM Transitions for AnnotationDraft model.

This module defines declarative transitions for the AnnotationDraft entity.

AnnotationDraft represents work-in-progress annotations that users are actively editing.
"""

from typing import Any, Dict

from fsm.registry import register_state_transition
from fsm.state_choices import AnnotationDraftStateChoices
from fsm.transitions import ModelChangeTransition, TransitionContext


@register_state_transition('annotationdraft', 'annotation_draft_created', triggers_on_create=True)
class AnnotationDraftCreatedTransition(ModelChangeTransition):
    """
    Transition when a new annotation draft is created.

    This occurs when a user starts working on a new annotation.

    Trigger: Automatically on creation (triggers_on_create=True)
    """

    @property
    def target_state(self) -> str:
        return AnnotationDraftStateChoices.CREATED

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Execute draft creation transition."""
        draft = context.entity

        return {
            'reason': 'Annotation draft created - user started annotation work',
            'task_id': draft.task_id,
            'annotation_id': draft.annotation_id if draft.annotation_id else None,
            'user_id': draft.user_id,
            'lead_time': draft.lead_time,
        }


@register_state_transition(
    'annotationdraft', 'annotation_draft_auto_saved', triggers_on_create=False, triggers_on_update=True
)
class AnnotationDraftAutoSavedTransition(ModelChangeTransition):
    """
    Transition when an annotation draft is auto-saved.

    This occurs periodically as the user works on an annotation.

    Trigger: On update (triggers_on_create=False, triggers_on_update=True)
    """

    @property
    def target_state(self) -> str:
        # Keep the draft in ACTIVE state during auto-saves
        # Only move to CREATED if current state is CREATED
        if self.context and self.context.current_state == AnnotationDraftStateChoices.CREATED:
            return AnnotationDraftStateChoices.ACTIVE
        return AnnotationDraftStateChoices.ACTIVE

    def should_execute(self, context: TransitionContext) -> bool:
        """Only execute if draft is in CREATED or ACTIVE state."""
        current_state = context.current_state
        return current_state in [AnnotationDraftStateChoices.CREATED, AnnotationDraftStateChoices.ACTIVE]

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Execute draft auto-save transition."""
        draft = context.entity

        return {
            'reason': 'Annotation draft auto-saved',
            'task_id': draft.task_id,
            'annotation_id': draft.annotation_id if draft.annotation_id else None,
            'user_id': draft.user_id,
            'lead_time': draft.lead_time,
            'changed_fields': list(self.changed_fields.keys()),
        }

