"""Projects Django App Configuration"""

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class ProjectsConfig(AppConfig):
    name = 'projects'

    def ready(self):
        """
        Import FSM transitions after Django app registry is ready.

        This prevents circular imports by ensuring all models are
        loaded before transitions reference them.
        """
        try:
            # Import transitions to register them with FSM
            from projects import transitions  # noqa: F401

            logger.debug('FSM transitions registered for projects app')
        except ImportError as e:
            # FSM may not be available in all configurations
            logger.debug(f'FSM transitions not available for projects: {e}')
