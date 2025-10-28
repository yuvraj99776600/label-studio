"""Tasks Django App Configuration"""

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class TasksConfig(AppConfig):
    name = 'tasks'

    def ready(self):
        """
        Import FSM transitions after Django app registry is ready.

        This prevents circular imports by ensuring all models are
        loaded before transitions reference them.
        """
        try:
            # Import transitions to register them with FSM
            from tasks import (
                annotation_transitions,  # noqa: F401
                transitions,  # noqa: F401
            )

            logger.debug('FSM transitions registered for tasks app')
        except ImportError as e:
            # FSM may not be available in all configurations
            logger.debug(f'FSM transitions not available for tasks: {e}')
