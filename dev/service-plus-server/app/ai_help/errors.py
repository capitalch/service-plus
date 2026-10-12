"""Errors shared by the Ask AI providers and service."""


class ProviderBusyError(Exception):
    """The model refused for capacity: quota exceeded (429) or overloaded (503)."""
