"""FSM Django App Configuration"""

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class FsmConfig(AppConfig):
    default_auto_field = 'django.db.models.UUIDField'
    name = 'fsm'
    verbose_name = 'Label Studio FSM'

    def ready(self):
        """
        Import models and state_choices to ensure registration happens on Django startup.

        The @register_state_model and @register_state_choices decorators run during
        module import, so we must import these modules to populate the registries.
        This ensures state models are available throughout the application lifecycle.
        """
        # Import models to trigger @register_state_model decorators
        # Import state_choices to trigger @register_state_choices decorators
        from fsm import (
            models,  # noqa: F401
            state_choices,  # noqa: F401
        )

        logger.debug('FSM models and state choices registered')
