"""
Transition execution orchestrator for the FSM engine.

This module serves as the top-level orchestrator for state transitions,
importing from both state_manager and transitions to coordinate execution
without creating circular dependencies.

No other FSM modules should import from this module.
"""

import logging
from typing import Any, Dict

from django.db.models import Model
from fsm.models import BaseState
from fsm.registry import get_state_model_for_entity, transition_registry
from fsm.state_manager import StateManager
from fsm.transitions import TransitionContext

logger = logging.getLogger(__name__)


def execute_transition(
    entity: Model,
    transition_name: str,
    transition_data: Dict[str, Any] = None,
    user=None,
    **context_kwargs,
) -> BaseState:
    """
    Execute a registered transition by name.

    This is the main entry point for executing state transitions in the FSM system.
    It coordinates between the registry, transitions, and state manager without
    creating circular dependencies.

    Args:
        entity: The entity to transition
        transition_name: Name of the registered transition
        transition_data: Data for the transition (validated by Pydantic)
        user: User executing the transition
        **context_kwargs: Additional context data

    Returns:
        The newly created state record

    Raises:
        ValueError: If transition is not found or state model is not registered
        TransitionValidationError: If transition validation fails
    """
    entity_name = entity._meta.model_name.lower()
    transition_data = transition_data or {}

    # Get the transition class from registry
    transition_class = transition_registry.get_transition(entity_name, transition_name)
    if not transition_class:
        raise ValueError(f"Transition '{transition_name}' not found for entity '{entity_name}'")

    # Get the state model for the entity
    state_model = get_state_model_for_entity(entity)
    if not state_model:
        raise ValueError(f"No state model registered for entity '{entity_name}'")

    # Create transition instance with provided data
    transition = transition_class(**transition_data)

    # Get current state information directly from state model
    current_state_object = state_model.get_current_state(entity)
    current_state = current_state_object.state if current_state_object else None

    # Build transition context
    context = TransitionContext(
        entity=entity,
        current_user=user,
        current_state_object=current_state_object,
        current_state=current_state,
        target_state=transition.target_state,
        organization_id=getattr(entity, 'organization_id', None),
        **context_kwargs,
    )

    logger.info(
        'Executing transition',
        extra={
            'event': 'fsm.transition_execute',
            'entity_type': entity_name,
            'entity_id': entity.pk,
            'transition_name': transition_name,
            'from_state': current_state,
            'to_state': transition.target_state,
            'user_id': user.id if user else None,
        },
    )

    # Execute the transition in phases
    # Phase 1: Prepare and validate the transition
    transition_context_data = transition.prepare_and_validate(context)

    # Phase 2: Create the state record via StateManager
    success = StateManager.transition_state(
        entity=entity,
        new_state=transition.target_state,
        transition_name=transition.transition_name,
        user=user,
        context=transition_context_data,
        reason=transition.get_reason(context),
    )

    if not success:
        raise ValueError(f'Failed to create state record for {transition_name}')

    # Get the newly created state record
    state_record = StateManager.get_current_state_object(entity)

    # Phase 3: Finalize the transition
    transition.finalize(context, state_record)

    return state_record
