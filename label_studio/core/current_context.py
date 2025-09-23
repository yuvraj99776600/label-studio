import threading
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from django.http import Request
    from users.models import User


class CurrentContext:
    """
    Context object available across the entire request or worker context (not shared between requests or workers, i.e. each request or worker has its own context)
    This is used to store contextual information that is needed across the entire request/worker context like organization_id, user, etc.

    In workers this needs to explicitly be set when running the worker.
    In requests this is set automatically by the ThreadLocalMiddleware.
    """

    _context = threading.local()

    @classmethod
    def set(cls, key: str, value: Any) -> None:
        if not hasattr(cls._context, 'data'):
            cls._context.data = {}
        cls._context.data[key] = value

    @classmethod
    def get(cls, key: str, default: Any = None) -> Any:
        if not hasattr(cls._context, 'data'):
            return default
        return cls._context.data.get(key, default)

    # Convenient properties for common values
    @classmethod
    def get_request(cls) -> Optional['Request']:
        if not hasattr(cls._context, 'request'):
            return None
        return cls._context.request

    @classmethod
    def set_request(cls, request: 'Request') -> None:
        cls._context.request = request
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
        if cls.is_worker():
            return cls.get('user')

        return cls.get_request().user

    @classmethod
    def set_user(cls, user: 'User') -> None:
        cls.set('user', user)
        if getattr(user, 'active_organization_id', None):
            cls.set_organization_id(user.active_organization_id)

    @classmethod
    def is_job(cls) -> bool:
        return cls.get_request() is None

    @classmethod
    def clear(cls) -> None:
        if hasattr(cls._context, 'data'):
            delattr(cls._context, 'data')

        if hasattr(cls._context, 'request'):
            delattr(cls._context, 'request')
