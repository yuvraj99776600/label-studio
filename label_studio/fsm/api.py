from core.permissions import all_permissions
from django_filters import CharFilter, DateTimeFilter, FilterSet, NumberFilter
from django_filters.rest_framework import DjangoFilterBackend
from fsm.registry import get_state_model
from fsm.serializers import StateModelSerializer
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination


class FSMEntityHistoryPagination(PageNumberPagination):
    page_size_query_param = 'page_size'
    page_size = 100
    max_page_size = 1000


class FSMEntityHistoryFilterSet(FilterSet):
    created_at_from = DateTimeFilter(
        field_name='created_at',
        lookup_expr='gte',
        label='Filter for state history items created at or after the ISO 8601 formatted date (YYYY-MM-DDTHH:MM:SS)',
    )
    created_at_to = DateTimeFilter(
        field_name='created_at',
        lookup_expr='lte',
        label='Filter for state history items created at or before the ISO 8601 formatted date (YYYY-MM-DDTHH:MM:SS)',
    )
    state = CharFilter(field_name='state', lookup_expr='iexact')
    previous_state = CharFilter(field_name='previous_state', lookup_expr='iexact')
    transition_name = CharFilter(field_name='transition_name', lookup_expr='iexact')
    triggered_by = NumberFilter(field_name='triggered_by', lookup_expr='exact')


class FSMEntityHistoryAPI(generics.ListAPIView):
    # TODO: Manage permissions per entity correctly, including per object permissions.
    # Ex: Task state history only for users with permissions to that task
    permission_required = all_permissions.organizations_view
    serializer_class = StateModelSerializer
    pagination_class = FSMEntityHistoryPagination
    filter_backends = [DjangoFilterBackend]   # Removes other backends like OrderingFilter
    filterset_class = FSMEntityHistoryFilterSet

    def get_queryset(self):
        state_model = get_state_model(self.kwargs['entity_name'])
        qs = state_model.get_state_history(self.kwargs['entity_id'])
        qs = qs.filter(organization_id=self.request.user.active_organization_id)
        qs = qs.prefetch_related('triggered_by__om_through')
        return qs
