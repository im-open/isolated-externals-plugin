import { Compiler } from 'webpack';
import path from 'path';

export interface IsolatedExternalInfo {
  name: string;
  url: string;
  loaded?: boolean;
}

export interface IsolatedExternalsElement {
  [key: string]: IsolatedExternalInfo;
}

export interface IsolatedExternals {
  [key: string]: IsolatedExternalsElement;
}

type IsolatedExternalsConfig = {
  [key: string]: {
    [key: string]: { url: string };
  };
};

function getExternalsNames(config: IsolatedExternalsConfig) {
  const allExternals = Object.entries(config).reduce<string[]>(
    (names, [, externals]) => [...names, ...Object.keys(externals)],
    []
  );
  return Array.from(new Set(allExternals));
}

export default class IsolatedExternalsPlugin {
  readonly moduleDir: string;
  constructor(
    readonly config: IsolatedExternalsConfig = {},
    readonly moduleLocation: string
  ) {
    this.moduleLocation =
      moduleLocation ||
      path.join(__dirname, 'util', 'isolatedExternalsModule.js');
    this.moduleDir = path.dirname(this.moduleLocation);
  }

  apply(compiler: Compiler): void {
    compiler.hooks.afterEnvironment.tap('IsolatedExternalsPlugin', () => {
      const setupExternals = () => {
        compiler.options.externalsType = 'promise';
        const existingExternals = compiler.options.externals || {};
        const isolatedExternalsNames = getExternalsNames(this.config);
        compiler.options.externals = {
          ...(typeof existingExternals === 'string'
            ? { existingExternals }
            : existingExternals),
          ...isolatedExternalsNames.reduce<Record<string, string>>(
            (exts, name) => ({
              ...exts,
              [name]: `__webpack_modules__["isolatedExternalsModule"]["${name}"]`,
            }),
            {}
          ),
        };
      };

      const setupRules = () => {
        compiler.options.module.rules = [
          ...compiler.options.module.rules,
          ...Object.entries(this.config).map(([entryName, externals]) => ({
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
          })),
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
