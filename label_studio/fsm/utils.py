"""
FSM utility functions.

Core utilities used across the FSM system for organization resolution
and state retrieval.
"""

import logging
from typing import Optional

from core.current_request import CurrentContext
from core.feature_flags import flag_set

logger = logging.getLogger(__name__)


def resolve_organization_id(entity=None, user=None):
    """
    Resolve organization_id using consistent logic without additional queries.

    This provides organization_id resolution for logging and state tracking
    without duplicating database queries.

    Args:
        entity: The entity to resolve organization_id for
        user: Optional user for fallback organization resolution

    Returns:
        organization_id or None
    """
    # Try context cache first
    organization_id = CurrentContext.get_organization_id()
    if organization_id:
        return organization_id

    # Allow for function calls without entity
    if entity is None:
        return None

    # Try direct organization_id attribute first
    organization_id = getattr(entity, 'organization_id', None)

    # If entity doesn't have direct organization_id, try relationships
    if not organization_id:
        # For entities with project relationship (most common case)
        if hasattr(entity, 'project') and entity.project:
            organization_id = getattr(entity.project, 'organization_id', None)
        # For entities with task.project relationship
        elif hasattr(entity, 'task') and entity.task and hasattr(entity.task, 'project') and entity.task.project:
            organization_id = getattr(entity.task.project, 'organization_id', None)

    # Fallback to user's active organization
    if not organization_id and user and hasattr(user, 'active_organization') and user.active_organization:
        organization_id = user.active_organization.id

    # Cache the result in current context if we found an organization_id
    if organization_id is not None:
        CurrentContext.set_organization_id(organization_id)

    return organization_id


def is_fsm_enabled(user=None) -> bool:
    """
    Check if FSM is enabled via feature flags.

    Args:
        user: User for feature flag evaluation (optional)

    Returns:
        True if FSM should be active
    """
    return flag_set('fflag_feat_fit_568_finite_state_management', user=user)


def get_current_state_safe(entity, user=None) -> Optional[str]:
    """
    Safely get current state with error handling.

    Args:
        entity: The entity to get state for
        user: The user making the request (for feature flag checking)

    Returns:
        Current state string or None if failed
    """
    if not is_fsm_enabled(user):
        return None

    try:
        from fsm.state_manager import get_state_manager

        StateManager = get_state_manager()
        return StateManager.get_current_state_value(entity)
    except Exception as e:
        logger.warning(
            f'Failed to get current state for {entity._meta.label_lower} {entity.pk}: {str(e)}',
            extra={
                'event': 'fsm.get_state_error',
                'entity_type': entity._meta.label_lower,
                'entity_id': entity.pk,
                'organization_id': resolve_organization_id(entity, user),
                'error': str(e),
            },
        )
        return None
