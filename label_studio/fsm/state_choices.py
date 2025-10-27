"""
FSM state choices registry system.

This module provides the infrastructure for registering and managing
state choices for different entity types in the FSM framework.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from fsm.registry import register_state_choices

"""
Core state choice enums for Label Studio entities.
These enums define the essential states for core Label Studio entities.
"""


@register_state_choices('task')
class TaskStateChoices(models.TextChoices):
    """
    Core task states for basic Label Studio workflow.
    Simplified states covering the essential task lifecycle:
    - Creation and assignment
    - Annotation work
    - Completion
    """

    # Initial State
    CREATED = 'CREATED', _('Created')

    # Work States
    IN_PROGRESS = 'IN_PROGRESS', _('In Progress')

    # Terminal State
    COMPLETED = 'COMPLETED', _('Completed')


@register_state_choices('annotation')
class AnnotationStateChoices(models.TextChoices):
    """
    Core annotation states for basic Label Studio workflow.
    Simplified states covering the essential annotation lifecycle:
    - Submission
    - Completion
    """

    # Working States
    SUBMITTED = 'SUBMITTED', _('Submitted')

    # Terminal State
    COMPLETED = 'COMPLETED', _('Completed')


@register_state_choices('project')
class ProjectStateChoices(models.TextChoices):
    """
    Core project states for basic Label Studio workflow.
    Simplified states covering the essential project lifecycle:
    - Setup and configuration
    - Active work
    - Completion
    """

    # Setup States
    CREATED = 'CREATED', _('Created')

    # Work States
    IN_PROGRESS = 'IN_PROGRESS', _('In Progress')

    # Terminal State
    COMPLETED = 'COMPLETED', _('Completed')


@register_state_choices('annotationdraft')
class AnnotationDraftStateChoices(models.TextChoices):
    """
    Draft annotation lifecycle states.
    Handles the complete draft workflow from creation through auto-save to final submission.
    Separate from annotation states to allow independent draft management.
    """

    # Creation States
    CREATED = 'CREATED', _('Created')
    AUTO_SAVED = 'AUTO_SAVED', _('Auto Saved')

    # User Action States
    ACTIVE = 'ACTIVE', _('Active')  # User actively editing
    POSTPONED = 'POSTPONED', _('Postponed')  # User postponed draft

    # Completion States
    SUBMITTED = 'SUBMITTED', _('Submitted')  # Converted to annotation
    DISCARDED = 'DISCARDED', _('Discarded')  # Draft discarded
    EXPIRED = 'EXPIRED', _('Expired')  # Draft expired
