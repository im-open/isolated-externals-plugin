import * as fs from 'fs';
import * as path from 'path';
import { LoaderDefinitionFunction } from 'webpack';
import { SYNCED_EXTERNALS_MODULE_NAME } from './externalsClasses';
import getRequestParam from './getRequestParam';

type IsolatedLoaderFunc = LoaderDefinitionFunction<unknown>;
type LoaderThis = ThisParameterType<IsolatedLoaderFunc>;
type Source = Parameters<IsolatedLoaderFunc>[0];

const syncedExternalText = fs.readFileSync(
  require.resolve(path.join(__dirname, 'unpromisedExternal.js')),
  'utf8'
);

export default function unpromiseLoader(
  this: LoaderThis,
  source: Source
): string {
  try {
    const globalName = getRequestParam(this.resourceQuery, 'globalName');
    if (!globalName) return source;

    return syncedExternalText
      .replace(
        /SYNCED_EXTERNALS_MODULE_NAME/g,
        `"${SYNCED_EXTERNALS_MODULE_NAME}"`
      )
      .replace(/THE_GLOBAL/g, `"${globalName}"`);
  } catch (e) {
    console.error(`failure to load module for ${this.request}`, e);
    throw e;
  }
}
