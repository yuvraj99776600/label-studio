"""
LSO FSM Workflow Tests

Tests FSM state tracking through realistic user workflows using the SDK/API.
Validates that FSM correctly tracks state changes during actual user journeys.

This test file focuses on LSO-specific functionality:
- Project lifecycle: CREATED -> IN_PROGRESS -> COMPLETED
- Task lifecycle: CREATED -> COMPLETED -> IN_PROGRESS -> COMPLETED
- Annotation lifecycle: SUBMITTED (on create), SUBMITTED (on update)

LSE-specific transitions (reviews, project settings, annotation drafts) are tested in LSE.
"""

import pytest
from fsm.state_choices import AnnotationStateChoices, ProjectStateChoices, TaskStateChoices
from fsm.state_manager import StateManager
from label_studio_sdk.client import LabelStudio
from projects.models import Project
from tasks.models import Annotation, Task

pytestmark = pytest.mark.django_db


# Helper functions


def assert_project_state(project_id, expected_state):
    """Assert project has expected FSM state"""
    project = Project.objects.get(pk=project_id)
    actual = StateManager.get_current_state_value(project)
    assert actual == expected_state, f'Expected project state {expected_state}, got {actual}'


def assert_task_state(task_id, expected_state):
    """Assert task has expected FSM state"""
    task = Task.objects.get(pk=task_id)
    actual = StateManager.get_current_state_value(task)
    assert actual == expected_state, f'Expected task state {expected_state}, got {actual}'


def assert_annotation_state(annotation_id, expected_state):
    """Assert annotation has expected FSM state"""
    annotation = Annotation.objects.get(pk=annotation_id)
    actual = StateManager.get_current_state_value(annotation)
    assert actual == expected_state, f'Expected annotation state {expected_state}, got {actual}'


