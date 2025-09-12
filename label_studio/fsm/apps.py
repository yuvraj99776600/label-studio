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
        # Check if this is Community edition - only register signals for Community
        from django.conf import settings

        version_edition = getattr(settings, 'VERSION_EDITION', 'Community')

        if version_edition != 'Community':
            logger.info(f'Label Studio FSM: Skipping initialization for {version_edition} edition')
            return

        logger.info('Label Studio FSM app ready, initializing core integrations for Community edition')

        # Import signal handlers to register them (only for Community edition)
        try:
            from . import signals  # noqa: F401

            logger.info('Label Studio FSM signal handlers registered successfully')
        except Exception as e:
            logger.error(
                'FSM: Failed to register Label Studio FSM signal handlers',
                extra={
                    'event': 'fsm.signal_registration_error',
                    'error': str(e),
                },
                exc_info=True,
            )
