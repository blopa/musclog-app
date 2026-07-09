import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WasmBoyJoypadState } from 'wasmboy';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import { isProduction } from '@/utils/app';
import {
  readAndDecodeGameBoySaves,
  seedGameBoyDemoData,
  seedGameBoyTodayDate,
} from '@/utils/decodeGameBoySave';
import { shouldSeedDevData } from '@/utils/file';

const GB_SCREEN_WIDTH = 160;
const GB_SCREEN_HEIGHT = 144;

// Hold a tap for at least this long (~5 frames at 60fps) so the emulator's
// per-frame joypad poll reliably samples it, even when the press and release
// land within a single frame.
const MIN_PRESS_MS = 90;

function withExpoBaseUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = process.env.EXPO_BASE_URL;
  if (base == null || base === '') {
    return path;
  }

  const basePath = String(base).replace(/^\/+|\/+$/g, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === `/${basePath}` || normalized.startsWith(`/${basePath}/`)) {
    return normalized;
  }

  return `/${basePath}${normalized}`;
}

const ROM_URL = withExpoBaseUrl('/images/musclog.gbc');
const MANUAL_URL = withExpoBaseUrl('/images/musclog-manual.pdf');

type JoypadButton = keyof WasmBoyJoypadState;

const JOYPAD_BUTTONS: JoypadButton[] = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'A', 'B', 'SELECT', 'START'];

const DPAD_GLYPHS: Record<'UP' | 'RIGHT' | 'DOWN' | 'LEFT', string> = {
  UP: '^',
  RIGHT: '>',
  DOWN: 'v',
  LEFT: '<',
};

// Keyboard mapping for desktop play (lower-cased key -> joypad button).
const KEY_MAP: Record<string, JoypadButton> = {
  arrowup: 'UP',
  w: 'UP',
  arrowdown: 'DOWN',
  s: 'DOWN',
  arrowleft: 'LEFT',
  a: 'LEFT',
  arrowright: 'RIGHT',
  d: 'RIGHT',
  x: 'A',
  z: 'B',
  enter: 'START',
  shift: 'SELECT',
};

type Status = 'idle' | 'loading' | 'playing' | 'error';

