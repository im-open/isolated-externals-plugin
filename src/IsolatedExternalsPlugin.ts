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

import Compilation = compilation.Compilation;

export interface ExternalInfo {
  name: string;
  url: string;
  loaded?: boolean;
}

export interface ExternalsObject {
  [key: string]: ExternalInfo;
}

export interface Externals {
  [key: string]: ExternalsObject;
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
  externals: ExternalsObject
): ConcatSource {
  const externalsList = Object.entries(externals);
  const varNames = externalsList
    .map(([, external]) => `var ${external.name} = context.${external.name};`)
    .join(' ');
  const wrappedSource = new ConcatSource(
    `function app(context){`,
    varNames,
    source,
    `}`
  );
  return wrappedSource;
}

async function addLoadExternals(
  source: Source | string
): Promise<ConcatSource> {
  const externalsLocation = path.resolve(__dirname, 'util', 'loadExternals.js');
  const loadExternals = await readFile(externalsLocation);
  return new ConcatSource(source, loadExternals.toString());
}

function callLoadExternals(
  source: Source | string,
  externals: ExternalsObject
): ConcatSource {
  const externalsObj = JSON.stringify(externals);
  const loadCall = `loadExternals(${externalsObj},`;
  const appCallback = `function (context) { app(context); }`;
  const closeCall = `);`;
  return new ConcatSource(source, loadCall, appCallback, closeCall);
}

function selfInvoke(source: Source | string): ConcatSource {
  return new ConcatSource(`(function() {`, source, `})()`);
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
  config: IsolatedExternalsConfig,
  compilerExternals: ExternalsObjectElement
): Externals {
  const externals = Object.entries(config).reduce<Externals>(
    (finalExternals: Externals, [entryName, external]) => {
      const externalContent = Object.entries(external).reduce<ExternalsObject>(
        (
          finalItems: ExternalsObject,
          [externalName, configExternal]: [string, { url: string }]
        ) => ({
          ...finalItems,
          [externalName]: {
            name: compilerExternals[externalName] as string,
            ...configExternal
          }
        }),
        {} as ExternalsObject
      );
      return {
        ...finalExternals,
        [entryName]: externalContent
      };
    },
    {} as Externals
  );
  return externals;
}

function getTargetAssets(
  comp: Compilation,
  config: IsolatedExternalsConfig,
  externals: Externals
): [string, Source | string][] {
  const entrypoints = Object.keys(externals)
    .filter(key => !!comp.entrypoints.get(key))
    .map<Entrypoint>(key => comp.entrypoints.get(key) as Entrypoint);
  const assets = Object.entries<Source | string>(comp.assets);
  const targetAssets = assets.filter(([name]) =>
    entrypoints.some(point => point.runtimeChunk.files.includes(name))
  );
  return targetAssets;
}

export default class IsolatedExternalsPlugin {
  constructor(readonly config: IsolatedExternalsConfig = {}) {}

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
          for (const pieces of targetAssets) {
            const [name, asset] = pieces;
            const source = asset as Source;
            const wrappedAsset = wrapApp(source, externalsObject);
            const loadableAsset = await addLoadExternals(wrappedAsset);
            const calledAsset = callLoadExternals(
              loadableAsset,
              externalsObject
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
