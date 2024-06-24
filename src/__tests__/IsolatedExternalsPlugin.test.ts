import path from 'path';
import webpack from 'webpack';
import IsolatedExternalsPlugin, {
  IsolatedExternalsElement,
} from '../IsolatedExternalsPlugin';
import { execSync } from 'child_process';
import HtmlWebpackPlugin from 'html-webpack-plugin';

let thePlugin: IsolatedExternalsPlugin;
let webpackOptions: webpack.Configuration;
const externalsConfig: IsolatedExternalsElement = {
  react: {
    url: 'https://unpkg.com/react@17/umd/react.development.js',
    globalName: 'React',
    includeImports: 'react-special',
  },
  ['react-dom']: {
    url: 'https://unpkg.com/react-dom@17/umd/react-dom.development.js',
    globalName: 'ReactDOM',
    includeImports: ['react-dom/client', 'react-dom/server'],
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
    path.join(__dirname, '../../dist/util/unpromisedEntry.js'),
    path.join(__dirname, '../../dist/util/unpromisedExternal.js')
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
  {
    globalName: 'React',
    regex: /react(?!-special).*\?unpromise-external&globalName=React/,
  },
  {
    globalName: 'React',
    regex: /\/\*! react-special \*\/ "react"/,
  },
  {
    globalName: 'ReactDOM',
    regex: /react-dom(?!\/(client|server)).*\?unpromise-external&globalName=ReactDOM/,
  },
  {
    globalName: 'ReactDOM',
    regex: /\/\*! react-dom\/client \*\/ "react-dom"/,
  },
  {
    globalName: 'ReactDOM',
    regex: /\/\*! react-dom\/server \*\/ "react-dom"/,
  },
])(
  'fileResult contains unpromised externals for $globalName matching "$regex"',
  ({ globalName, regex }) => {
    expect(fileResult).toMatch(regex);
    expect(fileResult).toContain(`syncedModulesProxy["${globalName}"]`);
  }
);

it('should have an unpromised-entry', () => {
  expect(fileResult).toContain('unpromised-entry');
});

it('should not have placeholders', () => {
  expect(fileResult).not.toContain('DEPS_PLACEHOLDER');
  expect(fileResult).not.toContain('RELOAD_PLACEHOLDER');
  expect(fileResult).not.toContain('[SYNCED_EXTERNALS_MODULE_NAME]');
  expect(fileResult).not.toContain('THE_GLOBAL');
});
