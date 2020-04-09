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

export interface Externals {
  [key: string]: ExternalInfo;
}

const readFile = promisify(fs.readFile);

type IsolatedExternalsConfig = {
  [key: string]: { url: string };
};

function wrapApp(source: Source | string, externals: Externals): ConcatSource {
  const externalsList = Object.entries(externals);
  const varNames = externalsList
    .map(
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      ([key, external]) => `var ${external.name} = context.${external.name};`
    )
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
  externals: Externals
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
    return (
      entries
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        .filter(([key, value]) => typeof value === 'string')
        .reduce<ExternalsObjectElement>(
          (final: ExternalsObjectElement, [key, value]: [string, string]) => ({
            ...final,
            [key]: value
          }),
          {}
        )
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
    (
      finalExternals: Externals,
      [key, configExternal]: [string, { url: string }]
    ) => ({
      ...finalExternals,
      [key]: {
        name: compilerExternals[key] as string,
        ...configExternal
      }
    }),
    {} as Externals
  );
  return externals;
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
        const assets = Object.entries(comp.assets);
        const targetAssets = assets.filter(([name]) => name.endsWith('.js'));
        for (const pieces of targetAssets) {
          const [name, asset] = pieces;
          const source = asset as Source;
          const wrappedAsset = wrapApp(source, externals);
          const loadableAsset = await addLoadExternals(wrappedAsset);
          const calledAsset = callLoadExternals(loadableAsset, externals);
          const selfInvokingAssset = selfInvoke(calledAsset);
          // @ts-ignore Error:(130, 27) TS2339: Property 'updateAsset' does not exist on type 'Compilation'.
          comp.updateAsset(name, selfInvokingAssset);
        }
      }
    );
  }
}
