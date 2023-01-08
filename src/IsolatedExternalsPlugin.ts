import {
  Configuration,
  Compiler,
  ExternalModule,
  ExternalsPlugin,
  NormalModule,
} from 'webpack';
import { validate } from 'schema-utils';
import { JSONSchema7 } from 'schema-utils/declarations/validate';

import {
  Externals,
  ExternalInfo,
  EXTERNALS_MODULE_NAME,
} from './util/externalsClasses';
import path from 'path';

type Maybe<T> = T | undefined | null;

type WebpackExternals = Configuration['externals'];
type CompileCallback = Parameters<Compiler['hooks']['compile']['tap']>[1];
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
type ExternalsCompileCallback = (
  opts: WithRequired<
    Partial<Parameters<CompileCallback>[0]>,
    'normalModuleFactory'
  >
) => ReturnType<CompileCallback>;
type NormalModuleFactory = Parameters<
  Parameters<Compiler['hooks']['normalModuleFactory']['tap']>[1]
>[0];
type FactorizeCallback = Parameters<
  NormalModuleFactory['hooks']['factorize']['tapAsync']
>[1];

export interface IsolatedExternalsElement {
  [key: string]: ExternalInfo;
}

export interface IsolatedExternals {
  [key: string]: IsolatedExternalsElement;
}

interface FinalIsolatedExternalsElement {
  [key: string]: ExternalInfo & {
    globalName: string;
  };
}

interface FinalIsolatedExternals {
  [key: string]: FinalIsolatedExternalsElement;
}

const configSchema: JSONSchema7 = {
  type: 'object',
  patternProperties: {
    '.*': {
      type: 'object',
      patternProperties: {
        '.*': {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            globalName: { type: 'string' },
          },
        },
      },
    },
  },
};

// eslint-disable-next-line @typescript-eslint/ban-types
const createGetProxy = <T extends object, R extends NonNullable<T[keyof T]>>(
  orig: T,
  get: (target: T, key: NonNullable<keyof T>) => Maybe<R>
): T => {
  return new Proxy(({} as unknown) as T, {
    get: (target, key, ...args): R =>
      get(target, key as NonNullable<keyof T>) ||
      (Reflect.get(orig, key, ...args) as R),
  });
};

const getPassthroughCompiler = (
  compiler: Compiler,
  normalModuleFactory: NormalModuleFactory,
  factorizeAsyncMock: (cb: FactorizeCallback) => void
): Compiler => {
  const nmfFactorizeProxy = createGetProxy(
    normalModuleFactory.hooks.factorize,
    (target, key) => {
      if (key === 'tapAsync') {
        return (name: string, cb: FactorizeCallback) => factorizeAsyncMock(cb);
      }
    }
  );

  const nmfHooksProxy = createGetProxy(
    normalModuleFactory.hooks,
    (target, key) => {
      if (key === 'factorize') {
        return nmfFactorizeProxy;
      }
    }
  );

  const nmfProxy = createGetProxy(normalModuleFactory, (target, key) => {
    if (key === 'hooks') {
      return nmfHooksProxy;
    }
  });

  const compileProxy = createGetProxy(compiler.hooks.compile, (target, key) => {
    if (key === 'tap') {
      return (((name: string, fn: ExternalsCompileCallback) => {
        return fn({ normalModuleFactory: nmfProxy });
      }) as unknown) as CompileCallback;
    }
  });
  const compilerHooksProxy = createGetProxy(compiler.hooks, (target, key) => {
    if (key === 'compile') {
      return compileProxy;
    }
  });

  const stubbedCompiler = createGetProxy(compiler, (target, key) => {
    if (key === 'hooks') {
      return compilerHooksProxy;
    }
  });

  return stubbedCompiler;
};

export default class IsolatedExternalsPlugin {
  readonly moduleDir: string;
  constructor(
    readonly config: IsolatedExternals = {},
    readonly externalsModuleLocation: string
  ) {
    validate(configSchema, config, {
      name: 'IsolatedExternalsPlugin',
      baseDataPath: 'configuration',
    });
    this.externalsModuleLocation =
      externalsModuleLocation ||
      path.join(__dirname, 'util', 'isolatedExternalsModule.js');
    this.moduleDir = path.dirname(this.externalsModuleLocation);
  }

