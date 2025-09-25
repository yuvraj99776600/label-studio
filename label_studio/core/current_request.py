from core.current_context import CurrentContext
from django.core.signals import request_finished
from django.dispatch import receiver
from django.middleware.common import CommonMiddleware


def get_current_request():

    """returns the request object for this thread"""
    result = CurrentContext.get_request()
    return result


class ThreadLocalMiddleware(CommonMiddleware):
    def process_request(self, request):
        CurrentContext.set_request(request)


@receiver(request_finished)
def clean_request(sender, **kwargs):
    CurrentContext.clear()
