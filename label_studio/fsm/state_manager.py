"""
Core state management functionality for Label Studio.

Provides high-performance state management with caching and batch operations
that can be extended by Label Studio Enterprise with additional features.
"""

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Type

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Model
from fsm.models import BaseState
from fsm.registry import get_state_model_for_entity

# Avoid circular import
if TYPE_CHECKING:
    from fsm.transitions import BaseTransition

logger = logging.getLogger(__name__)


class StateManagerError(Exception):
    """Base exception for StateManager operations"""

    pass


class InvalidTransitionError(StateManagerError):
    """Raised when an invalid state transition is attempted"""

    pass


class StateManager:
    """
    Core state management system for Label Studio.

    Provides the foundation for state management that can be extended
    by Label Studio Enterprise with additional features like:
    - Advanced caching strategies
    - Bulk operations optimization
    - Complex transition validation
    - Enterprise-specific state models

    Features:
    - INSERT-only architecture with UUID7 for maximum performance
    - Basic caching for current state lookups
    - Simple state transitions with audit trails
    - Extensible design for enterprise features
    """

    CACHE_TTL = getattr(settings, 'FSM_CACHE_TTL', 300)  # 5 minutes default
    CACHE_PREFIX = 'fsm:current'

    @classmethod
    def get_cache_key(cls, entity: Model) -> str:
        """Generate cache key for entity's current state"""
        return f'{cls.CACHE_PREFIX}:{entity._meta.label_lower}:{entity.pk}'

    @classmethod
    def get_current_state(cls, entity: Model) -> Optional[str]:
        """
        Get current state with basic caching.

        Args:
            entity: The entity to get current state for

        Returns:
            Current state string or None if no states exist

        Example:
            task = Task.objects.get(id=123)
            current_state = StateManager.get_current_state(task)
            if current_state == 'COMPLETED':
                # Task is finished
                pass
        """
        cache_key = cls.get_cache_key(entity)

        # Try cache first
        cached_state = cache.get(cache_key)
        if cached_state is not None:
            logger.debug(f'Cache hit for {entity._meta.label_lower} {entity.pk}: {cached_state}')
            return cached_state

        # Query database using state model registry
        state_model = get_state_model_for_entity(entity)
        if not state_model:
            logger.warning(f'No state model found for {entity._meta.model_name}')
            return None

        try:
            entity_field = f'{entity._meta.model_name}'
            current_state = (
                state_model.objects.filter(**{entity_field: entity})
                .order_by('-id')  # UUID7 natural ordering
                .values_list('state', flat=True)
                .first()
            )

            # Cache result
            if current_state is not None:
                cache.set(cache_key, current_state, cls.CACHE_TTL)

            logger.debug(f'Database query for {entity._meta.label_lower} {entity.pk}: {current_state}')
            return current_state

        except Exception as e:
            logger.error(f'Error getting current state for {entity._meta.label_lower} {entity.pk}: {e}')
            return None

    @classmethod
    def get_current_state_object(cls, entity: Model) -> Optional[BaseState]:
        """
        Get current state object with full audit information.

        Args:
            entity: The entity to get current state object for

        Returns:
            Latest BaseState instance or None if no states exist
        """
        state_model = get_state_model_for_entity(entity)
        if not state_model:
            return None

        entity_field = f'{entity._meta.model_name}'
        return state_model.objects.filter(**{entity_field: entity}).order_by('-id').first()

    @classmethod
    def transition_state(
        cls,
        entity: Model,
        new_state: str,
        transition_name: str = None,
        user=None,
        context: Dict[str, Any] = None,
        reason: str = '',
    ) -> bool:
        """
        Perform state transition with audit trail.

        Uses INSERT-only approach for maximum performance:
        - No UPDATE operations or row locks
        - Complete audit trail by design
        - Basic cache update for consistency

        Args:
            entity: The entity to transition
            new_state: Target state
            transition_name: Name of transition method (for audit)
            user: User triggering the transition
            context: Additional context data
            reason: Human-readable reason for transition

        Returns:
            True if transition succeeded, False otherwise

        Raises:
            InvalidTransitionError: If transition is not valid
            StateManagerError: If transition fails

        Example:
            success = StateManager.transition_state(
                entity=task,
                new_state='IN_PROGRESS',
                transition_name='start_annotation',
                user=request.user,
                context={'assignment_id': assignment.id},
                reason='User started annotation work'
            )
        """
        state_model = get_state_model_for_entity(entity)
        if not state_model:
            raise StateManagerError(f'No state model found for {entity._meta.model_name}')

        current_state = cls.get_current_state(entity)

        logger.info(
            f'Transitioning {entity._meta.label_lower} {entity.pk}: '
            f'{current_state} → {new_state} (transition: {transition_name})'
        )

        try:
            with transaction.atomic():
                # INSERT-only approach - no UPDATE operations needed
                # Get denormalized fields from the state model itself
                denormalized_fields = {}
                if hasattr(state_model, 'get_denormalized_fields'):
                    denormalized_fields = state_model.get_denormalized_fields(entity)

                # Get organization from user's active organization
                organization_id = (
                    user.active_organization.id
                    if user and hasattr(user, 'active_organization') and user.active_organization
                    else None
                )

                new_state_record = state_model.objects.create(
                    **{entity._meta.model_name: entity},
                    state=new_state,
                    previous_state=current_state,
                    transition_name=transition_name,
                    triggered_by=user,
                    context_data=context or {},
                    reason=reason,
                    organization_id=organization_id,
                    **denormalized_fields,
                )

                # Update cache with new state
                cache_key = cls.get_cache_key(entity)
                cache.set(cache_key, new_state, cls.CACHE_TTL)

                logger.info(
                    f'State transition successful: {entity._meta.label_lower} {entity.pk} '
                    f'now in state {new_state} (record ID: {new_state_record.id})'
                )
                return True

        except Exception as e:
            # On failure, invalidate potentially stale cache
            cache_key = cls.get_cache_key(entity)
            cache.delete(cache_key)
            logger.error(
                f'State transition failed for {entity._meta.label_lower} {entity.pk}: '
                f'{current_state} → {new_state}: {e}'
            )
            raise StateManagerError(f'Failed to transition state: {e}') from e

    @classmethod
    def get_state_history(cls, entity: Model, limit: int = 100) -> List[BaseState]:
        """
        Get complete state history for an entity.

        Args:
            entity: Entity to get history for
            limit: Maximum number of state records to return

        Returns:
            List of state records ordered by most recent first
        """
        state_model = get_state_model_for_entity(entity)
        if not state_model:
            return []

        entity_field = f'{entity._meta.model_name}'
        return list(state_model.objects.filter(**{entity_field: entity}).order_by('-id')[:limit])

    @classmethod
    def get_states_in_time_range(
        cls, entity: Model, start_time: datetime, end_time: Optional[datetime] = None
    ) -> List[BaseState]:
        """
        Get states within a time range using UUID7 time-based queries.

        Args:
            entity: Entity to get states for
            start_time: Start of time range
            end_time: End of time range (defaults to now)

        Returns:
            List of states within the time range
        """
        state_model = get_state_model_for_entity(entity)
        if not state_model:
            return []

        return list(state_model.get_states_in_range(entity, start_time, end_time or datetime.now()))

    @classmethod
    def invalidate_cache(cls, entity: Model):
        """Invalidate cached state for an entity"""
        cache_key = cls.get_cache_key(entity)
        cache.delete(cache_key)
        logger.debug(f'Invalidated cache for {entity._meta.label_lower} {entity.pk}')

    @classmethod
    def warm_cache(cls, entities: List[Model]):
        """
        Warm cache with current states for a list of entities.

        Basic implementation that can be optimized by Enterprise with
        bulk queries and advanced caching strategies.
        """
        cache_updates = {}
        for entity in entities:
            current_state = cls.get_current_state(entity)
            if current_state:
                cache_key = cls.get_cache_key(entity)
                cache_updates[cache_key] = current_state

        if cache_updates:
            cache.set_many(cache_updates, cls.CACHE_TTL)
            logger.debug(f'Warmed cache for {len(cache_updates)} entities')

    @classmethod
    def execute_declarative_transition(
        cls, transition: 'BaseTransition', entity: Model, user=None, **context_kwargs
    ) -> BaseState:
        """
        Execute a declarative Pydantic-based transition.

        This method integrates the new declarative transition system with
        the existing StateManager, providing a bridge between the two approaches.

        Args:
            transition: Instance of a BaseTransition subclass
            entity: The entity to transition
            user: User executing the transition
            **context_kwargs: Additional context data

        Returns:
            The newly created state record

        Raises:
            TransitionValidationError: If transition validation fails
            StateManagerError: If transition execution fails
        """
        from .transitions import TransitionContext

        # Get current state information
        current_state_object = cls.get_current_state_object(entity)
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
            f'Executing declarative transition {transition.__class__.__name__} '
            f'for {entity._meta.label_lower} {entity.pk}: '
            f'{current_state} → {transition.target_state}'
        )

        try:
            # Execute the transition through the declarative system
            state_record = transition.execute(context)

            logger.info(
                f'Declarative transition successful: {entity._meta.label_lower} {entity.pk} '
                f'now in state {transition.target_state} (record ID: {state_record.id})'
            )

            return state_record

        except Exception as e:
            logger.error(
                f'Declarative transition failed for {entity._meta.label_lower} {entity.pk}: '
                f'{current_state} → {transition.target_state}: {e}'
            )
            raise


# Allow runtime configuration of which StateManager to use
# Enterprise can set this to their extended implementation
DEFAULT_STATE_MANAGER = StateManager


def get_state_manager() -> Type[StateManager]:
    """
    Get the configured state manager class.

    Returns the StateManager class to use. Enterprise can override
    this by setting a different class in their configuration.
    """
    # Check if enterprise has configured a custom state manager
    if hasattr(settings, 'FSM_STATE_MANAGER_CLASS'):
        manager_path = settings.FSM_STATE_MANAGER_CLASS
        module_name, class_name = manager_path.rsplit('.', 1)
        module = __import__(module_name, fromlist=[class_name])
        return getattr(module, class_name)

    return DEFAULT_STATE_MANAGER
