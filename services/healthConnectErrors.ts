/**
 * Health Connect Error Types and Definitions
 * Comprehensive error handling for all Health Connect scenarios
 */

export enum HealthConnectErrorCode {
  // Initialization & SDK Errors
  SDK_NOT_AVAILABLE = 'SDK_NOT_AVAILABLE',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SDK_VERSION_MISMATCH = 'SDK_VERSION_MISMATCH',

  // Permission Errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  PERMISSION_REQUEST_FAILED = 'PERMISSION_REQUEST_FAILED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Data Read Errors
  READ_FAILED = 'READ_FAILED',
  READ_TIMEOUT = 'READ_TIMEOUT',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',

  // Data Write Errors
  WRITE_FAILED = 'WRITE_FAILED',
  WRITE_TIMEOUT = 'WRITE_TIMEOUT',
  DUPLICATE_DATA = 'DUPLICATE_DATA',
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',

  // Data Validation Errors
  INVALID_VALUE_RANGE = 'INVALID_VALUE_RANGE',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_UNIT = 'INVALID_UNIT',
  INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',

  // Sync Errors
  SYNC_FAILED = 'SYNC_FAILED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  OFFLINE = 'OFFLINE',

  // Rate Limiting & Quota
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',

  // Unknown/Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class HealthConnectError extends Error {
  code: HealthConnectErrorCode;
  originalError?: Error;
  retryable: boolean;
  context?: Record<string, unknown>;

  constructor(
    code: HealthConnectErrorCode,
    message: string,
    options?: {
      originalError?: Error;
      retryable?: boolean;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'HealthConnectError';
    this.code = code;
    this.originalError = options?.originalError;
    this.retryable = options?.retryable ?? false;
    this.context = options?.context;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HealthConnectError);
    }
  }

  /**
   * Get user-friendly error message for display
   */
  getUserMessage(): string {
    // TODO: use i18n.t('message') here
    switch (this.code) {
      case HealthConnectErrorCode.SDK_NOT_AVAILABLE:
        return 'Health Connect is not available on this device. Please install it from the Play Store.';
      case HealthConnectErrorCode.PERMISSION_DENIED:
        return 'Health Connect permissions were denied. Please grant permissions to sync health data.';
      case HealthConnectErrorCode.PERMISSION_REVOKED:
        return 'Health Connect permissions were revoked. Please re-enable them in settings.';
      case HealthConnectErrorCode.OFFLINE:
        return 'No internet connection. Health data will sync when you are back online.';
      case HealthConnectErrorCode.SYNC_CONFLICT:
        return 'Health data conflict detected. Using most recent data.';
      case HealthConnectErrorCode.INVALID_VALUE_RANGE:
        return 'Invalid health data value. Please check your input.';
      case HealthConnectErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment and try again.';
      case HealthConnectErrorCode.SYNC_IN_PROGRESS:
        return 'Sync already in progress. Please wait for it to complete.';
      default:
        return 'An error occurred while syncing health data. Please try again.';
    }
  }

  /**
   * Check if error is retryable with exponential backoff
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get recommended retry delay in milliseconds
   */
  getRetryDelay(attemptNumber: number): number {
    if (!this.retryable) {
      return 0;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    const baseDelay = 1000;
    const maxDelay = 16000;
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);

    // Add jitter (±25%) to prevent thundering herd
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }
}

/**
 * Factory methods for common error scenarios
 */
export class HealthConnectErrorFactory {
  static sdkNotAvailable(originalError?: Error): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.SDK_NOT_AVAILABLE,
      'Health Connect SDK is not available on this device',
      { originalError, retryable: false }
    );
  }

  static permissionDenied(permissions: string[]): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.PERMISSION_DENIED,
      'Health Connect permissions were denied',
      {
        retryable: false,
        context: { deniedPermissions: permissions },
      }
    );
  }

  static permissionRevoked(permissions: string[]): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.PERMISSION_REVOKED,
      'Health Connect permissions were revoked',
      {
        retryable: false,
        context: { revokedPermissions: permissions },
      }
    );
  }

  static readFailed(recordType: string, originalError?: Error): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.READ_FAILED,
      `Failed to read ${recordType} from Health Connect`,
      {
        originalError,
        retryable: true,
        context: { recordType },
      }
    );
  }

  static writeFailed(recordType: string, originalError?: Error): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.WRITE_FAILED,
      `Failed to write ${recordType} to Health Connect`,
      {
        originalError,
        retryable: true,
        context: { recordType },
      }
    );
  }

  static invalidValueRange(
    metricType: string,
    value: number,
    range: { min: number; max: number }
  ): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.INVALID_VALUE_RANGE,
      `${metricType} value ${value} is outside valid range [${range.min}, ${range.max}]`,
      {
        retryable: false,
        context: { metricType, value, range },
      }
    );
  }

  static syncInProgress(): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.SYNC_IN_PROGRESS,
      'A sync operation is already in progress',
      { retryable: true }
    );
  }

  static offline(): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.OFFLINE,
      'Device is offline. Cannot sync health data',
      { retryable: true }
    );
  }

  static rateLimitExceeded(retryAfterMs?: number): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded. Too many requests to Health Connect',
      {
        retryable: true,
        context: { retryAfterMs },
      }
    );
  }

  static syncConflict(
    metricType: string,
    localValue: unknown,
    remoteValue: unknown
  ): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.SYNC_CONFLICT,
      `Sync conflict detected for ${metricType}`,
      {
        retryable: false,
        context: { metricType, localValue, remoteValue },
      }
    );
  }

  static unknownError(originalError?: Error): HealthConnectError {
    return new HealthConnectError(
      HealthConnectErrorCode.UNKNOWN_ERROR,
      'An unknown error occurred with Health Connect',
      {
        originalError,
        retryable: true,
      }
    );
  }
}

/**
 * Retry configuration for different error types
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  retryableErrors: [
    HealthConnectErrorCode.READ_FAILED,
    HealthConnectErrorCode.WRITE_FAILED,
    HealthConnectErrorCode.READ_TIMEOUT,
    HealthConnectErrorCode.WRITE_TIMEOUT,
    HealthConnectErrorCode.NETWORK_ERROR,
    HealthConnectErrorCode.CONNECTION_TIMEOUT,
    HealthConnectErrorCode.RATE_LIMIT_EXCEEDED,
    HealthConnectErrorCode.SYNC_FAILED,
    HealthConnectErrorCode.OFFLINE,
  ],
};
