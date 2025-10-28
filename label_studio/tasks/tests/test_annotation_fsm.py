"""
Tests for Annotation FSM integration using HsModel approach.

This test module verifies that the Annotation model correctly integrates
with the FSM system through the HsModel base class, replacing the
previous signal-based approach.

Annotation FSM Transitions:
- annotation_submitted: When annotation is created/submitted (default creation path)
- annotation_updated: When annotation is updated
- annotation_completed: When annotation work is finalized
- annotation_accepted: When annotation is accepted in review
- annotation_rejected: When annotation is rejected in review
- annotation_ground_truth_set: When annotation is marked as ground truth
- annotation_ground_truth_unset: When annotation ground truth is removed
"""

import pytest
from core.current_request import CurrentContext
from django.test import TestCase
from fsm.state_choices import AnnotationStateChoices, TaskStateChoices
from fsm.state_manager import StateManager
from organizations.models import Organization
from projects.models import Project
from tasks.models import Annotation, Task
from users.models import User


class TestAnnotationFSMIntegration(TestCase):
    """Test Annotation FSM integration via HsModel"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org', created_by=self.user)
        self.user.active_organization = self.organization
        self.user.save()

        # Set up CurrentContext for FSM
        CurrentContext.set_user(self.user)
        CurrentContext.set_organization_id(self.organization.id)

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def tearDown(self):
        """Clean up"""
        CurrentContext.clear()

    def test_annotation_creation_triggers_fsm(self):
        """
        Test that creating an annotation triggers FSM transition.

        This test validates:
        - Annotation creation triggers annotation_submitted transition
        - FSM state is set to SUBMITTED
        - State history is recorded
        - Context data includes annotation details
        """
        # Create an annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Verify FSM state was created
        state = StateManager.get_current_state_value(annotation)
        self.assertEqual(state, AnnotationStateChoices.SUBMITTED)

        # Verify state history exists
        history = StateManager.get_state_history(annotation, limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].state, AnnotationStateChoices.SUBMITTED)
        self.assertEqual(history[0].transition_name, 'annotation_submitted')
        self.assertEqual(history[0].reason, 'Annotation submitted for review')

    def test_annotation_skip_fsm_flag(self):
        """
        Test that skip_fsm flag prevents FSM transitions.

        This test validates:
        - Annotations created with skip_fsm=True don't create FSM states
        - Useful for bulk imports or system operations
        """
        # Create an annotation with skip_fsm=True passed to save()
        annotation = Annotation(
            task=self.task,
            project=self.project,
            completed_by=self.user,
            result=[{'value': {'text': 'label'}}],
        )
        annotation.save(skip_fsm=True)  # Skip FSM processing

        # Verify no FSM state was created
        state = StateManager.get_current_state_value(annotation)
        self.assertIsNone(state)

    def test_annotation_update_triggers_fsm(self):
        """
        Test that updating an annotation triggers FSM transition.

        This test validates:
        - Annotation updates trigger annotation_updated transition
        - FSM records the update
        - Context includes changed_fields
        """
        # Create an annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Update the annotation
        annotation.result = [{'value': {'text': 'updated label'}}]
        annotation.save()

        # Verify FSM recorded the update
        history = StateManager.get_state_history(annotation, limit=10)
        self.assertEqual(len(history), 2)

        # First state should be SUBMITTED
        self.assertEqual(history[1].transition_name, 'annotation_submitted')

        # Second state should be UPDATED
        self.assertEqual(history[0].transition_name, 'annotation_updated')
        self.assertEqual(history[0].state, AnnotationStateChoices.UPDATED)
        self.assertEqual(history[0].reason, 'Annotation updated after review feedback')

    def test_annotation_state_metadata(self):
        """
        Test that FSM state records include proper metadata.

        This test validates:
        - State record has correct state value
        - State record has transition_name
        - State record has organization_id
        - State record has completed_by_id
        - State record has context_data with task and project info
        """
        # Create an annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Get the state record
        state_record = StateManager.get_current_state_object(annotation)

        # Verify metadata
        self.assertEqual(state_record.state, AnnotationStateChoices.SUBMITTED)
        self.assertEqual(state_record.transition_name, 'annotation_submitted')
        self.assertEqual(state_record.organization_id, self.organization.id)
        self.assertEqual(state_record.triggered_by, self.user)

        # Verify context data
        self.assertIn('task_id', state_record.context_data)
        self.assertIn('project_id', state_record.context_data)
        self.assertIn('completed_by_id', state_record.context_data)
        self.assertEqual(state_record.context_data['task_id'], self.task.id)
        self.assertEqual(state_record.context_data['project_id'], self.project.id)
        self.assertEqual(state_record.context_data['completed_by_id'], self.user.id)


class TestAnnotationFSMTransitions(TestCase):
    """Test specific Annotation FSM transitions"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.reviewer = User.objects.create_user(email='reviewer@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.reviewer.active_organization = self.organization
        self.user.save()
        self.reviewer.save()

        # Set up CurrentContext for FSM
        CurrentContext.set_user(self.user)
        CurrentContext.set_organization_id(self.organization.id)

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def tearDown(self):
        """Clean up"""
        CurrentContext.clear()

    def test_annotation_submitted_transition(self):
        """
        Test annotation_submitted transition details.

        This test validates:
        - Transition records task_id, project_id, completed_by_id
        - Transition records lead_time if available
        - Reason is correct
        """
        annotation = Annotation.objects.create(
            task=self.task,
            project=self.project,
            completed_by=self.user,
            result=[{'value': {'text': 'label'}}],
            lead_time=125.5,
        )

        state_record = StateManager.get_current_state_object(annotation)

        # Verify transition details
        self.assertEqual(state_record.transition_name, 'annotation_submitted')
        self.assertEqual(state_record.reason, 'Annotation submitted for review')

        # Verify context
        self.assertEqual(state_record.context_data['task_id'], self.task.id)
        self.assertEqual(state_record.context_data['project_id'], self.project.id)
        self.assertEqual(state_record.context_data['completed_by_id'], self.user.id)
        self.assertEqual(state_record.context_data['lead_time'], 125.5)

    def test_annotation_updated_transition(self):
        """
        Test annotation_updated transition details.

        This test validates:
        - Transition is triggered on updates
        - Context includes changed_fields
        - Multiple updates create multiple state records
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Update result
        annotation.result = [{'value': {'text': 'updated'}}]
        annotation.save()

        # Get latest state
        history = StateManager.get_state_history(annotation, limit=10)
        latest_state = history[0]

        # Verify it's an update transition
        self.assertEqual(latest_state.transition_name, 'annotation_updated')
        self.assertEqual(latest_state.state, AnnotationStateChoices.UPDATED)

        # Verify context includes changed_fields
        self.assertIn('changed_fields', latest_state.context_data)

    @pytest.mark.skip(reason='LSE-only transition - annotation_completed not available in LSO')
    def test_annotation_completed_via_execute_transition(self):
        """
        Test annotation_completed transition triggered programmatically.

        This test validates:
        - annotation_completed can be triggered via StateManager.execute_transition
        - State changes to COMPLETED
        - Context includes completion details
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Simulate completion (e.g., from TaskCompletionStrategy)
        success = StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_completed',
            transition_data={'completion_reason': 'Review accepted'},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(annotation)
        self.assertEqual(current_state, AnnotationStateChoices.COMPLETED)

    @pytest.mark.skip(reason='LSE-only transition - annotation_accepted not available in LSO')
    def test_annotation_accepted_via_execute_transition(self):
        """
        Test annotation_accepted transition.

        This test validates:
        - annotation_accepted can be triggered during review
        - State changes to ACCEPTED
        - Context includes reviewer info
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Simulate review acceptance
        success = StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_accepted',
            transition_data={'reviewer_id': self.reviewer.id},
            user=self.reviewer,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(annotation)
        self.assertEqual(current_state, AnnotationStateChoices.ACCEPTED)

        # Verify context
        history = StateManager.get_state_history(annotation, limit=1)
        self.assertIn('reviewer_id', history[0].context_data)

    @pytest.mark.skip(reason='LSE-only transition - annotation_rejected not available in LSO')
    def test_annotation_rejected_via_execute_transition(self):
        """
        Test annotation_rejected transition.

        This test validates:
        - annotation_rejected can be triggered during review
        - State changes to REJECTED
        - Context includes rejection reason
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Simulate review rejection
        success = StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_rejected',
            transition_data={'reviewer_id': self.reviewer.id, 'rejection_reason': 'Incorrect labels'},
            user=self.reviewer,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(annotation)
        self.assertEqual(current_state, AnnotationStateChoices.REJECTED)

    @pytest.mark.skip(reason='LSE-only transition - annotation_ground_truth_set not available in LSO')
    def test_annotation_ground_truth_set_via_execute_transition(self):
        """
        Test annotation_ground_truth_set transition.

        This test validates:
        - annotation_ground_truth_set can be triggered
        - State changes to GROUND_TRUTH
        - Context includes ground truth metadata
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Simulate ground truth being set
        success = StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_ground_truth_set',
            transition_data={'set_by': self.user.id},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(annotation)
        self.assertEqual(current_state, AnnotationStateChoices.GROUND_TRUTH)

    @pytest.mark.skip(reason='LSE-only transition - annotation_ground_truth_unset not available in LSO')
    def test_annotation_ground_truth_unset_via_execute_transition(self):
        """
        Test annotation_ground_truth_unset transition.

        This test validates:
        - annotation_ground_truth_unset can be triggered
        - State changes back to previous state
        - Context includes unset reason
        """
        # Create annotation and set as ground truth
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_ground_truth_set',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Simulate ground truth being unset
        success = StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_ground_truth_unset',
            transition_data={'unset_reason': 'Incorrect ground truth'},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(annotation)
        # Should transition to SUBMITTED or another appropriate state
        self.assertNotEqual(current_state, AnnotationStateChoices.GROUND_TRUTH)


class TestAnnotationFSMPostTransitionHooks(TestCase):
    """Test post-transition hooks that trigger task state changes"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org', created_by=self.user)
        self.user.active_organization = self.organization
        self.user.save()

        # Set up CurrentContext for FSM
        CurrentContext.set_user(self.user)
        CurrentContext.set_organization_id(self.organization.id)

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def tearDown(self):
        """Clean up"""
        CurrentContext.clear()

    def test_annotation_submitted_triggers_task_annotation_started(self):
        """
        Test that annotation submission triggers task state change.

        This test validates:
        - When first annotation is submitted, task transitions to IN_PROGRESS
        - Post-transition hook calls StateManager.execute_transition for task
        - Task state history includes task_annotation_started
        """
        # Verify task starts in CREATED state
        task_state = StateManager.get_current_state_value(self.task)
        self.assertEqual(task_state, TaskStateChoices.CREATED)

        # Create first annotation
        Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Verify task state changed (via post_transition_hook)
        task_state = StateManager.get_current_state_value(self.task)
        self.assertEqual(task_state, TaskStateChoices.IN_PROGRESS)

        # Verify task state history
        task_history = StateManager.get_state_history(self.task, limit=10)
        self.assertEqual(len(task_history), 2)
        self.assertEqual(task_history[0].transition_name, 'task_annotation_started')

    def test_annotation_from_draft_triggers_task_annotation_started(self):
        """
        Test that annotation from draft also triggers task state change.

        This test validates:
        - Annotation created from draft triggers task transition
        - Post-transition hook works for both creation paths
        """
        # Verify task starts in CREATED state
        task_state = StateManager.get_current_state_value(self.task)
        self.assertEqual(task_state, TaskStateChoices.CREATED)

        # Create annotation from draft
        annotation = Annotation(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )
        annotation.save()

        # Verify task state changed
        task_state = StateManager.get_current_state_value(self.task)
        self.assertEqual(task_state, TaskStateChoices.IN_PROGRESS)

    def test_second_annotation_doesnt_retrigger_task_transition(self):
        """
        Test that subsequent annotations don't re-trigger task_annotation_started.

        This test validates:
        - Only the first annotation triggers task_annotation_started
        - Subsequent annotations don't create duplicate transitions
        - Task state remains ANNOTATION_IN_PROGRESS
        """
        # Create first annotation
        Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label1'}}]
        )

        # Get initial task history count
        initial_task_history = StateManager.get_state_history(self.task, limit=10)
        len(initial_task_history)

        # Create second annotation
        Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label2'}}]
        )

        # Verify task state is still IN_PROGRESS
        task_state = StateManager.get_current_state_value(self.task)
        self.assertEqual(task_state, TaskStateChoices.IN_PROGRESS)

        # Verify no new task state transition was created
        # (TaskCompletionStrategy might create one, but not task_annotation_started)
        final_task_history = StateManager.get_state_history(self.task, limit=10)

        # Check that task_annotation_started wasn't called again
        annotation_started_count = sum(1 for h in final_task_history if h.transition_name == 'task_annotation_started')
        self.assertEqual(annotation_started_count, 1)


