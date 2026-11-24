import { LFM_VL_450M, LOCAL_MODEL_FREE_SPACE_MARGIN_BYTES } from '@/constants/localModels';

import {
  buildInstalledRecord,
  checkSpace,
  classifyDownloadFailure,
  downloadFraction,
  filesFor,
  installFolderName,
  installHasProjector,
  isCurrentInstall,
  isUpdateAvailable,
  modelFileUrl,
  modelSupportsLanguage,
  parseInstalledRecord,
  requiredFreeBytes,
  staleInstallFolders,
  totalDownloadBytes,
} from '../install';

const WITH = { withProjector: true };
const WITHOUT = { withProjector: false };

describe('selection and sizes', () => {
  it('leaves the projector out when photos are not wanted', () => {
    expect(filesFor(LFM_VL_450M, WITH).map((f) => f.role)).toEqual(['model', 'projector']);
    expect(filesFor(LFM_VL_450M, WITHOUT).map((f) => f.role)).toEqual(['model']);
  });

  it('sums the bytes of the selection', () => {
    expect(totalDownloadBytes(LFM_VL_450M, WITH)).toBe(219311264 + 102815168);
    expect(totalDownloadBytes(LFM_VL_450M, WITHOUT)).toBe(219311264);
  });

  it('downloads from the pinned revision, never a branch', () => {
    const url = modelFileUrl(LFM_VL_450M, LFM_VL_450M.files[0]);
    expect(url).toBe(
      `https://huggingface.co/LiquidAI/LFM2.5-VL-450M-GGUF/resolve/${LFM_VL_450M.revision}/LFM2.5-VL-450M-Q4_0.gguf`
    );
    expect(url).not.toContain('/main/');
  });
});

describe('checkSpace', () => {
  it('needs the download plus the margin', () => {
    const needed = requiredFreeBytes(LFM_VL_450M, WITH);
    expect(needed).toBe(
      totalDownloadBytes(LFM_VL_450M, WITH) + LOCAL_MODEL_FREE_SPACE_MARGIN_BYTES
    );
    expect(checkSpace(needed, LFM_VL_450M, WITH)).toEqual({ enough: true });
    expect(checkSpace(needed - 1, LFM_VL_450M, WITH)).toEqual({
      enough: false,
      neededBytes: needed,
      freeBytes: needed - 1,
    });
  });

  it('does not block on an unreadable figure', () => {
    expect(checkSpace(null, LFM_VL_450M, WITH)).toEqual({ enough: true });
    expect(checkSpace(NaN, LFM_VL_450M, WITH)).toEqual({ enough: true });
  });
});

describe('downloadFraction', () => {
  it('clamps and handles an unknown total', () => {
    expect(downloadFraction(50, 100)).toBe(0.5);
    expect(downloadFraction(500, 100)).toBe(1);
    expect(downloadFraction(10, 0)).toBe(0);
    expect(downloadFraction(-1, 100)).toBe(0);
  });
});

describe('installed record', () => {
  it('round-trips and is current for its own manifest', () => {
    const record = buildInstalledRecord(LFM_VL_450M, WITH, 123);
    const parsed = parseInstalledRecord(JSON.stringify(record));
    expect(parsed).toEqual(record);
    expect(isCurrentInstall(parsed, LFM_VL_450M)).toBe(true);
    expect(installHasProjector(parsed)).toBe(true);
  });

  it('a text-only install is still current, without a projector', () => {
    const parsed = parseInstalledRecord(
      JSON.stringify(buildInstalledRecord(LFM_VL_450M, WITHOUT, 1))
    );
    expect(isCurrentInstall(parsed, LFM_VL_450M)).toBe(true);
    expect(installHasProjector(parsed)).toBe(false);
  });

  it('is not current when the hash, size or revision differ', () => {
    const record = buildInstalledRecord(LFM_VL_450M, WITH, 1);
    const tampered = { ...record, files: record.files.map((f) => ({ ...f, sha256: 'x' })) };
    expect(isCurrentInstall(tampered, LFM_VL_450M)).toBe(false);
    const smaller = { ...record, files: record.files.map((f) => ({ ...f, bytes: 1 })) };
    expect(isCurrentInstall(smaller, LFM_VL_450M)).toBe(false);
    const older = { ...record, revision: 'old' };
    expect(isCurrentInstall(older, LFM_VL_450M)).toBe(false);
    expect(isUpdateAvailable(older, LFM_VL_450M)).toBe(true);
    expect(isUpdateAvailable(record, LFM_VL_450M)).toBe(false);
  });

  it('reads garbage as not installed', () => {
    expect(parseInstalledRecord(null)).toBeNull();
    expect(parseInstalledRecord('')).toBeNull();
    expect(parseInstalledRecord('{')).toBeNull();
    expect(parseInstalledRecord('{"id":1}')).toBeNull();
    expect(isCurrentInstall(null, LFM_VL_450M)).toBe(false);
  });

  it('is not current with the projector alone', () => {
    const record = buildInstalledRecord(LFM_VL_450M, WITH, 1);
    const onlyProjector = { ...record, files: record.files.filter((f) => f.role === 'projector') };
    expect(isCurrentInstall(onlyProjector, LFM_VL_450M)).toBe(false);
  });
});

describe('staleInstallFolders', () => {
  it('keeps every folder until the current one is complete', () => {
    expect(
      staleInstallFolders(['old@1', installFolderName(LFM_VL_450M)], LFM_VL_450M, false)
    ).toEqual([]);
  });

  it('removes everything but the current folder once it is complete', () => {
    expect(
      staleInstallFolders(['old@1', installFolderName(LFM_VL_450M)], LFM_VL_450M, true)
    ).toEqual(['old@1']);
  });
});

describe('classifyDownloadFailure', () => {
  it('maps status, space and cancel messages', () => {
    expect(classifyDownloadFailure(404, null)).toBe('http');
    expect(classifyDownloadFailure(null, 'ENOSPC: no space left')).toBe('noSpace');
    expect(classifyDownloadFailure(null, 'Download cancelled')).toBe('interrupted');
    expect(classifyDownloadFailure(null, 'Network request failed')).toBe('network');
  });

  it('does not call an unnamed or storage failure "offline"', () => {
    expect(
      classifyDownloadFailure(
        null,
        "Call to function 'ExponentFileSystem.makeDirectoryAsync' has been rejected. Location 'file:///x' isn't writable."
      )
    ).toBe('storage');
    expect(classifyDownloadFailure(null, 'something odd')).toBe('interrupted');
  });
});

describe('modelSupportsLanguage', () => {
  it('matches the base language', () => {
    expect(modelSupportsLanguage(LFM_VL_450M, 'pt-BR')).toBe(true);
    expect(modelSupportsLanguage(LFM_VL_450M, 'en-US')).toBe(true);
    expect(modelSupportsLanguage(LFM_VL_450M, 'ru-RU')).toBe(false);
    expect(modelSupportsLanguage(LFM_VL_450M, 'nl-NL')).toBe(false);
    expect(modelSupportsLanguage(LFM_VL_450M, '')).toBe(true);
  });
});
