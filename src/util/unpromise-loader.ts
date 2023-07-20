import { LoaderDefinitionFunction } from 'webpack';
import { SYNCED_EXTERNALS_MODULE_NAME } from './externalsClasses';
import getRequestParam from './getRequestParam';

type IsolatedLoaderFunc = LoaderDefinitionFunction<unknown>;
type LoaderThis = ThisParameterType<IsolatedLoaderFunc>;
type Source = Parameters<IsolatedLoaderFunc>[0];

export function getUpdatedSource(
  resourceRequest: string,
  source: Source
): string {
  const globalName = getRequestParam(resourceRequest, 'globalName');
  if (!globalName) return source;

  return source
    .replace(
      /SYNCED_EXTERNALS_MODULE_NAME/g,
      `"${SYNCED_EXTERNALS_MODULE_NAME}"`
    )
    .replace(/THE_GLOBAL/g, `"${globalName}"`);
}

export default function unpromiseLoader(
  this: LoaderThis,
  source: Source
): string {
  try {
    return getUpdatedSource(this.resourceQuery, source);
  } catch (e) {
    console.error(`failure to load module for ${this.request}`, e);
    throw e;
  }
}
