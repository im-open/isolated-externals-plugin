import type { SYNCED_EXTERNALS_MODULE_NAME as SYNC_EXT_MOD_NAME } from './externalsClasses';
type SyncedExternalsModuleName = typeof SYNC_EXT_MOD_NAME;

declare const SYNCED_EXTERNALS_MODULE_NAME: SyncedExternalsModuleName;
declare const THE_GLOBAL: string;

type ModuleHolder = {
  [key in SyncedExternalsModuleName]: {
    [key: string]: unknown;
  };
};

declare const __webpack_modules__: ModuleHolder;

const externalsProxy = new Proxy<{
  [key: string | symbol]: unknown;
}>(
  {},
  {
    get: <T>(target: { [key: symbol]: T }, prop: symbol | string) => {
      if (typeof prop !== 'string') return target[prop];

      return (__webpack_modules__[SYNCED_EXTERNALS_MODULE_NAME] || {})[prop];
    },
  }
);

const syncedModulesProxy = new Proxy<{
  [key: string | symbol]: unknown;
}>(
  {},
  {
    get: <T>(target: unknown, prop: symbol | string) => {
      return externalsProxy[prop] as T;
    },
  }
);

const theExternal = syncedModulesProxy[THE_GLOBAL];
export default theExternal;
