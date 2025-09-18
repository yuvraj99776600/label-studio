"""Middleware for FSM context caching."""

from fsm.context_cache import FSMContextCache


class FSMContextCacheMiddleware:
    """
    Middleware that sets up FSM context cache for the duration of a request.

    This ensures that all FSM operations during a request share the same
    organization ID cache, avoiding redundant database lookups.

    Add to settings.MIDDLEWARE:
        'fsm.middleware.FSMContextCacheMiddleware',
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        with FSMContextCache():
            response = self.get_response(request)
        return response