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
  Compilation,
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

type Maybe<T> = T | undefined | null;

type ModuleDependency = dependencies.ModuleDependency;
type WebpackExternals = Configuration['externals'];
type CompileCallback = Parameters<Compiler['hooks']['compile']['tap']>[1];
type CompilationParams = ConstructorParameters<typeof Compilation>[1];
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

interface UnpromisedEntries {
  [key: string]: string[];
}

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
  readonly unpromisedEntries: UnpromisedEntries;
  constructor(
    readonly config: IsolatedExternals = {},
    readonly externalsModuleLocation: string = '',
    readonly unpromisedEntryModuleLocation: string = ''
  ) {
    validate(configSchema, config, {
      name: 'IsolatedExternalsPlugin',
      baseDataPath: 'configuration',
    });
    this.externalsModuleLocation =
      externalsModuleLocation ||
      path.join(__dirname, 'util', 'isolatedExternalsModule.js');
    this.unpromisedEntryModuleLocation =
      unpromisedEntryModuleLocation ||
      path.join(__dirname, 'util', 'unpromisedEntry.js');
    this.moduleDir = path.dirname(this.externalsModuleLocation);
    this.unpromisedEntries = {};
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
        {
          resourceQuery: /unpromised-entry/,
          use: [
            {
              loader: path.resolve(
                path.join(this.moduleDir, 'unpromised-entry-loader.js')
              ),
            },
          ],
        },
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

    const isolateCompilationEntries = (
      compilation: Compilation,
      compilationParams: CompilationParams
    ) => {
      const logger = compilation.getLogger('IsolatedExternalsPlugin');
      const { normalModuleFactory } = compilationParams;
      const unpromisedEntries = this.unpromisedEntries;

      const getParentModule = (result: ResolveData) =>
        compilation.moduleGraph.getParentModule(result.dependencies[0]);

      const getTargetEntry = (
        dependency: Maybe<Module>,
        parents?: Maybe<Module>[]
      ): Maybe<NormalModule> => {
        const dep = dependency as Maybe<NormalModule>;
        if (!dep) {
          return;
        }
        const { rawRequest = '' } = dep || {};

        if (rawRequest) {
          const entryName =
            getRequestParam(rawRequest, 'isolatedExternalsEntry') ||
            getRequestParam(rawRequest, 'unpromised-entry');
          if (entryName) {
            return dep;
          }
        }

        const connections =
          parents ||
          Array.from(compilation.moduleGraph.getIncomingConnections(dep)).map(
            (conn) => conn?.originModule as Maybe<NormalModule>
          );
        let targetEntry: Maybe<NormalModule>;
        connections
          .filter((conn) => conn && conn.identifier() !== dep.identifier())
          .find((conn) => (targetEntry = getTargetEntry(conn)));
        return targetEntry;
      };

      function updateRequestWithParam(
        request: string,
        paramName: string,
        paramValue: string
      ) {
        const param = `${paramName}=${encodeURIComponent(paramValue)}`;
        const parmRegex = new RegExp(`[?&]${paramName}=[^&]+`);
        const newRequest = request.replace(parmRegex, '');
        const delimiter = newRequest.includes('?') ? '&' : '?';
        return `${request}${delimiter}${param}`;
      }

      function getEntryDepsRequest(
        entryName: string,
        request: string,
        replacedRequest: string,
        replacedContext: string,
        existingEntries: UnpromisedEntries
      ) {
        if (!entryName) return request;

        const unpromiseDeps = existingEntries[entryName] || [];
        if (!unpromiseDeps) return request;

        const originalRequest =
          getRequestParam(replacedRequest, 'originalRequest') ||
          replacedRequest;

        const originalContext =
          getRequestParam(replacedRequest, 'originalContext') ||
          replacedContext;

        let depRequest = updateRequestWithParam(
          request,
          'originalRequest',
          originalRequest
        );
        depRequest = updateRequestWithParam(
          depRequest,
          'originalContext',
          originalContext
        );
        depRequest = updateRequestWithParam(
          depRequest,
          'unpromised-entry',
          entryName
        );
        depRequest = updateRequestWithParam(
          depRequest,
          'deps',
          unpromiseDeps.join(',')
        );

        return depRequest;
      }

      function getEntryDep(entryName: string, request: string) {
        if (!entryName) return;

        const entry = compilation.entries.get(entryName);
        if (!entry) return;

        const newEntryDep = EntryPlugin.createDependency(
          request,
          entry.options || entryName
        );
        return newEntryDep;
      }

      function getTargetEntryNameFromResult(
        result: ResolveData | Module,
        existingTargetEntry?: NormalModule
      ) {
        const targetEntry =
          existingTargetEntry ??
          getTargetEntry(
            (result as Module).type
              ? (result as Module)
              : getParentModule(result as ResolveData)
          );
        if (!targetEntry) return '';

        const entryName =
          getRequestParam(targetEntry.userRequest, 'isolatedExternalsEntry') ||
          '';
        return entryName;
      }

      const setsEqual = <T>(setA: Set<T>, setB: Set<T>): boolean =>
        setA.size === setB.size && [...setA].every((value) => setB.has(value));

      interface KnownParent {
        isNonEsm: boolean;
        connections: Set<string>;
      }
      const knownParents: {
        [key: string]: KnownParent;
      } = {};

      const addKnownParent = (req: string, info: KnownParent) =>
        (knownParents[req] = info);

      const moduleHasNonEsmDeps = (module: Module) =>
        module.dependencies.some(
          (dep) =>
            !['unknown', 'esm', 'self'].includes(dep.category) ||
            dep.constructor.name.includes('CommonJs')
        );
      const parentsHaveNonEsmDep = (
        parent: Module,
        parents: Maybe<Module>[]
      ) => {
        if (!parents.length) {
          logger.debug(`top level parent: \n`, parent.identifier());
          return moduleHasNonEsmDeps(parent);
        }

        function* hasNonEsmDepGen(): Generator<boolean, boolean, void> {
          let parentInd = 0;
          let isNonEsm = false;
          while (parentInd < parents.length && !isNonEsm) {
            let targetParent = parents[parentInd];
            while (!targetParent && parentInd < parents.length)
              targetParent = parents[++parentInd];

            if (!targetParent) return isNonEsm;

            isNonEsm = isNonEsmParent(targetParent);
            parentInd++;

            yield isNonEsm;
          }
          return isNonEsm;
        }

        const hasNonEsmDep = hasNonEsmDepGen();
        for (const isNonEsm of hasNonEsmDep) {
          if (isNonEsm) return true;
        }
        return false;
      };

      const createModuleSet = (arr: Maybe<Module>[]) =>
        new Set(
          arr.filter((m): m is Module => Boolean(m)).map((m) => m.identifier())
        );

      const isNonEsmParent = (
        parent: Module,
        existingParents?: Maybe<Module>[]
      ): boolean => {
        const knownResult = knownParents[parent.identifier()];
        const parents =
          existingParents ||
          [...compilation.moduleGraph.getIncomingConnections(parent)]
            .filter((mod) => mod.originModule !== parent)
            .map<Module | null>((mod) => mod.originModule)
            .filter<Module>((m): m is Module => Boolean(m))
            .filter((m) => m.identifier() !== parent.identifier());
        const parentSet = createModuleSet(parents);

        try {
          if (knownResult && setsEqual(knownResult.connections, parentSet)) {
            return knownResult.isNonEsm;
          }

          const hasNonEsmDeps = moduleHasNonEsmDeps(parent);
          const isNonEsm =
            hasNonEsmDeps || parentsHaveNonEsmDep(parent, parents);

          if (parent.identifier().includes('react-query/devtools')) {
            logger.debug('react-query/devtools', {
              req: parent.identifier(),
              hasNonEsmDeps,
              isNonEsm,
              deps: parent.dependencies.map((dep) => ({
                category: dep.category,
                id: (dep as ModuleDependency).request,
                className: dep.constructor.name,
              })),
            });
          }

          addKnownParent(parent.identifier(), {
            isNonEsm,
            connections: parentSet,
          });

          if (hasNonEsmDeps) {
            logger.debug('found non-esm parent', {
              req: parent.identifier(),
              deps: parent.dependencies.map((dep) => {
                const {
                  category,
                  constructor: { name: constructorName },
                } = dep;
                return {
                  category,
                  id: (dep as ModuleDependency).request,
                  name: ((dep as unknown) as { name: string }).name,
                  constructorName,
                };
              }),
            });
          }

          return isNonEsm;
        } catch (err) {
          console.warn('Error in isNonEsmParent: ', {
            req: parent.identifier(),
            parentSet,
          });
          console.error(err);
          logger.error(err);
          throw err;
        }
      };

      const isNonEsmResult = (
        result: ResolveData,
        parent: Module,
        parents: Maybe<Module>[]
      ) => {
        const connections =
          parents ||
          [...compilation.moduleGraph.getIncomingConnections(parent)].map(
            (c) => c.originModule
          );
        const knownParent = knownParents[parent.identifier()];
        if (
          knownParent &&
          setsEqual(knownParent.connections, createModuleSet(connections))
        ) {
          logger.debug(
            'known parent: \n',
            parent.identifier(),
            '\n',
            knownParent
          );
          return knownParent.isNonEsm;
        }

        const isNonEsm =
          (result.dependencyType !== 'esm' &&
            (logger.debug(
              `Found dependency type for ${result.request}:`,
              result.dependencyType
            ),
            true)) ||
          isNonEsmParent(parent, connections);
        return isNonEsm;
      };

      normalModuleFactory.hooks.beforeResolve.tap(
        'IsolatedExternalsPlugin',
        (result) => {
          try {
            const parentModule = getParentModule(result);
            const parents = [
              ...compilation.moduleGraph.getIncomingConnections(parentModule),
            ]
              .map((c) => c.originModule)
              .filter((m) => m?.identifier() !== parentModule.identifier());

            if (!parents.length) return;

            const targetEntry = getTargetEntry(parentModule, parents);
            if (!targetEntry) return;

            const entryName = getTargetEntryNameFromResult(result, targetEntry);

            const externalsBlock = finalIsolatedExternals[entryName];
            const externalName = result.request;

            const targetExternal = externalsBlock?.[externalName];
            if (!targetExternal) return;

            logger.debug(
              `Checking dep "${result.request} for entry "${entryName}"`
            );

            const nonEsmInChain = isNonEsmResult(result, parentModule, parents);
            if (!nonEsmInChain) return;

            logger.debug(
              `unpromising entry "${entryName}" for external "${result.request}".`
            );

            const req = result.request.endsWith('/')
              ? result.request + 'index'
              : result.request;

            const newRequest = `${req}?unpromise-external&globalName=${targetExternal.globalName}`;

            result.request = newRequest;

            const externalsReqs = Object.entries(externalsBlock);
            const previousExternals = externalsReqs.slice(
              0,
              externalsReqs.findIndex(([key]) => key === externalName)
            );

            unpromisedEntries[entryName] = [
              ...new Set([
                ...(unpromisedEntries[entryName] || []),
                ...previousExternals.map(([, { globalName }]) => globalName),
                targetExternal.globalName,
              ]),
            ];
          } catch (err) {
            logger.warn('error setting up unpromise-externals', result.request);
            logger.error(err);
            console.error(err);
            throw err;
          }
        }
      );

      const updateEntries = async () => {
        const existingEntries = { ...unpromisedEntries };
        for (const entryName of Object.keys(existingEntries)) {
          const entry = compilation.entries.get(entryName);
          if (!entry) {
            logger.debug('no entry', entryName);
            break;
          }
          const entryDep = (entry.dependencies as ModuleDependency[]).find(
            (dep) =>
              (getRequestParam(dep.request, 'isolatedExternalsEntry') ||
                getRequestParam(dep.request, 'unpromised-entry')) === entryName
          );
          if (!entryDep) {
            logger.debug('no entry dependency', entryName);
            break;
          }

          const newEntryRequest = getEntryDepsRequest(
            entryName,
            this.unpromisedEntryModuleLocation,
            entryDep.request,
            /^\./.test(entryDep.request)
              ? entryDep.getContext() || process.cwd()
              : '',
            existingEntries
          );

          if (entryDep.request === newEntryRequest) {
            logger.debug('no need to rebuild entry module', {
              entryName,
              request: entryDep.request,
            });
            break;
          }

          logger.debug('Rebuilding entry:', {
            entryName,
            newEntryRequest,
          });

          const newEntryDep = getEntryDep(entryName, newEntryRequest);
          if (!newEntryDep) {
            logger.debug('no new entry module', entryName, entryDep.request);
            break;
          }
          logger.debug('replacing entry module', {
            entryName,
            newEntryDep,
          });
          entry.dependencies = entry.dependencies.filter(
            (dep) => dep !== entryDep
          );

          const rebuilding = new Promise<void>((resolve, reject) => {
            compilation.addEntry('', newEntryDep, entryName, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
          await rebuilding;
        }
      };

      compilation.hooks.buildModule.tap(
        'IsolatedExternalsPlugin',
        () => void updateEntries()
      );

      compilation.hooks.rebuildModule.tap(
        'IsolatedExternalsPlugin',
        () => void updateEntries()
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

          const parent = getParentModule(data);
          const targetEntry = getTargetEntry(parent);

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
    };

    compiler.hooks.thisCompilation.tap(
      'IsolatedExternalsPlugin',
      isolateCompilationEntries
    );

    compiler.hooks.watchRun.tap('IsolatedExternalsPlugin', (newCompiler) => {
      newCompiler.hooks.thisCompilation.tap(
        'IsolatedExternalsPlugin',
        isolateCompilationEntries
      );
    });

    compiler.hooks.compilation.tap('IsolatedExternalsPlugin', (compilation) => {
      compilation.fileDependencies.add(this.externalsModuleLocation);
      compilation.fileDependencies.add(this.unpromisedEntryModuleLocation);
    });
  }
}
