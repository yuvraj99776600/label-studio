from django.middleware.common import CommonMiddleware


def get_current_request():
    from core.current_context import CurrentContext

    """returns the request object for this thread"""
    result = CurrentContext.get_request()
    return result


class ThreadLocalMiddleware(CommonMiddleware):
    def process_request(self, request):
        from core.current_context import CurrentContext

        CurrentContext.set_request(request)

    def process_response(self, request, response):
        from core.current_context import CurrentContext

        if CurrentContext.get_request():
            CurrentContext.clear()
        return response

    def process_exception(self, request, exception):
        from core.current_context import CurrentContext

        if CurrentContext.get_request():
            CurrentContext.clear()
