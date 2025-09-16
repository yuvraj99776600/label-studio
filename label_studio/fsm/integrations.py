"""
FSM integrations for Label Studio core workflows.

This module provides basic state transition integrations for core Label Studio
entities (Project, Task, Annotation) with simplified workflows compared to
Label Studio Enterprise.

The integrations are designed to:
1. Provide essential state tracking for basic Label Studio workflows
2. Be disabled automatically when Label Studio Enterprise is present
3. Use the same feature flags as LSE to avoid conflicts
4. Provide basic audit trail and state history
"""

import logging
from typing import Optional

from core.feature_flags import flag_set
from django.contrib.auth.models import User
from fsm.state_manager import get_state_manager

logger = logging.getLogger(__name__)


def _resolve_organization_id(entity, user=None):
    """
    Resolve organization_id using the same logic as StateManager without additional queries.

    This mirrors the organization_id resolution logic from StateManager.transition_state()
    to provide consistent organization_id for logging without duplicating database queries.
    """
    # Try direct organization_id attribute first
    organization_id = getattr(entity, 'organization_id', None)

    # If entity doesn't have direct organization_id, try denormalized fields approach
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

    return organization_id


def is_enterprise_enabled() -> bool:
    """
    Check if Label Studio Enterprise is enabled/present.

    Returns True if enterprise features are available, which means
    this core integration should be disabled to avoid conflicts.
    """
    from django.conf import settings

    # Check if this is Enterprise edition via Django settings
    if getattr(settings, 'VERSION_EDITION', 'Community') != 'Community':
        return True

    # Additional check: if LSE FSM apps are present, consider it enterprise
    try:
        from django.apps import apps

        if apps.is_installed('lse_fsm'):
            return True
    except Exception:
        # If there's any issue checking for LSE apps, continue safely
        pass

    return False


def is_fsm_enabled(user: Optional[User] = None) -> bool:
    """
    Check if FSM is enabled via feature flags.

    Note: VERSION_EDITION check is handled at the app/signal level.

    Args:
        user: User for feature flag evaluation

    Returns:
        True if FSM should be active for core Label Studio
    """
    # Don't activate if enterprise is present (avoids conflicts with LSE FSM)
    if is_enterprise_enabled():
        return False

    return flag_set('fflag_feat_fit_568_finite_state_management', user=user)


def safe_state_transition(func):
    """
    Decorator to safely handle state transitions with error resilience.

    Ensures that FSM errors don't break core Label Studio functionality.
    """

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            # Try to extract entity and user from function arguments for organization_id resolution
            entity = args[0] if len(args) > 0 else None
            user = args[1] if len(args) > 1 else kwargs.get('user')
            organization_id = _resolve_organization_id(entity, user) if entity else None

            logger.error(
                'FSM: Error in integration function',
                extra={
                    'event': 'fsm.integration_function_error',
                    'function_name': func.__name__,
                    'entity_type': entity._meta.label_lower if entity and hasattr(entity, '_meta') else None,
                    'entity_id': getattr(entity, 'pk', None) if entity else None,
                    'organization_id': organization_id,
                    'error': str(e),
                },
                exc_info=True,
            )
            # Return False to indicate failure but don't raise
            return False

    return wrapper


# Project State Transitions
@safe_state_transition
def project_created(project, user: Optional[User] = None) -> bool:
    """
    Handle project creation state transition.

    Args:
        project: Project instance
        user: User who created the project

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import ProjectStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=project, new_state=ProjectStateChoices.CREATED, user=user, reason='Project created in Label Studio core'
    )


@safe_state_transition
def project_started(project, user: Optional[User] = None) -> bool:
    """
    Handle project started (first task or configuration completed).

    Args:
        project: Project instance
        user: User who started work on the project

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import ProjectStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=project, new_state=ProjectStateChoices.IN_PROGRESS, user=user, reason='Project work started'
    )


@safe_state_transition
def project_completed(project, user: Optional[User] = None) -> bool:
    """
    Handle project completion.

    Args:
        project: Project instance
        user: User who completed the project

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import ProjectStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=project, new_state=ProjectStateChoices.COMPLETED, user=user, reason='Project completed'
    )


# Task State Transitions
@safe_state_transition
def task_created(task, user: Optional[User] = None) -> bool:
    """
    Handle task creation state transition.

    Args:
        task: Task instance
        user: User who created the task

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import TaskStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=task, new_state=TaskStateChoices.CREATED, user=user, reason='Task created in Label Studio core'
    )


@safe_state_transition
def task_started(task, user: Optional[User] = None) -> bool:
    """
    Handle task work started (first annotation created).

    Args:
        task: Task instance
        user: User who started work on the task

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import TaskStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=task, new_state=TaskStateChoices.IN_PROGRESS, user=user, reason='Task annotation work started'
    )


@safe_state_transition
def task_completed(task, user: Optional[User] = None) -> bool:
    """
    Handle task completion.

    Args:
        task: Task instance
        user: User who completed the task

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import TaskStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=task, new_state=TaskStateChoices.COMPLETED, user=user, reason='Task completed'
    )


# Annotation State Transitions
@safe_state_transition
def annotation_submitted(annotation, user: Optional[User] = None) -> bool:
    """
    Handle annotation submission.

    Args:
        annotation: Annotation instance
        user: User who submitted the annotation

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import AnnotationStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=annotation,
        new_state=AnnotationStateChoices.SUBMITTED,
        user=user,
        reason='Annotation submitted in Label Studio core',
    )


@safe_state_transition
def annotation_completed(annotation, user: Optional[User] = None) -> bool:
    """
    Handle annotation completion.

    Args:
        annotation: Annotation instance
        user: User who completed the annotation

    Returns:
        True if transition was successful, False otherwise
    """
    if not is_fsm_enabled(user):
        return False

    from fsm.state_choices import AnnotationStateChoices

    state_manager = get_state_manager()
    return state_manager.transition_state(
        entity=annotation, new_state=AnnotationStateChoices.COMPLETED, user=user, reason='Annotation completed'
    )


# Utility Functions
def get_current_state_safe(entity):
    """
    Safely get the current state of an entity with error handling.

    Args:
        entity: Entity to get state for

    Returns:
        Current state string or None if no state/error
    """
    try:
        if not is_fsm_enabled():
            return None

        state_manager = get_state_manager()
        return state_manager.get_current_state_value(entity)
    except Exception as e:
        logger.error(
            'FSM: Error getting current state',
            extra={
                'event': 'fsm.get_state_error',
                'entity_type': entity._meta.label_lower if hasattr(entity, '_meta') else str(type(entity).__name__),
                'entity_id': getattr(entity, 'pk', None),
                'organization_id': _resolve_organization_id(entity),
                'error': str(e),
            },
        )
        return None
