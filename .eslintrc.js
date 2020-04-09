module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json']
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier/@typescript-eslint'
  ],
  rules: {
    'no-underscore-dangle': 'off',
    'max-len': ['error', { code: 150 }],
    '@typescript-eslint/ban-ts-ignore': 0,
    'class-methods-use-this': 0
  }
};
