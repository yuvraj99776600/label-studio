from contextvars import ContextVar
from typing import TYPE_CHECKING, Any, Dict, Optional

if TYPE_CHECKING:
    from django.http import Request
    from users.models import User

context_var: ContextVar[Optional[Dict[str, Any]]] = ContextVar('current_context', default=None)


class CurrentContext:
    """
    Context object available across the entire request/worker context.
    This is used to store contextual information that is needed across the entire request/worker context like organization_id, user, etc.

    In workers this needs to explicitly be set when running the worker.
    In requests this is set automatically by the ThreadLocalMiddleware.
    """

    @classmethod
    def _ensure_context(cls) -> Dict[str, Any]:
        """Ensure context exists, creating empty one if needed"""
        ctx = context_var.get()
        if ctx is None:
            ctx = {}
            context_var.set(ctx)
        return ctx

    @classmethod
    def set(cls, key: str, value: Any) -> None:
        current = cls._ensure_context()
        new_context = {**current, key: value}
        context_var.set(new_context)

    @classmethod
    def get(cls, key: str, default: Any = None) -> Any:
        return cls._ensure_context().get(key, default)

    @classmethod
    def is_initialized(cls) -> bool:
        return context_var.get() is not None

    @classmethod
    def update(cls, data: Dict[str, Any]) -> None:
        current = cls._ensure_context()
        context_var.set({**current, **data})

    # Convenient properties for common values
    @classmethod
    def get_request(cls) -> Optional['Request']:
        return cls.get('request')

    @classmethod
    def set_request(cls, request: 'Request') -> None:
        cls.set('request', request)
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
        if user.active_organization_id:
            cls.set_organization_id(user.active_organization_id)

    @classmethod
    def get_all(cls) -> Dict[str, Any]:
        return cls._ensure_context().copy()

    @classmethod
    def is_worker(cls) -> bool:
        return cls.get_request() is None

    @classmethod
    def clear(cls) -> None:
        context_var.set(None)
