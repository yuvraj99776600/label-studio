"""
FSM Transitions for Task model.

This module defines declarative transitions for the Task entity.

Note: Most task state transitions (annotation_started, annotation_complete, completed)
are triggered by Annotation changes, not Task field changes. Those are handled by
annotation transitions via post_transition_hooks that update the parent task.
"""

from typing import Any, Dict

from fsm.registry import register_state_transition
from fsm.state_choices import TaskStateChoices
from fsm.transitions import ModelChangeTransition, TransitionContext


@register_state_transition('task', 'task_created', triggers_on_create=True)
class TaskCreatedTransition(ModelChangeTransition):
    """
    Transition when a new task is created.

    This is the initial state transition that occurs when a task is
    first saved to the database.

    Trigger: Automatically on creation (triggers_on_create=True)

    Note: Other task transitions (annotation_started, completed, etc.) are
    triggered by Annotation model changes, not Task field changes.
    """

    @property
    def target_state(self) -> str:
        return TaskStateChoices.CREATED

    def get_reason(self, context: TransitionContext) -> str:
        """Return detailed reason for task creation."""
        return 'Task created in the system'

    def transition(self, context: TransitionContext) -> Dict[str, Any]:
        """
        Execute task creation transition.

        Args:
            context: Transition context containing task and user information

        Returns:
            Context data to store with the state record
        """
        task = context.entity

        return {
            'reason': 'Task created in the system',
            'project_id': task.project_id,
            'data_keys': list(task.data.keys()) if task.data else [],
            'overlap': task.overlap,
        }
