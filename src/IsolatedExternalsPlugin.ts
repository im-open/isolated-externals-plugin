import {
  Compiler,
  compilation,
  ExternalsElement,
  ExternalsObjectElement
} from 'webpack';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ConcatSource, Source } from 'webpack-sources';
import randomstring from 'randomstring';

import Compilation = compilation.Compilation;

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
  runtimeChunk: {
    files: string[];
  };
}

const readFile = promisify(fs.readFile);

type IsolatedExternalsConfig = {
  [key: string]: {
    [key: string]: { url: string };
  };
};

function wrapApp(
  source: Source | string,
  externals: IsolatedExternalsElement,
  appName: string
): ConcatSource {
  const externalsList = Object.entries(externals);
  const varNames = externalsList
    .map(([, external]) => `var ${external.name} = context.${external.name};`)
    .join(' ');
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
  source: Source | string
): Promise<ConcatSource> {
  const externalsLocation = path.resolve(__dirname, 'util', 'loadExternals.js');
  const loadExternals = await readFile(externalsLocation);
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
    element => typeof element === 'object' && !(element instanceof RegExp)
  );
  const finalExternals = externalsObjects.map(external => {
    const entries = Object.entries(external);
    return entries
      .filter(([, value]) => typeof value === 'string')
      .reduce<ExternalsObjectElement>(
        (final: ExternalsObjectElement, [key, value]: [string, string]) => ({
          ...final,
          [key]: value
        }),
        {}
      );
  });
  const finalElement = finalExternals.reduce<ExternalsObjectElement>(
    (finalObj: ExternalsObjectElement, obj: ExternalsObjectElement) => ({
      ...finalObj,
      ...obj
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
      const externalContent = Object.entries(pluginExternal).reduce<
        IsolatedExternalsElement
      >(
        (
          finalItems: IsolatedExternalsElement,
          [externalName, externalConfig]: [string, { url: string }]
        ) => ({
          ...finalItems,
          [externalName]: {
            name: compilerExternals[externalName] as string,
            ...externalConfig
          }
        }),
        {} as IsolatedExternalsElement
      );
      return {
        ...finalExternals,
        [entryName]: externalContent
      };
    },
    {} as IsolatedExternals
  );
  return externals;
}

function getTargetAssets(
  comp: Compilation,
  config: IsolatedExternalsConfig,
  externals: IsolatedExternals
): [string, Source | string][] {
  const entrypoints = Object.keys(externals)
    .filter(key => comp.entrypoints.has(key))
    .map<Entrypoint>(key => comp.entrypoints.get(key) as Entrypoint);
  const assets = Object.entries<Source | string>(comp.assets);
  const targetAssets = assets.filter(([name]) =>
    entrypoints.some(point => point.runtimeChunk.files.includes(name))
  );
  return targetAssets;
}

export default class IsolatedExternalsPlugin {
  appName: string;
  constructor(readonly config: IsolatedExternalsConfig = {}) {
    this.appName =
      randomstring.generate({ length: 1, charset: 'alphabetic' }) +
      randomstring.generate(11);
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
        for (const [, externalsObject] of externalObjects) {
          for (const [name, asset] of targetAssets) {
            const source = asset as Source;
            const wrappedAsset = wrapApp(source, externalsObject, this.appName);
            const loadableAsset = await addLoadExternals(wrappedAsset);
            const calledAsset = callLoadExternals(
              loadableAsset,
              externalsObject,
              this.appName
            );
            const selfInvokingAssset = selfInvoke(calledAsset);
            // @ts-ignore Error:(130, 27) TS2339: Property 'updateAsset' does not exist on type 'Compilation'.
            comp.updateAsset(name, selfInvokingAssset);
          }
        }
      }
    );
  }
}
