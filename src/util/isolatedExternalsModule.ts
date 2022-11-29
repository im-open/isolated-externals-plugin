import { CachedExternal, Externals, CachedExternals } from './externalsClasses';
import { processExternal } from './processExternals';

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

const prevExternals: Promise<unknown>[] = [];
async function loadExternal(context: Record<string, unknown>, url: string) {
  await Promise.all(prevExternals);
  const cachedExternal = getExternal(url);
  const processingPromise = processExternal(context, cachedExternal);
  prevExternals.push(processingPromise);
  return processingPromise;
}

function getValue(strName: string, context: Record<string, unknown>) {
  const names = strName.split('.');
  let value: unknown = context;
  while (names.length) {
    const lookup = names.shift();
    if (!lookup) break;

    value = (value as Record<string, unknown>)[lookup];
  }
  return value;
}

function createExternalsObject(
  externalsInfo: Externals
): Record<string, unknown> {
  const externalsContext = {} as Record<string, unknown>;
  return Object.entries(externalsInfo).reduce<Record<string, unknown>>(
    (extObj, [, { url, globalName }]) => {
      if (!globalName) return extObj;

      const externalLoad = loadExternal(externalsContext, url);
      Object.defineProperty(extObj, globalName, {
        get: async (): Promise<unknown | undefined> => {
          const foundContext = await externalLoad;
          return (
            getValue(globalName, foundContext) ||
            getValue(
              globalName,
              ((window || global || self) as unknown) as Record<string, unknown>
            )
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
