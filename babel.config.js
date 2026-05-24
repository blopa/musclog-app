module.exports = function (api) {
  api.cache(true);

  // SDK 56 / hermes-v1 introduced two breaking changes for WatermelonDB + legacy decorators:
  //
  // 1. @babel/plugin-transform-flow-strip-types and @babel/plugin-transform-typescript now
  //    reject `declare` and `!` on decorated class fields. Both plugins use a `Class` visitor
  //    that iterates body.body directly, so a ClassProperty visitor is too late — we must use
  //    a Class visitor that runs first (user-config plugins register before preset overrides).
  //
  // 2. hermes-v1 removed @babel/plugin-transform-class-properties (Hermes handles them natively),
  //    but @babel/plugin-proposal-decorators with { legacy: true } still requires class-properties
  //    to be Babel-transformed AFTER both decorators and TypeScript. Placing classPropertiesPreset
  //    first in the presets array makes Babel execute it last (presets run in reverse order),
  //    which puts it after babel-preset-expo's TypeScript override.

  function stripDeclareFromDecoratedFields() {
    return {
      visitor: {
        Class(path) {
          path.get('body.body').forEach((member) => {
            if (member.isClassProperty() && member.node.decorators?.length) {
              if (member.node.declare) {
                member.node.declare = false;
              }

              if (member.node.definite) {
                member.node.definite = false;
              }
            }
          });
        },
      },
    };
  }

  function classPropertiesPreset() {
    return {
      plugins: [
        ['@babel/plugin-transform-class-properties', { loose: true }],
        ['@babel/plugin-transform-private-methods', { loose: true }],
        ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      ],
    };
  }

  return {
    presets: [
      classPropertiesPreset, // first in array = runs last; after TypeScript transform
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      stripDeclareFromDecoratedFields,
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
