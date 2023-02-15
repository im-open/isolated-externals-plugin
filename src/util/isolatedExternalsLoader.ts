import { LoaderDefinitionFunction } from 'webpack';
import { Externals, ExternalInfo } from './externalsClasses';

const lastClosingCurly = /}([^}]*)$/;
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
        ? `(__importDefault || ${passThroughFunc})(require('${externalTransformer})')`
        : passThroughFunc;
      const transformedExternal = Object.keys(external).reduce(
        (modifiedExternal, key) =>
          key === 'urlTransformer'
            ? modifiedExternal
            : {
                ...modifiedExternal,
                [key]: external[key] as ExternalInfo[keyof ExternalInfo],
              },
        {}
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
