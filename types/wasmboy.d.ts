declare module 'wasmboy' {
  export interface WasmBoyJoypadState {
    UP?: boolean;
    RIGHT?: boolean;
    DOWN?: boolean;
    LEFT?: boolean;
    A?: boolean;
    B?: boolean;
    SELECT?: boolean;
    START?: boolean;
  }

  export interface WasmBoyOptions {
    headless?: boolean;
    isGbcEnabled?: boolean;
    isAudioEnabled?: boolean;
    gameboyFrameRate?: number;
    audioBatchProcessing?: boolean;
    frameSkip?: number;
    tileRendering?: boolean;
    tileCaching?: boolean;
    updateGraphicsCallback?: false | ((imageDataArray: Uint8ClampedArray) => void);
    saveStateCallback?: false | ((saveStateObject: unknown) => void);
  }

  export const WasmBoy: {
    config(options: WasmBoyOptions, canvasElement: HTMLCanvasElement): Promise<void>;
    loadROM(rom: Uint8Array | string): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    reset(): Promise<void>;
    isPlaying(): boolean;
    isReady(): boolean;
    enableDefaultJoypad(): void;
    disableDefaultJoypad(): void;
    setJoypadState(state: WasmBoyJoypadState): void;
    // Persists the loaded cartridge (including its battery-backed SRAM) to
    // IndexedDB, keyed by the cartridge header. loadROM() restores the saved
    // cartridge RAM automatically on the next load.
    saveLoadedCartridge(saveStates?: unknown): Promise<unknown>;
  };
}
