// @ts-ignore
/// <reference types="nativewind/types" />

declare module '*.png' {
  const value: string;
  export default value;
}

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_BASE_URL?: string;
  }
}