class TestProjectWorkflows:
    """Test project FSM state tracking through realistic workflows"""

    def test_project_creation_workflow(self, django_live_url, business_client):
        """
        User creates project -> Project state = CREATED

        Validates:
        - Project is created with CREATED state
        - FSM captures project creation
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        # Create project via SDK
        project = ls.projects.create(
            title='Test Project - Creation Workflow',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )

        # Verify project state
        assert_project_state(project.id, ProjectStateChoices.CREATED)

    def test_project_in_progress_workflow(self, django_live_url, business_client):
        """
        First annotation on any task -> Project CREATED -> IN_PROGRESS

        Validates:
        - Project starts in CREATED state
        - First annotation submission triggers project IN_PROGRESS
        - Task transitions to COMPLETED
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        # Create project and tasks
        project = ls.projects.create(
            title='Test Project - In Progress Workflow',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})
        ls.tasks.create(project=project.id, data={'text': 'Task 2'})

        # Verify initial states
        assert_project_state(project.id, ProjectStateChoices.CREATED)
        tasks = list(ls.tasks.list(project=project.id))
        assert len(tasks) == 2
        assert_task_state(tasks[0].id, TaskStateChoices.CREATED)

        # Submit annotation on first task
        ls.annotations.create(
            id=tasks[0].id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )

        # Verify task completed and project in progress
        assert_task_state(tasks[0].id, TaskStateChoices.COMPLETED)
        assert_project_state(project.id, ProjectStateChoices.IN_PROGRESS)

    def test_project_completion_workflow(self, django_live_url, business_client):
        """
        All tasks completed -> Project IN_PROGRESS -> COMPLETED

        Validates:
        - Project moves to COMPLETED when all tasks are completed
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        # Create project and tasks
        project = ls.projects.create(
            title='Test Project - Completion Workflow',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})
        ls.tasks.create(project=project.id, data={'text': 'Task 2'})

        tasks = list(ls.tasks.list(project=project.id))

        # Submit annotation on first task -> project IN_PROGRESS
        ls.annotations.create(
            id=tasks[0].id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_project_state(project.id, ProjectStateChoices.IN_PROGRESS)

        # Submit annotation on second task -> project COMPLETED
        ls.annotations.create(
            id=tasks[1].id,
            result=[{'value': {'choices': ['negative']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )

        # Verify all tasks completed and project completed
        assert_task_state(tasks[0].id, TaskStateChoices.COMPLETED)
        assert_task_state(tasks[1].id, TaskStateChoices.COMPLETED)
        assert_project_state(project.id, ProjectStateChoices.COMPLETED)

    def test_project_back_to_in_progress_workflow(self, django_live_url, business_client):
        """
        Task becomes incomplete -> Project COMPLETED -> IN_PROGRESS

        Validates:
        - Deleting annotations from a task moves task to IN_PROGRESS
        - Project transitions back to IN_PROGRESS when any task is incomplete
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        # Create project and tasks
        project = ls.projects.create(
            title='Test Project - Back to In Progress',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})
        ls.tasks.create(project=project.id, data={'text': 'Task 2'})

        tasks = list(ls.tasks.list(project=project.id))

        # Complete both tasks
        annotation1 = ls.annotations.create(
            id=tasks[0].id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        ls.annotations.create(
            id=tasks[1].id,
            result=[{'value': {'choices': ['negative']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_project_state(project.id, ProjectStateChoices.COMPLETED)

        # Delete annotation from first task
        ls.annotations.delete(id=annotation1.id)

        # Verify task moved to IN_PROGRESS and project back to IN_PROGRESS
        assert_task_state(tasks[0].id, TaskStateChoices.IN_PROGRESS)
        assert_project_state(project.id, ProjectStateChoices.IN_PROGRESS)


class TestTaskWorkflows:
    """Test task FSM state tracking through realistic workflows"""

    def test_task_import_workflow(self, django_live_url, business_client):
        """
        User imports tasks -> Each task state = CREATED

        Validates:
        - Tasks are created with CREATED state
        - FSM captures task creation
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        project = ls.projects.create(
            title='Test Project - Task Import',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )

        # Create tasks via SDK
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})
        ls.tasks.create(project=project.id, data={'text': 'Task 2'})
        ls.tasks.create(project=project.id, data={'text': 'Task 3'})

        # Verify all tasks are CREATED
        tasks = list(ls.tasks.list(project=project.id))
        assert len(tasks) == 3
        for task in tasks:
            assert_task_state(task.id, TaskStateChoices.CREATED)

    def test_task_completion_workflow(self, django_live_url, business_client):
        """
        First annotation submitted -> Task CREATED -> COMPLETED

        Validates:
        - Task transitions to COMPLETED when annotation is submitted
        - Annotation is in SUBMITTED state
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        project = ls.projects.create(
            title='Test Project - Task Completion',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})

        tasks = list(ls.tasks.list(project=project.id))
        task_id = tasks[0].id

        # Verify initial state
        assert_task_state(task_id, TaskStateChoices.CREATED)

        # Submit annotation
        annotation = ls.annotations.create(
            id=task_id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )

        # Verify task completed
        assert_task_state(task_id, TaskStateChoices.COMPLETED)
        assert_annotation_state(annotation.id, AnnotationStateChoices.SUBMITTED)

    def test_task_in_progress_workflow(self, django_live_url, business_client):
        """
        All annotations deleted -> Task COMPLETED -> IN_PROGRESS

        Validates:
        - Task transitions to IN_PROGRESS when all annotations are deleted
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        project = ls.projects.create(
            title='Test Project - Task In Progress',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})

        tasks = list(ls.tasks.list(project=project.id))
        task_id = tasks[0].id

        # Submit and verify completion
        annotation = ls.annotations.create(
            id=task_id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_task_state(task_id, TaskStateChoices.COMPLETED)

        # Delete annotation
        ls.annotations.delete(id=annotation.id)

        # Verify task in progress
        assert_task_state(task_id, TaskStateChoices.IN_PROGRESS)

    def test_task_re_completion_workflow(self, django_live_url, business_client):
        """
        Annotation submitted on IN_PROGRESS task -> Task IN_PROGRESS -> COMPLETED

        Validates:
        - Task can transition back to COMPLETED after being IN_PROGRESS
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        project = ls.projects.create(
            title='Test Project - Task Re-completion',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})

        tasks = list(ls.tasks.list(project=project.id))
        task_id = tasks[0].id

        # Submit, delete, verify IN_PROGRESS
        annotation1 = ls.annotations.create(
            id=task_id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        ls.annotations.delete(id=annotation1.id)
        assert_task_state(task_id, TaskStateChoices.IN_PROGRESS)

        # Re-submit annotation
        ls.annotations.create(
            id=task_id,
            result=[{'value': {'choices': ['negative']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )

        # Verify task completed again
        assert_task_state(task_id, TaskStateChoices.COMPLETED)


class TestAnnotationWorkflows:
    """Test annotation FSM state tracking through realistic workflows"""

    def test_annotation_submission_workflow(self, django_live_url, business_client):
        """
        User submits annotation -> Annotation state = SUBMITTED

        Validates:
        - Annotation is created with SUBMITTED state
        - FSM captures annotation creation
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        project = ls.projects.create(
            title='Test Project - Annotation Submission',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})

        tasks = list(ls.tasks.list(project=project.id))

        # Submit annotation
        annotation = ls.annotations.create(
            id=tasks[0].id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )

        # Verify annotation state
        assert_annotation_state(annotation.id, AnnotationStateChoices.SUBMITTED)

        # Verify FSM state record count
        annotation_obj = Annotation.objects.get(pk=annotation.id)
        state_count = StateManager.get_state_history(annotation_obj).count()
        assert state_count == 1, f'Expected 1 state record, got {state_count}'

    def test_annotation_update_workflow(self, django_live_url, business_client):
        """
        User updates annotation -> New state record (still SUBMITTED)

        Validates:
        - Annotation update creates new FSM state record
        - State remains SUBMITTED
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        project = ls.projects.create(
            title='Test Project - Annotation Update',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})

        tasks = list(ls.tasks.list(project=project.id))

        # Submit annotation
        annotation = ls.annotations.create(
            id=tasks[0].id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_annotation_state(annotation.id, AnnotationStateChoices.SUBMITTED)

        # Update annotation
        ls.annotations.update(
            id=annotation.id,
            result=[{'value': {'choices': ['negative']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
        )

        # Verify state still SUBMITTED but new state record created
        assert_annotation_state(annotation.id, AnnotationStateChoices.SUBMITTED)
        annotation_obj = Annotation.objects.get(pk=annotation.id)
        state_count = StateManager.get_state_history(annotation_obj).count()
        assert state_count == 2, f'Expected 2 state records, got {state_count}'


class TestEndToEndWorkflows:
    """Test complete end-to-end workflows"""

    def test_complete_annotation_journey(self, django_live_url, business_client):
        """
        Complete workflow:
        1. Create project -> Project CREATED
        2. Import 2 tasks -> Tasks CREATED
        3. Submit annotation on task1 -> Task1 COMPLETED, Project IN_PROGRESS
        4. Submit annotation on task2 -> Task2 COMPLETED, Project COMPLETED
        5. Delete annotation from task1 -> Task1 IN_PROGRESS, Project IN_PROGRESS
        6. Re-submit annotation on task1 -> Task1 COMPLETED, Project COMPLETED

        Validates the complete FSM state flow for a typical annotation journey.
        """
        ls = LabelStudio(base_url=django_live_url, api_key=business_client.api_key)

        # Step 1: Create project
        project = ls.projects.create(
            title='Test Project - Complete Journey',
            label_config='<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="positive"/><Choice value="negative"/></Choices></View>',
        )
        assert_project_state(project.id, ProjectStateChoices.CREATED)

        # Step 2: Create 2 tasks
        ls.tasks.create(project=project.id, data={'text': 'Task 1'})
        ls.tasks.create(project=project.id, data={'text': 'Task 2'})
        tasks = list(ls.tasks.list(project=project.id))
        assert len(tasks) == 2
        task1_id = tasks[0].id
        task2_id = tasks[1].id
        assert_task_state(task1_id, TaskStateChoices.CREATED)
        assert_task_state(task2_id, TaskStateChoices.CREATED)

        # Step 3: Submit annotation on task1
        annotation1 = ls.annotations.create(
            id=task1_id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_task_state(task1_id, TaskStateChoices.COMPLETED)
        assert_project_state(project.id, ProjectStateChoices.IN_PROGRESS)
        assert_annotation_state(annotation1.id, AnnotationStateChoices.SUBMITTED)

        # Step 4: Submit annotation on task2
        annotation2 = ls.annotations.create(
            id=task2_id,
            result=[{'value': {'choices': ['negative']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_task_state(task2_id, TaskStateChoices.COMPLETED)
        assert_project_state(project.id, ProjectStateChoices.COMPLETED)
        assert_annotation_state(annotation2.id, AnnotationStateChoices.SUBMITTED)

        # Step 5: Delete annotation from task1
        ls.annotations.delete(id=annotation1.id)
        assert_task_state(task1_id, TaskStateChoices.IN_PROGRESS)
        assert_project_state(project.id, ProjectStateChoices.IN_PROGRESS)

        # Step 6: Re-submit annotation on task1
        annotation3 = ls.annotations.create(
            id=task1_id,
            result=[{'value': {'choices': ['positive']}, 'from_name': 'label', 'to_name': 'text', 'type': 'choices'}],
            lead_time=5.0,
        )
        assert_task_state(task1_id, TaskStateChoices.COMPLETED)
        assert_project_state(project.id, ProjectStateChoices.COMPLETED)
        assert_annotation_state(annotation3.id, AnnotationStateChoices.SUBMITTED)
