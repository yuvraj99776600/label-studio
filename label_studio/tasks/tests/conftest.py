"""Pytest fixtures for tasks tests."""
from unittest import mock

import pytest


@pytest.fixture(name='fflag_fix_all_fit_720_lazy_load_annotations_on')
def fflag_fix_all_fit_720_lazy_load_annotations_on():
    """Enable the lazy load annotations feature flag (FIT-720)."""
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'fflag_fix_all_fit_720_lazy_load_annotations':
            return True
        return flag_set(*args, **kwargs)

    with mock.patch('tasks.api.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='fflag_fix_all_fit_720_lazy_load_annotations_off')
def fflag_fix_all_fit_720_lazy_load_annotations_off():
    """Disable the lazy load annotations feature flag (FIT-720)."""
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'fflag_fix_all_fit_720_lazy_load_annotations':
            return False
        return flag_set(*args, **kwargs)

    with mock.patch('tasks.api.flag_set', wraps=fake_flag_set):
        yield
