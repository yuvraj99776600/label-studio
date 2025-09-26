from threading import local

from django.core.signals import request_finished
from django.dispatch import receiver
from django.middleware.common import CommonMiddleware
from typing import Any, Optional
#from label_studio.core.models import User

_thread_locals = local()


def get_current_request():
    """returns the request object for this thread"""
    #result = getattr(_thread_locals, 'request', None)
    result = CurrentContext.get_request()
    return result


class ThreadLocalMiddleware(CommonMiddleware):
    def process_request(self, request):
        #_thread_locals.request = request
        CurrentContext.set_request(request)


@receiver(request_finished)
def clean_request(sender, **kwargs):
    if hasattr(_thread_locals, 'request'):
        del _thread_locals.request


class CurrentContext:
    @classmethod
    def set(cls, key: str, value: Any, shared: bool = True) -> None:
        if not hasattr(_thread_locals, 'data'):
            _thread_locals.data = {}
        if not hasattr(_thread_locals, 'job_data'):
            _thread_locals.job_data = {}

        if shared:
            _thread_locals.job_data[key] = value
        else:
            _thread_locals.data[key] = value

    @classmethod
    def get(cls, key: str, default: Any = None) -> Any:
        return getattr(_thread_locals, 'job_data', {}).get(key, getattr(_thread_locals, 'data', {}).get(key, default))

    @classmethod
    def get_user(cls):
        return _thread_locals.request.user

    @classmethod
    def set_request(cls, request):
        _thread_locals.request = request
        if request.user:
            cls.set_user(request.user)

    @classmethod
    def get_organization_id(cls) -> Optional[int]:
        return cls.get('organization_id')

    @classmethod
    def set_organization_id(cls, organization_id: int) -> None:
        cls.set('organization_id', organization_id)

    @classmethod
    def get_user(cls) -> Optional['User']:
        return cls.get('user')

    @classmethod
    def set_user(cls, user: 'User') -> None:
        cls.set('user', user)
        if getattr(user, 'active_organization_id', None):
            cls.set_organization_id(user.active_organization_id)

    @classmethod
    def is_job(cls) -> bool:
        return cls.get_request() is None

    @classmethod
    def get_job_data(cls) -> dict:
        """
        This data will be shared to jobs spawned by the current thread.
        """
        job_data = getattr(_thread_locals, 'job_data', {})
        print(f"job_data: {job_data}")

        if job_data:
            return job_data
        return {}

    @classmethod
    def clear(cls) -> None:
        if hasattr(_thread_locals, 'data'):
            delattr(_thread_locals, 'data')

        if hasattr(_thread_locals, 'job_data'):
            delattr(_thread_locals, 'job_data')

        if hasattr(_thread_locals, 'request'):
            delattr(_thread_locals, 'request')

    @classmethod
    def get_request(cls):
        return getattr(_thread_locals, 'request', None)
        # return _thread_locals.request
