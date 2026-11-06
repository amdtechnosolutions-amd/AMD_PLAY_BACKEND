export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, 'VALIDATION_ERROR', errors);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_REQUIRED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class BookingConflictError extends AppError {
  constructor(message = 'Selected slot is already held or booked by another customer') {
    super(message, 409, 'SLOT_ALREADY_BOOKED');
  }
}

export class TenantIsolationError extends AppError {
  constructor(message = 'Access denied: Tenant context mismatch or missing') {
    super(message, 403, 'TENANT_ISOLATION_VIOLATION');
  }
}

export class DeviceOfflineError extends AppError {
  constructor(message = 'Access device / IoT controller is currently offline') {
    super(message, 503, 'DEVICE_OFFLINE');
  }
}
