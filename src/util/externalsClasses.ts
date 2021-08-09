/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
type CachedExternals = Record<string, CachedExternal>;

interface ExternalInfo {
  name: string;
  url: string;
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
interface Externals {
  [key: string]: ExternalInfo;
}

type GuaranteedResponse = Pick<Response, 'ok' | 'status' | 'text' | 'clone'>;
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

  clone() {
    return (this as unknown) as Response;
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
      'Response' in window
        ? new Response(body, responseInit)
        : new StaticResponse(body, responseInit);
  }

  text() {
    return this.clone()?.text();
  }

  clone() {
    return this.__response.clone();
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
  if ('fetch' in window) {
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
    return Promise.resolve(this.__response?.clone());
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
  error?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  private cachePromise?: Promise<CacheLike>;
  private retries: number;
  static MAX_RETRIES = 1;

  constructor(url: string) {
    this.url = url;
    this.loading = true;
    this.failed = false;
    this.retries = 0;
  }

  async getCache() {
    if (this.cachePromise) return await this.cachePromise;

    /*
     * This covers any browsers without the caches API,
     * and works around this Firefox bug:
     * https://bugzilla.mozilla.org/show_bug.cgi?id=1724607
     */
    try {
      this.cachePromise = window.caches.open(CACHE_NAME);
      return await this.cachePromise;
    } catch {
      const staticCache = new StaticCache();
      this.cachePromise = Promise.resolve(staticCache);
      return await this.cachePromise;
    }
  }

  async getContent() {
    return (await (await this.getCache()).match(this.url))?.text();
  }

  async setContent(content: string) {
    await (await this.getCache()).put(this.url, new Response(content));
  }

  async load(): Promise<void> {
    this.loading = true;

    try {
      const cache = await this.getCache();
      await cache.add(this.url);
      const response = await cache.match(this.url);
      this.failed = !response?.ok || response?.status >= 400;
    } catch (err) {
      /*
       * Chrome occasionally fails with a network error when attempting to cache
       * a url that returns a redirect Response. This retry should get around
       * that.
       */
      if (this.retries < CachedExternal.MAX_RETRIES) {
        this.retries += 1;
        return this.load();
      } else {
        this.failed = true;
        this.error = err; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      }
    }

    this.loading = false;
  }
}
