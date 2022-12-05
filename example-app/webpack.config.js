const path = require('path');
const IsolatedExternalsPlugin = require('../dist/IsolatedExternalsPlugin')
  .default;
const HtmlWebpackPlugin = require('html-webpack-plugin');

const externalsConfig = {
  initial: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js',
      globalName: 'React',
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js',
      globalName: 'ReactDOM',
    },
    ['react-is']: {
      url: 'https://unpkg.com/react-is@16/umd/react-is.development.js',
      globalName: 'ReactIs',
    },
    ['styled-components']: {
      url: 'https://unpkg.com/styled-components@5/dist/styled-components.js',
      globalName: 'styled',
    },
    ['@microsoft/applicationinsights-web']: {
      url:
        'https://www.unpkg.com/@microsoft/applicationinsights-web@2.6.2/dist/applicationinsights-web.min.js',
      globalName: 'Microsoft.ApplicationInsights',
    },
  },
  secondary: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js',
      globalName: 'React',
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js',
      globalName: 'ReactDOM',
    },
    ['react-is']: {
      url: 'https://unpkg.com/react-is@16/umd/react-is.development.js',
      globalName: 'ReactIs',
    },
    ['styled-components']: {
      url: 'https://unpkg.com/styled-components@4/dist/styled-components.js',
      globalName: 'styled',
    },
  },
};

module.exports = {
  mode: 'development',
  entry: {
    initial: path.join(__dirname, '/js/initial.js'),
    secondary: path.join(__dirname, '/js/secondary.js'),
    tertiary: path.join(__dirname, '/js/tertiary.js'),
  },
  devtool: 'eval-source-map',
  output: {
    filename: 'dist/[name]-[contenthash].js',
  },
  module: {
    rules: [
      {
        test: /.js(x)?$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react'],
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, './html/index.html'),
    }),
    new IsolatedExternalsPlugin(externalsConfig),
  ],
  devServer: {
    compress: true,
    port: 9000,
  },
};
