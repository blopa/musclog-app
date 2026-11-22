// The app reacts to these Worker error codes (utils/premium/workerError.ts). Each one must be a
// code the Worker can actually answer, or the app would wait for an error that never comes.
import { describe, expect, it } from 'vitest';
import { WORKER_ERROR_CODES } from '../../../utils/premium/workerError';
import { ERROR_CODES } from '../src/http';

describe('error contract', () => {
  it('every code the app reacts to is a Worker code', () => {
    for (const code of WORKER_ERROR_CODES) {
      expect(ERROR_CODES, code).toContain(code);
    }
  });
});
