import path from 'path';
import webpack from 'webpack';
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
          url: 'https://unpkg.com/react@16/umd/react.development.js'
        },
        ['react-dom']: {
          url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js'
        }
      }
    },
    loadExternalsLocation
  );

  webpackOptions = {
    entry: {
      component: path.resolve(__dirname, '..', 'testing-support', 'fakeApp.js')
    },
    externals: {
      ['react-dom']: 'ReactDOM',
      react: 'React'
    },
    plugins: [thePlugin]
  };
});

function getResultText(result: webpack.Stats): string {
  const resultingSource = result.compilation.assets['component.js'];
  return resultingSource.source();
}

it('adds the loadExternals function', done => {
  webpack(webpackOptions, (err, result) => {
    const resultText = getResultText(result);
    expect(resultText).toContain('function loadExternals');
    done();
  });
});

it('never creates an appName that begins with a number', () => {
  let iteration = 0;
  while (iteration < 100) {
    iteration = iteration + 1;
    const plugin = new IsolatedExternalsPlugin();
    expect(/[0-9]/.test(plugin.appName[0])).toBeFalsy();
  }
});
