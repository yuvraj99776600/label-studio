"""Pytest fixtures for tasks tests."""
import os

import pytest


@pytest.fixture(name='fflag_fix_all_fit_720_lazy_load_annotations_on')
def fflag_fix_all_fit_720_lazy_load_annotations_on():
    """Enable the lazy load annotations feature flag (FIT-720).

    Uses environment variable approach which flag_set() checks first,
    making this more reliable than mocking.
    """
    env_var = 'fflag_fix_all_fit_720_lazy_load_annotations'
    old_value = os.environ.get(env_var)
    os.environ[env_var] = '1'
    yield
    if old_value is None:
        os.environ.pop(env_var, None)
    else:
        os.environ[env_var] = old_value


@pytest.fixture(name='fflag_fix_all_fit_720_lazy_load_annotations_off')
def fflag_fix_all_fit_720_lazy_load_annotations_off():
    """Disable the lazy load annotations feature flag (FIT-720).

    Uses environment variable approach which flag_set() checks first,
    making this more reliable than mocking.
    """
    env_var = 'fflag_fix_all_fit_720_lazy_load_annotations'
    old_value = os.environ.get(env_var)
    os.environ[env_var] = '0'
    yield
    if old_value is None:
        os.environ.pop(env_var, None)
    else:
        os.environ[env_var] = old_value
