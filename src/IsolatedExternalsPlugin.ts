import {
  Compiler,
  compilation,
  ExternalsElement,
  ExternalsObjectElement,
} from 'webpack';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ConcatSource, Source } from 'webpack-sources';
import randomstring from 'randomstring';

type Compilation = compilation.Compilation;

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

interface Entrypoint {
  chunks: {
    files: string[];
  }[];
}

const readFile = promisify(fs.readFile);

type IsolatedExternalsConfig = {
  [key: string]: {
    [key: string]: { url: string };
  };
};

const generateVar = (external: string) =>
  `var ${external} = context.${external} || (window || global || self)["${external}"];`;

function wrapApp(
  source: Source | string,
  externals: IsolatedExternalsElement,
  appName: string
): ConcatSource {
  const externalsList = Object.entries(externals);
  const varNames = externalsList
    .map(([, { name }]) =>
      generateVar(
        // for the case of nested dependencies, we only need to define the base
        // object from our context
        name.split('.')[0]
      )
    )
    .join('\n  ');
  const wrappedSource = new ConcatSource(
    `function ${appName}(context){`,
    `\n`,
    varNames,
    `\n`,
    source,
    `\n`,
    `}`
  );
  return wrappedSource;
}

async function addLoadExternals(
  source: Source | string,
  loadExternalsLocation: string
): Promise<ConcatSource> {
  const loadExternals = await readFile(loadExternalsLocation);
  return new ConcatSource(source, `\n`, loadExternals.toString());
}

function callLoadExternals(
  source: Source | string,
  externals: IsolatedExternalsElement,
  appName: string
): ConcatSource {
  const externalsObj = JSON.stringify(externals);
  const loadCall = `loadExternals(${externalsObj},`;
  const appCallback = `function (context) { ${appName}(context); }`;
  const closeCall = `);`;
  return new ConcatSource(source, loadCall, appCallback, closeCall);
}

function selfInvoke(source: Source | string): ConcatSource {
  return new ConcatSource(`(function() {`, source, `})();`);
}

function getConfigExternals(
  externals: ExternalsElement | ExternalsElement[]
): ExternalsObjectElement {
  const externalsArray = Array.isArray(externals) ? externals : [externals];
  const externalsObjects = externalsArray.filter(
    (element) => typeof element === 'object' && !(element instanceof RegExp)
  );
  const finalExternals = externalsObjects.map((external) => {
    const entries = Object.entries(external);
    return entries
      .filter(([, value]) => typeof value === 'string')
      .reduce<ExternalsObjectElement>(
        (final: ExternalsObjectElement, [key, value]: [string, string]) => ({
          ...final,
          [key]: value,
        }),
        {}
      );
  });
  const finalElement = finalExternals.reduce<ExternalsObjectElement>(
    (finalObj: ExternalsObjectElement, obj: ExternalsObjectElement) => ({
      ...finalObj,
      ...obj,
    }),
    {}
  );
  return finalElement;
}

function getExternals(
  pluginConfig: IsolatedExternalsConfig,
  compilerExternals: ExternalsObjectElement
): IsolatedExternals {
  const externals = Object.entries(pluginConfig).reduce<IsolatedExternals>(
    (finalExternals: IsolatedExternals, [entryName, pluginExternal]) => {
      const externalContent = Object.entries(
        pluginExternal
      ).reduce<IsolatedExternalsElement>(
        (
          finalItems: IsolatedExternalsElement,
          [externalName, externalConfig]: [string, { url: string }]
        ) => ({
          ...finalItems,
          [externalName]: {
            name: compilerExternals[externalName] as string,
            ...externalConfig,
          },
        }),
        {} as IsolatedExternalsElement
      );
      return {
        ...finalExternals,
        [entryName]: externalContent,
      };
    },
    {} as IsolatedExternals
  );
  return externals;
}

interface NamedEntry {
  entrypoint: Entrypoint;
  name: string;
}

function getTargetAssets(
  comp: Compilation,
  config: IsolatedExternalsConfig,
  externals: IsolatedExternals
): [string, string, Source | string][] {
  const externalKeys = Object.keys(externals);
  const entrypoints = externalKeys
    .filter((key) => comp.entrypoints.has(key))
    .map<NamedEntry>((key) => ({
      name: key,
      entrypoint: comp.entrypoints.get(key) as Entrypoint,
    }));
  const assets = Object.entries<Source | string>(comp.assets);
  const targetAssets = assets
    .filter(
      ([name]) =>
        entrypoints.some((entry) =>
          entry.entrypoint.chunks.some((chunk) => chunk.files.includes(name))
        ) &&
        /\.js(x)?$/.test(name) &&
        !/\.hot-update\./.test(name)
    )
    .map<[string, string, Source | string]>(([name, source]) => {
      const targetEntry = entrypoints.find((entry) =>
        entry.entrypoint.chunks.some((chunk) => chunk.files.includes(name))
      ) || { name: '' };
      return [targetEntry.name, name, source];
    });
  return targetAssets;
}

function getAppName(): string {
  return (
    randomstring.generate({ length: 1, charset: 'alphabetic' }) +
    randomstring.generate(11)
  );
}

export default class IsolatedExternalsPlugin {
  loadExternalsLocation: string;
  constructor(
    readonly config: IsolatedExternalsConfig = {},
    loadExternalsLocation?: string
  ) {
    this.loadExternalsLocation =
      loadExternalsLocation ||
      path.resolve(__dirname, 'util', 'loadExternals.js');
  }

  apply(compiler: Compiler): void {
    compiler.hooks.emit.tapPromise(
      'IsolatedExternalsPlugin',
      async (comp: Compilation): Promise<void> => {
        const compilerExternals = getConfigExternals(
          compiler.options.externals || {}
        );
        const externals = getExternals(this.config, compilerExternals);
        const targetAssets = getTargetAssets(comp, this.config, externals);

        const externalObjects = Object.entries(externals);
        for (const [entryName, name, asset] of targetAssets) {
          const targetObjects = externalObjects.filter(
            ([externalName]) => externalName === entryName
          );
          for (const [, externalsObject] of targetObjects) {
            const source = asset as Source;
            const appName = getAppName();
            const wrappedAsset = wrapApp(source, externalsObject, appName);
            const loadableAsset = await addLoadExternals(
              wrappedAsset,
              this.loadExternalsLocation
            );
            const calledAsset = callLoadExternals(
              loadableAsset,
              externalsObject,
              appName
            );
            const selfInvokingAssset = selfInvoke(calledAsset);
            comp.updateAsset(name, selfInvokingAssset);
          }
        }
      }
    );
  }
}
