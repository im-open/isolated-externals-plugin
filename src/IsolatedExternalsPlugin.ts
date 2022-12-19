import { Configuration, Compiler } from 'webpack';
import { Concat } from 'typescript-tuple';
import { validate } from 'schema-utils';
import { JSONSchema7 } from 'schema-utils/declarations/validate';

import {
  Externals,
  ExternalInfo,
  EXTERNALS_MODULE_NAME,
} from './util/externalsClasses';
import path from 'path';

type WebpackExternals = Configuration['externals'];
type ExternalItemFunction = Extract<
  WebpackExternals,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data: any, callback: any) => void
>;
type ExternalItemFunctionParams = Parameters<ExternalItemFunction>;
type ExternalItemFunctionData = ExternalItemFunctionParams[0];
type OrigExternalItemCallback = ExternalItemFunctionParams[1];
type ExternalItemCallbackParams = Concat<
  Parameters<NonNullable<OrigExternalItemCallback>>,
  ['promise']
>;
type ExternalItemCallback = (...args: ExternalItemCallbackParams) => void;
type SingleWebpackExternal = Exclude<WebpackExternals, Array<unknown>>;

export interface IsolatedExternalsElement {
  [key: string]: ExternalInfo;
}

export interface IsolatedExternals {
  [key: string]: IsolatedExternalsElement;
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

const getExistingExternal = (
  existingExternals: WebpackExternals,
  data: ExternalItemFunctionData
): SingleWebpackExternal | undefined => {
  if (!existingExternals) {
    return;
  }

  if (typeof existingExternals === 'function') {
    return existingExternals;
  }

  if (Array.isArray(existingExternals)) {
    return existingExternals.find((external) =>
      getExistingExternal(external, data)
    );
  }

  if (existingExternals instanceof RegExp) {
    return existingExternals;
  }

  if (typeof existingExternals === 'object') {
    const theExternal = existingExternals[data.request || ''];
    if (theExternal) return existingExternals;
  }

  if (typeof existingExternals === 'string') {
    if (existingExternals === data.request) {
      return existingExternals;
    }
  }
};

function callExistingExternal(
  existingExternal: SingleWebpackExternal,
  data: ExternalItemFunctionData,
  callback: NonNullable<OrigExternalItemCallback>
): void | Promise<unknown> {
  if (typeof existingExternal === 'function') {
    return existingExternal(data, callback);
  }

  if (existingExternal instanceof RegExp) {
    return callback(undefined, existingExternal);
  }

  if (typeof existingExternal === 'object') {
    return callback(undefined, existingExternal[data.request || '']);
  }

  if (typeof existingExternal === 'string') {
    return callback(undefined, existingExternal);
  }
}

export default class IsolatedExternalsPlugin {
  readonly moduleDir: string;
  constructor(
    readonly config: IsolatedExternals = {},
    readonly externalsModuleLocation: string,
    readonly nonExternalsModuleLocation: string
  ) {
    validate(configSchema, config, {
      name: 'IsolatedExternalsPlugin',
      baseDataPath: 'configuration',
    });
    this.externalsModuleLocation =
      externalsModuleLocation ||
      path.join(__dirname, 'util', 'isolatedExternalsModule.js');
    this.nonExternalsModuleLocation =
      nonExternalsModuleLocation ||
      path.join(__dirname, 'util', 'nonIsolatedExternalsModule.js');
    this.moduleDir = path.dirname(this.externalsModuleLocation);
  }

  apply(compiler: Compiler): void {
    compiler.hooks.afterEnvironment.tap('IsolatedExternalsPlugin', () => {
      const existingExternals = compiler.options.externals || {};
      const isolatedExternals = Object.entries(this.config);
      const finalIsolatedExternals = isolatedExternals.reduce<IsolatedExternals>(
        (finalExternals, [entryName, exts]) => {
          const finalExts = Object.entries(exts).reduce<Externals>(
            (allExts, [packageName, ext]) => ({
              ...allExts,
              [packageName]: {
                ...ext,
                globalName:
                  ext.globalName ||
                  (existingExternals as Record<string, string | undefined>)[
                    packageName
                  ] ||
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

      const setupExternals = () => {
        let existingExternals = compiler.options.externals || {};
        existingExternals =
          typeof existingExternals === 'string'
            ? { [existingExternals]: existingExternals }
            : existingExternals;
        existingExternals = Array.isArray(existingExternals)
          ? existingExternals
          : [existingExternals];

        compiler.options.externals = [
          (data: ExternalItemFunctionData, callback) => {
            const { request } = data;
            if (!request) return callback();

            const externalInfo = allIsolatedExternals[request];
            if (!externalInfo || !externalInfo.globalName) {
              const matchedExternal = getExistingExternal(
                existingExternals,
                data
              );
              if (matchedExternal) {
                return callExistingExternal(matchedExternal, data, callback);
              }

              return callback();
            }

            ((callback as unknown) as ExternalItemCallback)(
              undefined,
              `__webpack_modules__["${EXTERNALS_MODULE_NAME}"]["${externalInfo.globalName}"]`,
              'promise'
            );
          },
        ];
      };

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
        const nonIsolatedModulePath = path.resolve(
          this.nonExternalsModuleLocation
        );

        const originalEntry = compiler.options.entry;
        type NormalizedEntries = typeof originalEntry extends infer U
          ? U extends () => unknown
            ? never
            : U
          : never;
        const isolatedKeys = Object.keys(this.config);
        const isolatedEntries = Object.entries(
          compiler.options.entry
        ).reduce<NormalizedEntries>(
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
                `${
                  isolatedKeys.includes(entryKey)
                    ? isolatedModulePath
                    : nonIsolatedModulePath
                }?${entryKey}`,
                ...(entryValue.import || []),
              ],
            },
          }),
          {}
        );
        compiler.options.entry = { ...originalEntry, ...isolatedEntries };
      };

      setupExternals();
      setupRules();
      setupEntries();
    });

    compiler.hooks.compilation.tap('IsolatedExternalsPlugin', (compilation) => {
      compilation.fileDependencies.add(this.externalsModuleLocation);
      compilation.fileDependencies.add(this.nonExternalsModuleLocation);
    });
  }
}
