"""
Utility functions for working with the declarative transition system.

This module provides helper functions to make it easier to integrate
the new Pydantic-based transition system with existing Label Studio code.
"""

from typing import Any, Dict, List, Optional, Type

from django.db.models import Model
from fsm.models import BaseState
from fsm.registry import transition_registry
from fsm.state_manager import StateManager
from fsm.transitions import BaseTransition, TransitionValidationError


def execute_transition(
    entity: Model, transition_name: str, transition_data: Dict[str, Any], user=None, **context_kwargs
) -> BaseState:
    """
    Execute a named transition on an entity.

    This is a convenience function that looks up the transition class
    and executes it with the provided data.

    Args:
        entity: The entity to transition
        transition_name: Name of the registered transition
        transition_data: Data for the transition (validated by Pydantic)
        user: User executing the transition
        **context_kwargs: Additional context data

    Returns:
        The newly created state record

    Raises:
        ValueError: If transition is not found
        TransitionValidationError: If transition validation fails
    """
    entity_name = entity._meta.model_name.lower()
    return transition_registry.execute_transition(
        entity_name=entity_name,
        transition_name=transition_name,
        entity=entity,
        transition_data=transition_data,
        user=user,
        **context_kwargs,
    )


def execute_transition_instance(entity: Model, transition: BaseTransition, user=None, **context_kwargs) -> BaseState:
    """
    Execute a pre-created transition instance.

    Args:
        entity: The entity to transition
        transition: Instance of a transition class
        user: User executing the transition
        **context_kwargs: Additional context data

    Returns:
        The newly created state record
    """
    return StateManager.execute_declarative_transition(
        transition=transition, entity=entity, user=user, **context_kwargs
    )


def get_available_transitions(entity: Model, user=None, validate: bool = False) -> Dict[str, Type[BaseTransition]]:
    """
    Get available transitions for an entity.

    Args:
        entity: The entity to get transitions for
        user: User context for validation (only used when validate=True)
        validate: Whether to validate each transition against current state.
                 When False, returns all registered transitions for the entity type.
                 When True, filters to only transitions valid from current state (may be expensive).

    Returns:
        Dictionary mapping transition names to transition classes.
        When validate=False: All registered transitions for the entity type.
        When validate=True: Only transitions valid for the current state.
    """
    entity_name = entity._meta.model_name.lower()
    available = transition_registry.get_transitions_for_entity(entity_name)

    if not validate:
        return available

    valid_transitions = {}

    for name, transition_class in available.items():
        try:
            # Get current state information
            current_state_object = StateManager.get_current_state_object(entity)
            current_state = current_state_object.state if current_state_object else None

            # Build minimal context for validation
            from .transitions import TransitionContext

            # Get target state from class or instance
            target_state = transition_class.get_target_state()
            if target_state is None:
                # Need to create an instance to get target_state
                try:
                    temp_instance = transition_class()
                    target_state = temp_instance.target_state
                except Exception:
                    # Can't create instance, skip this transition
                    continue

            context = TransitionContext(
                entity=entity,
                current_user=user,
                current_state_object=current_state_object,
                current_state=current_state,
                target_state=target_state,
                organization_id=getattr(entity, 'organization_id', None),
            )

            # Use class-level validation that doesn't require an instance
            if transition_class.can_transition_from_state(context):
                valid_transitions[name] = transition_class

        except (TransitionValidationError, Exception):
            # Transition is not valid for current state/context
            continue

    return valid_transitions


def create_transition_from_dict(transition_class: Type[BaseTransition], data: Dict[str, Any]) -> BaseTransition:
    """
    Create a transition instance from a dictionary of data.

    This handles Pydantic validation and provides clear error messages.

    Args:
        transition_class: The transition class to instantiate
        data: Dictionary of transition data

    Returns:
        Validated transition instance

    Raises:
        ValueError: If data validation fails
    """
    try:
        return transition_class(**data)
    except Exception as e:
        raise ValueError(f'Failed to create {transition_class.__name__}: {e}')


