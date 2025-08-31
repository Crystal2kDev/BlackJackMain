import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      '@typescript-eslint': ts,
    },
    languageOptions: {
      parser: ts.parser,
      sourceType: 'module',
    },
    rules: {
      'react/prop-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];