class TestAnnotationFSMEdgeCases(TestCase):
    """Test edge cases and error handling in Annotation FSM"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org', created_by=self.user)
        self.user.active_organization = self.organization
        self.user.save()

        # Set up CurrentContext for FSM
        CurrentContext.set_user(self.user)
        CurrentContext.set_organization_id(self.organization.id)

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def tearDown(self):
        """Clean up"""
        CurrentContext.clear()

    def test_annotation_with_empty_result(self):
        """
        Test annotation creation with empty result.

        This test validates:
        - Annotations can be created with empty result list
        - FSM still records the transition
        """
        annotation = Annotation.objects.create(task=self.task, project=self.project, completed_by=self.user, result=[])

        # Verify FSM state was created
        state = StateManager.get_current_state_value(annotation)
        self.assertEqual(state, AnnotationStateChoices.SUBMITTED)

    def test_annotation_without_completed_by(self):
        """
        Test annotation creation without completed_by user.

        This test validates:
        - Annotations can be created without completed_by
        - FSM handles None completed_by_id gracefully
        """
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=None, result=[{'value': {'text': 'label'}}]
        )

        # Verify FSM state was created
        state = StateManager.get_current_state_value(annotation)
        self.assertEqual(state, AnnotationStateChoices.SUBMITTED)

        # Verify context data
        state_record = StateManager.get_current_state_object(annotation)
        self.assertIn('completed_by_id', state_record.context_data)
        self.assertIsNone(state_record.context_data['completed_by_id'])

    def test_multiple_annotations_on_same_task(self):
        """
        Test that multiple annotations on the same task have independent states.

        This test validates:
        - Each annotation gets its own FSM state
        - States don't interfere with each other
        - All annotations can be tracked independently
        """
        # Create multiple annotations
        annotation1 = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label1'}}]
        )

        annotation2 = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label2'}}]
        )

        # Verify both have independent states
        state1 = StateManager.get_current_state_value(annotation1)
        state2 = StateManager.get_current_state_value(annotation2)

        self.assertEqual(state1, AnnotationStateChoices.SUBMITTED)
        self.assertEqual(state2, AnnotationStateChoices.SUBMITTED)

        # Verify they have separate state records
        history1 = StateManager.get_state_history(annotation1, limit=10)
        history2 = StateManager.get_state_history(annotation2, limit=10)

        self.assertNotEqual(history1[0].id, history2[0].id)

    def test_annotation_state_history_after_multiple_updates(self):
        """
        Test that annotation state history tracks multiple updates correctly.

        This test validates:
        - Each update creates a new state record
        - State history is ordered correctly (newest first)
        - previous_state is tracked correctly
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'v1'}}]
        )

        # Multiple updates
        annotation.result = [{'value': {'text': 'v2'}}]
        annotation.save()

        annotation.result = [{'value': {'text': 'v3'}}]
        annotation.save()

        # Verify state history
        history = StateManager.get_state_history(annotation, limit=10)

        # Should have 3 records: 1 submitted + 2 updated
        self.assertEqual(len(history), 3)

        # Check order (newest first)
        self.assertEqual(history[0].transition_name, 'annotation_updated')
        self.assertEqual(history[1].transition_name, 'annotation_updated')
        self.assertEqual(history[2].transition_name, 'annotation_submitted')

        # Check previous_state tracking
        self.assertIsNone(history[2].previous_state)  # First state
        self.assertEqual(history[1].previous_state, AnnotationStateChoices.SUBMITTED)
        self.assertEqual(history[0].previous_state, AnnotationStateChoices.UPDATED)

    @pytest.mark.skip(reason='LSE-only workflow - uses LSE-specific transitions')
    def test_annotation_workflow_lifecycle(self):
        """
        Test complete annotation lifecycle workflow.

        This test validates:
        - Annotation can go through complete lifecycle
        - submitted -> updated -> accepted -> completed
        - All transitions are recorded correctly
        """
        # Create annotation
        annotation = Annotation.objects.create(
            task=self.task, project=self.project, completed_by=self.user, result=[{'value': {'text': 'label'}}]
        )

        # Update annotation
        annotation.result = [{'value': {'text': 'updated label'}}]
        annotation.save()

        # Accept annotation
        StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_accepted',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Complete annotation
        StateManager.execute_transition(
            entity=annotation,
            transition_name='annotation_completed',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Verify complete history
        history = StateManager.get_state_history(annotation, limit=10)
        self.assertEqual(len(history), 4)

        # Verify lifecycle order (newest first)
        self.assertEqual(history[0].transition_name, 'annotation_completed')
        self.assertEqual(history[1].transition_name, 'annotation_accepted')
        self.assertEqual(history[2].transition_name, 'annotation_updated')
        self.assertEqual(history[3].transition_name, 'annotation_submitted')

        # Verify final state
        current_state = StateManager.get_current_state_value(annotation)
        self.assertEqual(current_state, AnnotationStateChoices.COMPLETED)
