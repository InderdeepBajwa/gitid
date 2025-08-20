export enum ErrorCode {
  IDENTITY_NOT_FOUND = 'IDENTITY_NOT_FOUND',
  IDENTITY_EXISTS = 'IDENTITY_EXISTS',
  INVALID_ALIAS = 'INVALID_ALIAS',
  SSH_KEY_ERROR = 'SSH_KEY_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  GIT_ERROR = 'GIT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  BACKUP_ERROR = 'BACKUP_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR'
}

export class GitIdError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'GitIdError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }
}

export class ValidationError extends GitIdError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

export class IdentityNotFoundError extends GitIdError {
  constructor(alias: string) {
    super(
      ErrorCode.IDENTITY_NOT_FOUND,
      `Identity '${alias}' not found`,
      { alias }
    );
    this.name = 'IdentityNotFoundError';
  }
}

export class IdentityExistsError extends GitIdError {
  constructor(alias: string) {
    super(
      ErrorCode.IDENTITY_EXISTS,
      `Identity '${alias}' already exists`,
      { alias }
    );
    this.name = 'IdentityExistsError';
  }
}

export class SecurityError extends GitIdError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.SECURITY_ERROR, message, details, false);
    this.name = 'SecurityError';
  }
}

export class GitError extends GitIdError {
  constructor(message: string, description?: string, details?: unknown) {
    super(ErrorCode.GIT_ERROR, `${message}${description ? ': ' + description : ''}`, details);
    this.name = 'GitError';
  }
}

export class SystemError extends GitIdError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.SYSTEM_ERROR, message, details, false);
    this.name = 'SystemError';
  }
}

export function isGitIdError(error: unknown): error is GitIdError {
  return error instanceof GitIdError;
}

export function handleError(error: unknown): GitIdError {
  if (isGitIdError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new SystemError(error.message, { 
      originalError: error.name,
      stack: error.stack 
    });
  }
  
  return new SystemError('An unknown error occurred', { error });
}