def get_transition_schema(transition_class: Type[BaseTransition]) -> Dict[str, Any]:
    """
    Get the JSON schema for a transition class.

    Useful for generating API documentation or frontend forms.

    Args:
        transition_class: The transition class

    Returns:
        JSON schema dictionary
    """
    return transition_class.model_json_schema()


def validate_transition_data(transition_class: Type[BaseTransition], data: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Validate transition data without creating an instance.

    Args:
        transition_class: The transition class
        data: Data to validate

    Returns:
        Dictionary of field names to error messages (empty if valid)
    """
    try:
        transition_class(**data)
        return {}
    except Exception as e:
        # Parse Pydantic validation errors
        errors = {}
        if hasattr(e, 'errors'):
            for error in e.errors():
                field = '.'.join(str(loc) for loc in error['loc'])
                if field not in errors:
                    errors[field] = []
                errors[field].append(error['msg'])
        else:
            errors['__root__'] = [str(e)]
        return errors


def get_entity_state_flow(entity: Model) -> List[Dict[str, Any]]:
    """
    Get a summary of the state flow for an entity type.

    This analyzes all registered transitions and builds a flow diagram.

    Args:
        entity: Example entity instance

    Returns:
        List of state flow information
    """
    entity_name = entity._meta.model_name.lower()
    transitions = transition_registry.get_transitions_for_entity(entity_name)

    # Build state flow information
    states = set()
    flows = []

    for transition_name, transition_class in transitions.items():
        # Create instance to get target state
        try:
            transition = transition_class()
            target = transition.target_state
            states.add(target)

            flows.append(
                {
                    'transition_name': transition_name,
                    'transition_class': transition_class.__name__,
                    'target_state': target,
                    'description': transition_class.__doc__ or '',
                    'fields': list(transition_class.model_fields.keys()),
                }
            )
        except Exception:
            continue

    return flows


# Backward compatibility helpers


def transition_state_declarative(entity: Model, transition_name: str, user=None, **transition_data) -> BaseState:
    """
    Backward-compatible helper for transitioning state declaratively.

    This provides a similar interface to StateManager.transition_state
    but uses the declarative system.
    """
    return execute_transition(
        entity=entity, transition_name=transition_name, transition_data=transition_data, user=user
    )


class TransitionBuilder:
    """
    Builder class for constructing and executing transitions fluently.

    Example usage:
        result = (TransitionBuilder(entity)
                  .transition('start_task')
                  .with_data(assigned_user_id=123, priority='high')
                  .by_user(request.user)
                  .execute())
    """

    def __init__(self, entity: Model):
        self.entity = entity
        self._transition_name: Optional[str] = None
        self._transition_data: Dict[str, Any] = {}
        self._user = None
        self._context_data: Dict[str, Any] = {}

    def transition(self, name: str) -> 'TransitionBuilder':
        """Set the transition name"""
        self._transition_name = name
        return self

    def with_data(self, **data) -> 'TransitionBuilder':
        """Add transition data"""
        self._transition_data.update(data)
        return self

    def by_user(self, user) -> 'TransitionBuilder':
        """Set the executing user"""
        self._user = user
        return self

    def with_context(self, **context) -> 'TransitionBuilder':
        """Add context data"""
        self._context_data.update(context)
        return self

    def execute(self) -> BaseState:
        """Execute the configured transition"""
        if not self._transition_name:
            raise ValueError('Transition name not specified')

        return execute_transition(
            entity=self.entity,
            transition_name=self._transition_name,
            transition_data=self._transition_data,
            user=self._user,
            **self._context_data,
        )

    def validate(self) -> Dict[str, List[str]]:
        """Validate the configured transition without executing"""
        if not self._transition_name:
            raise ValueError('Transition name not specified')

        entity_name = self.entity._meta.model_name.lower()
        transition_class = transition_registry.get_transition(entity_name, self._transition_name)

        if not transition_class:
            raise ValueError(f"Transition '{self._transition_name}' not found for entity '{entity_name}'")

        return validate_transition_data(transition_class, self._transition_data)