export default function GameBoy() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.gameboy' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joypadRef = useRef<WasmBoyJoypadState>({});
  // The configured WasmBoy module, cached once the emulator starts so input can
  // be flushed synchronously (see flushJoypad below).
  const wasmBoyRef = useRef<{ setJoypadState: (state: WasmBoyJoypadState) => void } | null>(null);
  // When each button was last pressed, plus any pending delayed-release timers,
  // so a quick tap is held long enough for the emulator to sample it.
  const pressedAtRef = useRef<Partial<Record<JoypadButton, number>>>({});
  const releaseTimersRef = useRef<Partial<Record<JoypadButton, ReturnType<typeof setTimeout>>>>({});
  const [status, setStatus] = useState<Status>('idle');

  // Push the current joypad ref into the running emulator. This MUST stay
  // synchronous so it reads joypadRef at call time. An earlier version awaited a
  // dynamic import() first, so by the time it read the ref a fast press+release
  // had already flipped the button back to false — the press never reached the
  // emulator and on-screen taps appeared to do nothing.
  const flushJoypad = useCallback(() => {
    wasmBoyRef.current?.setJoypadState({ ...joypadRef.current });
  }, []);

  const applyButton = useCallback(
    (button: JoypadButton, pressed: boolean) => {
      if (joypadRef.current[button] === pressed) {
        return;
      }
      joypadRef.current[button] = pressed;
      flushJoypad();
    },
    [flushJoypad]
  );

  const clearReleaseTimer = useCallback((button: JoypadButton) => {
    const pendingRelease = releaseTimersRef.current[button];
    if (pendingRelease != null) {
      clearTimeout(pendingRelease);
      delete releaseTimersRef.current[button];
    }
  }, []);

  const setButton = useCallback(
    (button: JoypadButton, pressed: boolean) => {
      clearReleaseTimer(button);

      if (pressed) {
        pressedAtRef.current[button] = Date.now();
        applyButton(button, true);
        return;
      }

      // Defer the release until the press has been held for MIN_PRESS_MS so the
      // emulator's per-frame joypad poll reliably sees a quick tap.
      const heldForMs = Date.now() - (pressedAtRef.current[button] ?? 0);
      const remainingMs = MIN_PRESS_MS - heldForMs;
      if (remainingMs > 0) {
        releaseTimersRef.current[button] = setTimeout(() => {
          delete releaseTimersRef.current[button];
          delete pressedAtRef.current[button];
          applyButton(button, false);
        }, remainingMs);
      } else {
        delete pressedAtRef.current[button];
        applyButton(button, false);
      }
    },
    [applyButton, clearReleaseTimer]
  );

  const releaseAllButtons = useCallback(() => {
    for (const button of JOYPAD_BUTTONS) {
      clearReleaseTimer(button);
      delete pressedAtRef.current[button];
      joypadRef.current[button] = false;
    }
    flushJoypad();
  }, [clearReleaseTimer, flushJoypad]);

  const start = useCallback(async () => {
    if (canvasRef.current == null) {
      return;
    }

    setStatus('loading');
    try {
      const { WasmBoy } = await import('wasmboy');

      await WasmBoy.config(
        {
          headless: false,
          isGbcEnabled: true,
          isAudioEnabled: true,
          gameboyFrameRate: 60,
          audioBatchProcessing: true,
        },
        canvasRef.current
      );

      // We drive input ourselves (keyboard + touch) so on-screen buttons
      // are not overwritten by the built-in per-frame joypad polling.
      WasmBoy.disableDefaultJoypad();
      wasmBoyRef.current = WasmBoy;

      const response = await fetch(ROM_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch ROM: ${response.status}`);
      }
      const rom = new Uint8Array(await response.arrayBuffer());

      // Hand the ROM save data before it boots. Normal mode only seeds today's
      // date for not-yet-onboarded saves; demo mode force-writes a deterministic
      // fully onboarded SRAM image with recent nutrition/bodyweight/workout data.
      // Best-effort: a failure here must never block play.
      try {
        const seedResult = shouldSeedDevData()
          ? await seedGameBoyDemoData(rom)
          : await seedGameBoyTodayDate(rom);
        if (!isProduction()) {
          console.log('[gameboy] seeded save:', seedResult);
        }
      } catch (error) {
        console.error('[gameboy] failed to seed save', error);
      }

      await WasmBoy.loadROM(rom);
      await WasmBoy.play();
      setStatus('playing');
    } catch (error) {
      console.error('[gameboy] failed to start emulator', error);
      setStatus('error');
    }
  }, []);

  // Dev-only: decode and log the persisted cartridge SRAM on load so the whole
  // save (profile, weigh-ins, food log, workouts, custom foods) is inspectable.
  useEffect(() => {
    // TODO: eventually use this to read/write back to the Gameboy stated, based on what is saved into the
    // indexedDb "musclog" database, used in the progress.web.tsx screen
    if (isProduction()) {
      return;
    }

    readAndDecodeGameBoySaves()
      .then((saves) => {
        console.log('[gameboy] decoded save(s):', saves);
      })
      .catch((error) => {
        console.error('[gameboy] failed to decode save', error);
      });
  }, []);

  // Flush the cartridge's battery-backed SRAM (all of the game's saves) to
  // IndexedDB. WasmBoy keeps a fresh copy of cartridge RAM on the main thread
  // (the core pushes it every frame) and restores it automatically inside
  // loadROM() on the next page load, so persisting it is all that's needed.
  const persistSave = useCallback(async () => {
    try {
      const { WasmBoy } = await import('wasmboy');
      if (!WasmBoy.isReady()) {
        return;
      }

      await WasmBoy.saveLoadedCartridge();
    } catch (error) {
      console.error('[gameboy] failed to persist save', error);
    }
  }, []);

  // While playing, react to the user leaving or backgrounding the page. Persist
  // the save on a periodic safety-net interval, on pagehide, on
  // visibilitychange→hidden, and on cleanup (covers client-side navigation away,
  // which fires no unload event). Also release any held buttons on blur or when
  // hidden, so a button can't stick down when focus is lost mid-press (no
  // keyup/pointerup ever arrives).
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const interval = setInterval(() => void persistSave(), 10000);
    const onPageHide = () => void persistSave();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void persistSave();
        releaseAllButtons();
      }
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', releaseAllButtons);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', releaseAllButtons);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void persistSave();
      releaseAllButtons();
    };
  }, [status, persistSave, releaseAllButtons]);

  // Keyboard input (desktop), only while playing.
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const handleKey = (event: KeyboardEvent, pressed: boolean) => {
      const button = KEY_MAP[event.key.toLowerCase()];
      if (button == null) {
        return;
      }
      event.preventDefault();
      setButton(button, pressed);
    };

    const onKeyDown = (event: KeyboardEvent) => handleKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => handleKey(event, false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [status, setButton]);

  // Stop the emulator worker/RAF loop when leaving the page.
  useEffect(() => {
    return () => {
      void import('wasmboy').then(({ WasmBoy }) => {
        if (WasmBoy.isReady()) {
          void WasmBoy.pause();
        }
      });
    };
  }, []);

  // Clear any pending delayed button releases on unmount so no timer fires after
  // the component is gone.
  useEffect(() => {
    const timers = releaseTimersRef.current;
    return () => {
      Object.values(timers).forEach((id) => clearTimeout(id));
      releaseTimersRef.current = {};
    };
  }, []);

  let screenOverlay: ReactNode = (
    <button
      type="button"
      onClick={start}
      className="rounded-full bg-[#00FFA3] px-8 py-3 text-base font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#00FFA3] focus:ring-offset-2 focus:ring-offset-black"
    >
      {t('playButton')}
    </button>
  );

  if (status === 'loading') {
    screenOverlay = <p className="text-sm font-medium text-gray-300">{t('loading')}</p>;
  } else if (status === 'error') {
    screenOverlay = (
      <>
        <p className="text-sm font-medium text-red-400">{t('errorLoad')}</p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-[#00FFA3] px-6 py-2 text-sm font-bold text-black transition-transform hover:-translate-y-0.5"
        >
          {t('playButton')}
        </button>
      </>
    );
  }

  return (
    <>
      <main className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center overflow-hidden px-4 py-16">
        <DotPattern className="text-primary/30" />
        <div className="from-background/60 to-background/80 absolute inset-0 bg-gradient-to-b via-transparent" />

        <div className="relative z-10 mx-auto mt-4 flex w-full max-w-xl flex-col items-center text-center">
          <h1 className="max-w-lg text-balance text-4xl font-black leading-tight text-white sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-md text-balance text-base leading-7 text-gray-300 sm:text-lg">
            {t('subtitle')}
          </p>

          {/* Console screen */}
          <div className="relative mt-10 w-full max-w-sm rounded-3xl border border-white/10 bg-black/70 p-4 shadow-2xl">
            <div className="relative aspect-[160/144] w-full overflow-hidden rounded-xl bg-black">
              <canvas
                ref={canvasRef}
                width={GB_SCREEN_WIDTH}
                height={GB_SCREEN_HEIGHT}
                className="absolute inset-0 h-full w-full"
                style={{ imageRendering: 'pixelated' }}
              />

              {status !== 'playing' ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
                  {screenOverlay}
                </div>
              ) : null}
            </div>
          </div>

          {/* Touch controls */}
          <TouchControls onPress={setButton} disabled={status !== 'playing'} t={t} />

          <p className="mt-8 max-w-md text-xs leading-5 text-gray-500">{t('controlsHint')}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={ROM_URL}
              download="musclog.gbc"
              className="inline-flex items-center gap-2 rounded-full border border-[#00FFA3]/40 bg-[#00FFA3]/10 px-6 py-2 text-sm font-bold text-[#00FFA3] transition-transform hover:-translate-y-0.5"
            >
              {t('downloadRom')}
            </a>
            <a
              href={MANUAL_URL}
              download="musclog-manual.pdf"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              {t('downloadManual')}
            </a>
          </div>
        </div>
      </main>
    </>
  );
}

type TouchControlsProps = {
  onPress: (button: JoypadButton, pressed: boolean) => void;
  disabled: boolean;
  t: (key: string) => string;
};

function TouchControls({ onPress, disabled, t }: TouchControlsProps) {
  return (
    <div
      className="mt-8 flex w-full max-w-sm select-none items-center justify-between gap-6"
      style={{ touchAction: 'none', opacity: disabled ? 0.4 : 1 }}
    >
      {/* D-pad */}
      <div className="relative h-36 w-36">
        <PadButton
          button="UP"
          label={t('up')}
          onPress={onPress}
          disabled={disabled}
          className="left-12 top-0 h-12 w-12 rounded-t-lg"
        >
          {DPAD_GLYPHS.UP}
        </PadButton>
        <PadButton
          button="LEFT"
          label={t('left')}
          onPress={onPress}
          disabled={disabled}
          className="left-0 top-12 h-12 w-12 rounded-l-lg"
        >
          {DPAD_GLYPHS.LEFT}
        </PadButton>
        <PadButton
          button="RIGHT"
          label={t('right')}
          onPress={onPress}
          disabled={disabled}
          className="left-24 top-12 h-12 w-12 rounded-r-lg"
        >
          {DPAD_GLYPHS.RIGHT}
        </PadButton>
        <PadButton
          button="DOWN"
          label={t('down')}
          onPress={onPress}
          disabled={disabled}
          className="left-12 top-24 h-12 w-12 rounded-b-lg"
        >
          {DPAD_GLYPHS.DOWN}
        </PadButton>
      </div>

      {/* Action + system buttons */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <RoundButton button="B" label={t('bButton')} onPress={onPress} disabled={disabled}>
            B
          </RoundButton>
          <RoundButton button="A" label={t('aButton')} onPress={onPress} disabled={disabled}>
            A
          </RoundButton>
        </div>
        <div className="flex items-center gap-3">
          <PillButton button="SELECT" label={t('select')} onPress={onPress} disabled={disabled}>
            {t('select')}
          </PillButton>
          <PillButton button="START" label={t('start')} onPress={onPress} disabled={disabled}>
            {t('start')}
          </PillButton>
        </div>
      </div>
    </div>
  );
}

type ButtonProps = {
  button: JoypadButton;
  label: string;
  onPress: (button: JoypadButton, pressed: boolean) => void;
  disabled: boolean;
  className?: string;
  children: ReactNode;
};

function useButtonHandlers(
  button: JoypadButton,
  disabled: boolean,
  onPress: (button: JoypadButton, pressed: boolean) => void
) {
  const activePointerIdRef = useRef<number | null>(null);

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (activePointerIdRef.current != null) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    onPress(button, true);
  };

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (activePointerIdRef.current == null || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    activePointerIdRef.current = null;
    onPress(button, false);
  };

  const releaseOnLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      return;
    }
    release(event);
  };

  return {
    onPointerDown: press,
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: releaseOnLeave,
    onLostPointerCapture: release,
    onClick: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
  };
}

function PadButton({ button, label, onPress, disabled, className, children }: ButtonProps) {
  const handlers = useButtonHandlers(button, disabled, onPress);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...handlers}
      className={`absolute flex items-center justify-center bg-white/10 text-sm text-white transition-colors active:bg-[#00FFA3]/40 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

function RoundButton({ button, label, onPress, disabled, children }: ButtonProps) {
  const handlers = useButtonHandlers(button, disabled, onPress);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...handlers}
      className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[#00FFA3]/20 text-lg font-bold text-white transition-colors active:bg-[#00FFA3]/50"
    >
      {children}
    </button>
  );
}

function PillButton({ button, label, onPress, disabled, children }: ButtonProps) {
  const handlers = useButtonHandlers(button, disabled, onPress);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...handlers}
      className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors active:bg-[#00FFA3]/40"
    >
      {children}
    </button>
  );
}
