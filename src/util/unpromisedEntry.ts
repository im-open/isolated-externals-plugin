import type {
  EXTERNALS_MODULE_NAME as EXT_MOD_NAME,
  SYNCED_EXTERNALS_MODULE_NAME as SYNC_EXT_MOD_NAME,
} from './externalsClasses';
type ExternalsModuleName = typeof EXT_MOD_NAME;
type SyncedExternalsModuleName = typeof SYNC_EXT_MOD_NAME;

type ExternalsModuleHolder = {
  [key in ExternalsModuleName]: {
    [key: string]: Promise<unknown>;
  };
};

type SyncedExternalsModuleHolder = {
  [key in SyncedExternalsModuleName]: {
    [key: string]: unknown;
  };
};

type ModuleHolder = ExternalsModuleHolder & SyncedExternalsModuleHolder;

declare const __webpack_modules__: ModuleHolder;
declare const EXTERNALS_MODULE_NAME: ExternalsModuleName;
declare const SYNCED_EXTERNALS_MODULE_NAME: SyncedExternalsModuleName;

const unpromisedDeps = 'DEPS_PLACEHOLDER'.split(',');
const reload = 'RELOAD_PLACEHOLDER';

async function waitForDep(dep: string) {
  const result = await __webpack_modules__[EXTERNALS_MODULE_NAME][dep];
  (__webpack_modules__[SYNCED_EXTERNALS_MODULE_NAME] ||
    (() => {
      __webpack_modules__[SYNCED_EXTERNALS_MODULE_NAME] = {};
      return __webpack_modules__[SYNCED_EXTERNALS_MODULE_NAME];
    }))[dep] = result;
}

async function awaitDeps() {
  await Promise.all(unpromisedDeps.map(waitForDep));
  require(reload);
}

void awaitDeps();
