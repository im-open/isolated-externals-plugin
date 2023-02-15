export interface ExternalInfo {
  globalName?: string;
  url: string;
  urlTransformer?: string;
}

export interface Externals {
  [key: string]: ExternalInfo;
}

export type ModuleExternalInfo = Omit<ExternalInfo, 'urlTransformer'> & {
  urlTransformer: (url: string) => string;
};

export interface ModuleExternals {
  [key: string]: ModuleExternalInfo;
}

const isReady = (): boolean =>
  document.readyState === 'interactive' || document.readyState === 'complete';

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
export class CachedExternal {
  url: string;
  loading: boolean;
  failed: boolean;
  error?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  loaded: boolean;
  private response: Response | undefined;
  private cachePromise?: Promise<CacheLike>;
  private retries: number;
  private readyListener?: () => void;
  static MAX_RETRIES = 1;

  constructor(url: string) {
    this.url = url;
    this.failed = false;
    this.retries = 0;
    this.loaded = false;
    this.loading = true;
    void this.load();
  }

  async getCache(): Promise<CacheLike> {
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

  async getContent(): Promise<string | undefined> {
    if (this.failed) return '';

    const cacheMatch = await (await this.getCache()).match(this.url);
    if (cacheMatch) {
      return cacheMatch.text();
    }

    if (this.loading) await this.waitForLoad();
    else await this.load();
    return this.getContent();
  }

  async setContent(content: string): Promise<void> {
    await (await this.getCache()).put(this.url, new Response(content));
  }

  waitForLoad(): Promise<Response | undefined> {
    return new Promise((res) => {
      const checkLoad = () => {
        if (!this.loading) return res(this.response);
        window.requestAnimationFrame(checkLoad);
      };
      checkLoad();
    });
  }

  waitForReady(): Promise<void> {
    return new Promise((res) => {
      const readyListener = () => {
        if (isReady()) return res();

        const newListener = readyListener.bind(this);
        const readyEvent = 'readystatechange';
        document.removeEventListener(
          readyEvent,
          this.readyListener || newListener
        );
        this.readyListener = newListener;
        document.addEventListener(readyEvent, newListener);
      };

      readyListener();
    });
  }

  async loadResponse(): Promise<Response | undefined> {
    const cache = await this.getCache();
    const cacheMatch = await cache.match(this.url);
    if (cacheMatch) return cacheMatch;

    await cache.add(this.url);
    const response = await cache.match(this.url);

    if (!response) return;

    if (response.redirected) {
      await cache.put(response.url, response.clone());
    }
    return response;
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    this.loading = true;

    await this.waitForReady();

    try {
      const response = await this.loadResponse();
      this.failed = !response?.ok || response?.status >= 400;
      this.loaded = true;
      this.response = response as Response;
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
        console.error(err);
        this.failed = true;
        this.error = err; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      }
    }

    this.loading = false;
  }
}

export const EXTERNALS_MODULE_NAME = 'externalsModule';
