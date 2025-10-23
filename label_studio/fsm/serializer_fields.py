"""
FSM Serializer Fields for Django Rest Framework.

Provides reusable DRF serializer fields for exposing FSM state in API responses.
These fields work seamlessly with the FSMStateQuerySetMixin annotations to prevent
N+1 queries.

Usage:
    from fsm.serializer_fields import FSMStateField

    class TaskSerializer(serializers.ModelSerializer):
        state = FSMStateField(read_only=True)

        class Meta:
            model = Task
            fields = ['id', 'data', 'state', ...]

Note:
    All state serialization functionality is guarded by the FSM feature flag
    ('fflag_feat_fit_568_finite_state_management'). When disabled, fields return None.

    Both feature flag and StateManager imports are done at function level to avoid
    circular imports during Django initialization (feature_flags imports models).
"""

from rest_framework import serializers


class FSMStateField(serializers.ReadOnlyField):
    """
    Read-only DRF field for exposing FSM state.

    This field automatically uses the `state` or `current_state` annotation if present
    (preventing N+1 queries), or falls back to querying the state manager
    if the annotation is missing.

    Key features:
    - Works with annotated querysets (no N+1 queries)
    - Falls back to StateManager for single object retrievals
    - Always read-only (state changes through transitions only)
    - Returns None if FSM is disabled or no state exists

    Example with annotations (optimal):
        # In your viewset
        def get_queryset(self):
            return Task.objects.all().annotate_fsm_state()

        # In your serializer
        class TaskSerializer(serializers.ModelSerializer):
            state = FSMStateField()

            class Meta:
                model = Task
                fields = ['id', 'data', 'state']

        # Result: No N+1 queries, state comes from annotation

    Example without annotations (fallback):
        # Direct object retrieval
        task = Task.objects.get(id=123)
        serializer = TaskSerializer(task)

        # Result: Calls StateManager.get_current_state_value()
        # Still efficient due to StateManager caching
    """

    def __init__(self, **kwargs):
        kwargs.setdefault('source', '*')
        super().__init__(**kwargs)

    def to_representation(self, instance):
        """
        Serialize the FSM state to a string.

        Args:
            instance: The model instance being serialized

        Returns:
            str or None: The current state value (None if feature flag disabled)
        """
        # Import at function level to avoid circular imports during Django initialization
        # (both feature_flags and StateManager import models which aren't ready during app loading)
        from core.current_request import CurrentContext
        from core.feature_flags import flag_set
        from fsm.state_manager import StateManager

        # Check feature flag directly (works for both core and enterprise)
        # Using flag_set directly instead of is_fsm_enabled to work in enterprise context
        user = CurrentContext.get_user()
        if not flag_set('fflag_feat_fit_568_finite_state_management', user=user):
            return None

        if instance is None:
            return None

        # Check if the instance has a state annotation
        # This can come from Data Manager's annotate_state() or FSMStateQuerySetMixin.annotate_fsm_state()
        if hasattr(instance, 'state'):
            # Use the annotated value (no additional query)
            return instance.state
        elif hasattr(instance, 'current_state'):
            # Fallback to current_state annotation from FSMStateQuerySetMixin
            return instance.current_state

        # Fallback: Query the state manager
        # This happens when the queryset wasn't annotated
        # StateManager has its own caching, so this is still efficient
        try:
            return StateManager.get_current_state_value(instance)
        except Exception:
            # If FSM is disabled or state model not found, return None
            return None

    def to_internal_value(self, data):
        """
        This field is read-only, so this should never be called.
        """
        raise NotImplementedError('FSMStateField is read-only. Use transitions to change state.')


class FSMStateMetadataField(serializers.Field):
    """
    Read-only DRF field for exposing FSM state with metadata.

    Returns a dictionary containing:
    - state: Current state value
    - previous_state: Previous state value (if any)
    - created_at: When the current state was entered
    - triggered_by: User ID who triggered the transition

    This field requires the FSMMultiStateQuerySetMixin.annotate_fsm_state_with_metadata()
    annotation for optimal performance.

    Example:
        # In your viewset
        def get_queryset(self):
            return Task.objects.all().annotate_fsm_state_with_metadata()

        # In your serializer
        class TaskSerializer(serializers.ModelSerializer):
            state_info = FSMStateMetadataField(source='*')

            class Meta:
                model = Task
                fields = ['id', 'data', 'state_info']

        # Response:
        {
            "id": 123,
            "data": {...},
            "state_info": {
                "state": "IN_PROGRESS",
                "previous_state": "CREATED",
                "created_at": "2025-10-23T10:30:00Z",
                "triggered_by": 42
            }
        }
    """

    def __init__(self, **kwargs):
        kwargs['read_only'] = True
        kwargs['required'] = False
        kwargs['allow_null'] = True
        super().__init__(**kwargs)

    def to_representation(self, value):
        """
        Serialize the FSM state metadata to a dictionary.

        Args:
            value: The model instance

        Returns:
            dict or None: State metadata dictionary (None if feature flag disabled)
        """
        # Import at function level to avoid circular imports during Django initialization
        # (both feature_flags and StateManager import models which aren't ready during app loading)
        from core.current_request import CurrentContext
        from core.feature_flags import flag_set
        from fsm.state_manager import StateManager

        # Check feature flag directly (works for both core and enterprise)
        # Using flag_set directly instead of is_fsm_enabled to work in enterprise context
        user = CurrentContext.get_user()
        if not flag_set('fflag_feat_fit_568_finite_state_management', user=user):
            return None

        instance = (
            value
            if not hasattr(self, 'parent')
            else (self.parent.instance if hasattr(self.parent, 'instance') else value)
        )

        if instance is None:
            return None

        # Check for annotations from annotate_fsm_state_with_metadata() or Data Manager
        if hasattr(instance, 'state'):
            return {
                'state': instance.state,
                'previous_state': getattr(instance, 'previous_state', None),
                'created_at': getattr(instance, 'state_created_at', None),
                'triggered_by': getattr(instance, 'state_triggered_by_id', None),
            }
        elif hasattr(instance, 'current_state'):
            return {
                'state': instance.current_state,
                'previous_state': getattr(instance, 'previous_state', None),
                'created_at': getattr(instance, 'state_created_at', None),
                'triggered_by': getattr(instance, 'state_triggered_by_id', None),
            }

        # Fallback: Get state object from StateManager
        try:
            state_obj = StateManager.get_current_state_object(instance)
            if state_obj:
                return {
                    'state': state_obj.state,
                    'previous_state': state_obj.previous_state,
                    'created_at': state_obj.created_at,
                    'triggered_by': state_obj.triggered_by_id,
                }
        except Exception:
            pass

        return None

    def to_internal_value(self, data):
        """
        This field is read-only, so this should never be called.
        """
        raise NotImplementedError('FSMStateMetadataField is read-only. Use transitions to change state.')
