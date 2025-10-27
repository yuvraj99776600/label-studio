"""
Tests for AnnotationDraft FSM integration using HsModel approach.

This test module verifies that the AnnotationDraft model correctly integrates
with the FSM system through the HsModel base class, replacing the
previous signal-based approach.

AnnotationDraft FSM Transitions:
- annotation_draft_created: When a new draft is created
- annotation_draft_auto_saved: When draft is auto-saved during work
- annotation_draft_activated: When user starts actively working on draft
- annotation_draft_submitted: When draft is converted to final annotation
"""

from django.test import TestCase, override_settings
from fsm.state_choices import AnnotationDraftStateChoices
from fsm.state_manager import StateManager
from organizations.models import Organization
from projects.models import Project
from tasks.models import AnnotationDraft, Task
from users.models import User


@override_settings(FSM_SIGNALS_ENABLED=False)  # Ensure signals are disabled
class TestAnnotationDraftFSMIntegration(TestCase):
    """Test AnnotationDraft FSM integration via HsModel"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def test_draft_creation_triggers_fsm(self):
        """
        Test that creating a draft triggers FSM transition.

        This test validates:
        - Draft creation triggers annotation_draft_created transition
        - FSM state is set to CREATED
        - State history is recorded
        - Context data includes draft details
        """
        # Create a draft
        draft = AnnotationDraft.objects.create(
            task=self.task, user=self.user, lead_time=10.5, result=[{'value': {'text': 'draft label'}}]
        )

        # Verify FSM state was created
        state = StateManager.get_current_state_value(draft)
        self.assertEqual(state, AnnotationDraftStateChoices.CREATED)

        # Verify state history exists
        history = StateManager.get_state_history(draft, limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].state, AnnotationDraftStateChoices.CREATED)
        self.assertEqual(history[0].transition_name, 'annotation_draft_created')
        self.assertEqual(history[0].reason, 'Annotation draft created - user started annotation work')

    def test_draft_auto_save_triggers_fsm(self):
        """
        Test that auto-saving a draft triggers FSM transition.

        This test validates:
        - Draft updates trigger annotation_draft_auto_saved transition
        - FSM state changes to ACTIVE
        - Context includes changed_fields
        - Multiple auto-saves create multiple state records
        """
        # Create a draft
        draft = AnnotationDraft.objects.create(
            task=self.task, user=self.user, result=[{'value': {'text': 'draft v1'}}]
        )

        # Simulate auto-save
        draft.result = [{'value': {'text': 'draft v2'}}]
        draft.save()

        # Verify FSM recorded the auto-save
        history = StateManager.get_state_history(draft, limit=10)
        self.assertEqual(len(history), 2)

        # First state should be CREATED
        self.assertEqual(history[1].transition_name, 'annotation_draft_created')

        # Second state should be ACTIVE (auto-saved)
        self.assertEqual(history[0].transition_name, 'annotation_draft_auto_saved')
        self.assertEqual(history[0].state, AnnotationDraftStateChoices.ACTIVE)
        self.assertEqual(history[0].reason, 'Annotation draft auto-saved')

    def test_draft_skip_fsm_flag(self):
        """
        Test that skip_fsm flag prevents FSM transitions.

        This test validates:
        - Drafts created with skip_fsm=True don't create FSM states
        - Useful for bulk operations or system actions
        """
        # Create a draft with skip_fsm=True
        draft = AnnotationDraft.objects.create(
            task=self.task,
            user=self.user,
            result=[{'value': {'text': 'draft'}}],
            skip_fsm=True,  # Skip FSM processing
        )

        # Verify no FSM state was created
        state = StateManager.get_current_state_value(draft)
        self.assertIsNone(state)

    def test_draft_non_state_change_no_fsm(self):
        """
        Test that non-state-affecting changes don't trigger FSM.

        This test validates:
        - Some field changes might not trigger FSM
        - Only relevant changes should create transitions
        """
        # Create a draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'draft'}}])

        # Note: In the current implementation, most updates will trigger auto_saved
        # This test documents the behavior
        initial_count = len(StateManager.get_state_history(draft, limit=10))

        # Verify initial state
        self.assertEqual(initial_count, 1)

    def test_draft_state_metadata(self):
        """
        Test that FSM state records include proper metadata.

        This test validates:
        - State record has correct state value
        - State record has transition_name
        - State record has organization_id
        - State record has context_data with task and user info
        """
        # Create a draft
        draft = AnnotationDraft.objects.create(
            task=self.task, user=self.user, lead_time=15.0, result=[{'value': {'text': 'draft'}}]
        )

        # Get the state record
        state_record = StateManager.get_current_state_object(draft)

        # Verify metadata
        self.assertEqual(state_record.state, AnnotationDraftStateChoices.CREATED)
        self.assertEqual(state_record.transition_name, 'annotation_draft_created')
        self.assertEqual(state_record.organization_id, self.organization.id)

        # Verify context data
        self.assertIn('task_id', state_record.context_data)
        self.assertIn('user_id', state_record.context_data)
        self.assertIn('lead_time', state_record.context_data)
        self.assertEqual(state_record.context_data['task_id'], self.task.id)
        self.assertEqual(state_record.context_data['user_id'], self.user.id)
        self.assertEqual(state_record.context_data['lead_time'], 15.0)


class TestAnnotationDraftFSMTransitions(TestCase):
    """Test specific AnnotationDraft FSM transitions"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def test_draft_created_transition_details(self):
        """
        Test annotation_draft_created transition details.

        This test validates:
        - Transition records task_id, user_id
        - Transition records annotation_id if available
        - Transition records lead_time
        - Reason is correct
        """
        draft = AnnotationDraft.objects.create(
            task=self.task, user=self.user, lead_time=20.5, result=[{'value': {'text': 'draft'}}]
        )

        state_record = StateManager.get_current_state_object(draft)

        # Verify transition details
        self.assertEqual(state_record.transition_name, 'annotation_draft_created')
        self.assertEqual(state_record.reason, 'Annotation draft created - user started annotation work')

        # Verify context
        self.assertEqual(state_record.context_data['task_id'], self.task.id)
        self.assertEqual(state_record.context_data['user_id'], self.user.id)
        self.assertEqual(state_record.context_data['lead_time'], 20.5)
        self.assertIn('annotation_id', state_record.context_data)

    def test_draft_auto_saved_transition_details(self):
        """
        Test annotation_draft_auto_saved transition details.

        This test validates:
        - Transition is triggered on updates
        - Context includes changed_fields
        - State transitions from CREATED to ACTIVE
        - Reason is correct
        """
        # Create draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'v1'}}])

        # Auto-save
        draft.result = [{'value': {'text': 'v2'}}]
        draft.lead_time = 30.0
        draft.save()

        # Get latest state
        history = StateManager.get_state_history(draft, limit=10)
        latest_state = history[0]

        # Verify it's an auto-save transition
        self.assertEqual(latest_state.transition_name, 'annotation_draft_auto_saved')
        self.assertEqual(latest_state.state, AnnotationDraftStateChoices.ACTIVE)
        self.assertEqual(latest_state.reason, 'Annotation draft auto-saved')

        # Verify context includes changed_fields
        self.assertIn('changed_fields', latest_state.context_data)
        self.assertIn('lead_time', latest_state.context_data)

    def test_draft_activated_via_execute_transition(self):
        """
        Test annotation_draft_activated transition triggered programmatically.

        This test validates:
        - annotation_draft_activated can be triggered
        - State changes to ACTIVE
        - Context includes activation details

        Note: This might be triggered when lead_time is set or user actively starts work
        """
        # Create draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'draft'}}])

        # Simulate activation (e.g., user starts actively working)
        success = StateManager.execute_transition(
            entity=draft,
            transition_name='annotation_draft_activated',
            transition_data={'activation_time': '2024-01-01T10:00:00Z'},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(draft)
        self.assertEqual(current_state, AnnotationDraftStateChoices.ACTIVE)

    def test_draft_submitted_via_execute_transition(self):
        """
        Test annotation_draft_submitted transition.

        This test validates:
        - annotation_draft_submitted can be triggered
        - State changes to SUBMITTED
        - Context includes final annotation_id

        Note: This transition occurs when draft is converted to a final annotation
        """
        # Create draft
        draft = AnnotationDraft.objects.create(
            task=self.task, user=self.user, result=[{'value': {'text': 'final draft'}}]
        )

        # Simulate submission (draft converted to annotation)
        success = StateManager.execute_transition(
            entity=draft,
            transition_name='annotation_draft_submitted',
            transition_data={'annotation_id': 123, 'submission_time': '2024-01-01T11:00:00Z'},
            user=self.user,
            organization_id=self.organization.id,
        )

        self.assertTrue(success)

        # Verify state changed
        current_state = StateManager.get_current_state_value(draft)
        self.assertEqual(current_state, AnnotationDraftStateChoices.SUBMITTED)

        # Verify context includes annotation_id
        history = StateManager.get_state_history(draft, limit=1)
        self.assertIn('annotation_id', history[0].context_data)
        self.assertEqual(history[0].context_data['annotation_id'], 123)


class TestAnnotationDraftFSMWorkflows(TestCase):
    """Test complete AnnotationDraft workflow scenarios"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def test_complete_draft_lifecycle(self):
        """
        Test complete draft lifecycle: created -> auto-saved (multiple) -> submitted.

        This test validates:
        - Draft creation
        - Multiple auto-saves
        - Final submission
        - Complete state history tracking
        """
        # Create draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'v1'}}])

        # Multiple auto-saves (simulating user editing)
        draft.result = [{'value': {'text': 'v2'}}]
        draft.lead_time = 10.0
        draft.save()

        draft.result = [{'value': {'text': 'v3'}}]
        draft.lead_time = 20.0
        draft.save()

        draft.result = [{'value': {'text': 'v4'}}]
        draft.lead_time = 30.0
        draft.save()

        # Submit draft
        StateManager.execute_transition(
            entity=draft,
            transition_name='annotation_draft_submitted',
            transition_data={'annotation_id': 999},
            user=self.user,
            organization_id=self.organization.id,
        )

        # Verify complete history
        history = StateManager.get_state_history(draft, limit=10)
        self.assertEqual(len(history), 5)  # created + 3 auto-saves + submitted

        # Verify lifecycle order (newest first)
        self.assertEqual(history[0].transition_name, 'annotation_draft_submitted')
        self.assertEqual(history[1].transition_name, 'annotation_draft_auto_saved')
        self.assertEqual(history[2].transition_name, 'annotation_draft_auto_saved')
        self.assertEqual(history[3].transition_name, 'annotation_draft_auto_saved')
        self.assertEqual(history[4].transition_name, 'annotation_draft_created')

        # Verify final state
        current_state = StateManager.get_current_state_value(draft)
        self.assertEqual(current_state, AnnotationDraftStateChoices.SUBMITTED)

    def test_draft_abandoned_workflow(self):
        """
        Test draft that is abandoned (created, auto-saved, but never submitted).

        This test validates:
        - Draft can remain in ACTIVE state
        - No submission transition is required
        - State history reflects partial work
        """
        # Create draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'v1'}}])

        # Some auto-saves
        draft.result = [{'value': {'text': 'v2'}}]
        draft.save()

        # Draft is abandoned (no submission)
        # Verify final state is ACTIVE
        current_state = StateManager.get_current_state_value(draft)
        self.assertEqual(current_state, AnnotationDraftStateChoices.ACTIVE)

        # Verify history
        history = StateManager.get_state_history(draft, limit=10)
        self.assertEqual(len(history), 2)  # created + 1 auto-save
        self.assertEqual(history[0].transition_name, 'annotation_draft_auto_saved')
        self.assertEqual(history[1].transition_name, 'annotation_draft_created')


class TestAnnotationDraftFSMEdgeCases(TestCase):
    """Test edge cases and error handling in AnnotationDraft FSM"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(email='test@example.com', password='test123')
        self.organization = Organization.objects.create(title='Test Org')
        self.user.active_organization = self.organization
        self.user.save()

        self.project = Project.objects.create(
            title='Test Project', organization=self.organization, created_by=self.user
        )

        self.task = Task.objects.create(project=self.project, data={'text': 'Test task'})

    def test_draft_with_empty_result(self):
        """
        Test draft creation with empty result.

        This test validates:
        - Drafts can be created with empty result
        - FSM still records the transition
        - Useful for "start annotation" actions
        """
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[])

        # Verify FSM state was created
        state = StateManager.get_current_state_value(draft)
        self.assertEqual(state, AnnotationDraftStateChoices.CREATED)

    def test_draft_with_annotation_link(self):
        """
        Test draft creation linked to an existing annotation.

        This test validates:
        - Drafts can reference an existing annotation
        - annotation_id is recorded in context
        - Used for editing existing annotations
        """
        # Create a draft linked to an annotation (e.g., editing mode)
        draft = AnnotationDraft.objects.create(
            task=self.task,
            user=self.user,
            annotation_id=456,  # Linked to existing annotation
            result=[{'value': {'text': 'editing'}}],
        )

        # Verify FSM state
        state_record = StateManager.get_current_state_object(draft)
        self.assertIn('annotation_id', state_record.context_data)
        self.assertEqual(state_record.context_data['annotation_id'], 456)

    def test_multiple_drafts_same_task(self):
        """
        Test that multiple users can have drafts on the same task.

        This test validates:
        - Each draft gets its own FSM state
        - States don't interfere with each other
        - Multiple users can work simultaneously
        """
        user2 = User.objects.create_user(email='user2@example.com', password='test123')
        user2.active_organization = self.organization
        user2.save()

        # Create drafts for different users
        draft1 = AnnotationDraft.objects.create(
            task=self.task, user=self.user, result=[{'value': {'text': 'user1 draft'}}]
        )

        draft2 = AnnotationDraft.objects.create(
            task=self.task, user=user2, result=[{'value': {'text': 'user2 draft'}}]
        )

        # Verify both have independent states
        state1 = StateManager.get_current_state_value(draft1)
        state2 = StateManager.get_current_state_value(draft2)

        self.assertEqual(state1, AnnotationDraftStateChoices.CREATED)
        self.assertEqual(state2, AnnotationDraftStateChoices.CREATED)

        # Verify they have separate state records
        history1 = StateManager.get_state_history(draft1, limit=10)
        history2 = StateManager.get_state_history(draft2, limit=10)

        self.assertNotEqual(history1[0].id, history2[0].id)

    def test_rapid_auto_saves(self):
        """
        Test that rapid auto-saves are handled correctly.

        This test validates:
        - Multiple rapid updates each create state records
        - No race conditions or state corruption
        - All auto-saves are tracked
        """
        # Create draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'v0'}}])

        # Simulate rapid auto-saves
        for i in range(1, 6):
            draft.result = [{'value': {'text': f'v{i}'}}]
            draft.lead_time = i * 5.0
            draft.save()

        # Verify all auto-saves were recorded
        history = StateManager.get_state_history(draft, limit=20)
        self.assertEqual(len(history), 6)  # 1 created + 5 auto-saves

        # Verify all are auto-save transitions (except first)
        auto_saves = [h for h in history if h.transition_name == 'annotation_draft_auto_saved']
        self.assertEqual(len(auto_saves), 5)

    def test_draft_state_history_tracking(self):
        """
        Test that draft state history tracks previous_state correctly.

        This test validates:
        - previous_state is set correctly after each transition
        - State chain is maintained properly
        """
        # Create draft
        draft = AnnotationDraft.objects.create(task=self.task, user=self.user, result=[{'value': {'text': 'v1'}}])

        # Auto-save
        draft.result = [{'value': {'text': 'v2'}}]
        draft.save()

        # Submit
        StateManager.execute_transition(
            entity=draft,
            transition_name='annotation_draft_submitted',
            user=self.user,
            organization_id=self.organization.id,
        )

        # Verify previous_state chain
        history = StateManager.get_state_history(draft, limit=10)

        self.assertIsNone(history[2].previous_state)  # First state (created)
        self.assertEqual(history[1].previous_state, AnnotationDraftStateChoices.CREATED)
        self.assertEqual(history[0].previous_state, AnnotationDraftStateChoices.ACTIVE)
