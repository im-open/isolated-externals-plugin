import path from 'path';
import webpack from 'webpack';
import IsolatedExternalsPlugin from '../IsolatedExternalsPlugin';
import { execSync } from 'child_process';
import HtmlWebpackPlugin from 'html-webpack-plugin';

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
jest.setTimeout(20000);

execSync(`npm run build`, {
  stdio: 'inherit',
});

beforeAll((done) => {
  thePlugin = new IsolatedExternalsPlugin(
    {
      component: externalsConfig,
    },
    path.join(__dirname, '../../dist/util/isolatedExternalsModule.js'),
    path.join(__dirname, '../../dist/util/unpromisedEntry.js')
  );
  webpackOptions = {
    mode: 'development',
    entry: {
      component: path.resolve(__dirname, '..', 'testing-support', 'fakeApp.js'),
    },
    devtool: 'source-map',
    plugins: [
      thePlugin,
      new HtmlWebpackPlugin({
        template: path.resolve(
          __dirname,
          '..',
          'testing-support',
          'index.html'
        ),
      }),
    ],
  };
  webpack(webpackOptions, (err, result) => {
    runResult = result;
    fileResult = execSync(
      `cat ${path.join(__dirname, '../../dist/component.js')}`,
      { encoding: 'utf8' }
    );

    if (runResult?.hasErrors()) console.error(runResult.toJson().errors);

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

test.each([
  ['React', /react.*\?unpromise-external&globalName=React/],
  ['ReactDOM', /react-dom.*\?unpromise-external&globalName=ReactDOM/],
])('fileResult contains unpromised externals: %s', (globalName, regex) => {
  expect(fileResult).toMatch(regex);
  expect(fileResult).toContain(`syncedModulesProxy["${globalName}"]`);
});

it('should have an unpromised-entry', () => {
  expect(fileResult).toContain('unpromised-entry');
});

it('should not have placeholders', () => {
  expect(fileResult).not.toContain('DEPS_PLACEHOLDER');
  expect(fileResult).not.toContain('RELOAD_PLACEHOLDER');
});
