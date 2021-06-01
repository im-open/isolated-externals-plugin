type CachedExternals = Record<string, CachedExternal>;

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
  loading: boolean;
  failed: boolean;
  content: string;

  constructor(url: string) {
    this.url = url;
    this.loading = true;
    this.failed = false;
    this.content = '';
  }
}

/* assign polyfill */
if (typeof Object.assign !== 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, 'assign', {
    value: function assign(
      target: Record<string, unknown>,
      ...varArgs: Record<string, unknown>[]
    ) {
      // .length of function is 2
      'use strict';
      if (target === null || target === undefined) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      const to = Object(target) as Record<string, unknown>;

      for (let index = 0; index < arguments.length; index++) {
        const nextSource = varArgs[index];

        if (nextSource !== null && nextSource !== undefined) {
          for (const nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true,
  });
}
/* end assign polyfill */

function wrappedEval(content: string): unknown {
  // in case of a self-invoking wrapper, make sure self is defined
  // as our context object.
  return eval(`
var self=this;
var globalThis = this;
${content}
  `);
}

function getWindowCache(): CachedExternals {
  const wind = window as Window;
  wind.__isolatedExternalsCache = wind.__isolatedExternalsCache || {};
  return wind.__isolatedExternalsCache;
}

function loadFromCache(external: ExternalInfo): CachedExternal | null {
  const cache = getWindowCache();
  const cachedExternal = cache[external.url];

  if (!cachedExternal) return null;
  return cachedExternal;
}

function XHRLoad(
  external: CachedExternal,
  onLoaded: (loadedExternal: CachedExternal) => void
): void {
  const request = new XMLHttpRequest();
  const loadedFunction = function (this: XMLHttpRequest): void {
    Object.assign(external, {
      content: this.responseText,
      failed: this.status >= 400,
      loading: false,
    });
    onLoaded(external);
    request.removeEventListener('load', loadedFunction);
  };
  request.addEventListener('load', loadedFunction);
  request.open('GET', external.url);
  request.send();
}

async function fetchLoad(external: CachedExternal): Promise<CachedExternal> {
  const response = await fetch(external.url, {
    // "follow" is technically the default,
    // but making epxlicit for backwards compatibility
    redirect: 'follow',
  });
  const responseText = await response.text();
  Object.assign(external, {
    failed: !response.ok || response.status >= 400,
    loading: false,
    content: responseText,
  });
  return external;
}

async function networkLoad(
  external: CachedExternal,
  onLoaded: (loadedExternal: CachedExternal) => void
): Promise<void> {
  if ({}.hasOwnProperty.call(window, 'fetch')) {
    try {
      const loadedExternal = await fetchLoad(external);
      onLoaded(loadedExternal);
    } catch {
      XHRLoad(external, onLoaded);
    }
  } else {
    XHRLoad(external, onLoaded);
  }
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
  void networkLoad(newExternal, onLoaded);
}

const isReady = () =>
  document.readyState === 'interactive' || document.readyState === 'complete';

type ListenerParams = Parameters<Window['addEventListener']>;
type ReplaceEventListener = {
  (
    ev: ListenerParams[0],
    listener: ListenerParams[1],
    options?: ListenerParams[2]
  ): void;
};

const inMemoryListeners: Record<ListenerParams[0], ListenerParams[1]> = {};

const removeInMemoryListener: ReplaceEventListener = (ev, listener, options) =>
  document.removeEventListener(ev, inMemoryListeners[ev] || listener, options);

const replaceEventListener: ReplaceEventListener = (ev, listener, options) => {
  removeInMemoryListener(ev, listener, options);
  inMemoryListeners[ev] = listener;
  document.addEventListener(ev, listener, options);
};

const readyStateEvent = 'readystatechange';
let readyStateListener: EventListener;
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function loadExternals(
  this: unknown,
  externalsObj: Externals,
  onComplete: (context: Record<string, unknown>) => void
): void {
  if (!isReady()) {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    readyStateListener = loadExternals.bind(this, externalsObj, onComplete);
    replaceEventListener(readyStateEvent, readyStateListener);
    return;
  }
  removeInMemoryListener(readyStateEvent, readyStateListener);

  const context = {};
  const externalKeys = Object.keys(externalsObj);

  const load = (index: number): void => {
    const key = externalKeys[index];
    const targetExternal = externalsObj[key];
    loadExternal(targetExternal, ({ failed, url, content }: CachedExternal) => {
      if (failed) {
        console.error(`failed to load external from '${url}'`);
      } else {
        try {
          wrappedEval.call(context, content);
        } catch (e) {
          console.error(`failed to eval external from ${url}`, e);
        }
      }

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
