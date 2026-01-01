const { devices } = require('@playwright/test');

module.exports = {
    projects: [{
        name: 'Pixel 6',
        use: {
            ...devices['Pixel 6'],
        },
    }],
    testDir: './tests',
    timeout: 30000,
    use: {
        browserName: 'chromium',
        ...devices['Pixel 6'],
    },
};
