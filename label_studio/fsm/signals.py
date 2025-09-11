"""
Django signal handlers for Label Studio core FSM integrations.

These signal handlers provide automatic state transitions for core Label Studio
workflows. They are designed to:
1. Work only when enterprise is not present
2. Respect the same feature flags as enterprise
3. Provide basic state tracking without interfering with enterprise functionality
4. Be resilient to errors (never break core functionality)
"""

import logging
from typing import Optional

from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def get_user_from_instance(instance) -> Optional[User]:
    """
    Extract user from model instance using common field patterns.
    
    Args:
        instance: Django model instance
        
    Returns:
        User instance if found, None otherwise
    """
    # Try common user field patterns
    for field in ['created_by', 'updated_by', 'completed_by', 'user']:
        if hasattr(instance, field):
            user = getattr(instance, field)
            if isinstance(user, User):
                return user
    return None


@receiver(post_save)
def handle_model_state_transitions(sender, instance, created, **kwargs):
    """
    Universal signal handler for model state transitions.
    
    This handler automatically detects model types and triggers
    appropriate state transitions based on the model type and
    creation/update context.
    
    Args:
        sender: Model class that sent the signal
        instance: Model instance that was saved
        created: True if this is a new instance
        **kwargs: Additional signal arguments
    """
    from fsm.integrations import is_fsm_enabled
    
    # Early exit if FSM is not enabled (includes enterprise check)
    if not is_fsm_enabled():
        return
        
    user = get_user_from_instance(instance)
    model_name = sender.__name__.lower()
    
    try:
        # Handle Project state transitions
        if model_name == 'project':
            if created:
                from fsm.integrations import project_created
                project_created(instance, user=user)
                logger.debug(f'FSM: Project {instance.id} created')
        
        # Handle Task state transitions  
        elif model_name == 'task':
            if created:
                from fsm.integrations import task_created, project_started
                task_created(instance, user=user)
                
                # Also trigger project started if this is the first task
                if hasattr(instance, 'project'):
                    project_started(instance.project, user=user)
                    
                logger.debug(f'FSM: Task {instance.id} created')
        
        # Handle Annotation state transitions
        elif model_name == 'annotation':
            if created:
                from fsm.integrations import annotation_submitted, task_started
                annotation_submitted(instance, user=user)
                
                # Also trigger task started if this is the first annotation
                if hasattr(instance, 'task'):
                    task_started(instance.task, user=user)
                    
                logger.debug(f'FSM: Annotation {instance.id} submitted')
            
            # Handle annotation completion (when is_completed flag is set)
            elif hasattr(instance, 'is_completed') and instance.is_completed:
                from fsm.integrations import annotation_completed, task_completed
                annotation_completed(instance, user=user)
                
                # Check if task should be marked completed
                if hasattr(instance, 'task'):
                    task = instance.task
                    # Simple heuristic: if task has is_labeled=True, mark as completed
                    if getattr(task, 'is_labeled', False):
                        task_completed(task, user=user)
                        
                logger.debug(f'FSM: Annotation {instance.id} completed')
    
    except Exception as e:
        # Log error but don't raise - FSM errors should never break core functionality
        logger.error(f'FSM: Error in signal handler for {model_name}: {str(e)}', exc_info=True)