module.exports = {
  root: true,
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier/@typescript-eslint',
  ],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./eslint-tsconfig.json', './src/__tests__/tsconfig.json'],
  },
  rules: {
    'no-underscore-dangle': 'off',
    'max-len': ['error', { code: 150 }],
    'class-methods-use-this': 0,
    '@typescript-eslint/ban-ts-ignore': 0,
  },
  ignorePatterns: ['**/dist/*'],
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
      },
    },
    {
      files: ['example-app/**/*.js', '**/testing-support/*.js'],
      extends: ['plugin:react/recommended'],
      plugins: ['react'],
      settings: {
        react: {
          version: 'detect',
        },
      },
    },
    {
      files: ['**/*.config.js'],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
