// Vite's ?raw import of a text file (the wrangler config, read by a test).
declare module '*.toml?raw' {
  const content: string;
  export default content;
}
