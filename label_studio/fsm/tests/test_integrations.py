"""
Test Label Studio core FSM integrations.

Tests that verify the core Label Studio FSM integrations work correctly
and don't conflict with enterprise features.
"""

from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

User = get_user_model()
from fsm.integrations import (
    annotation_completed,
    annotation_submitted,
    get_current_state_safe,
    is_enterprise_enabled,
    is_fsm_enabled,
    project_completed,
    project_created,
    project_started,
    task_completed,
    task_created,
    task_started,
)
from fsm.state_choices import AnnotationStateChoices, ProjectStateChoices, TaskStateChoices
from projects.tests.factories import ProjectFactory
from tasks.tests.factories import AnnotationFactory, TaskFactory
from users.tests.factories import UserFactory


class TestEnterpriseDetection(TestCase):
    """Test enterprise detection functionality"""

    @override_settings(VERSION_EDITION='Enterprise')
    def test_enterprise_detection_when_present(self):
        """Test that enterprise is detected when VERSION_EDITION is not 'Community'"""
        result = is_enterprise_enabled()
        self.assertTrue(result)

    @override_settings(VERSION_EDITION='Community')
    def test_enterprise_detection_when_absent(self):
        """Test that enterprise is not detected when VERSION_EDITION is 'Community'"""
        result = is_enterprise_enabled()
        self.assertFalse(result)

    def test_enterprise_detection_default(self):
        """Test that enterprise detection defaults to Community when VERSION_EDITION is not set"""
        with patch('fsm.integrations.getattr') as mock_getattr:
            # Mock getattr to return 'Community' as default
            mock_getattr.return_value = 'Community'
            result = is_enterprise_enabled()
            self.assertFalse(result)


