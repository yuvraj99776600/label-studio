"""
FSM Test Configuration.

Ensures proper test isolation for FSM tests.
"""

import pytest
from copy import deepcopy
from django.core.cache import cache


@pytest.fixture(autouse=True, scope="function")
def fsm_test_isolation():
    """
    Ensure test isolation by:
    1. Saving and restoring the transition registry
    2. Clearing CurrentContext and cache
    
    This prevents test leakage when tests clear the registry for their own purposes.
    """
    from core.current_request import CurrentContext
    from fsm.registry import transition_registry
    
    # Save original registry state
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
