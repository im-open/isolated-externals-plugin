import { CachedExternal } from './externalsClasses';
export type CachedExternals = Record<string, CachedExternal>;

declare global {
  interface Window {
    __isolatedExternalsCacheV3: CachedExternals;
  }
}

export function getExternal(url: string): CachedExternal {
  const cache = (window.__isolatedExternalsCacheV3 =
    window.__isolatedExternalsCacheV3 || {});
  return (
    cache[url] ||
    (() => {
      const theExternal = new CachedExternal(url);
      cache[url] = theExternal;
      return theExternal;
    })()
  );
}
