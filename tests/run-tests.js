const { exec, spawn } = require('child_process');
const http = require('http');

function isExpoServerReady() {
    return new Promise((resolve) => {
        http.get('http://localhost:8082', (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

async function main() {
    let expoProcess;
    try {
        expoProcess = await startExpo();
        await waitForExpoServer();
        await runPlaywrightTests();
    } catch (err) {
        console.error(`Error: ${err}`);
        process.exit(1);
    } finally {
        if (expoProcess) {
            expoProcess.kill();
        }
    }
}

function runPlaywrightTests() {
    return new Promise((resolve, reject) => {
        exec('npx playwright test', (err, stdout, stderr) => {
            if (err) {
                console.error(`Playwright test error: ${stderr}`);
                reject(err);
            } else {
                console.log(stdout);
                resolve();
            }
        });
    });
}

function startExpo() {
    return new Promise((resolve, reject) => {
        const expoProcess = spawn(
            'expo',
            ['start', '--web', '--port', '8082'],
            {
                env: {
                    ...process.env,
                    BROWSER: 'none',
                },
                stdio: 'inherit',
            }
        );

        expoProcess.on('error', (err) => {
            reject(err);
        });

        resolve(expoProcess);
    });
}

async function waitForExpoServer() {
    let isReady = false;
    const maxRetries = 30;
    let retries = 0;

    while (!isReady && retries < maxRetries) {
        isReady = await isExpoServerReady();
        if (!isReady) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries++;
        }
    }

    if (!isReady) {
        throw new Error('Expo server did not start in time.');
    }
}

main();
