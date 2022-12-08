import path from 'path';
import webpack from 'webpack';
import IsolatedExternalsPlugin from '../IsolatedExternalsPlugin';
import { execSync } from 'child_process';

let thePlugin: IsolatedExternalsPlugin;
let webpackOptions: webpack.Configuration;
const externalsConfig = {
  react: {
    url: 'https://unpkg.com/react@17/umd/react.development.js',
    globalName: 'React',
  },
  ['react-dom']: {
    url: 'https://unpkg.com/react-dom@17/umd/react-dom.development.js',
    globalName: 'ReactDOM',
  },
  ['@microsoft/applicationinsights-web']: {
    url:
      'https://www.unpkg.com/browse/@microsoft/applicationinsights-web@2.6.2/dist/applicationinsights-web.min.js',
    globalName: 'Microsoft.ApplicationInsights',
  },
};
let runResult: webpack.Stats | undefined;
let fileResult: string;

beforeAll((done) => {
  thePlugin = new IsolatedExternalsPlugin(
    {
      component: externalsConfig,
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
  webpack(webpackOptions, (err, result) => {
    runResult = result;
    fileResult = execSync(
      `cat ${path.join(__dirname, '../../dist/component.js')}`,
      { encoding: 'utf8' }
    );
    done();
  });
});

it('successfully completes', () => {
  expect(runResult).not.toBeFalsy();
  expect(runResult?.hasErrors()).toBe(false);
});

test.each(
  Object.entries(externalsConfig).map(([packageName, { globalName, url }]) => [
    packageName,
    globalName,
    url,
  ])
)('fileResult contains expected values', (packageName, globalName, url) => {
  expect(fileResult).toContain(packageName);
  expect(fileResult).toContain(url);
  expect(fileResult).toContain(globalName);
});
