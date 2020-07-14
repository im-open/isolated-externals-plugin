interface CachedExternals {
  [key: string]: CachedExternal;
}
interface Window {
  __isolatedExternalsCache: CachedExternals;
}

interface ExternalInfo {
  name: string;
  url: string;
}

interface Externals {
  [key: string]: ExternalInfo;
}

class CachedExternal {
  url: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  loading: boolean;
  content: string;

  constructor(url: string) {
    this.url = url;
    this.loading = true;
    this.content = '';
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function wrappedEval(content: string): any {
  return eval(content);
}

function getWindowCache(): CachedExternals {
  window.__isolatedExternalsCache = window.__isolatedExternalsCache || {};
  return window.__isolatedExternalsCache;
}

function loadFromCache(external: ExternalInfo): CachedExternal | null {
  const cache = getWindowCache();
  const cachedExternal = cache[external.url];

  if (!cachedExternal) return null;
  return cachedExternal;
}

function networkLoad(
  external: CachedExternal,
  onLoaded: (loadedExternal: CachedExternal) => void
): void {
  const request = new XMLHttpRequest();
  const loadedFunction = function(this: XMLHttpRequest): void {
    external.content = this.responseText;
    external.loading = false;
    onLoaded(external);
    request.removeEventListener('load', loadedFunction);
  };
  request.addEventListener('load', loadedFunction);
  request.open('GET', external.url);
  request.send();
}

function awaitExternal(
  external: CachedExternal,
  onLoaded: (loadedExternal: CachedExternal) => void
): void {
  const checkExternal = (): void => {
    if (!external.loading) {
      onLoaded(external);
      return;
    }
    window.requestAnimationFrame(checkExternal);
  };
  checkExternal();
}

function loadExternal(
  external: ExternalInfo,
  onLoaded: (loadedExternal: CachedExternal) => void
): void {
  const cachedExternal = loadFromCache(external);
  if (cachedExternal) {
    awaitExternal(cachedExternal, onLoaded);
    return;
  }
  const newExternal = new CachedExternal(external.url);
  window.__isolatedExternalsCache[external.url] = newExternal;
  networkLoad(newExternal, onLoaded);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function loadExternals(
  externalsObj: Externals,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  onComplete: (context: any) => void
): void {
  const context = {};
  const externalKeys = Object.keys(externalsObj);

  const load = (index: number): void => {
    const key = externalKeys[index];
    const targetExternal = externalsObj[key];
    loadExternal(targetExternal, (loadedExternal: CachedExternal) => {
      wrappedEval.call(context, loadedExternal.content);

      const nextIndex = index + 1;
      if (nextIndex === externalKeys.length) {
        onComplete(context);
      } else {
        load(nextIndex);
      }
    });
  };
  load(0);
}