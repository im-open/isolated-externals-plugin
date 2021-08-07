/// reference path="./externalsClasses"

async function awaitExternal(
  external: CachedExternal
): Promise<CachedExternal> {
  return new Promise((resolve) => {
    const checkExternal = (): void => {
      if (!external.loading) {
        resolve(external);
        return;
      }
      window.requestAnimationFrame(checkExternal);
    };
    checkExternal();
  });
}

interface Window {
  __isolatedExternalsCacheV2: CachedExternals;
}

function getWindowCache(): CachedExternals {
  const wind = window as Window;
  wind.__isolatedExternalsCacheV2 = wind.__isolatedExternalsCacheV2 || {};
  return wind.__isolatedExternalsCacheV2;
}

function loadFromCache(external: ExternalInfo): CachedExternal | null {
  const windowCache = getWindowCache();
  const cachedExternal = windowCache[external.url];

  if (!cachedExternal) return null;
  return cachedExternal;
}

async function loadExternal(external: ExternalInfo): Promise<CachedExternal> {
  const cachedExternal = loadFromCache(external);
  if (cachedExternal) {
    return awaitExternal(cachedExternal);
  }
  const newExternal = new CachedExternal(external.url);
  getWindowCache()[external.url] = newExternal;
  void (await newExternal.load());
  return newExternal;
}

/* eslint-disable @typescript-eslint/no-implied-eval */
function applyExternal(
  content: string,
  context: Record<string, unknown>
): unknown {
  // in case of a self-invoking wrapper, make sure self is defined
  // as our context object.
  return Function(`
var self=this;
var globalThis = this;
${content}`).call(context);
}
/* eslint-enable @typescript-eslint/no-implied-eval */

async function applyExternals(loadedExternals: CachedExternal[]) {
  const context = {};
  for (const cachedExternal of loadedExternals) {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
    const { failed, url, error } = cachedExternal;

    if (failed) {
      console.error(
        `EXTERNAL LOAD FAILED: failed to load external from '${url}'`,
        error
      );
    } else {
      try {
        const content = await cachedExternal.getContent();
        applyExternal(content || '', context);
      } catch (e) {
        console.error(
          `EXTERNAL PROCESS FAILED: failed to process external from ${url}`,
          e
        );
      }
    }
  }
  return context;
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
async function loadExternals(
  this: unknown,
  externalsObj: Externals,
  onComplete: (context: Record<string, unknown>) => void
): Promise<void> {
  if (!isReady()) {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    readyStateListener = loadExternals.bind(this, externalsObj, onComplete);
    replaceEventListener(readyStateEvent, readyStateListener);
    return;
  }
  removeInMemoryListener(readyStateEvent, readyStateListener);

  const loadedExternals = await Promise.all(
    Object.values(externalsObj).map(loadExternal)
  );
  const context = await applyExternals(loadedExternals);
  onComplete(context);
}
