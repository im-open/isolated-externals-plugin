declare module 'webpack/lib/dependencies/ModuleDependency' {
  import { dependencies } from 'webpack';
  class ModuleDependency extends dependencies.ModuleDependency {}
  export = ModuleDependency;
}

declare module 'webpack/lib/dependencies/HarmonyImportDependency' {
  import { dependencies } from 'webpack';
  class HarmonyImportDependency extends dependencies.HarmonyImportDependency {}
  export = HarmonyImportDependency;
}

declare module 'webpack/lib/dependencies/ModuleDependencyTemplateAsRequireId' {
  import { dependencies } from 'webpack';
  class ModuleDependencyTemplateAsRequireId extends dependencies
    .ModuleDependency.Template {}
  export = ModuleDependencyTemplateAsRequireId;
}

declare module 'webpack/lib/dependencies/ModuleDependencyTemplateAsId' {
  import { dependencies } from 'webpack';
  class ModuleDependencyTemplateAsId extends dependencies.ModuleDependency
    .Template {}
  export = ModuleDependencyTemplateAsId;
}

declare module 'webpack/lib/RawModule' {
  import { Module } from 'webpack';
  class RawModule extends Module {
    constructor(source: string, identifier: string, readableIdentifier: string);
  }
  export = RawModule;
}
