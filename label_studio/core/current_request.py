from threading import local

from django.core.signals import request_finished
from django.dispatch import receiver
from django.middleware.common import CommonMiddleware

_thread_locals = local()


def get_current_request():
    """returns the request object for this thread"""
    result = getattr(_thread_locals, 'request', None)
    return result


class ThreadLocalMiddleware(CommonMiddleware):
    def process_request(self, request):
        _thread_locals.request = request


@receiver(request_finished)
def clean_request(sender, **kwargs):
    if hasattr(_thread_locals, 'request'):
        del _thread_locals.request


class CurrentContext:
    @classmethod
    def get_user(cls):
        return _thread_locals.request.user
    
    @classmethod
    def set_user(self, user):
        _thread_locals.request.user = user
    
    @classmethod
    def clear(self):
        del _thread_locals.request

    @classmethod
    def get_organization_id(self):
        return _thread_locals.request.user.active_organization.id
    
    @classmethod
    def set_organization_id(self, organization_id):
        _thread_locals.request.user.active_organization_id = organization_id
        _thread_locals.request.user.save()
    
    @classmethod
    def clear(self):
        del _thread_locals.request


    @classmethod
    def get_job_data(self):
        return {}