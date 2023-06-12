import { LoaderDefinitionFunction } from 'webpack';
import { SYNCED_EXTERNALS_MODULE_NAME } from './externalsClasses';
import getRequestParam from './getRequestParam';

type IsolatedLoaderFunc = LoaderDefinitionFunction<unknown>;
type LoaderThis = ThisParameterType<IsolatedLoaderFunc>;
type Source = Parameters<IsolatedLoaderFunc>[0];

export default function unpromiseLoader(
  this: LoaderThis,
  source: Source
): string {
  try {
    const globalName = getRequestParam(this.resourceQuery, 'globalName');
    if (!globalName) return source;

    return `exports = __webpack_modules__["${SYNCED_EXTERNALS_MODULE_NAME}"]["${globalName}"];`;
  } catch (e) {
    console.error(`failure to load module for ${this.request}`, e);
    throw e;
  }
}
