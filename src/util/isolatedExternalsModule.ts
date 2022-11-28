import { CachedExternal, Externals, CachedExternals } from './externalsClasses';
import { processExternal } from './processExternals';

declare global {
  const ISOLATED_EXTERNALS_OBJECT: Externals;
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

export function createExternalsObject(
  externalsName: string,
  externalsInfo: Externals
): void {
  const externalsContext = {} as Record<string, unknown>;
  window[externalsName] = Object.entries(externalsInfo).reduce<
    Record<string, unknown>
  >((extObj, [name, { url }]) => {
    Object.defineProperty(extObj, name, {
      get: async (): Promise<unknown | undefined> => {
        return (
          externalsContext[name] ||
          (await (async () => {
            const cachedExternal = getExternal(url);
            const foundContext = await processExternal(
              externalsContext,
              cachedExternal
            );
            return foundContext[name];
          })())
        );
      },
    });
    return extObj;
  }, {});
}

createExternalsObject('ISOLATED_EXTERNALS_NAME', ISOLATED_EXTERNALS_OBJECT);
