module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-explicit-any': 'warn'
  }
} 