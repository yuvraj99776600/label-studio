"""
FSM utility functions.

Core utilities used across the FSM system for organization resolution,
state retrieval, and UUID7 generation.
"""

import logging
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from core.current_request import CurrentContext
from core.feature_flags import flag_set
from django.db.models import UUIDField

logger = logging.getLogger(__name__)


# =============================================================================
# UUID7 Utilities
# =============================================================================


class UUID7Generator:
    """
    Generator for UUID7 (time-ordered UUIDs).

    UUID7 provides:
    - Natural time ordering for time-series data
    - Millisecond precision timestamps
    - Global uniqueness
    - Optimal for INSERT-only workloads
    """

    @staticmethod
    def generate() -> uuid.UUID:
        """Generate a new UUID7."""
        # Get current time in milliseconds
        timestamp_ms = int(time.time() * 1000)

        # UUID7 structure:
        # - 48 bits: timestamp in milliseconds
        # - 4 bits: version (7)
        # - 12 bits: random
        # - 2 bits: variant (10)
        # - 62 bits: random

        # Create timestamp bytes (48 bits = 6 bytes)
        timestamp_bytes = timestamp_ms.to_bytes(6, byteorder='big')

        # Generate random bytes for the rest
        random_bytes = secrets.token_bytes(10)

        # Combine: timestamp (6) + random (10) = 16 bytes
        uuid_bytes = timestamp_bytes + random_bytes

        # Create UUID and set version/variant bits
        uuid_int = int.from_bytes(uuid_bytes, byteorder='big')

        # Set version to 7 (0111 in binary)
        uuid_int = (uuid_int & ~(0xF << 76)) | (7 << 76)

        # Set variant to RFC 4122 (10 in binary)
        uuid_int = (uuid_int & ~(0x3 << 62)) | (0x2 << 62)

        return uuid.UUID(int=uuid_int)


def generate_uuid7() -> uuid.UUID:
    """
    Generate a new UUID7.

    Returns:
        A UUID7 instance with natural time ordering
    """
    return UUID7Generator.generate()


def timestamp_from_uuid7(uuid7: uuid.UUID) -> datetime:
    """
    Extract timestamp from a UUID7.

    Args:
        uuid7: A UUID7 instance

    Returns:
        Datetime object representing when the UUID was created
    """
    # Extract the first 48 bits (timestamp in milliseconds)
    uuid_int = uuid7.int
    timestamp_ms = uuid_int >> 80  # Shift right 80 bits to get the first 48 bits

    # Convert milliseconds to datetime
    timestamp_seconds = timestamp_ms / 1000.0
    return datetime.fromtimestamp(timestamp_seconds, tz=timezone.utc)


def uuid7_from_timestamp(dt: datetime) -> uuid.UUID:
    """
    Create a UUID7 from a specific timestamp.

    Args:
        dt: Datetime to encode in the UUID

    Returns:
        A UUID7 with the specified timestamp
    """
    # Convert datetime to milliseconds
    timestamp_ms = int(dt.timestamp() * 1000)

    # Create timestamp bytes
    timestamp_bytes = timestamp_ms.to_bytes(6, byteorder='big')

    # Generate random bytes for the rest
    random_bytes = secrets.token_bytes(10)

    # Combine
    uuid_bytes = timestamp_bytes + random_bytes
    uuid_int = int.from_bytes(uuid_bytes, byteorder='big')

    # Set version to 7
    uuid_int = (uuid_int & ~(0xF << 76)) | (7 << 76)

    # Set variant to RFC 4122
    uuid_int = (uuid_int & ~(0x3 << 62)) | (0x2 << 62)

    return uuid.UUID(int=uuid_int)


def uuid7_time_range(start_time: datetime, end_time: datetime) -> Tuple[uuid.UUID, uuid.UUID]:
    """
    Generate UUID7 range for time-based queries.

    Args:
        start_time: Start of time range
        end_time: End of time range

    Returns:
        Tuple of (start_uuid, end_uuid) for range queries
    """
    return uuid7_from_timestamp(start_time), uuid7_from_timestamp(end_time)


def validate_uuid7(uuid_value: uuid.UUID) -> bool:
    """
    Validate that a UUID is version 7.

    Args:
        uuid_value: UUID to validate

    Returns:
        True if the UUID is version 7
    """
    return uuid_value.version == 7


class UUID7Field(UUIDField):
    """
    Django model field for UUID7.

    Provides the same interface as Django's UUIDField but with
    UUID7 as the default value generator.
    """

    def __init__(self, *args, **kwargs):
        # Set default to generate_uuid7 if not provided
        if 'default' not in kwargs:
            kwargs['default'] = generate_uuid7
        super().__init__(*args, **kwargs)


# =============================================================================
# FSM Helper Functions
# =============================================================================


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
