// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dev/*', 'ios/*', 'android/*'],
  },
  {
    rules: {
      // Literal quotes/apostrophes in React Native <Text> are fine.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
