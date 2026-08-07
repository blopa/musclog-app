// Stub for static assets (images, fonts, audio) imported from application code.
//
// The `node` project gets this for free from `@react-native/jest-preset`'s asset
// transformer; the `jsdom` project does not use that preset, so it maps asset extensions
// here instead. Without it, Jest tries to parse a PNG as JavaScript.

module.exports = 'test-file-stub';
