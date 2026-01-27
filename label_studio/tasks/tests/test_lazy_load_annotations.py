"""Tests for lazy loading annotations feature (FIT-720).

This module tests the AnnotationStubSerializer and the annotations_stub
query parameter for the TaskAPI endpoint.
"""
import pytest
from unittest.mock import patch, MagicMock
from organizations.tests.factories import OrganizationFactory
from projects.tests.factories import ProjectFactory
from rest_framework.test import APITestCase
from tasks.models import Annotation
from tasks.serializers import AnnotationSerializer, AnnotationStubSerializer
from tasks.tests.factories import AnnotationFactory, TaskFactory


class TestAnnotationStubSerializer(APITestCase):
    """Test the AnnotationStubSerializer excludes result field and includes is_stub flag."""

    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.project = ProjectFactory(organization=cls.organization)
        cls.user = cls.organization.created_by
        cls.task = TaskFactory(project=cls.project, data={'text': 'test'})
        cls.annotation = AnnotationFactory(
            task=cls.task,
            completed_by=cls.user,
            result=[
                {
                    'from_name': 'label',
                    'to_name': 'text',
                    'type': 'labels',
                    'value': {'labels': ['class_A'], 'start': 0, 'end': 10},
                }
            ],
        )

    def test_stub_serializer_excludes_result(self):
        """Test that AnnotationStubSerializer does not include the result field."""
        serializer = AnnotationStubSerializer(self.annotation)
        data = serializer.data

        # Result should NOT be in the stub serializer
        assert 'result' not in data

    def test_stub_serializer_includes_is_stub_flag(self):
        """Test that AnnotationStubSerializer includes is_stub=True."""
        serializer = AnnotationStubSerializer(self.annotation)
        data = serializer.data

        assert 'is_stub' in data
        assert data['is_stub'] is True

    def test_stub_serializer_includes_metadata(self):
        """Test that AnnotationStubSerializer includes all required metadata fields."""
        serializer = AnnotationStubSerializer(self.annotation)
        data = serializer.data

        # Required metadata fields for displaying annotation list
        required_fields = [
            'id',
            'created_at',
            'updated_at',
            'was_cancelled',
            'ground_truth',
            'lead_time',
            'created_ago',
            'created_username',
            'completed_by',
            'is_stub',
        ]

        for field in required_fields:
            assert field in data, f"Field '{field}' should be in stub serializer"

    def test_full_serializer_includes_result(self):
        """Test that the full AnnotationSerializer includes the result field."""
        serializer = AnnotationSerializer(self.annotation)
        data = serializer.data

        # Result should be in the full serializer
        assert 'result' in data
        assert len(data['result']) == 1
        assert data['result'][0]['type'] == 'labels'

    def test_full_serializer_does_not_have_is_stub(self):
        """Test that the full AnnotationSerializer does not include is_stub flag."""
        serializer = AnnotationSerializer(self.annotation)
        data = serializer.data

        # is_stub should NOT be in the full serializer
        assert 'is_stub' not in data


class TestAnnotationsStubQueryParameter(APITestCase):
    """Test the annotations_stub query parameter for TaskAPI."""

    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.project = ProjectFactory(organization=cls.organization)
        cls.user = cls.organization.created_by
        cls.task = TaskFactory(project=cls.project, data={'text': 'test'})
        cls.annotation = AnnotationFactory(
            task=cls.task,
            completed_by=cls.user,
            result=[
                {
                    'from_name': 'label',
                    'to_name': 'text',
                    'type': 'labels',
                    'value': {'labels': ['class_A'], 'start': 0, 'end': 10},
                }
            ],
        )

    @patch('tasks.api.flag_set')
    def test_task_api_with_annotations_stub_enabled(self, mock_flag_set):
        """Test that TaskAPI returns stub annotations when feature flag is enabled and annotations_stub=true."""
        mock_flag_set.return_value = True

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/tasks/{self.task.id}/?annotations_stub=true')

        assert response.status_code == 200
        data = response.json()

        assert 'annotations' in data
        assert len(data['annotations']) == 1

        annotation_data = data['annotations'][0]
        # When stub mode is enabled, result should be excluded and is_stub should be True
        assert 'result' not in annotation_data
        assert annotation_data.get('is_stub') is True

    @patch('tasks.api.flag_set')
    def test_task_api_without_annotations_stub(self, mock_flag_set):
        """Test that TaskAPI returns full annotations when annotations_stub is not set."""
        mock_flag_set.return_value = True

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/tasks/{self.task.id}/')

        assert response.status_code == 200
        data = response.json()

        assert 'annotations' in data
        assert len(data['annotations']) == 1

        annotation_data = data['annotations'][0]
        # Without stub mode, result should be included
        assert 'result' in annotation_data
        assert 'is_stub' not in annotation_data

    @patch('tasks.api.flag_set')
    def test_task_api_with_feature_flag_disabled(self, mock_flag_set):
        """Test that TaskAPI ignores annotations_stub when feature flag is disabled."""
        mock_flag_set.return_value = False

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/tasks/{self.task.id}/?annotations_stub=true')

        assert response.status_code == 200
        data = response.json()

        assert 'annotations' in data
        assert len(data['annotations']) == 1

        annotation_data = data['annotations'][0]
        # With feature flag disabled, annotations_stub should be ignored
        # and full annotations should be returned
        assert 'result' in annotation_data
        assert 'is_stub' not in annotation_data


class TestSingleAnnotationEndpoint(APITestCase):
    """Test the single annotation endpoint for lazy loading."""

    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.project = ProjectFactory(organization=cls.organization)
        cls.user = cls.organization.created_by
        cls.task = TaskFactory(project=cls.project, data={'text': 'test'})
        cls.annotation = AnnotationFactory(
            task=cls.task,
            completed_by=cls.user,
            result=[
                {
                    'from_name': 'label',
                    'to_name': 'text',
                    'type': 'labels',
                    'value': {'labels': ['class_A'], 'start': 0, 'end': 10},
                }
            ],
        )

    def test_get_single_annotation(self):
        """Test that single annotation endpoint returns full annotation data."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/annotations/{self.annotation.id}/')

        assert response.status_code == 200
        data = response.json()

        # Single annotation endpoint should always return full data
        assert 'result' in data
        assert len(data['result']) == 1
        assert data['result'][0]['type'] == 'labels'
        assert data['id'] == self.annotation.id
