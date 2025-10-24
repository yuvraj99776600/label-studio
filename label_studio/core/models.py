import json
import logging
from typing import Any, Dict, Optional

from django.core import serializers
from django.db import models
from django.db.models import JSONField
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)


class HsModel(models.Model):
    """
    History State Model - Base class for models that participate in FSM state tracking.

    This class provides explicit FSM integration through model lifecycle hooks,
    replacing the implicit signal-based approach with predictable, testable behavior.

    Key features:
    - Intercepts save operations to trigger FSM transitions
    - Tracks field changes for transition logic
    - Maintains CurrentContext for user/org tracking
    - Provides explicit transition determination
    - Fails gracefully - FSM errors don't break saves

    Usage:
        class Task(HsModel):
            # ... model fields ...

            def _determine_fsm_transition(self) -> Optional[str]:
                if self._state.adding:  # Creating new instance
                    return 'task_created'

                changed = self._get_changed_fields()
                if 'is_labeled' in changed and changed['is_labeled'][1]:
                    return 'task_labeled'

                return None

            def _get_fsm_transition_data(self) -> Dict[str, Any]:
                return {
                    'project_id': self.project_id,
                    'overlap': self.overlap
                }
    """

    class Meta:
        abstract = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Track original field values for change detection
        self._original_values = {}
        if self.pk:
            self._capture_original_values()

    def _capture_original_values(self):
        """
        Capture current field values for change detection.

        This allows us to detect which fields changed during save operations,
        which is crucial for determining appropriate FSM transitions.
        """
        for field in self._meta.fields:
            self._original_values[field.name] = getattr(self, field.name, None)

    def _get_changed_fields(self) -> Dict[str, tuple]:
        """
        Get fields that changed since the last load/save.

        Returns:
            Dict mapping field names to (old_value, new_value) tuples

        Example:
            changed = self._get_changed_fields()
            if 'is_labeled' in changed:
                old_val, new_val = changed['is_labeled']
                if not old_val and new_val:
                    # Task became labeled
                    pass
        """
        changed = {}
        for field in self._meta.fields:
            old_value = self._original_values.get(field.name)
            new_value = getattr(self, field.name, None)
            if old_value != new_value:
                changed[field.name] = (old_value, new_value)
        return changed

    def _determine_fsm_transition(self) -> Optional[str]:
        """
        Determine which FSM transition should be triggered based on model state.

        Override this in subclasses to provide entity-specific transition logic.
        This method is called after save() completes successfully.

        Returns:
            The transition name to execute, or None if no transition needed

        Example:
            def _determine_fsm_transition(self) -> Optional[str]:
                if self._state.adding:
                    return 'annotation_submitted'

                changed = self._get_changed_fields()
                if 'was_cancelled' in changed and changed['was_cancelled'][1]:
                    return 'annotation_cancelled'

                return None
        """
        return None

    def _get_fsm_transition_data(self) -> Dict[str, Any]:
        """
        Get data to pass to the FSM transition.

        Override in subclasses to provide transition-specific data that should
        be stored in the state record's context_data field.

        Returns:
            Dictionary of data to pass to transition

        Example:
            def _get_fsm_transition_data(self) -> Dict[str, Any]:
                return {
                    'project_id': self.project_id,
                    'completed_by_id': self.completed_by_id,
                    'annotation_count': self.annotations.count()
                }
        """
        return {}

    def _should_execute_fsm(self) -> bool:
        """
        Check if FSM processing should be executed.

        Can be overridden in subclasses to add custom logic for when
        FSM should be skipped (e.g., during bulk operations).

        Returns:
            True if FSM should execute, False otherwise
        """
        # Check if FSM is globally enabled via feature flag
        try:
            from core.current_request import CurrentContext
            from core.feature_flags import flag_set

            user = CurrentContext.get_user()
            return flag_set('fflag_feat_fit_568_finite_state_management', user=user)
        except Exception:
            return False

    def save(self, *args, **kwargs):
        """
        Override save to trigger FSM transitions based on model changes.

        This method:
        1. Captures the current state (creating vs updating)
        2. Performs the actual database save
        3. Determines if an FSM transition is needed
        4. Executes the transition if needed
        5. Gracefully handles FSM errors without breaking the save

        Args:
            *args: Positional arguments passed to super().save()
            **kwargs: Keyword arguments passed to super().save()
                     Special kwarg: skip_fsm=True to bypass FSM processing

        Returns:
            Whatever super().save() returns
        """
        # Check for explicit FSM skip flag
        skip_fsm = kwargs.pop('skip_fsm', False)

        # Check if this is a creation vs update
        is_creating = self._state.adding

        # Capture changed fields before save (only for updates)
        changed_fields = {} if is_creating else self._get_changed_fields()

        # Perform the actual save
        result = super().save(*args, **kwargs)

        # After successful save, trigger FSM transition if enabled and not skipped
        if not skip_fsm and self._should_execute_fsm():
            try:
                transition_name = self._determine_fsm_transition()
                if transition_name:
                    self._execute_fsm_transition(
                        transition_name=transition_name, is_creating=is_creating, changed_fields=changed_fields
                    )
            except Exception as e:
                # Log error but don't break the save operation
                # The model save succeeded, FSM transition failure is non-critical
                logger.error(
                    f'FSM transition failed for {self.__class__.__name__} {self.pk}',
                    extra={
                        'event': 'fsm.transition_failed_on_save',
                        'entity_type': self.__class__.__name__,
                        'entity_id': self.pk,
                        'transition_name': transition_name,
                        'error': str(e),
                        'is_creating': is_creating,
                    },
                    exc_info=True,
                )

        # Update original values after save for next time
        self._capture_original_values()

        return result

    def _execute_fsm_transition(self, transition_name: str, is_creating: bool, changed_fields: Dict[str, tuple]):
        """
        Execute an FSM transition.

        This method handles the actual transition execution, including:
        - Getting current context (user, org_id)
        - Preparing transition data
        - Calling the state manager

        Args:
            transition_name: Name of the registered transition to execute
            is_creating: Whether this is a new model creation
            changed_fields: Dict of changed fields (field_name -> (old, new))
        """
        from core.current_request import CurrentContext
        from fsm.state_manager import get_state_manager

        StateManager = get_state_manager()
        user = CurrentContext.get_user()
        org_id = CurrentContext.get_organization_id()

        # Get transition-specific data from the model
        transition_data = self._get_fsm_transition_data()

        # Add metadata about the change
        transition_data.update(
            {
                'is_creating': is_creating,
                'changed_fields': {k: {'old': v[0], 'new': v[1]} for k, v in changed_fields.items()},
            }
        )

        logger.info(
            f'Executing FSM transition for {self.__class__.__name__}',
            extra={
                'event': 'fsm.transition_executing',
                'entity_type': self.__class__.__name__,
                'entity_id': self.pk,
                'transition_name': transition_name,
                'is_creating': is_creating,
                'user_id': user.id if user else None,
                'organization_id': org_id,
            },
        )

        # Execute the registered transition
        try:
            StateManager.execute_transition(
                entity=self,
                transition_name=transition_name,
                transition_data=transition_data,
                user=user,
                organization_id=org_id,
            )

            logger.info(
                f'FSM transition executed successfully for {self.__class__.__name__}',
                extra={
                    'event': 'fsm.transition_success',
                    'entity_type': self.__class__.__name__,
                    'entity_id': self.pk,
                    'transition_name': transition_name,
                    'user_id': user.id if user else None,
                    'organization_id': org_id,
                },
            )
        except Exception:
            # Re-raise to be caught by save() method
            raise


