from core.current_context import CurrentContext
from django.middleware.common import CommonMiddleware


def get_current_request():
    """returns the request object for this thread"""
    result = CurrentContext.get_request()
    return result


class ThreadLocalMiddleware(CommonMiddleware):
    def process_request(self, request):
        CurrentContext.set_request(request)

    def process_response(self, request, response):
        if CurrentContext.get_request():
            CurrentContext.clear()
        return response

    def process_exception(self, request, exception):
        if CurrentContext.get_request():
            CurrentContext.clear()
