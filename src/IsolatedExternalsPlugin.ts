import {
  Configuration,
  Compiler,
  ExternalModule,
  dependencies,
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

const { ModuleDependency: OrigModuleDependency } = dependencies;
type ModuleDependency = typeof OrigModuleDependency;
type Maybe<T> = T | undefined | null;

type WebpackExternals = Configuration['externals'];

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
    let existingExternals: WebpackExternals;
    let normalizedExistingExternals: WebpackExternals = {};
    const isolatedExternals = Object.entries(this.config);
    const finalIsolatedExternals = isolatedExternals.reduce<FinalIsolatedExternals>(
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
    const entryExternals = Object.values(finalIsolatedExternals);
    const allIsolatedExternals = entryExternals.reduce<Externals>(
      (finalExternals, externalConfig) => ({
        ...finalExternals,
        ...externalConfig,
      }),
      {} as Externals
    );

    compiler.hooks.afterEnvironment.tap('IsolatedExternalsPlugin', () => {
      existingExternals = compiler.options.externals;
      normalizedExistingExternals = existingExternals || {};
      normalizedExistingExternals =
        typeof normalizedExistingExternals === 'string'
          ? { [normalizedExistingExternals]: normalizedExistingExternals }
          : normalizedExistingExternals;
      normalizedExistingExternals = Array.isArray(normalizedExistingExternals)
        ? normalizedExistingExternals
        : [normalizedExistingExternals as NonNullable<unknown>];

      const setupRules = () => {
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
      };

      const setupEntries = () => {
        const isolatedModulePath = path.resolve(this.externalsModuleLocation);

        const originalEntry = compiler.options.entry;
        type NormalizedEntries = typeof originalEntry extends infer U
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
        compiler.options.entry = { ...originalEntry, ...isolatedEntries };
      };

      setupRules();
      setupEntries();
    });

    compiler.hooks.normalModuleFactory.tap('IsolatedExternalsPlugin', (nmf) => {
      nmf.hooks.factorize.tapAsync('IsolatedExternalsPlugin', (data, cb) => {
        if (!allIsolatedExternals[data.request]) return cb();

        type DependencyModule = ModuleDependency &
          NormalModule & {
            _parentModule?: DependencyModule;
          };

        const getTargetEntry = (dep: DependencyModule): Maybe<string> => {
          const rawRequest = dep._parentModule?.rawRequest || '';

          const entryUrl = new URL(`https://www.example.com${rawRequest}`);
          const entry = entryUrl.searchParams.get('isolatedExternalsEntry');
          if (entry) {
            return entry;
          }

          dep.dependencies
            ?.filter((d) => ((d as unknown) as DependencyModule) !== dep)
            .filter((d) => getTargetEntry((d as unknown) as DependencyModule))
            .map((d) => getTargetEntry((d as unknown) as DependencyModule))[0];
        };

        const targetEntry = data.dependencies
          ?.map<Maybe<string>>((dep) =>
            getTargetEntry((dep as unknown) as DependencyModule)
          )
          .find(Boolean);
        if (!targetEntry) {
          return cb();
        }

        const targetExternal =
          finalIsolatedExternals[targetEntry]?.[data.request];
        if (!targetExternal) {
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
      });
    });

    compiler.hooks.compilation.tap('IsolatedExternalsPlugin', (compilation) => {
      compilation.fileDependencies.add(this.externalsModuleLocation);
    });
  }
}
