import CryptoJS from 'crypto-js';

import { decodeCycleFile, encryptCycleBackup } from '@/services/cycleRecovery';
import { CYCLE_BACKUP_KDF_ITERATIONS } from '../backupCrypto';

const plain = JSON.stringify({
  format: 'musclog-cycle',
  version: 1,
  periods: [],
  dayLogs: [],
  contexts: [],
  moods: [],
});
// Exercise the actual AES/HMAC/PBKDF2 primitives with a cheap work factor in the test process.
const actualPbkdf2 = CryptoJS.PBKDF2;
const derive = jest
  .spyOn(CryptoJS, 'PBKDF2')
  .mockImplementation((password, salt, options) =>
    actualPbkdf2(password, salt, { ...options, iterations: 20 })
  );
afterAll(() => derive.mockRestore());

it('restores an encrypted backup with its exact password and randomizes each backup', async () => {
  const file = await encryptCycleBackup(plain, ' private password ');
  expect(file).not.toContain('dayLogs');
  expect(await decodeCycleFile(file, ' private password ')).toBe(plain);
  expect(await encryptCycleBackup(plain, ' private password ')).not.toBe(file);
  expect(derive).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({ iterations: CYCLE_BACKUP_KDF_ITERATIONS })
  );
});
it('rejects the wrong password and tampered ciphertext or metadata before parsing records', async () => {
  const file = await encryptCycleBackup(plain, 'password-123');
  await expect(decodeCycleFile(file, 'wrong-password')).rejects.toThrow();
  const object = JSON.parse(file);
  await expect(
    decodeCycleFile(
      JSON.stringify({
        ...object,
        payload: `${object.payload[0] === 'a' ? 'b' : 'a'}${object.payload.slice(1)}`,
      }),
      'password-123'
    )
  ).rejects.toThrow();
  await expect(
    decodeCycleFile(JSON.stringify({ ...object, iterations: 1 }), 'password-123')
  ).rejects.toThrow();
  await expect(decodeCycleFile(file, '')).rejects.toThrow();
});
it('accepts plaintext input and refuses a short password', async () => {
  expect(await decodeCycleFile(plain, '')).toBe(plain);
  await expect(encryptCycleBackup(plain, 'short')).rejects.toThrow();
});
