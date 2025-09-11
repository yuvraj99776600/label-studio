"""FSM Django App Configuration"""

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class FsmConfig(AppConfig):
    default_auto_field = 'django.db.models.UUIDField'
    name = 'fsm'
    verbose_name = 'Label Studio FSM'

    def ready(self):
        """Initialize FSM integration when the app is ready"""
        logger.info('Label Studio FSM app ready, initializing core integrations')

        # Import signal handlers to register them
        try:
            from . import signals  # noqa: F401

            logger.info('Label Studio FSM signal handlers registered successfully')
        except Exception as e:
            logger.error(f'Failed to register Label Studio FSM signal handlers: {str(e)}', exc_info=True)
