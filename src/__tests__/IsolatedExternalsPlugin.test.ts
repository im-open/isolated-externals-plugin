import path from 'path';
import webpack from 'webpack';
import IsolatedExternalsPlugin from '../IsolatedExternalsPlugin';

let thePlugin: IsolatedExternalsPlugin;
let webpackOptions: webpack.Configuration;

beforeEach(() => {
  thePlugin = new IsolatedExternalsPlugin(
    {
      component: {
        react: {
          url: 'https://unpkg.com/react@17/umd/react.development.js',
        },
        ['react-dom']: {
          url: 'https://unpkg.com/react-dom@17/umd/react-dom.development.js',
        },
        ['@microsoft/applicationinsights-web']: {
          url:
            'https://www.unpkg.com/browse/@microsoft/applicationinsights-web@2.6.2/dist/applicationinsights-web.min.js',
        },
      },
    },
    path.join(__dirname, '../../dist/util/isolatedExternalsModule.js')
  );
  webpackOptions = {
    mode: 'development',
    entry: {
      component: path.resolve(__dirname, '..', 'testing-support', 'fakeApp.js'),
    },
    devtool: 'source-map',
    plugins: [thePlugin],
  };
});

it('successfully completes', (done) => {
  webpack(webpackOptions, (err, result) => {
    console.log(result?.toString());
    done();
  });
});
