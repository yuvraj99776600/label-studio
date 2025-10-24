"""
Tests for Project FSM integration using HsModel approach.

This test module verifies that the Project model correctly integrates
with the FSM system through the HsModel base class, replacing the
previous signal-based approach.
"""

from django.test import TestCase, override_settings
from fsm.state_manager import StateManager
from fsm.state_choices import ProjectStateChoices
from organizations.models import Organization
from projects.models import Project
from users.models import User


@override_settings(FSM_SIGNALS_ENABLED=False)  # Ensure signals are disabled
class TestProjectFSMIntegration(TestCase):
    """Test Project FSM integration via HsModel"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()

    def test_project_creation_triggers_fsm(self):
        """Test that creating a project triggers FSM transition"""
        # Create a project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

        # Verify FSM state was created
        state = StateManager.get_current_state_value(project)
        self.assertEqual(state, ProjectStateChoices.CREATED)

        # Verify state history exists
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].state, ProjectStateChoices.CREATED)
        self.assertEqual(history[0].transition_name, 'project_created')

    def test_project_settings_change_triggers_fsm(self):
        """Test that changing project settings triggers FSM transition"""
        # Create a project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            maximum_annotations=1
        )

        # Change a state-affecting setting
        project.maximum_annotations = 3
        project.save()

        # Verify FSM recorded the change
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 2)

        # First state should be CREATED
        self.assertEqual(history[1].state, ProjectStateChoices.CREATED)
        self.assertEqual(history[1].transition_name, 'project_created')

        # Second state should record the settings change
        self.assertEqual(history[0].transition_name, 'project_settings_changed')

        # Verify context data includes the change
        context_data = history[0].context_data
        self.assertIn('changed_settings', context_data)
        self.assertIn('maximum_annotations', context_data['changed_settings'])

    def test_project_non_state_change_no_fsm(self):
        """Test that non-state-affecting changes don't trigger FSM"""
        # Create a project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

        # Change a non-state-affecting field
        project.description = 'Updated description'
        project.save()

        # Verify only one FSM state exists (from creation)
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].transition_name, 'project_created')

    def test_skip_fsm_flag(self):
        """Test that skip_fsm flag prevents FSM transitions"""
        # Create a project with skip_fsm=True
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            skip_fsm=True  # Skip FSM processing
        )

        # Verify no FSM state was created
        state = StateManager.get_current_state_value(project)
        self.assertIsNone(state)

    def test_multiple_settings_changes(self):
        """Test that multiple setting changes are recorded properly"""
        # Create a project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            maximum_annotations=1,
            overlap_cohort_percentage=50
        )

        # Change multiple settings
        project.maximum_annotations = 3
        project.overlap_cohort_percentage = 75
        project.save()

        # Verify FSM recorded the changes
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 2)

        # Check that both fields are in changed_settings
        context_data = history[0].context_data
        changed_settings = context_data.get('changed_settings', {})
        self.assertIn('maximum_annotations', changed_settings)
        self.assertIn('overlap_cohort_percentage', changed_settings)

    def test_project_state_metadata(self):
        """Test that FSM state records include proper metadata"""
        # Create a project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

        # Get the state record
        state_record = StateManager.get_current_state_object(project)

        # Verify metadata
        self.assertEqual(state_record.state, ProjectStateChoices.CREATED)
        self.assertEqual(state_record.transition_name, 'project_created')
        self.assertEqual(state_record.triggered_by, self.user)
        self.assertEqual(state_record.organization_id, self.organization.id)

        # Verify context data
        self.assertIn('organization_id', state_record.context_data)
        self.assertIn('title', state_record.context_data)
        self.assertEqual(state_record.context_data['title'], 'Test Project')


class TestProjectFSMTransitions(TestCase):
    """Test specific Project FSM transitions"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()

    def test_project_created_transition_reason(self):
        """Test that project_created transition has correct reason"""
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

        state_record = StateManager.get_current_state_object(project)
        self.assertEqual(state_record.reason, 'Project created')

    def test_settings_changed_transition_includes_changed_fields(self):
        """Test that settings_changed transition records changed fields"""
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            maximum_annotations=1
        )

        # Change setting
        old_value = project.maximum_annotations
        project.maximum_annotations = 5
        project.save()

        # Get latest state
        history = StateManager.get_state_history(project, limit=1)
        state_record = history[0]

        # Verify changed fields are recorded
        changed_settings = state_record.context_data.get('changed_settings', {})
        self.assertIn('maximum_annotations', changed_settings)

        max_ann_change = changed_settings['maximum_annotations']
        self.assertEqual(max_ann_change['old'], old_value)
        self.assertEqual(max_ann_change['new'], 5)

    def test_project_published_transition(self):
        """Test that publishing a project triggers FSM transition"""
        # Create an unpublished project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            is_published=False
        )

        # Publish the project
        project.is_published = True
        project.save()

        # Verify FSM recorded the published transition
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 2)

        # Latest state should be PUBLISHED
        self.assertEqual(history[0].state, ProjectStateChoices.PUBLISHED)
        self.assertEqual(history[0].transition_name, 'project_published')
        self.assertEqual(history[0].reason, 'Project published to annotators')

    def test_project_unpublished_transition(self):
        """Test that unpublishing a project triggers FSM transition"""
        # Create a published project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            is_published=True
        )

        # Unpublish the project
        project.is_published = False
        project.save()

        # Verify FSM recorded the unpublished transition
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 2)

        # Latest state should be CREATED (no tasks) or IN_PROGRESS (with tasks)
        self.assertEqual(history[0].transition_name, 'project_unpublished')
        self.assertIn(history[0].reason, 'Project unpublished')

    def test_publish_unpublish_cycle(self):
        """Test publishing and unpublishing a project multiple times"""
        # Create project
        project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user,
            is_published=False
        )

        # Publish
        project.is_published = True
        project.save()

        # Unpublish
        project.is_published = False
        project.save()

        # Publish again
        project.is_published = True
        project.save()

        # Verify FSM recorded all transitions
        history = StateManager.get_state_history(project, limit=10)
        self.assertEqual(len(history), 4)

        # Check transition names in order (most recent first)
        self.assertEqual(history[0].transition_name, 'project_published')
        self.assertEqual(history[1].transition_name, 'project_unpublished')
        self.assertEqual(history[2].transition_name, 'project_published')
        self.assertEqual(history[3].transition_name, 'project_created')

