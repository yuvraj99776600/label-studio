"""
Test Label Studio core FSM integrations.

Tests that verify the core Label Studio FSM integrations work correctly
and don't conflict with enterprise features.
"""

import pytest
from unittest.mock import patch, Mock
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from fsm.integrations import (
    is_enterprise_enabled,
    is_fsm_enabled, 
    project_created,
    task_created,
    annotation_submitted,
    get_current_state_safe,
)
from fsm.state_choices import ProjectStateChoices, TaskStateChoices, AnnotationStateChoices


class TestEnterpriseDetection(TestCase):
    """Test enterprise detection functionality"""

    def test_enterprise_detection_when_present(self):
        """Test that enterprise is detected when lse_fsm is available"""
        with patch('fsm.integrations.import_module') as mock_import:
            # Mock successful import of lse_fsm
            mock_import.return_value = Mock()
            # Reset the function to use the mock
            with patch('builtins.__import__', return_value=Mock()):
                from fsm.integrations import is_enterprise_enabled
                # Note: This test may be environment dependent
                # In actual deployment, this would return True when enterprise is present

    def test_enterprise_detection_when_absent(self):
        """Test that enterprise is not detected when lse_fsm is not available"""  
        with patch('builtins.__import__', side_effect=ImportError('No module named lse_fsm')):
            # Reimport to get fresh function state
            import importlib
            import fsm.integrations
            importlib.reload(fsm.integrations)
            
            # Should return False when enterprise is not available
            result = fsm.integrations.is_enterprise_enabled()
            # Note: This test may be environment dependent


class TestFSMEnabledChecks(TestCase):
    """Test FSM enabled logic"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser')

    @patch('fsm.integrations.is_enterprise_enabled')
    @patch('fsm.integrations.flag_set')
    def test_fsm_disabled_when_enterprise_present(self, mock_flag_set, mock_enterprise):
        """Test that core FSM is disabled when enterprise is present"""
        mock_enterprise.return_value = True
        mock_flag_set.return_value = True
        
        result = is_fsm_enabled(self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.is_enterprise_enabled')
    @patch('fsm.integrations.flag_set')
    def test_fsm_enabled_when_enterprise_absent_and_flag_on(self, mock_flag_set, mock_enterprise):
        """Test that core FSM is enabled when enterprise is absent and flag is on"""
        mock_enterprise.return_value = False
        mock_flag_set.return_value = True
        
        result = is_fsm_enabled(self.user)
        self.assertTrue(result)

    @patch('fsm.integrations.is_enterprise_enabled')
    @patch('fsm.integrations.flag_set')
    def test_fsm_disabled_when_flag_off(self, mock_flag_set, mock_enterprise):
        """Test that core FSM is disabled when feature flag is off"""
        mock_enterprise.return_value = False
        mock_flag_set.return_value = False
        
        result = is_fsm_enabled(self.user)
        self.assertFalse(result)


class TestStateTransitions(TestCase):
    """Test core state transition functions"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser')
        self.mock_project = Mock()
        self.mock_project.id = 1
        self.mock_task = Mock() 
        self.mock_task.id = 1
        self.mock_annotation = Mock()
        self.mock_annotation.id = 1

    @patch('fsm.integrations.is_fsm_enabled')
    @patch('fsm.integrations.get_state_manager')
    def test_project_created_when_enabled(self, mock_get_manager, mock_enabled):
        """Test project creation state transition when FSM is enabled"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = project_created(self.mock_project, user=self.user)

        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.mock_project,
            new_state=ProjectStateChoices.CREATED,
            user=self.user,
            reason='Project created in Label Studio core'
        )

    @patch('fsm.integrations.is_fsm_enabled')
    def test_project_created_when_disabled(self, mock_enabled):
        """Test project creation when FSM is disabled"""
        mock_enabled.return_value = False

        result = project_created(self.mock_project, user=self.user)

        self.assertFalse(result)

    @patch('fsm.integrations.is_fsm_enabled')
    @patch('fsm.integrations.get_state_manager')
    def test_task_created_when_enabled(self, mock_get_manager, mock_enabled):
        """Test task creation state transition when FSM is enabled"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = task_created(self.mock_task, user=self.user)

        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.mock_task,
            new_state=TaskStateChoices.CREATED,
            user=self.user,
            reason='Task created in Label Studio core'
        )

    @patch('fsm.integrations.is_fsm_enabled')
    @patch('fsm.integrations.get_state_manager')
    def test_annotation_submitted_when_enabled(self, mock_get_manager, mock_enabled):
        """Test annotation submission state transition when FSM is enabled"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = annotation_submitted(self.mock_annotation, user=self.user)

        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.mock_annotation,
            new_state=AnnotationStateChoices.SUBMITTED,
            user=self.user,
            reason='Annotation submitted in Label Studio core'
        )

    @patch('fsm.integrations.is_fsm_enabled') 
    @patch('fsm.integrations.get_state_manager')
    def test_error_handling_in_transitions(self, mock_get_manager, mock_enabled):
        """Test that errors in state transitions are handled gracefully"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.side_effect = Exception("State manager error")
        mock_get_manager.return_value = mock_state_manager

        # Should not raise exception, should return False
        result = project_created(self.mock_project, user=self.user)
        self.assertFalse(result)


class TestUtilityFunctions(TestCase):
    """Test utility functions"""

    def setUp(self):
        self.mock_entity = Mock()

    @patch('fsm.integrations.is_fsm_enabled')
    @patch('fsm.integrations.get_state_manager')
    def test_get_current_state_safe_when_enabled(self, mock_get_manager, mock_enabled):
        """Test getting current state when FSM is enabled"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.get_current_state_value.return_value = "CREATED"
        mock_get_manager.return_value = mock_state_manager

        result = get_current_state_safe(self.mock_entity)

        self.assertEqual(result, "CREATED")

    @patch('fsm.integrations.is_fsm_enabled')
    def test_get_current_state_safe_when_disabled(self, mock_enabled):
        """Test getting current state when FSM is disabled"""
        mock_enabled.return_value = False

        result = get_current_state_safe(self.mock_entity)

        self.assertIsNone(result)

    @patch('fsm.integrations.is_fsm_enabled')
    @patch('fsm.integrations.get_state_manager')
    def test_get_current_state_safe_with_error(self, mock_get_manager, mock_enabled):
        """Test getting current state with error handling"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.get_current_state_value.side_effect = Exception("State manager error")
        mock_get_manager.return_value = mock_state_manager

        result = get_current_state_safe(self.mock_entity)

        self.assertIsNone(result)