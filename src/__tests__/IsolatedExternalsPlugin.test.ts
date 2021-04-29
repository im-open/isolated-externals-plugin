import path from 'path';
import webpack from 'webpack';
import { Source } from 'webpack-sources';
import IsolatedExternalsPlugin from '../IsolatedExternalsPlugin';

const loadExternalsLocation = path.resolve(
  __dirname,
  '..',
  '..',
  'dist',
  'util',
  'loadExternals.js'
);

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
    loadExternalsLocation
  );

  webpackOptions = {
    entry: {
      component: path.resolve(__dirname, '..', 'testing-support', 'fakeApp.js'),
    },
    externals: {
      ['react-dom']: 'ReactDOM',
      react: 'React',
      ['@microsoft/applicationinsights-web']: 'Microsoft.ApplicationInsights',
    },
    plugins: [thePlugin],
    devtool: 'source-map',
  };
});

function getResultText(result: webpack.Stats, file = 'component.js'): string {
  const resultingSource = (result.compilation.assets as Record<string, Source>)[
    file
  ];
  return resultingSource.source().toString();
}

it('adds the loadExternals function', (done) => {
  webpack(webpackOptions, (err, result) => {
    const resultText = getResultText(result);
    expect(resultText).toContain('function loadExternals');
    done();
  });
});

it('does not wrap anything other than javascript assets', (done) => {
  webpack(webpackOptions, (err, result) => {
    const resultText = getResultText(result, 'component.js.map');
    expect(resultText).not.toContain('function loadExternals');
    done();
  });
});

it('defines the base object for nested vars', (done) => {
  webpack(webpackOptions, (err, result) => {
    const resultText = getResultText(result);
    expect(resultText).toContain(
      'var Microsoft = context.Microsoft || (window || global || self)["Microsoft"];'
    );
    done();
  });
});
