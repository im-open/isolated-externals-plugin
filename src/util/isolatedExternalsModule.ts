import {
  CachedExternal,
  Externals,
  CachedExternals,
  EXTERNALS_MODULE_NAME,
} from './externalsClasses';
import { processExternal } from './processExternals';
import getValue from './getValue';
import getGlobal from './getGlobal';

declare global {
  const ISOLATED_EXTERNALS_OBJECT: Externals;
  const __webpack_modules__: Record<string, unknown>;
  interface Window {
    __isolatedExternalsCacheV3: CachedExternals;
  }
}

function getExternal(url: string): CachedExternal {
  window.__isolatedExternalsCacheV3 = window.__isolatedExternalsCacheV3 || {};
  return (
    window.__isolatedExternalsCacheV3[url] ||
    (() => {
      const theExternal = new CachedExternal(url);
      window.__isolatedExternalsCacheV3[url] = theExternal;
      return theExternal;
    })()
  );
}

async function loadExternal(
  context: Record<string, unknown>,
  url: string,
  previousDeps?: Promise<unknown>[]
) {
  await Promise.all(previousDeps || []);
  const cachedExternal = getExternal(url);
  const processingPromise = processExternal(context, cachedExternal);
  return processingPromise;
}

function createExternalsObject(
  externalsInfo: Externals
): Record<string, unknown> {
  let orderedDeps: Promise<unknown>[] = [];
  const externalsContext = {} as Record<string, unknown>;
  const externalsObject = Object.entries(externalsInfo).reduce<
    Record<string, unknown>
  >((extObj, [, { url, globalName }]) => {
    if (!globalName) return extObj;

    const externalLoad = loadExternal(externalsContext, url, orderedDeps);
    orderedDeps = [...orderedDeps, externalLoad];
    Object.defineProperty(extObj, globalName, {
      get: async (): Promise<unknown | undefined> => {
        const foundContext = await externalLoad;
        return (
          getValue(globalName, foundContext) ||
          getValue(globalName, getGlobal())
        );
      },
    });
    return extObj;
  }, {});

  const externalsGlobalProxy = new Proxy(externalsObject, {
    get: (target, prop): unknown => {
      return Reflect.get(target, prop) || Reflect.get(getGlobal(), prop);
    },
  });
  return externalsGlobalProxy;
}

export const externals = createExternalsObject(ISOLATED_EXTERNALS_OBJECT);
__webpack_modules__[EXTERNALS_MODULE_NAME] = externals;
