const { writeFileSync } = require('fs');
const path = require('path');
const { googleFormsToJson } = require('react-google-forms-hooks');

// eslint-disable-next-line no-undef
const DIRNAME = __dirname;

const doTask = async () => {
    const result = await googleFormsToJson(
        'https://docs.google.com/forms/d/e/1FAIpQLSdzDj1kfBN8RA4syj0T8Q2SwecQZSUObZJ_hHRzRRo-f6njZA/viewform'
    );

    writeFileSync(path.resolve(DIRNAME, '..', 'data', 'form.json'), JSON.stringify(result, null, 2));
};

doTask();