  apply(compiler: Compiler): void {
    const isolatedExternals = Object.entries(this.config);
    let existingExternals: WebpackExternals;
    let normalizedExistingExternals: WebpackExternals = {};
    let finalIsolatedExternals: FinalIsolatedExternals;
    let entryExternals: FinalIsolatedExternalsElement[];
    let allIsolatedExternals: Externals;
    let originalExternalsPlugin: ExternalsPlugin;

    compiler.hooks.afterEnvironment.tap('IsolatedExternalsPlugin', () => {
      existingExternals = compiler.options.externals;
      finalIsolatedExternals = isolatedExternals.reduce<FinalIsolatedExternals>(
        (finalExternals, [entryName, exts]) => {
          const finalExts = Object.entries(
            exts
          ).reduce<FinalIsolatedExternalsElement>(
            (allExts, [packageName, ext]) => ({
              ...allExts,
              [packageName]: {
                ...ext,
                globalName:
                  ext.globalName ||
                  (normalizedExistingExternals as Record<
                    string,
                    string | undefined
                  >)[packageName] ||
                  packageName,
              },
            }),
            {}
          );
          return { ...finalExternals, [entryName]: finalExts };
        },
        {}
      );
      entryExternals = Object.values(finalIsolatedExternals);
      allIsolatedExternals = entryExternals.reduce<Externals>(
        (finalExternals, externalConfig) => ({
          ...finalExternals,
          ...externalConfig,
        }),
        {} as Externals
      );

      originalExternalsPlugin = new ExternalsPlugin(
        compiler.options.externalsType,
        existingExternals
      );
      compiler.options.externals = {};

      normalizedExistingExternals = existingExternals || {};
      normalizedExistingExternals =
        typeof normalizedExistingExternals === 'string'
          ? { [normalizedExistingExternals]: normalizedExistingExternals }
          : normalizedExistingExternals;
      normalizedExistingExternals = Array.isArray(normalizedExistingExternals)
        ? normalizedExistingExternals
        : [normalizedExistingExternals as NonNullable<unknown>];

      compiler.options.module.rules = [
        ...compiler.options.module.rules,
        ...Object.entries(finalIsolatedExternals)
          // We want the longest names last so the most specific ones are matched first
          // module rules are processed in reverse order
          // https://webpack.js.org/concepts/loaders/#configuration
          .sort(function reverseNameLength([entryNameA], [entryNameB]) {
            return entryNameA.length > entryNameB.length ? 1 : -1;
          })
          .map(([entryName, externals]) => ({
            test: /isolatedExternalsModule.js/,
            resourceQuery: new RegExp(`${entryName}$`),
            use: [
              {
                loader: path.resolve(
                  path.join(this.moduleDir, 'isolatedExternalsLoader.js')
                ),
                options: externals,
              },
            ],
          })),
      ];
    });

    compiler.hooks.entryOption.tap(
      'IsolatedExternalsPlugin',
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      (context, entry) => {
        const isolatedModulePath = path.resolve(this.externalsModuleLocation);

        type NormalizedEntries = typeof entry extends infer U
          ? U extends () => unknown
            ? never
            : U
          : never;
        const isolatedKeys = Object.keys(this.config);
        const isolatedEntries = Object.entries(compiler.options.entry)
          .filter(([key]) => isolatedKeys.includes(key))
          .reduce<NormalizedEntries>(
            (
              finalEntries,
              [entryKey, entryValue]: [
                string,
                NormalizedEntries[keyof NormalizedEntries]
              ]
            ) => ({
              ...finalEntries,
              [entryKey]: {
                ...entryValue,
                import: [
                  `${isolatedModulePath}?${entryKey}`,
                  ...(entryValue.import || []).map((importPath) => {
                    const delimiter = importPath.includes('?') ? '&' : '?';
                    return `${importPath}${delimiter}isolatedExternalsEntry=${entryKey}`;
                  }),
                ],
              },
            }),
            {}
          );
        Object.assign(entry, isolatedEntries);
      }
    );

    compiler.hooks.thisCompilation.tap(
      'IsolatedExternalsPlugin',
      (compilation, compilationParams) => {
        const { normalModuleFactory } = compilationParams;
        normalModuleFactory.hooks.factorize.tapAsync(
          'IsolatedExternalsPlugin',
          (data, cb) => {
            const callOriginalExternalsPlugin = () =>
              originalExternalsPlugin.apply(
                getPassthroughCompiler(
                  compiler,
                  normalModuleFactory,
                  (originalFactorize) => originalFactorize(data, cb)
                )
              );

            if (!allIsolatedExternals[data.request]) {
              callOriginalExternalsPlugin();
              return;
            }

            const getEntryName = function (request: string) {
              const entryUrl = new URL('https://www.example.com/' + request);
              const entry = entryUrl.searchParams.get('isolatedExternalsEntry');
              return entry;
            };

            const getTargetEntry = (
              dep: Maybe<NormalModule>
            ): Maybe<string> => {
              if (!dep) {
                return;
              }
              const { rawRequest = '' } = dep;

              const entryName = getEntryName(rawRequest);
              if (entryName) {
                return entryName;
              }

              const connections = Array.from(
                compilation.moduleGraph.getIncomingConnections(dep)
              );
              return getTargetEntry(
                connections.find((conn) =>
                  getTargetEntry(conn.originModule as Maybe<NormalModule>)
                )?.originModule as Maybe<NormalModule>
              );
            };

            const targetEntry = data.dependencies
              ?.map<Maybe<string>>((dep) =>
                getTargetEntry(
                  compilation.moduleGraph.getParentModule(
                    dep
                  ) as Maybe<NormalModule>
                )
              )
              .find(Boolean);

            if (!targetEntry) {
              callOriginalExternalsPlugin();
              return;
            }

            const targetExternal =
              finalIsolatedExternals[targetEntry]?.[data.request];
            if (!targetExternal) {
              callOriginalExternalsPlugin();
              return cb();
            }

            return cb(
              undefined,
              new ExternalModule(
                `__webpack_modules__["${EXTERNALS_MODULE_NAME}"]["${targetExternal.globalName}"]`,
                'promise',
                data.request
              )
            );
          }
        );
      }
    );

    compiler.hooks.compilation.tap('IsolatedExternalsPlugin', (compilation) => {
      compilation.fileDependencies.add(this.externalsModuleLocation);
    });
  }
}
