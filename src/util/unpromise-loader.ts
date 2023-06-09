import * as fs from 'fs';
import * as path from 'path';
import { LoaderDefinitionFunction } from 'webpack';
import { EXTERNALS_MODULE_NAME } from './externalsClasses';

const getRequestParam = function (request: string, param: string) {
  const entryUrl = new URL('https://www.example.com/' + request);
  const value = entryUrl.searchParams.get(param);
  return value;
};

type IsolatedLoaderFunc = LoaderDefinitionFunction<unknown>;
type LoaderThis = ThisParameterType<IsolatedLoaderFunc>;
type Source = Parameters<IsolatedLoaderFunc>[0];

const syncedExternalJs = fs.readFileSync(
  require.resolve(path.join(__dirname, 'syncedExternal.js')),
  'utf8'
);

export default function unpromiseLoader(
  this: LoaderThis,
  source: Source
): string {
  try {
    const globalNameResource = /globalName=([^&]+)/.exec(
      this.resourceQuery
    )?.[0];
    if (!globalNameResource) return source;
    const globalName = globalNameResource.split('=')[1];

    if (!globalName) return source;

    const thePromise = `__webpack_modules__[${EXTERNALS_MODULE_NAME}][${globalName}]`;

    return syncedExternalJs.replace('THE_PROMISE', thePromise);
  } catch (e) {
    console.error(`failure to load module for ${this.request}`, e);
    throw e;
  }
}
