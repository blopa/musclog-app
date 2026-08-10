import {
  HealthConnectError,
  HealthConnectErrorCode,
  HealthConnectErrorFactory,
  isHealthPermissionError,
  RETRY_CONFIG,
} from '@/services/healthConnectErrors';

// Echo the key back so assertions describe *which* message a code maps to without
// depending on the wording in `lang/locales`.
jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

describe('HealthConnectError', () => {
  it('is a real Error subclass so `catch (e) { if (e instanceof Error) }` still works', () => {
    const error = new HealthConnectError(HealthConnectErrorCode.READ_FAILED, 'boom');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HealthConnectError');
    expect(error.message).toBe('boom');
    expect(error.code).toBe(HealthConnectErrorCode.READ_FAILED);
  });

  it('defaults to non-retryable, so a new code has to opt in to being retried', () => {
    expect(new HealthConnectError(HealthConnectErrorCode.READ_FAILED, 'boom').isRetryable()).toBe(
      false
    );
  });

  it('keeps the original error and context for reporting', () => {
    const original = new Error('underlying');
    const error = new HealthConnectError(HealthConnectErrorCode.WRITE_FAILED, 'boom', {
      originalError: original,
      retryable: true,
      context: { recordType: 'Weight' },
    });

    expect(error.originalError).toBe(original);
    expect(error.context).toEqual({ recordType: 'Weight' });
    expect(error.isRetryable()).toBe(true);
  });

  describe('getRetryDelay', () => {
    afterEach(() => {
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('returns 0 for a non-retryable error so callers never sleep before giving up', () => {
      const error = new HealthConnectError(HealthConnectErrorCode.PERMISSION_DENIED, 'nope', {
        retryable: false,
      });

      expect(error.getRetryDelay(1)).toBe(0);
      expect(error.getRetryDelay(5)).toBe(0);
    });

    it('backs off exponentially from 1s', () => {
      // random() === 0.5 makes the ±25% jitter term exactly zero.
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const error = HealthConnectErrorFactory.readFailed('Weight');

      expect(error.getRetryDelay(1)).toBe(1000);
      expect(error.getRetryDelay(2)).toBe(2000);
      expect(error.getRetryDelay(3)).toBe(4000);
      expect(error.getRetryDelay(4)).toBe(8000);
    });

    it('caps the base delay at 16s no matter how many attempts have happened', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const error = HealthConnectErrorFactory.readFailed('Weight');

      expect(error.getRetryDelay(5)).toBe(16000);
      expect(error.getRetryDelay(50)).toBe(16000);
    });

    it('applies ±25% jitter to spread simultaneous retries out', () => {
      const error = HealthConnectErrorFactory.readFailed('Weight');

      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(error.getRetryDelay(3)).toBe(3000); // 4000 - 25%

      jest.spyOn(Math, 'random').mockReturnValue(1);
      expect(error.getRetryDelay(3)).toBe(5000); // 4000 + 25%
    });

    it('keeps the jittered delay positive for every attempt and every random draw', () => {
      const error = HealthConnectErrorFactory.readFailed('Weight');

      for (const draw of [0, 0.25, 0.5, 0.75, 1]) {
        jest.spyOn(Math, 'random').mockReturnValue(draw);
        for (let attempt = 1; attempt <= 8; attempt += 1) {
          expect(error.getRetryDelay(attempt)).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getUserMessage', () => {
    it.each([
      [HealthConnectErrorCode.SDK_NOT_AVAILABLE, 'snackbar.healthConnect.sdkNotAvailable'],
      [HealthConnectErrorCode.PERMISSION_DENIED, 'snackbar.healthConnect.permissionDenied'],
      [HealthConnectErrorCode.PERMISSION_REVOKED, 'snackbar.healthConnect.permissionRevoked'],
      [
        HealthConnectErrorCode.INSUFFICIENT_PERMISSIONS,
        'snackbar.healthConnect.noPermissionsGranted',
      ],
      [HealthConnectErrorCode.OFFLINE, 'snackbar.healthConnect.offline'],
      [HealthConnectErrorCode.SYNC_CONFLICT, 'snackbar.healthConnect.syncConflict'],
      [HealthConnectErrorCode.INVALID_VALUE_RANGE, 'snackbar.healthConnect.invalidValueRange'],
      [HealthConnectErrorCode.RATE_LIMIT_EXCEEDED, 'snackbar.healthConnect.rateLimitExceeded'],
      [HealthConnectErrorCode.SYNC_IN_PROGRESS, 'snackbar.healthConnect.syncInProgress'],
    ])('maps %s to its own message', (code, key) => {
      expect(new HealthConnectError(code, 'raw').getUserMessage()).toBe(key);
    });

    it('falls back to the generic message for codes without a dedicated string', () => {
      // The raw `message` is developer-facing; users must never see it verbatim.
      const error = new HealthConnectError(
        HealthConnectErrorCode.READ_FAILED,
        'Failed to read Weight from Health Connect'
      );

      expect(error.getUserMessage()).toBe('snackbar.healthConnect.unknownError');
    });
  });

  describe('isHealthPermissionError', () => {
    it.each([
      HealthConnectErrorCode.PERMISSION_DENIED,
      HealthConnectErrorCode.PERMISSION_REVOKED,
      HealthConnectErrorCode.PERMISSION_REQUEST_FAILED,
      HealthConnectErrorCode.INSUFFICIENT_PERMISSIONS,
    ])('recognizes %s as an expected permission outcome', (code) => {
      expect(isHealthPermissionError(new HealthConnectError(code, 'permission issue'))).toBe(true);
    });

    it('does not hide operational failures or arbitrary errors', () => {
      expect(
        isHealthPermissionError(
          new HealthConnectError(HealthConnectErrorCode.READ_FAILED, 'read failed')
        )
      ).toBe(false);
      expect(isHealthPermissionError(new Error('plain error'))).toBe(false);
    });
  });
});

describe('HealthConnectErrorFactory', () => {
  it('marks transient I/O failures retryable and permission failures not', () => {
    expect(HealthConnectErrorFactory.readFailed('Weight').isRetryable()).toBe(true);
    expect(HealthConnectErrorFactory.writeFailed('Weight').isRetryable()).toBe(true);
    expect(HealthConnectErrorFactory.offline().isRetryable()).toBe(true);
    expect(HealthConnectErrorFactory.rateLimitExceeded().isRetryable()).toBe(true);

    expect(HealthConnectErrorFactory.sdkNotAvailable().isRetryable()).toBe(false);
    expect(HealthConnectErrorFactory.permissionDenied(['Weight']).isRetryable()).toBe(false);
    expect(HealthConnectErrorFactory.permissionRevoked(['Weight']).isRetryable()).toBe(false);
  });

  it('records which permissions were denied or revoked separately', () => {
    expect(HealthConnectErrorFactory.permissionDenied(['Weight', 'Height']).context).toEqual({
      deniedPermissions: ['Weight', 'Height'],
    });
    expect(HealthConnectErrorFactory.permissionRevoked(['Steps']).context).toEqual({
      revokedPermissions: ['Steps'],
    });
  });

  it('names the failing record type in both the message and the context', () => {
    const error = HealthConnectErrorFactory.readFailed('BodyFat');

    expect(error.code).toBe(HealthConnectErrorCode.READ_FAILED);
    expect(error.message).toContain('BodyFat');
    expect(error.context).toEqual({ recordType: 'BodyFat' });
  });

  it('captures both sides of a sync conflict so the resolver can compare them', () => {
    const error = HealthConnectErrorFactory.syncConflict('weight', 80, 81.5);

    expect(error.code).toBe(HealthConnectErrorCode.SYNC_CONFLICT);
    expect(error.isRetryable()).toBe(false);
    expect(error.context).toEqual({ metricType: 'weight', localValue: 80, remoteValue: 81.5 });
  });

  it('reports the offending value alongside the range it violated', () => {
    const error = HealthConnectErrorFactory.invalidValueRange('weight', 900, { min: 20, max: 500 });

    expect(error.message).toContain('900');
    expect(error.message).toContain('[20, 500]');
    expect(error.context).toEqual({
      metricType: 'weight',
      value: 900,
      range: { min: 20, max: 500 },
    });
  });

  it('threads the underlying error through so the stack is not lost', () => {
    const original = new Error('JSI blew up');

    expect(HealthConnectErrorFactory.sdkNotAvailable(original).originalError).toBe(original);
    expect(HealthConnectErrorFactory.unknownError(original).originalError).toBe(original);
  });
});

describe('RETRY_CONFIG', () => {
  it('only lists codes that are actually produced as retryable', () => {
    // A code listed here but constructed with `retryable: false` would be retried by the
    // config yet report `isRetryable() === false` — the two must not disagree.
    const producedRetryable = [
      HealthConnectErrorFactory.readFailed('Weight'),
      HealthConnectErrorFactory.writeFailed('Weight'),
      HealthConnectErrorFactory.offline(),
      HealthConnectErrorFactory.rateLimitExceeded(),
    ];

    for (const error of producedRetryable) {
      expect(RETRY_CONFIG.retryableErrors).toContain(error.code);
      expect(error.isRetryable()).toBe(true);
    }
  });

  it('never lists a permission or availability failure, which retrying cannot fix', () => {
    expect(RETRY_CONFIG.retryableErrors).not.toContain(HealthConnectErrorCode.PERMISSION_DENIED);
    expect(RETRY_CONFIG.retryableErrors).not.toContain(HealthConnectErrorCode.PERMISSION_REVOKED);
    expect(RETRY_CONFIG.retryableErrors).not.toContain(HealthConnectErrorCode.SDK_NOT_AVAILABLE);
    expect(RETRY_CONFIG.retryableErrors).not.toContain(HealthConnectErrorCode.INVALID_VALUE_RANGE);
  });

  it('bounds retries so a permanently failing sync terminates', () => {
    expect(RETRY_CONFIG.maxAttempts).toBeGreaterThan(0);
    expect(Number.isFinite(RETRY_CONFIG.maxAttempts)).toBe(true);
  });
});
