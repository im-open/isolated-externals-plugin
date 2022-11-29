import { Compiler } from 'webpack';
import {
  Externals,
  ExternalInfo,
  EXTERNALS_MODULE_NAME,
} from './util/externalsClasses';
import path from 'path';

export interface IsolatedExternalsElement {
  [key: string]: ExternalInfo;
}

export interface IsolatedExternals {
  [key: string]: IsolatedExternalsElement;
}

export default class IsolatedExternalsPlugin {
  readonly moduleDir: string;
  constructor(
    readonly config: IsolatedExternals = {},
    readonly externalsModuleLocation: string,
    readonly nonExternalsModuleLocation: string
  ) {
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
                  ],
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
        compiler.options.externalsType = 'promise';
        compiler.options.externals = {
          ...(typeof existingExternals === 'string'
            ? { existingExternals }
            : existingExternals),
          ...Object.entries(allIsolatedExternals).reduce<
            Record<string, string>
          >(
            (exts, [externalName, { globalName }]) => ({
              ...exts,
              ...(!globalName
                ? {}
                : {
                    [externalName]: `__webpack_modules__["${EXTERNALS_MODULE_NAME}"]["${globalName}"]`,
                  }),
            }),
            {}
          ),
        };
      };

      const setupRules = () => {
        compiler.options.module.rules = [
          ...compiler.options.module.rules,
          ...Object.entries(finalIsolatedExternals).map(
            ([entryName, externals]) => ({
              test: /isolatedExternalsModule.js/,
              resourceQuery: new RegExp(entryName),
              use: [
                {
                  loader: path.resolve(
                    path.join(this.moduleDir, 'isolatedExternalsLoader.js')
                  ),
                  options: externals,
                },
              ],
            })
          ),
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
  }
}
