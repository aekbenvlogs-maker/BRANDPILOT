# -*- coding: utf-8 -*-
# BRANDPILOT — backend/exceptions.py
# Base exception hierarchy for the BRANDPILOT platform.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations


class BrandpilotError(Exception):
    """Base class for all BRANDSCALE domain exceptions.

    All application-specific exceptions must inherit from this class
    to allow catch-all handlers to distinguish domain errors from
    unexpected runtime errors.

    Attributes:
        message: Human-readable error description.
        code:    Optional machine-readable error code for API responses.
    """

    def __init__(self, message: str, code: str | None = None) -> None:
        """Initialise the base error.

        Args:
            message: Human-readable description of the error.
            code:    Optional machine-readable code (e.g. "AMBIGUOUS_PROMPT").
        """
        super().__init__(message)
        self.message = message
        self.code = code or self.__class__.__name__.upper()

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(code={self.code!r}, message={self.message!r})"
