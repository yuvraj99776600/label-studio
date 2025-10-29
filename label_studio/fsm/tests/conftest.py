"""
FSM Test Configuration.

Ensures proper test isolation for FSM tests.
"""

from copy import deepcopy

import pytest
from django.core.cache import cache
from fsm.registry import transition_registry


@pytest.fixture(autouse=True, scope='function')
def fsm_test_isolation():
    """
    Ensure test isolation by:
    1. Saving and restoring the transition registry
    2. Clearing CurrentContext and cache

    This prevents test leakage when tests clear the registry for their own purposes.
    """
    from core.current_request import CurrentContext

    original_transitions = deepcopy(transition_registry._transitions)

    # Clear context and cache before test
    CurrentContext.clear()
    cache.clear()

    yield

    # Restore registry state to prevent leakage
    transition_registry._transitions = original_transitions

    # Clear context and cache after test
    CurrentContext.clear()
    cache.clear()
