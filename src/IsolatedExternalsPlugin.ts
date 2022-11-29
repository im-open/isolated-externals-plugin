import { Compiler } from 'webpack';
import { Externals, ExternalInfo } from './util/externalsClasses';
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
    readonly moduleLocation: string
  ) {
    this.moduleLocation =
      moduleLocation ||
      path.join(__dirname, 'util', 'isolatedExternalsModule.js');
    this.moduleDir = path.dirname(this.moduleLocation);
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
                    [externalName]: `__webpack_modules__["isolatedExternalsModule"]["${globalName}"]`,
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
        const modulePath = path.resolve(this.moduleLocation);

        const originalEntry = compiler.options.entry;
        type NormalizedEntries = typeof originalEntry extends infer U
          ? U extends () => unknown
            ? never
            : U
          : never;
        const isolatedEntries = Object.entries(compiler.options.entry)
          .filter(([entryName]) => Object.keys(this.config).includes(entryName))
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
                  `${modulePath}?${entryKey}`,
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
