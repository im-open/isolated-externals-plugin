import { LoaderDefinitionFunction } from 'webpack';
import { Externals } from './externalsClasses';

export default function (
  this: ThisParameterType<LoaderDefinitionFunction<Externals>>,
  source: string
): string {
  const externals = this.getOptions();
  const newSource = source.replace(
    /ISOLATED_EXTERNALS_OBJECT/,
    JSON.stringify(externals, null, 2)
  );
  return newSource;
}
