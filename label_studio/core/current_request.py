from core.current_context import CurrentContext
from django.middleware.common import CommonMiddleware


def get_current_request():
    """returns the request object for this thread"""
    result = CurrentContext.get_request()
    return result


class ThreadLocalMiddleware(CommonMiddleware):
    def process_request(self, request):
        CurrentContext.set_request(request)


# ContextVars are self-cleaning, so we don't need to clean up the request object in a signal like the previous thread based solution.
# This is also compliant with the ASGI spec.
