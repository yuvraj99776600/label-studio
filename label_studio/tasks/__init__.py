"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""

# Register FSM transitions for Task, Annotation, and AnnotationDraft models
try:
    from tasks import (
        annotation_draft_transitions,  # noqa: F401
        annotation_transitions,  # noqa: F401
        transitions,  # noqa: F401
    )
except ImportError:
    # FSM may not be available in all configurations
    pass
