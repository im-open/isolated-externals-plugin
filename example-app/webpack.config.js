const path = require('path');
const IsolatedExternalsPlugin = require('../dist/IsolatedExternalsPlugin')
  .default;
const HtmlWebpackPlugin = require('html-webpack-plugin');

const externals = {
  initial: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js',
      name: 'React'
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js',
      name: 'ReactDOM'
    },
    ['react-is']: {
      url: 'https://unpkg.com/react-is@16/umd/react-is.development.js',
      name: 'ReactIs'
    },
    ['styled-components']: {
      url: 'https://unpkg.com/styled-components@5/dist/styled-components.js',
      name: 'styled'
    }
  },
  secondary: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js',
      name: 'React'
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js',
      name: 'ReactDOM'
    },
    ['styled-components']: {
      url: 'https://unpkg.com/styled-components@4/dist/styled-components.js',
      name: 'styled'
    }
  }
};

const allExternals = Object.keys(externals).reduce(
  (final, key) => ({
    ...final,
    ...externals[key]
  }),
  {}
);
const webpackExternals = Object.keys(allExternals).reduce(
  (final, key) => ({
    ...final,
    [key]: allExternals[key].name
  }),
  {}
);

module.exports = {
  entry: {
    initial: path.join(__dirname, '/js/initial.js'),
    secondary: path.join(__dirname, '/js/secondary.js')
  },
  devtool: 'sourcemap',
  externals: webpackExternals,
  output: {
    filename: 'dist/[name]-[contenthash].js'
  },
  module: {
    rules: [
      {
        test: /.js(x)?$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, './html/index.html')
    }),
    new IsolatedExternalsPlugin(externals)
  ],
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000
  }
};
