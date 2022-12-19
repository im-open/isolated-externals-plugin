import { EXTERNALS_MODULE_NAME } from './externalsClasses';
import getGlobal from './getGlobal';
import getValue from './getValue';

export {};

const windowProxy = new Proxy(getGlobal(), {
  get(...args): unknown {
    const [, prop] = args;
    if (typeof prop === 'string' && prop.includes('.')) {
      return getValue(
        prop,
        (windowProxy as unknown) as Record<string, unknown>
      );
    }
    return Reflect.get(...args) as unknown;
  },
});

__webpack_modules__[EXTERNALS_MODULE_NAME] = windowProxy;
