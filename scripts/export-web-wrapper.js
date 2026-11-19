const { spawn } = require('child_process');

/**
 * Wrapper for 'expo export --platform web' that forces the process to exit
 * once the "Exported: dist" message is detected. This is a workaround for
 * background tasks or listeners that might be keeping the Node.js event loop
 * alive in some environments (like GitHub Actions) during static rendering.
 */
function main() {
  console.log('[export-web-wrapper] Starting expo export...');

  const child = spawn('npx', ['expo', 'export', '--platform', 'web'], {
    stdio: ['inherit', 'pipe', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      // Every public page is rendered once per language, so the export outgrew Node's default heap
      // (about 4 GB): it died mid-render with "heap out of memory" and the later steps ran on a
      // half-empty dist. `npm run web` already asks for the same limit.
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=8192',
    },
    shell: true,
  });

  let hasExported = false;

  child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('Exported: dist')) {
      console.log('\n[export-web-wrapper] Detected successful export. Forcing exit in 5s...');
      hasExported = true;
      // Give it a few seconds to finish any minor cleanup, then kill it.
      setTimeout(() => {
        console.log('[export-web-wrapper] Exiting now.');
        process.exit(0);
      }, 5000);
    }
  });

  child.on('error', (err) => {
    console.error('[export-web-wrapper] Error spawning process:', err);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (!hasExported) {
      console.log(`[export-web-wrapper] Process closed with code ${code}`);
      process.exit(code || 0);
    }
  });
}

main();
