import {
  Configuration,
  Compiler,
  ExternalModule,
  ExternalsPlugin,
  NormalModule,
  dependencies,
  Module,
  EntryPlugin,
  ResolveData,
  Dependency,
} from 'webpack';
import { validate } from 'schema-utils';
import { JSONSchema7 } from 'schema-utils/declarations/validate';
import path from 'path';

import {
  Externals,
  ExternalInfo,
  EXTERNALS_MODULE_NAME,
} from './util/externalsClasses';
import { createGetProxy } from './util/proxy';
import getRequestParam from './util/getRequestParam';
import { keywordError } from 'ajv/dist/compile/errors';

export type Maybe<T> = T | undefined | null;

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
  [key: string]: Omit<ExternalInfo, 'globalName'> & {
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
          .flatMap(([entryName, externals]) => [
            {
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
            },
            {
              resourceQuery: new RegExp(`isolatedExternalsEntry=${entryName}`),
              use: [
                {
                  loader: path.resolve(
                    path.join(this.moduleDir, 'unpromised-entry-loader.js')
                  ),
                },
              ],
            },
          ]),
        {
          resourceQuery: /unpromise-external/,
          use: [
            {
              loader: path.resolve(
                path.join(this.moduleDir, 'unpromise-loader.js')
              ),
            },
          ],
        },
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
        const unpromisedEntries: {
          [key: string]: {
            context: string;
            request: string;
            deps: string[];
          };
        } = {};

        const getTargetEntry = (
          dep: Maybe<NormalModule>
        ): Maybe<NormalModule> => {
          if (!dep) {
            return;
          }
          const { rawRequest = '' } = dep || {};

          if (rawRequest) {
            const entryName = getRequestParam(
              rawRequest,
              'isolatedExternalsEntry'
            );
            if (entryName) {
              return dep;
            }
          }

          const connections = Array.from(
            compilation.moduleGraph.getIncomingConnections(dep as Module)
          );
          return getTargetEntry(
            connections.find(
              (conn) =>
                conn.originModule !== dep &&
                getTargetEntry(conn.originModule as Maybe<NormalModule>)
            )?.originModule as Maybe<NormalModule>
          );
        };

        const getTargetEntryFromDeps = (
          deps: Maybe<dependencies.ModuleDependency[]>
        ) => {
          const targetEntry = deps
            ?.map((dep) =>
              getTargetEntry(
                compilation.moduleGraph.getParentModule(
                  dep
                ) as Maybe<NormalModule>
              )
            )
            .find(Boolean);

          return targetEntry;
        };

        async function rebuildEntryModule(
          entryName: string,
          request: string,
          context: string,
          unpromiseDeps: string[]
        ) {
          const rebuilding = new Promise<void>((resolve, reject) => {
            const newRequest = request.replace(
              /(\?|&)unpromised-entry&deps=[^&]+/,
              ''
            );
            const delimiter = newRequest.includes('?') ? '&' : '?';

            const depRequest = `${newRequest}${delimiter}unpromised-entry&deps=${unpromiseDeps.join(
              ','
            )}`;
            const entry = compilation.entries.get(entryName);
            if (!entry) return;

            const entryModule = compilation.moduleGraph.getModule(
              entry.dependencies[0]
            ) as NormalModule;
            if (entryModule.rawRequest == depRequest) return;

            const newEntryDep = EntryPlugin.createDependency(
              depRequest,
              entry.options || entryName
            );

            compilation.addEntry(
              context,
              newEntryDep,
              entryName,
              (err, addedModule) => {
                addedModule?.invalidateBuild();
                if (err) {
                  console.error(`error adding module ${request}`, err);
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          });
          await rebuilding;
        }

        function getTargetEntryNameFromResult(
          result: ResolveData,
          existingTargetEntry?: NormalModule
        ) {
          const targetEntry =
            existingTargetEntry ?? getTargetEntryFromDeps(result.dependencies);
          if (!targetEntry) return '';

          const entryName =
            getRequestParam(
              targetEntry.userRequest,
              'isolatedExternalsEntry'
            ) || '';
          return entryName;
        }

        normalModuleFactory.hooks.beforeResolve.tap(
          'IsolatedExternalsPlugin',
          (result) => {
            try {
              if (result.dependencyType === 'esm') return;

              const targetEntry = getTargetEntryFromDeps(result.dependencies);
              if (!targetEntry) return;

              const entryName = getTargetEntryNameFromResult(
                result,
                targetEntry
              );

              const targetExternal =
                finalIsolatedExternals[entryName]?.[result.request];
              if (!targetExternal) return;

              const req = result.request.endsWith('/')
                ? result.request + 'index'
                : result.request;

              result.request = `${req}?unpromise-external&globalName=${targetExternal.globalName}`;
              unpromisedEntries[entryName] = {
                context: targetEntry.context || '',
                request: targetEntry.rawRequest,
                deps: [
                  ...new Set([
                    ...(unpromisedEntries[entryName]?.deps || []),
                    targetExternal.globalName,
                  ]),
                ],
              };
            } catch (err) {
              console.warn(
                'error setting up unpromise-externals',
                result.request
              );
              console.error(err);
              throw err;
            }
          }
        );

        normalModuleFactory.hooks.afterResolve.tapPromise(
          'IsolatedExternalsPlugin',
          async (result) => {
            if (!result.request.includes('?unpromise-external')) return;

            const entryName = getTargetEntryNameFromResult(result);
            if (!entryName) return;

            const { context, request, deps } =
              unpromisedEntries[entryName] || {};
            if (!context || !request || !deps) return;

            try {
              await rebuildEntryModule(entryName, request, context, deps);
            } catch {
              // sometimes we fail. that's ok.
            }
          }
        );

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

            const targetEntry = getTargetEntryFromDeps(data.dependencies);

            if (!targetEntry) {
              callOriginalExternalsPlugin();
              return;
            }

            const entryName =
              getRequestParam(
                targetEntry.userRequest,
                'isolatedExternalsEntry'
              ) || '';
            const targetExternal =
              finalIsolatedExternals[entryName]?.[data.request];
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
