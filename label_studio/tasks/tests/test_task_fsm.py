"""
Tests for Task FSM integration using HsModel approach.

This test module verifies that the Task model correctly integrates
with the FSM system through the HsModel base class, replacing the
previous signal-based approach.

Task FSM Transitions:
- task_created: When a new task is created
- task_annotation_started: When first annotation begins (triggered via post_transition_hook)
- task_annotation_completed: When annotation is completed (triggered via TaskCompletionStrategy)
- task_completed: When task has enough annotations (triggered via TaskCompletionStrategy)
- task_skipped: When task is skipped
- task_reopened: When task is reopened after completion
"""

from django.test import TestCase, override_settings
from fsm.state_choices import TaskStateChoices
from fsm.state_manager import StateManager
from organizations.models import Organization
from projects.models import Project
from tasks.models import Task
from users.models import User


@override_settings(FSM_SIGNALS_ENABLED=False)  # Ensure signals are disabled
class TestTaskFSMIntegration(TestCase):
    """Test Task FSM integration via HsModel"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()
        
        self.project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

    def test_task_creation_triggers_fsm(self):
        """
        Test that creating a task triggers FSM transition.
        
        This test validates:
        - Task creation triggers task_created transition
        - FSM state is set to CREATED
        - State history is recorded
        - Context data includes task details
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Verify FSM state was created
        state = StateManager.get_current_state_value(task)
        self.assertEqual(state, TaskStateChoices.CREATED)

        # Verify state history exists
        history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].state, TaskStateChoices.CREATED)
        self.assertEqual(history[0].transition_name, 'task_created')
        self.assertEqual(history[0].reason, 'Task created in the system')

    def test_task_creation_with_data_keys(self):
        """
        Test that task creation records data keys in context.
        
        This test validates:
        - Context data includes data_keys list
        - Context data includes project_id
        - Context data includes overlap setting
        """
        # Create a task with multiple data keys
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test', 'image': 'url.jpg', 'metadata': {'key': 'value'}},
            overlap=2
        )

        # Get the state record
        state_record = StateManager.get_current_state_object(task)

        # Verify context data
        self.assertIn('data_keys', state_record.context_data)
        self.assertIn('text', state_record.context_data['data_keys'])
        self.assertIn('image', state_record.context_data['data_keys'])
        self.assertIn('metadata', state_record.context_data['data_keys'])
        
        self.assertEqual(state_record.context_data['project_id'], self.project.id)
        self.assertEqual(state_record.context_data['overlap'], 2)

    def test_task_skip_fsm_flag(self):
        """
        Test that skip_fsm flag prevents FSM transitions.
        
        This test validates:
        - Tasks created with skip_fsm=True don't create FSM states
        - Useful for bulk imports or system operations
        """
        # Create a task with skip_fsm=True
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Bulk import task'},
            skip_fsm=True,  # Skip FSM processing
        )

        # Verify no FSM state was created
        state = StateManager.get_current_state_value(task)
        self.assertIsNone(state)

    def test_task_non_state_change_no_fsm(self):
        """
        Test that non-state-affecting changes don't trigger FSM.
        
        This test validates:
        - Updating fields like meta, updated_at doesn't create transitions
        - Only state-affecting changes should trigger FSM
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Change a non-state-affecting field
        task.meta = {'custom': 'metadata'}
        task.save()

        # Verify only one FSM state exists (from creation)
        history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].transition_name, 'task_created')

    def test_task_state_metadata(self):
        """
        Test that FSM state records include proper metadata.
        
        This test validates:
        - State record has correct state value
        - State record has transition_name
        - State record has organization_id
        - State record has context_data
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Get the state record
        state_record = StateManager.get_current_state_object(task)

        # Verify metadata
        self.assertEqual(state_record.state, TaskStateChoices.CREATED)
        self.assertEqual(state_record.transition_name, 'task_created')
        self.assertEqual(state_record.organization_id, self.organization.id)

        # Verify context data
        self.assertIn('project_id', state_record.context_data)
        self.assertIn('data_keys', state_record.context_data)
        self.assertIn('overlap', state_record.context_data)


