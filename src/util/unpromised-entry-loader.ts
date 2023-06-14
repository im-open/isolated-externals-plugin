import * as fs from 'fs';
import * as path from 'path';
import { LoaderDefinitionFunction } from 'webpack';
import getRequestParam from './getRequestParam';
import {
  EXTERNALS_MODULE_NAME,
  SYNCED_EXTERNALS_MODULE_NAME,
} from './externalsClasses';

type IsolatedLoaderFunc = LoaderDefinitionFunction<unknown>;
type LoaderThis = ThisParameterType<IsolatedLoaderFunc>;
type Source = Parameters<IsolatedLoaderFunc>[0];

const syncedEntryText = fs.readFileSync(
  require.resolve(path.join(__dirname, 'unpromisedEntry.js')),
  'utf8'
);

export default function unpromiseLoader(
  this: LoaderThis,
  source: Source
): string {
  try {
    const deps = getRequestParam(this.resourceQuery, 'deps');
    const originalRequest = decodeURIComponent(
      getRequestParam(this.resourceQuery, 'originalRequest') || ''
    );
    const originalContext = decodeURIComponent(
      getRequestParam(this.resourceQuery, 'originalContext') || ''
    );
    const normal =
      getRequestParam(this.resourceQuery, 'normal') == true.toString();
    const logger = this.getLogger('unpromised-entry-loader');
    logger.debug('unpromised-entry-loader', {
      deps,
      originalRequest,
      normal,
      resource: this.resource,
    });

    if (!deps || normal) return source;

    const resolvedRequest =
      originalRequest && originalContext
        ? path.resolve(
            path.normalize(originalContext),
            path.normalize(originalRequest)
          )
        : originalRequest;

    const delimiter = resolvedRequest.includes('?') ? '&' : '?';

    const result = syncedEntryText
      .replace(/DEPS_PLACEHOLDER/g, deps)
      .replace(
        /RELOAD_PLACEHOLDER/g,
        `${resolvedRequest}${delimiter}normal=true`
      )
      .replace(
        /SYNCED_EXTERNALS_MODULE_NAME/g,
        `"${SYNCED_EXTERNALS_MODULE_NAME}"`
      )
      .replace(/EXTERNALS_MODULE_NAME/g, `"${EXTERNALS_MODULE_NAME}"`);

    return result;
    this.callback(undefined, result);
  } catch (e) {
    console.error(`failure to load module for ${this.request}`, e);
    throw e;
  }
}
