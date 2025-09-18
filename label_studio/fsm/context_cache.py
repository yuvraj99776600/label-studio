"""Context-aware caching for organization ID resolution across request/worker lifecycles."""

import contextvars
import functools
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Context variable to store organization cache across the entire request/worker context
_org_cache_context: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar(
    'fsm_org_cache', default=None
)


def get_context_cache() -> Optional[Dict[str, Any]]:
    """Get the current context cache if available."""
    return _org_cache_context.get()


def set_context_cache(cache: Dict[str, Any]) -> None:
    """Set the context cache for this request/worker."""
    _org_cache_context.set(cache)


def clear_context_cache() -> None:
    """Clear the context cache."""
    _org_cache_context.set(None)


def ensure_context_cache() -> Dict[str, Any]:
    """Ensure a context cache exists, creating one if needed."""
    cache = get_context_cache()
    if cache is None:
        cache = {}
        set_context_cache(cache)
    return cache


class FSMContextCache:
    """Context manager for FSM organization caching that spans multiple operations."""

    def __init__(self):
        self._previous_cache = None

    def __enter__(self):
        # Store any existing cache
        self._previous_cache = get_context_cache()
        # Set up new cache
        set_context_cache({})
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore previous cache state
        set_context_cache(self._previous_cache)
        return False


def with_fsm_cache(func):
    """
    Decorator that ensures FSM context cache is available for the decorated function.

    This is useful for top-level functions like API endpoints, signal handlers,
    or worker tasks that may trigger multiple FSM operations.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        existing_cache = get_context_cache()
        if existing_cache is not None:
            # Cache already exists, just call the function
            return func(*args, **kwargs)
        else:
            # No cache exists, create one for this operation
            with FSMContextCache():
                return func(*args, **kwargs)
    return wrapper


# Alias for worker functions
fsm_cache_worker = with_fsm_cache