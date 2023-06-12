import { LoaderDefinitionFunction } from 'webpack';
import { Externals, ExternalInfo } from './externalsClasses';

const lastClosingCurly = /}([^}]*)$/;

// copied from webpack
const importDefault = `function(mod) {
  return (mod && mod.__esModule) ? mod : {
    "default": mod
  };
}`;
const passThroughFunc = `function (x) { return x; }`;

export default function (
  this: ThisParameterType<LoaderDefinitionFunction<Externals>>,
  source: string
): string {
  const externals = this.getOptions();
  const translatedExternals = Object.keys(externals).reduce(
    (finalExternals, key) => {
      const external = externals[key];
      const externalTransformer = external.urlTransformer;
      const urlTransformer = externalTransformer
        ? `(__importDefault || ${importDefault})(require('${externalTransformer}')).default`
        : passThroughFunc;
      const transformedExternal = Object.keys(external).reduce<ExternalInfo>(
        (modifiedExternal, key) =>
          key === 'urlTransformer'
            ? modifiedExternal
            : {
                ...modifiedExternal,
                [key]: external[key as keyof ExternalInfo],
              },
        { url: '' }
      );
      const stringExternal = JSON.stringify(transformedExternal, null, 2);
      const urlTransformerExternal = stringExternal.replace(
        lastClosingCurly,
        `, "urlTransformer": ${urlTransformer}}`
      );
      return finalExternals.replace(
        lastClosingCurly,
        `"${key}": ${urlTransformerExternal},}`
      );
    },
    '{}'
  );

  const newSource = source.replace(
    /ISOLATED_EXTERNALS_OBJECT/,
    translatedExternals
  );
  return newSource;
}