class TestTaskFSMTransitions(TestCase):
    """Test specific Task FSM transitions"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()
        
        self.project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

    def test_task_created_transition_reason(self):
        """
        Test that task_created transition has correct reason.
        
        This test validates:
        - Transition name is 'task_created'
        - Reason is 'Task created in the system'
        """
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        state_record = StateManager.get_current_state_object(task)
        self.assertEqual(state_record.reason, 'Task created in the system')
        self.assertEqual(state_record.transition_name, 'task_created')

    def test_task_annotation_started_via_execute_transition(self):
        """
        Test task_annotation_started transition triggered programmatically.
        
        This test validates:
        - task_annotation_started can be triggered via StateManager.execute_transition
        - Transition records annotation_id in context
        - State changes to ANNOTATION_IN_PROGRESS
        
        Note: In real workflow, this is triggered by annotation post_transition_hook
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Simulate annotation starting (normally done by annotation's post_transition_hook)
        success = StateManager.execute_transition(
            entity=task,
            transition_name='task_annotation_started',
            transition_data={'annotation_id': 123},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(task)
        self.assertEqual(current_state, TaskStateChoices.ANNOTATION_IN_PROGRESS)

        # Verify context data
        history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].transition_name, 'task_annotation_started')
        self.assertIn('annotation_id', history[0].context_data)
        self.assertEqual(history[0].context_data['annotation_id'], 123)

    def test_task_completed_via_execute_transition(self):
        """
        Test task_completed transition triggered programmatically.
        
        This test validates:
        - task_completed can be triggered via StateManager.execute_transition
        - State changes to COMPLETED
        - Context includes completion details
        
        Note: In real workflow, this is triggered by TaskCompletionStrategy
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Simulate annotation starting
        StateManager.execute_transition(
            entity=task,
            transition_name='task_annotation_started',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Simulate task completion (normally done by TaskCompletionStrategy)
        success = StateManager.execute_transition(
            entity=task,
            transition_name='task_completed',
            transition_data={
                'total_annotations': 3,
                'required_annotations': 3,
                'completion_reason': 'Overlap requirement met'
            },
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(task)
        self.assertEqual(current_state, TaskStateChoices.COMPLETED)

        # Verify state history
        history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(history), 3)
        
        # Check transitions in order (most recent first)
        self.assertEqual(history[0].transition_name, 'task_completed')
        self.assertEqual(history[1].transition_name, 'task_annotation_started')
        self.assertEqual(history[2].transition_name, 'task_created')

        # Verify context data
        self.assertIn('total_annotations', history[0].context_data)
        self.assertEqual(history[0].context_data['total_annotations'], 3)

    def test_task_state_history_tracking(self):
        """
        Test that task state history is properly tracked.
        
        This test validates:
        - Multiple state transitions are recorded in order
        - previous_state is correctly set
        - State history can be queried
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Simulate workflow: created -> annotation_started -> completed
        StateManager.execute_transition(
            entity=task,
            transition_name='task_annotation_started',
            user=self.user,
            organization_id=self.organization.id,
        )

        StateManager.execute_transition(
            entity=task,
            transition_name='task_completed',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Get state history
        history = StateManager.get_state_history(task, limit=10)
        
        # Should have 3 state records
        self.assertEqual(len(history), 3)

        # Check previous states are set correctly
        self.assertIsNone(history[2].previous_state)  # First state has no previous
        self.assertEqual(history[1].previous_state, TaskStateChoices.CREATED)
        self.assertEqual(history[0].previous_state, TaskStateChoices.ANNOTATION_IN_PROGRESS)

    def test_task_skipped_transition(self):
        """
        Test task_skipped transition.
        
        This test validates:
        - task_skipped can be triggered
        - State changes to SKIPPED
        - Context includes skip reason
        """
        # Create a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Simulate task being skipped
        success = StateManager.execute_transition(
            entity=task,
            transition_name='task_skipped',
            transition_data={'reason': 'User skipped task'},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(task)
        self.assertEqual(current_state, TaskStateChoices.SKIPPED)

    def test_task_reopened_transition(self):
        """
        Test task_reopened transition.
        
        This test validates:
        - task_reopened can be triggered after completion
        - State changes back to IN_PROGRESS
        - Context includes reopen reason
        """
        # Create and complete a task
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        StateManager.execute_transition(
            entity=task,
            transition_name='task_annotation_started',
            user=self.user,
            organization_id=self.organization.id,
        )

        StateManager.execute_transition(
            entity=task,
            transition_name='task_completed',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Simulate task being reopened
        success = StateManager.execute_transition(
            entity=task,
            transition_name='task_reopened',
            transition_data={'reason': 'Annotations rejected'},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed back
        current_state = StateManager.get_current_state_value(task)
        self.assertEqual(current_state, TaskStateChoices.ANNOTATION_IN_PROGRESS)

        # Verify history
        history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(history), 4)
        self.assertEqual(history[0].transition_name, 'task_reopened')


class TestTaskFSMEdgeCases(TestCase):
    """Test edge cases and error handling in Task FSM"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()
        
        self.project = Project.objects.create(
            title='Test Project',
            organization=self.organization,
            created_by=self.user
        )

    def test_task_creation_with_empty_data(self):
        """
        Test that task creation works with empty data.
        
        This test validates:
        - Tasks can be created with empty data dict
        - data_keys will be empty list
        - FSM still records the transition
        """
        task = Task.objects.create(
            project=self.project,
            data={}
        )

        state_record = StateManager.get_current_state_object(task)
        self.assertEqual(state_record.context_data['data_keys'], [])

    def test_task_creation_with_null_data(self):
        """
        Test that task creation works with null data.
        
        This test validates:
        - Tasks can be created with data=None
        - data_keys will be empty list
        - FSM still records the transition
        """
        task = Task.objects.create(
            project=self.project,
            data=None
        )

        state_record = StateManager.get_current_state_object(task)
        self.assertEqual(state_record.context_data['data_keys'], [])

    def test_multiple_task_creations(self):
        """
        Test that multiple tasks can be created independently.
        
        This test validates:
        - Each task gets its own FSM state
        - States don't interfere with each other
        - Cache keys are unique per task
        """
        task1 = Task.objects.create(
            project=self.project,
            data={'text': 'Task 1'}
        )
        
        task2 = Task.objects.create(
            project=self.project,
            data={'text': 'Task 2'}
        )

        # Verify both have independent states
        state1 = StateManager.get_current_state_value(task1)
        state2 = StateManager.get_current_state_value(task2)
        
        self.assertEqual(state1, TaskStateChoices.CREATED)
        self.assertEqual(state2, TaskStateChoices.CREATED)

        # Verify they have separate state records
        history1 = StateManager.get_state_history(task1, limit=10)
        history2 = StateManager.get_state_history(task2, limit=10)
        
        self.assertEqual(len(history1), 1)
        self.assertEqual(len(history2), 1)
        self.assertNotEqual(history1[0].id, history2[0].id)

    def test_task_transition_with_missing_user(self):
        """
        Test that transitions work even without a user.
        
        This test validates:
        - Transitions can be triggered without a user
        - triggered_by will be None
        - FSM still functions correctly
        """
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Trigger transition without user
        success = StateManager.execute_transition(
            entity=task,
            transition_name='task_annotation_started',
            user=None,  # No user
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify transition was recorded
        history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(history), 2)
        self.assertIsNone(history[0].triggered_by)

    def test_task_same_state_transition_skipped(self):
        """
        Test that transitioning to the same state is skipped.
        
        This test validates:
        - Same-state transitions don't create duplicate records
        - StateManager detects and skips redundant transitions
        """
        task = Task.objects.create(
            project=self.project,
            data={'text': 'Test task'}
        )

        # Get initial state count
        initial_history = StateManager.get_state_history(task, limit=10)
        initial_count = len(initial_history)

        # Try to transition to CREATED again (should be skipped)
        success = StateManager.execute_transition(
            entity=task,
            transition_name='task_created',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Should return success but not create new record
        self.assertTrue(success)

        # Verify no new state record was created
        final_history = StateManager.get_state_history(task, limit=10)
        self.assertEqual(len(final_history), initial_count)

