type Maybe<T> = T | undefined | null;

export const createGetProxy = <
  // eslint-disable-next-line @typescript-eslint/ban-types
  T extends object,
  R extends NonNullable<T[keyof T]>
>(
  orig: T,
  get: (target: T, key: NonNullable<keyof T>) => Maybe<R>
): T => {
  return new Proxy(({} as unknown) as T, {
    get: (target, key, ...args): R =>
      get(target, key as NonNullable<keyof T>) ||
      (Reflect.get(orig, key, ...args) as R),
  });
};
