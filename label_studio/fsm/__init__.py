"""
Finite State Machine (FSM) core functionality for Label Studio.

This package provides the core FSM infrastructure that can be extended
by Label Studio Enterprise and other applications.

Core components:
- BaseState: Abstract model for all state tracking
- StateManager: High-performance state management
- Core state choices for basic entities
- UUID7 utilities for time-series optimization
- FSMStateQuerySetMixin: QuerySet mixin for annotating state (prevents N+1 queries)
- FSMStateField: DRF serializer field for exposing state in APIs
"""

from fsm.queryset_mixins import FSMMultiStateQuerySetMixin, FSMStateQuerySetMixin
from fsm.serializer_fields import FSMStateField, FSMStateMetadataField

__all__ = [
    'FSMStateQuerySetMixin',
    'FSMMultiStateQuerySetMixin',
    'FSMStateField',
    'FSMStateMetadataField',
]
