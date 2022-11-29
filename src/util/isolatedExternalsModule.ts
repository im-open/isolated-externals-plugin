import { CachedExternal, Externals, CachedExternals } from './externalsClasses';
import { processExternal } from './processExternals';

declare global {
  const ISOLATED_EXTERNALS_OBJECT: Externals;
  const __webpack_modules__: Record<string, unknown>;
  interface Window {
    __isolatedExternalsCacheV2: CachedExternals;
  }
}

function getExternal(url: string): CachedExternal {
  window.__isolatedExternalsCacheV2 = window.__isolatedExternalsCacheV2 || {};
  return (
    window.__isolatedExternalsCacheV2[url] ||
    (() => {
      const theExternal = new CachedExternal(url);
      window.__isolatedExternalsCacheV2[url] = theExternal;
      return theExternal;
    })()
  );
}

function createExternalsObject(
  externalsInfo: Externals
): Record<string, unknown> {
  const externalsContext = {} as Record<string, unknown>;
  return Object.entries(externalsInfo).reduce<Record<string, unknown>>(
    (extObj, [, { url, globalName }]) => {
      if (!globalName) return extObj;

      Object.defineProperty(extObj, globalName, {
        get: async (): Promise<unknown | undefined> => {
          return (
            externalsContext[globalName] ||
            (await (async () => {
              const cachedExternal = getExternal(url);
              const foundContext = await processExternal(
                externalsContext,
                cachedExternal
              );
              return (
                foundContext[globalName] ||
                ((window || global || self)[globalName] as unknown | undefined)
              );
            })())
          );
        },
      });
      return extObj;
    },
    {}
  );
}

export const externals = createExternalsObject(ISOLATED_EXTERNALS_OBJECT);
__webpack_modules__['isolatedExternalsModule'] = externals;
