"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""

# Register FSM transitions for Project model
# This import ensures transitions are registered when the app loads
try:
    from projects import transitions  # noqa: F401
except ImportError:
    # FSM may not be available in all configurations
    pass
