import threading
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from django.http import Request
    from users.models import User


_thread_locals = threading.local()


class CurrentContext:
    """
    Context object available across the entire request or worker context (not shared between requests or workers, i.e. each request or worker has its own context)
    This is used to store contextual information that is needed across the entire request/worker context like organization_id, user, etc.

    In workers this needs to explicitly be set when running the worker.
    In requests this is set automatically by the ThreadLocalMiddleware.
    """

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
        return _thread_locals.job_data.get(key, _thread_locals.data.get(key, default))

    @classmethod
    def get_request(cls) -> Optional['Request']:
        return getattr(_thread_locals, 'request', None)

    @classmethod
    def set_request(cls, request: 'Request') -> None:
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
        return getattr(_thread_locals, 'job_data', {})

    @classmethod
    def clear(cls) -> None:
        if hasattr(_thread_locals, 'data'):
            delattr(_thread_locals, 'data')

        if hasattr(_thread_locals, 'job_data'):
            delattr(_thread_locals, 'job_data')

        if hasattr(_thread_locals, 'request'):
            delattr(_thread_locals, 'request')