class AsyncMigrationStatus(models.Model):
    meta = JSONField(
        'meta',
        null=True,
        default=dict,
        help_text='Meta is for any params for migrations, e.g.: project, filter or error message.',
    )

    project = models.ForeignKey(
        'projects.Project',
        related_name='asyncmigrationstatus',
        on_delete=models.CASCADE,
        null=True,
        help_text='Project ID for this migration',
    )

    name = models.TextField('migration_name', help_text='Migration name')

    STATUS_STARTED = 'STARTED'
    STATUS_IN_PROGRESS = 'IN PROGRESS'
    STATUS_FINISHED = 'FINISHED'
    STATUS_ERROR = 'ERROR'
    STATUS_CHOICES = (
        (STATUS_STARTED, 'Migration is started or queued.'),
        (STATUS_IN_PROGRESS, 'Migration is in progress. Check meta for job_id or status.'),
        (STATUS_FINISHED, 'Migration completed successfully.'),
        (STATUS_ERROR, 'Migration completed with errors. Check meta for more info.'),
    )
    status = models.CharField(max_length=100, choices=STATUS_CHOICES, null=True, default=None)

    created_at = models.DateTimeField(_('created at'), auto_now_add=True, help_text='Creation time')
    updated_at = models.DateTimeField(_('updated at'), auto_now=True, help_text='Last updated time')

    def __str__(self):
        return f'(id={self.id}) ' + self.name + (' at project ' + str(self.project) if self.project else '')


class DeletedRow(models.Model):
    """
    Model to store deleted rows of other models.
    Useful for using as backup for deleted rows, in case we need to restore them.
    """

    model = models.CharField(max_length=1024)   # tasks.task, projects.project, etc.
    row_id = models.IntegerField(null=True)   # primary key of the deleted row. task.id, project.id, etc.
    data = JSONField(null=True, blank=True)   # serialized json of the deleted row.
    reason = models.TextField(null=True, blank=True)   # reason for deletion.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # optional fields for searching purposes
    organization_id = models.IntegerField(null=True, blank=True)
    project_id = models.IntegerField(null=True, blank=True)
    user_id = models.IntegerField(null=True, blank=True)

    @classmethod
    def serialize_and_create(cls, model, **kwargs) -> 'DeletedRow':
        data = json.loads(serializers.serialize('json', [model]))[0]
        model = data['model']
        row_id = int(data['pk'])
        return cls.objects.create(model=model, row_id=row_id, data=data, **kwargs)

    @classmethod
    def bulk_serialize_and_create(cls, queryset, **kwargs) -> list['DeletedRow']:
        serialized_data = json.loads(serializers.serialize('json', queryset))
        bulk_objects = []
        for data in serialized_data:
            model = data['model']
            row_id = int(data['pk'])
            bulk_objects.append(cls(model=model, row_id=row_id, data=data, **kwargs))
        return cls.objects.bulk_create(bulk_objects)
