type CachedExternals = Record<string, CachedExternal>;

interface ExternalInfo {
  name: string;
  url: string;
}

interface Externals {
  [key: string]: ExternalInfo;
}

type GuaranteedResponse = Pick<Response, 'ok' | 'status' | 'text'>;
type ResponseLike = Partial<Response> & GuaranteedResponse;

class StaticResponse implements GuaranteedResponse {
  __status: number;
  __text: string | undefined;
  constructor(body: string, responseInit?: ResponseInit) {
    this.__text = body;
    this.__status = responseInit?.status || 200;
  }

  text() {
    return Promise.resolve(this.__text || '');
  }

  get status() {
    return this.__status;
  }

  get ok() {
    return this.__status < 400;
  }
}

class InnerResponse implements GuaranteedResponse {
  __response: ResponseLike;
  constructor(body: string, responseInit?: ResponseInit) {
    this.__response =
      'Response' in globalThis
        ? new Response(body, responseInit)
        : new StaticResponse(body, responseInit);
  }

  text() {
    return this.__response.text();
  }

  get status() {
    return this.__response.status;
  }

  get ok() {
    return this.__response.ok;
  }
}

function XHRLoad(
  url: string,
  onLoaded: (response: ResponseLike) => void
): void {
  const request = new XMLHttpRequest();
  const loadedFunction = function (this: XMLHttpRequest): void {
    const { responseText, status } = this;
    onLoaded(new InnerResponse(responseText, { status }));
    request.removeEventListener('load', loadedFunction);
  };
  request.addEventListener('load', loadedFunction);
  request.open('GET', url);
  request.send();
}

async function fetchLoad(url: string): Promise<Response> {
  const response = await fetch(url, {
    // "follow" is technically the default,
    // but making epxlicit for backwards compatibility
    redirect: 'follow',
  });
  return response;
}

const XHRPromise = (url: string): Promise<ResponseLike> =>
  new Promise((resolve) => XHRLoad(url, resolve));

async function networkLoad(url: string): Promise<ResponseLike> {
  if ({}.hasOwnProperty.call(window, 'fetch')) {
    try {
      const loadedExternal = await fetchLoad(url);
      return loadedExternal;
    } catch {
      return XHRPromise(url);
    }
  } else {
    return XHRPromise(url);
  }
}

type GuaranteedCache = Pick<Cache, 'match' | 'put' | 'add'>;
type CacheLike = Partial<Cache> & GuaranteedCache;
class StaticCache implements GuaranteedCache {
  __response: ResponseLike | undefined;

  async match() {
    return Promise.resolve(this.__response as Response);
  }

  async put(...[, response]: Parameters<Cache['put']>) {
    this.__response = response;
    return Promise.resolve();
  }

  async add(...[request]: Parameters<Cache['add']>) {
    this.__response = await networkLoad(
      (request as Request).url || (request as string)
    );
  }
}

const CACHE_NAME = '__isolatedExternalsCache';
class CachedExternal {
  url: string;
  loading: boolean;
  failed: boolean;
  private cache: CacheLike | undefined;
  private cachePromise: Promise<CacheLike>;

  constructor(url: string) {
    this.url = url;
    this.loading = true;
    this.failed = false;
    if ('caches' in self) {
      this.cachePromise = self.caches
        .open(CACHE_NAME)
        .then((openedCache) => (this.cache = openedCache));
    } else {
      this.cache = new StaticCache();
      this.cachePromise = Promise.resolve(this.cache);
    }
  }

  async getCache() {
    return await this.cachePromise;
  }

  async getContent() {
    return (await (await this.getCache()).match(this.url))?.text();
  }

  async setContent(content: string) {
    await (await this.getCache()).put(this.url, new Response(content));
  }

  async load() {
    this.loading = true;

    try {
      const cache = await this.getCache();
      await cache.add(this.url);
      const response = await cache.match(this.url);
      this.failed = !response?.ok || response?.status >= 400;
    } catch {
      this.failed = true;
    }

    this.loading = false;
  }
}

function wrappedEval(content: string): unknown {
  // in case of a self-invoking wrapper, make sure self is defined
  // as our context object.
  return eval(`
var self=this;
var globalThis = this;
${content}
  `);
}

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

async function evalExternals(loadedExternals: CachedExternal[]) {
  const context = {};
  for (const cachedExternal of loadedExternals) {
    const { failed, url } = cachedExternal;
    if (failed) {
      console.error(`failed to load external from '${url}'`);
    } else {
      try {
        const content = await cachedExternal.getContent();
        wrappedEval.call(context, content || '');
      } catch (e) {
        console.error(`failed to eval external from ${url}`, e);
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
  const context = await evalExternals(loadedExternals);
  onComplete(context);
}
