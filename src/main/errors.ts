/** Errors that are safe to surface to the renderer with a user-facing message. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} not found`, 'NOT_FOUND', { entity, id })
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', details)
  }
}

export interface IpcErrorPayload {
  message: string
  code: string
}

export function toIpcError(error: unknown): IpcErrorPayload {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code }
  }
  return { message: 'An unexpected error occurred.', code: 'INTERNAL_ERROR' }
}
