module.exports = {
  root: true,
  plugins: [],
  extends: [],
  rules: {
    'no-underscore-dangle': 'off',
    'max-len': ['error', { code: 150 }],
    'class-methods-use-this': 0,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier/@typescript-eslint',
      ],
      plugins: ['@typescript-eslint'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.json', './src/__tests__/tsconfig.json'],
      },
      rules: {
        '@typescript-eslint/ban-ts-ignore': 0,
      },
    },
    {
      files: ['example-app/**/*.js'],
      plugins: ['eslint-plugin-react'],
      parser: '@babel/eslint-parser',
    },
  ],
};
