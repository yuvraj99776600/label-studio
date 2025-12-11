from unittest.mock import patch

import pytest
from django.contrib.auth.models import AnonymousUser

from label_studio.core.current_request import CurrentContext
from label_studio.core.feature_flags.base import flag_set
from label_studio.core.feature_flags.utils import get_user_repr_from_organization


def test_get_user_repr_from_organization_owner_email_and_org_id(django_user_model):
    # Create a minimal organization-like object
    class Org:
        def __init__(self, id, email):
            self.id = id

            class CreatedBy:
                def __init__(self, email):
                    self.email = email

            self.created_by = CreatedBy(email)

    org = Org(123, 'owner@example.com')

    ctx = get_user_repr_from_organization(org)

    assert ctx['key'] == 'owner@example.com'
    assert ctx['custom']['organization'] == 'owner@example.com'
    assert ctx['custom']['organization_id'] == 123


def test_flag_set_with_organization_context_env_override(monkeypatch, settings):
    # Ensure offline mode/env control for deterministic behavior
    settings.FEATURE_FLAGS_OFFLINE = True

    # Use env override path for flag resolution
    monkeypatch.setenv('fflag_feat_test_org_targeting', 'true')

    class Org:
        def __init__(self, id, email):
            self.id = id

            class CreatedBy:
                def __init__(self, email):
                    self.email = email

            self.created_by = CreatedBy(email)

    org = Org(42, 'owner@example.com')

    assert flag_set('fflag_feat_test_org_targeting', organization=org, override_system_default=False) is True

    # Unset env should fall back to override_system_default=False
    monkeypatch.delenv('fflag_feat_test_org_targeting', raising=False)
    assert flag_set('fflag_feat_test_org_targeting', organization=org, override_system_default=False) is False


@pytest.fixture
def clean_current_context():
    """Fixture to ensure CurrentContext is clean before and after tests."""
    CurrentContext.clear()
    yield
    CurrentContext.clear()


def test_flag_set_user_auto_with_authenticated_user_in_context(
    monkeypatch, settings, django_user_model, clean_current_context
):
    """Test that user='auto' gets user from CurrentContext.get_user() when authenticated.

    This test validates:
    - Creating an authenticated user and setting it in CurrentContext
    - Calling flag_set with user='auto'
    - Verifying the user from context is used for feature flag evaluation
    """
    settings.FEATURE_FLAGS_OFFLINE = True
    monkeypatch.setenv('fflag_test_auto_user', 'true')

    # Create an authenticated user and set in context
    user = django_user_model.objects.create_user(username='testuser', email='test@example.com', password='testpass')
    CurrentContext.set_user(user)

    # Mock get_user_repr to verify the correct user is passed
    with patch('label_studio.core.feature_flags.base.get_user_repr') as mock_get_user_repr:
        mock_get_user_repr.return_value = {'key': 'test@example.com'}
        flag_set('fflag_test_auto_user', user='auto')

        # Verify get_user_repr was called with the authenticated user, not AnonymousUser
        mock_get_user_repr.assert_called_once()
        called_user = mock_get_user_repr.call_args[0][0]
        assert called_user == user
        assert called_user.is_authenticated


def test_flag_set_user_auto_without_user_in_context(monkeypatch, settings, clean_current_context):
    """Test that user='auto' falls back to AnonymousUser when no user in context.

    This test validates:
    - CurrentContext has no user set
    - Calling flag_set with user='auto'
    - Verifying AnonymousUser is used for feature flag evaluation
    """
    settings.FEATURE_FLAGS_OFFLINE = True
    monkeypatch.setenv('fflag_test_auto_user_anon', 'true')

    # Ensure no user in context
    assert CurrentContext.get_user() is None

    # Mock get_user_repr to verify AnonymousUser is passed
    with patch('label_studio.core.feature_flags.base.get_user_repr') as mock_get_user_repr:
        mock_get_user_repr.return_value = {'key': 'anonymous'}
        flag_set('fflag_test_auto_user_anon', user='auto')

        # Verify get_user_repr was called with AnonymousUser
        mock_get_user_repr.assert_called_once()
        called_user = mock_get_user_repr.call_args[0][0]
        assert called_user == AnonymousUser


def test_flag_set_user_auto_with_unauthenticated_user_in_context(monkeypatch, settings, clean_current_context):
    """Test that user='auto' falls back to AnonymousUser when unauthenticated user in context.

    This test validates:
    - Setting an AnonymousUser in CurrentContext
    - Calling flag_set with user='auto'
    - Verifying AnonymousUser class is used (not the instance) for feature flag evaluation
    """
    settings.FEATURE_FLAGS_OFFLINE = True
    monkeypatch.setenv('fflag_test_auto_user_unauth', 'true')

    # Set an anonymous user in context
    anon_user = AnonymousUser()
    CurrentContext.set_user(anon_user)

    # Mock get_user_repr to verify AnonymousUser is passed
    with patch('label_studio.core.feature_flags.base.get_user_repr') as mock_get_user_repr:
        mock_get_user_repr.return_value = {'key': 'anonymous'}
        flag_set('fflag_test_auto_user_unauth', user='auto')

        # Verify get_user_repr was called with AnonymousUser class
        mock_get_user_repr.assert_called_once()
        called_user = mock_get_user_repr.call_args[0][0]
        assert called_user == AnonymousUser
