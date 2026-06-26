import Head from 'expo-router/head';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WasmBoyJoypadState } from 'wasmboy';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import { isProduction } from '@/utils/app';
import { readAndDecodeGameBoySaves, seedGameBoyTodayDate } from '@/utils/decodeGameBoySave';

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

type JoypadButton = keyof WasmBoyJoypadState;

const JOYPAD_BUTTONS: JoypadButton[] = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'A', 'B', 'SELECT', 'START'];

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

// Touch controls dispatch these synthetic keyboard keys, then the normal
// keyboard listener below drives WasmBoy. That keeps desktop and touch input on
// one path.
const BUTTON_KEY_MAP: Record<JoypadButton, string> = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  A: 'x',
  B: 'z',
  START: 'Enter',
  SELECT: 'Shift',
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

  const setButton = useCallback(
    (button: JoypadButton, pressed: boolean) => {
      const pendingRelease = releaseTimersRef.current[button];
      if (pendingRelease != null) {
        clearTimeout(pendingRelease);
        delete releaseTimersRef.current[button];
      }

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
    [applyButton]
  );

  const releaseAllButtons = useCallback(() => {
    for (const button of JOYPAD_BUTTONS) {
      const pendingRelease = releaseTimersRef.current[button];
      if (pendingRelease != null) {
        clearTimeout(pendingRelease);
        delete releaseTimersRef.current[button];
      }
      delete pressedAtRef.current[button];
      joypadRef.current[button] = false;
    }
    flushJoypad();
  }, [flushJoypad]);

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

      // Hand the ROM today's real date before it boots: the Game Boy has no wall
      // clock, so for a not-yet-onboarded save we seed today's date into the
      // cartridge SRAM (creating the save if none exists). loadROM() then
      // restores it and onboarding pre-fills its date picker. Best-effort: a
      // failure here must never block play.
      try {
        const seedResult = await seedGameBoyTodayDate(rom);
        if (!isProduction()) {
          console.log('[gameboy] seed today date:', seedResult);
        }
      } catch (error) {
        console.error('[gameboy] failed to seed today date', error);
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

  // Persist saves while playing: on a periodic safety-net interval, on the
  // events that fire when the user leaves (tab hidden/closed, full reload), and
  // on unmount (e.g. client-side navigation away, which fires no unload event).
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const interval = setInterval(() => void persistSave(), 10000);
    const onPageHide = () => void persistSave();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void persistSave();
      }
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void persistSave();
    };
  }, [status, persistSave]);

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

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        releaseAllButtons();
      }
    };

    window.addEventListener('blur', releaseAllButtons);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', releaseAllButtons);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseAllButtons();
    };
  }, [status, releaseAllButtons]);

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

  return (
    <>
      <Head>
        <title>{t('pageTitle')}</title>
      </Head>
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
                  {status === 'loading' ? (
                    <p className="text-sm font-medium text-gray-300">{t('loading')}</p>
                  ) : status === 'error' ? (
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
                  ) : (
                    <button
                      type="button"
                      onClick={start}
                      className="rounded-full bg-[#00FFA3] px-8 py-3 text-base font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#00FFA3] focus:ring-offset-2 focus:ring-offset-black"
                    >
                      {t('playButton')}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Touch controls */}
          <TouchControls disabled={status !== 'playing'} t={t} />

          <p className="mt-8 max-w-md text-xs leading-5 text-gray-500">{t('controlsHint')}</p>

          <a
            href={ROM_URL}
            download="musclog.gbc"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#00FFA3]/40 bg-[#00FFA3]/10 px-6 py-2 text-sm font-bold text-[#00FFA3] transition-transform hover:-translate-y-0.5"
          >
            {t('downloadRom')}
          </a>
        </div>
      </main>
    </>
  );
}

type TouchControlsProps = {
  disabled: boolean;
  t: (key: string) => string;
};

function TouchControls({ disabled, t }: TouchControlsProps) {
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
          disabled={disabled}
          className="left-12 top-0 h-12 w-12 rounded-t-lg"
        >
          ▲
        </PadButton>
        <PadButton
          button="LEFT"
          label={t('left')}
          disabled={disabled}
          className="left-0 top-12 h-12 w-12 rounded-l-lg"
        >
          ◀
        </PadButton>
        <PadButton
          button="RIGHT"
          label={t('right')}
          disabled={disabled}
          className="left-24 top-12 h-12 w-12 rounded-r-lg"
        >
          ▶
        </PadButton>
        <PadButton
          button="DOWN"
          label={t('down')}
          disabled={disabled}
          className="left-12 top-24 h-12 w-12 rounded-b-lg"
        >
          ▼
        </PadButton>
      </div>

      {/* Action + system buttons */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <RoundButton button="B" label={t('bButton')} disabled={disabled}>
            B
          </RoundButton>
          <RoundButton button="A" label={t('aButton')} disabled={disabled}>
            A
          </RoundButton>
        </div>
        <div className="flex items-center gap-3">
          <PillButton button="SELECT" label={t('select')} disabled={disabled}>
            {t('select')}
          </PillButton>
          <PillButton button="START" label={t('start')} disabled={disabled}>
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
  disabled: boolean;
  className?: string;
  children: ReactNode;
};

function dispatchJoypadKeyboardEvent(button: JoypadButton, type: 'keydown' | 'keyup') {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key: BUTTON_KEY_MAP[button],
      bubbles: true,
      cancelable: true,
    })
  );
}

function useButtonHandlers(button: JoypadButton, disabled: boolean) {
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
    dispatchJoypadKeyboardEvent(button, 'keydown');
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
    dispatchJoypadKeyboardEvent(button, 'keyup');
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

function PadButton({ button, label, disabled, className, children }: ButtonProps) {
  const handlers = useButtonHandlers(button, disabled);
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

function RoundButton({ button, label, disabled, children }: ButtonProps) {
  const handlers = useButtonHandlers(button, disabled);
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

function PillButton({ button, label, disabled, children }: ButtonProps) {
  const handlers = useButtonHandlers(button, disabled);
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
