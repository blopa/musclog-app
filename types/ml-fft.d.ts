declare module 'ml-fft' {
  export const FFT: {
    init(n: number): void;
    fft(re: number[], im: number[], inv: 1 | -1): void;
  };
}
