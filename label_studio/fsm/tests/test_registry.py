"""
Tests for FSM registry functionality.

Tests registry management, state model registration, transition registration,
and related error handling scenarios.
"""

from unittest.mock import Mock, patch

import pytest
from django.test import TestCase
from fsm.registry import (
    register_state_model,
    register_state_transition,
    state_choices_registry,
    state_model_registry,
    transition_registry,
)
from fsm.state_manager import StateManager
from fsm.transitions import BaseTransition
from pydantic import Field


class MockEntity:
    """Mock entity for testing"""

    def __init__(self, pk=1):
        self.pk = pk
        self.id = pk
        self._meta = Mock()
        self._meta.model_name = 'testentity'
        self._meta.label_lower = 'tests.testentity'
        self.organization_id = 1


class RegistryTests(TestCase):
    """Tests for registry functionality and edge cases"""

    def setUp(self):
        # Clear registries to ensure clean state
        state_choices_registry.clear()
        state_model_registry.clear()
        transition_registry.clear()

        self.entity = MockEntity()

    def test_registry_execute_transition_integration(self):
        """Test TransitionRegistry.execute_transition method"""

        class SimpleTransition(BaseTransition):
            """Simple transition for testing"""

            message: str = Field(default='test')

            @property
            def target_state(self) -> str:
                return 'COMPLETED'

            def transition(self, context):
                return {'message': self.message}

            def execute(self, context):
                # Create a mock state record
                state_record = Mock()
                state_record.id = 'test-uuid'
                state_record.state = self.target_state
                return state_record

        transition_registry.register('testentity', 'simple_transition', SimpleTransition)

        # Mock the StateManager methods used in TransitionRegistry
        with patch.object(StateManager, 'get_current_state_object') as mock_get_state:
            mock_get_state.return_value = None

            result = transition_registry.execute_transition(
                entity_name='testentity',
                transition_name='simple_transition',
                entity=self.entity,
                transition_data={'message': 'Hello'},
                user=None,
            )

            assert result is not None
            assert result.state == 'COMPLETED'

    def test_registry_state_model_with_denormalizer(self):
        """Test StateModelRegistry with denormalizer function"""

        mock_state_model = Mock()
        mock_state_model.__name__ = 'MockStateModel'

        def test_denormalizer(entity):
            return {'custom_field': f'denormalized_{entity.pk}'}

        # Register with denormalizer
        state_model_registry.register_model('testentity', mock_state_model, test_denormalizer)

        # Check denormalizer was stored
        denormalizer = state_model_registry.get_denormalizer('testentity')
        assert denormalizer is not None

        result = denormalizer(self.entity)
        assert result == {'custom_field': 'denormalized_1'}

    def test_registry_denormalizer_error_handling(self):
        """Test denormalizer error handling in state model registry"""

        mock_state_model = Mock()
        mock_state_model.__name__ = 'MockStateModel'

        def failing_denormalizer(entity):
            raise RuntimeError('Denormalizer failed')

        state_model_registry.register_model('testentity', mock_state_model, failing_denormalizer)

        # Should handle denormalizer errors gracefully
        denormalizer = state_model_registry.get_denormalizer('testentity')
        with pytest.raises(RuntimeError):
            denormalizer(self.entity)

    def test_registry_overwrite_warning(self):
        """Test warning when overwriting existing registry entries"""

        mock_state_model1 = Mock()
        mock_state_model1.__name__ = 'MockModel1'
        mock_state_model2 = Mock()
        mock_state_model2.__name__ = 'MockModel2'

        # Register first model
        state_model_registry.register_model('testentity', mock_state_model1)

        # Register second model (should warn about overwrite)
        with patch('fsm.registry.logger') as mock_logger:
            state_model_registry.register_model('testentity', mock_state_model2)

            # Should have logged warning about overwrite
            mock_logger.warning.assert_called_once()
            warning_msg = mock_logger.warning.call_args[0][0]
            assert 'Overwriting existing state model' in warning_msg
            assert 'testentity' in warning_msg
            assert 'Previous:' in warning_msg
            assert 'New:' in warning_msg

    def test_registry_clear_methods(self):
        """Test registry clear methods"""

        # Add some test data
        mock_state_model = Mock()
        mock_state_model.__name__ = 'MockStateModel'
        state_model_registry.register_model('testentity', mock_state_model)

        class TestTransition(BaseTransition):
            @property
            def target_state(self) -> str:
                return 'TEST'

            def transition(self, context):
                return {}

        transition_registry.register('testentity', 'test_transition', TestTransition)

        # Verify data exists
        assert state_model_registry.get_model('testentity') is not None
        assert 'test_transition' in transition_registry.get_transitions_for_entity('testentity')

        # Clear registries
        state_model_registry.clear()
        transition_registry.clear()

        # Verify data is cleared
        assert state_model_registry.get_model('testentity') is None
        assert transition_registry.get_transitions_for_entity('testentity') == {}

    def test_registry_decorator_functions(self):
        """Test decorator functions for registration"""

        # Test state model decorator
        @register_state_model('decorated_entity')
        class DecoratedStateModel:
            pass

        # Should be registered
        assert state_model_registry.get_model('decorated_entity') == DecoratedStateModel

        # Test transition decorator
        @register_state_transition('decorated_entity', 'decorated_transition')
        class DecoratedTransition(BaseTransition):
            @property
            def target_state(self) -> str:
                return 'DECORATED'

            def transition(self, context):
                return {}

        # Should be registered
        transitions = transition_registry.get_transitions_for_entity('decorated_entity')
        assert 'decorated_transition' in transitions
        assert transitions['decorated_transition'] == DecoratedTransition
