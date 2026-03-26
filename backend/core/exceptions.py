"""Custom exceptions."""


class AppException(Exception):
    """Base application exception."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UnauthorizedError(AppException):
    """401 Unauthorized."""

    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message, 401)


class ForbiddenError(AppException):
    """403 Forbidden."""

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, 403)


class NotFoundError(AppException):
    """404 Not Found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, 404)


class ValidationError(AppException):
    """422 Validation error."""

    def __init__(self, message: str = "Validation error"):
        super().__init__(message, 422)
