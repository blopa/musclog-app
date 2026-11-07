import fs from 'fs';

import { SCREENSHOT_DIR, SHARD_DIR } from './report';

/** A run starts from an empty shard and screenshot folder, so two runs never mix. */
export default async function globalSetup(): Promise<void> {
  fs.rmSync(SHARD_DIR, { recursive: true, force: true });
  fs.rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SHARD_DIR, { recursive: true });
}