class TestFSMEnabledChecks(TestCase):
    """Test FSM enabled logic"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com')

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
        self.user = User.objects.create_user(username='testuser', email='test@example.com')
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
            reason='Project created in Label Studio core',
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
            reason='Task created in Label Studio core',
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
            reason='Annotation submitted in Label Studio core',
        )

    @patch('fsm.integrations.is_fsm_enabled')
    @patch('fsm.integrations.get_state_manager')
    def test_error_handling_in_transitions(self, mock_get_manager, mock_enabled):
        """Test that errors in state transitions are handled gracefully"""
        mock_enabled.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.side_effect = Exception('State manager error')
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
        mock_state_manager.get_current_state_value.return_value = 'CREATED'
        mock_get_manager.return_value = mock_state_manager

        result = get_current_state_safe(self.mock_entity)

        self.assertEqual(result, 'CREATED')

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
        mock_state_manager.get_current_state_value.side_effect = Exception('State manager error')
        mock_get_manager.return_value = mock_state_manager

        result = get_current_state_safe(self.mock_entity)

        self.assertIsNone(result)


class TestAdditionalIntegrations(TestCase):
    """Test additional integration functions for comprehensive coverage."""

    def setUp(self):
        self.user = UserFactory(email='test@example.com')
        self.project = ProjectFactory(created_by=self.user)
        self.task = TaskFactory(project=self.project)
        self.annotation = AnnotationFactory(task=self.task, completed_by=self.user, result=[])

    @patch('fsm.integrations.flag_set')
    def test_project_started_when_disabled(self, mock_flag):
        """Test project_started when FSM is disabled."""
        mock_flag.return_value = False
        result = project_started(self.project, self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_project_started_when_enabled(self, mock_get_manager, mock_flag):
        """Test project_started when FSM is enabled."""
        mock_flag.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = project_started(self.project, self.user)
        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.project,
            new_state=ProjectStateChoices.IN_PROGRESS,
            user=self.user,
            reason='Project work started',
        )

    @patch('fsm.integrations.flag_set')
    def test_project_completed_when_disabled(self, mock_flag):
        """Test project_completed when FSM is disabled."""
        mock_flag.return_value = False
        result = project_completed(self.project, self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_project_completed_when_enabled(self, mock_get_manager, mock_flag):
        """Test project_completed when FSM is enabled."""
        mock_flag.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = project_completed(self.project, self.user)
        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.project,
            new_state=ProjectStateChoices.COMPLETED,
            user=self.user,
            reason='Project completed',
        )

    @patch('fsm.integrations.flag_set')
    def test_task_started_when_disabled(self, mock_flag):
        """Test task_started when FSM is disabled."""
        mock_flag.return_value = False
        result = task_started(self.task, self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_task_started_when_enabled(self, mock_get_manager, mock_flag):
        """Test task_started when FSM is enabled."""
        mock_flag.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = task_started(self.task, self.user)
        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.task,
            new_state=TaskStateChoices.IN_PROGRESS,
            user=self.user,
            reason='Task annotation work started',
        )

    @patch('fsm.integrations.flag_set')
    def test_task_completed_when_disabled(self, mock_flag):
        """Test task_completed when FSM is disabled."""
        mock_flag.return_value = False
        result = task_completed(self.task, self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_task_completed_when_enabled(self, mock_get_manager, mock_flag):
        """Test task_completed when FSM is enabled."""
        mock_flag.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = task_completed(self.task, self.user)
        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.task,
            new_state=TaskStateChoices.COMPLETED,
            user=self.user,
            reason='Task completed',
        )

    @patch('fsm.integrations.flag_set')
    def test_annotation_completed_when_disabled(self, mock_flag):
        """Test annotation_completed when FSM is disabled."""
        mock_flag.return_value = False
        result = annotation_completed(self.annotation, self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_annotation_completed_when_enabled(self, mock_get_manager, mock_flag):
        """Test annotation_completed when FSM is enabled."""
        mock_flag.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.transition_state.return_value = True
        mock_get_manager.return_value = mock_state_manager

        result = annotation_completed(self.annotation, self.user)
        self.assertTrue(result)
        mock_state_manager.transition_state.assert_called_once_with(
            entity=self.annotation,
            new_state=AnnotationStateChoices.COMPLETED,
            user=self.user,
            reason='Annotation completed',
        )

    @patch('fsm.integrations.flag_set')
    def test_get_current_state_safe_when_disabled_direct(self, mock_flag):
        """Test get_current_state_safe when FSM is disabled."""
        mock_flag.return_value = False
        result = get_current_state_safe(self.task)
        self.assertIsNone(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_get_current_state_safe_when_enabled_with_state(self, mock_get_manager, mock_flag):
        """Test get_current_state_safe when FSM is enabled and entity has state."""
        mock_flag.return_value = True
        mock_state_manager = Mock()
        mock_state_manager.get_current_state_value.return_value = 'CREATED'
        mock_get_manager.return_value = mock_state_manager

        result = get_current_state_safe(self.task)
        self.assertEqual(result, 'CREATED')

    @patch('fsm.integrations.get_state_manager')
    def test_safe_state_transition_decorator_with_error(self, mock_get_manager):
        """Test that safe_state_transition decorator handles errors properly."""
        mock_state_manager = Mock()
        mock_state_manager.transition_state.side_effect = Exception('Database error')
        mock_get_manager.return_value = mock_state_manager

        # This should not raise an exception, but return False
        with patch('fsm.integrations.flag_set', return_value=True):
            result = project_created(self.project, self.user)
            self.assertFalse(result)

    def test_is_enterprise_enabled_when_community_alternative(self):
        """Test enterprise detection when community version."""
        with patch('fsm.integrations.getattr') as mock_getattr:
            mock_getattr.return_value = 'Community'
            result = is_enterprise_enabled()
            self.assertFalse(result)

    def test_is_enterprise_enabled_when_enterprise_alternative(self):
        """Test enterprise detection when enterprise version."""
        with patch('fsm.integrations.getattr') as mock_getattr:
            mock_getattr.return_value = 'Enterprise'
            result = is_enterprise_enabled()
            self.assertTrue(result)

    @patch('fsm.integrations.is_enterprise_enabled')
    @patch('fsm.integrations.flag_set')
    def test_is_fsm_enabled_when_enterprise_present_alternative(self, mock_flag, mock_enterprise):
        """Test is_fsm_enabled when enterprise is present."""
        mock_enterprise.return_value = True
        mock_flag.return_value = True

        result = is_fsm_enabled(self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.is_enterprise_enabled')
    @patch('fsm.integrations.flag_set')
    def test_is_fsm_enabled_when_enterprise_absent_flag_on_alternative(self, mock_flag, mock_enterprise):
        """Test is_fsm_enabled when enterprise absent and flag on."""
        mock_enterprise.return_value = False
        mock_flag.return_value = True

        result = is_fsm_enabled(self.user)
        self.assertTrue(result)

    @patch('fsm.integrations.is_enterprise_enabled')
    @patch('fsm.integrations.flag_set')
    def test_is_fsm_enabled_when_enterprise_absent_flag_off_alternative(self, mock_flag, mock_enterprise):
        """Test is_fsm_enabled when enterprise absent and flag off."""
        mock_enterprise.return_value = False
        mock_flag.return_value = False

        result = is_fsm_enabled(self.user)
        self.assertFalse(result)

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_task_created_disabled_with_fsm_check(self, mock_get_manager, mock_flag):
        """Test task_created when FSM is disabled (covers specific return path)."""
        mock_flag.return_value = False

        result = task_created(self.task, self.user)
        self.assertFalse(result)
        # get_state_manager should not be called
        mock_get_manager.assert_not_called()

    @patch('fsm.integrations.flag_set')
    @patch('fsm.integrations.get_state_manager')
    def test_annotation_submitted_disabled_with_fsm_check(self, mock_get_manager, mock_flag):
        """Test annotation_submitted when FSM is disabled (covers specific return path)."""
        mock_flag.return_value = False

        result = annotation_submitted(self.annotation, self.user)
        self.assertFalse(result)
        # get_state_manager should not be called
        mock_get_manager.assert_not_called()
