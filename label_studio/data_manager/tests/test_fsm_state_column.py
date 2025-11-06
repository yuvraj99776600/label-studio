"""
Tests for FSM State column in DataManager.

This test validates that the State column is only included in the DataManager
columns API when BOTH required feature flags are enabled:
1. fflag_feat_fit_568_finite_state_management - Controls FSM background calculations
2. fflag_feat_fit_710_fsm_state_fields - Controls state field display in APIs/UI
"""
from unittest.mock import patch

import pytest
from data_manager.functions import get_all_columns
from django.contrib.auth import get_user_model
from organizations.models import Organization
from projects.models import Project

User = get_user_model()


@pytest.mark.django_db
class TestFSMStateColumn:
    """Test FSM State column feature flag behavior in DataManager."""

    @pytest.fixture
    def project(self):
        """
        Create a test project for column testing.

        Returns a minimal project instance with required dependencies.
        """
        org = Organization.objects.create(title='Test Org')
        user = User.objects.create(username='test_user', email='test@test.com')
        project = Project.objects.create(title='Test Project', organization=org, created_by=user)
        return project

    def _get_column_ids(self, project):
        """
        Helper to get all column IDs from get_all_columns.

        Args:
            project: Project instance

        Returns:
            List of column IDs
        """
        data = get_all_columns(project)
        return [col['id'] for col in data['columns']]

    def test_state_column_present_when_both_flags_enabled(self, project):
        """
        Test that State column appears when BOTH feature flags are enabled.

        This validates the correct behavior:
        - fflag_feat_fit_568_finite_state_management = True
        - fflag_feat_fit_710_fsm_state_fields = True
        - Expected: State column is present in columns list
        """
        with patch('data_manager.functions.flag_set') as mock_flag_set:
            # Both flags return True
            mock_flag_set.return_value = True

            column_ids = self._get_column_ids(project)

            assert 'state' in column_ids, 'State column should be present when both flags are enabled'

    def test_state_column_absent_when_only_fsm_enabled(self, project):
        """
        Test that State column is ABSENT when only the FSM flag is enabled.

        This is the bug scenario that was reported:
        - fflag_feat_fit_568_finite_state_management = True
        - fflag_feat_fit_710_fsm_state_fields = False
        - Expected: State column should NOT be present (was showing empty before fix)

        Critical validation: This ensures the column definition matches the
        serializer field behavior, preventing empty State columns in the UI.
        """

        def flag_set_side_effect(flag_name, **kwargs):
            if flag_name == 'fflag_feat_fit_568_finite_state_management':
                return True
            elif flag_name == 'fflag_feat_fit_710_fsm_state_fields':
                return False
            # Default for other flags (like the members schema flag)
            return False

        with patch('data_manager.functions.flag_set', side_effect=flag_set_side_effect):
            column_ids = self._get_column_ids(project)

            assert 'state' not in column_ids, (
                'State column should NOT be present when only FSM flag is enabled. '
                'This was the bug: column shown but empty because serializer checks both flags.'
            )

    def test_state_column_absent_when_only_state_fields_enabled(self, project):
        """
        Test that State column is ABSENT when only the state fields flag is enabled.

        This validates:
        - fflag_feat_fit_568_finite_state_management = False
        - fflag_feat_fit_710_fsm_state_fields = True
        - Expected: State column should NOT be present

        Rationale: Without FSM calculations enabled, there's no state data to display.
        """

        def flag_set_side_effect(flag_name, **kwargs):
            if flag_name == 'fflag_feat_fit_568_finite_state_management':
                return False
            elif flag_name == 'fflag_feat_fit_710_fsm_state_fields':
                return True
            return False

        with patch('data_manager.functions.flag_set', side_effect=flag_set_side_effect):
            column_ids = self._get_column_ids(project)

            assert (
                'state' not in column_ids
            ), 'State column should NOT be present when only state fields flag is enabled'

    def test_state_column_absent_when_both_flags_disabled(self, project):
        """
        Test that State column is ABSENT when both feature flags are disabled.

        This validates the default behavior:
        - fflag_feat_fit_568_finite_state_management = False
        - fflag_feat_fit_710_fsm_state_fields = False
        - Expected: State column should NOT be present
        """
        with patch('data_manager.functions.flag_set') as mock_flag_set:
            # Both flags return False
            mock_flag_set.return_value = False

            column_ids = self._get_column_ids(project)

            assert 'state' not in column_ids, 'State column should NOT be present when both flags are disabled'

    def test_state_column_has_correct_properties_when_enabled(self, project):
        """
        Test that State column has correct properties when enabled.

        This validates the column definition structure:
        - Column ID is 'state'
        - Type is 'String'
        - Has proper help text
        - Has visibility defaults set correctly
        """
        with patch('data_manager.functions.flag_set') as mock_flag_set:
            # Both flags return True
            mock_flag_set.return_value = True

            data = get_all_columns(project)
            state_column = next((col for col in data['columns'] if col['id'] == 'state'), None)

            assert state_column is not None, 'State column should exist'
            assert state_column['type'] == 'String', 'State column should be of type String'
            assert state_column['title'] == 'State', 'State column should have correct title'
            assert state_column['target'] == 'tasks', 'State column should target tasks'
            assert 'help' in state_column, 'State column should have help text'
            assert 'visibility_defaults' in state_column, 'State column should have visibility defaults'
            assert state_column['project_defined'] is False, 'State column should not be project_defined'
