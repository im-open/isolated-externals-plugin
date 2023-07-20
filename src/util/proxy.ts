type Maybe<T> = T | undefined | null;

export const createGetProxy = <T extends object, R extends T[keyof T]>(
  orig: T,
  get: (target: T, key: keyof T) => Maybe<R>
): T => {
  return new Proxy(({} as unknown) as T, {
    get: (target, key, ...args): R =>
      get(target, key as keyof T) || (Reflect.get(orig, key, ...args) as R),
  });
};
