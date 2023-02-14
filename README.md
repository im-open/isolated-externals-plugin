# isolated-externals-plugin

[![Build Status](https://travis-ci.com/WTW-IM/isolated-externals-plugin.svg?branch=master)](https://travis-ci.com/github/WTW-IM/isolated-externals-plugin)
[![npm version](https://badge.fury.io/js/isolated-externals-plugin.svg)](https://badge.fury.io/js/isolated-externals-plugin)

## Installation

To install, simply run:

```bash
npm install --save-dev isolated-externals-plugin
```

## Usage

The `IsolatedExternalsPlugin` allows you to load external dependencies inside the scope of your webpack bundle without having to have them in your global scope. If you're curious about why you might want this, there are [some use cases listed below](#why-load-externals-locally-instead-of-globally).

It's an opinionated plugin in this way:

- The externals set with the `IsolatedExternalsPlugin` utilize [`externalsType.promise`](https://webpack.js.org/configuration/externals/#externalstypepromise), which utilizes `async`/`await` syntax.

The plugin is built as an ES Module, so you'll need to load it in by using the `default` property:

```javascript
const IsolatedExternalsPlugin = require('isolated-externals-plugin').default;
```

An `IsolatedExternalsPlugin` configuration might look like the following:

```javascript
new IsolatedExternalsPlugin({
  entry1: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js',
      globalName: 'React',
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js',
      globalName: 'ReactDOM',
    },
  },
  entry2: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js',
      globalName: 'React',
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js',
      globalName: 'ReactDOM',
    },
  },
});
```

Each property of the configuration follows this structure:

```javascript
[entryName]: {
  [packageName]: {
    url: [url],
    globalName: [globalName]
  }
}
```

| Part             | Description                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `entryName`\*    | The name of one of your webpack [Entry Points](https://webpack.js.org/concepts/entry-points/).            |
| `packageName`\*  | The name of the import for your externalized dependency (like 'react-dom').                               |
| `url`\*          | The URL from which to load your dependency file.                                                          |
| `globalName`     | The UMD name of your dependency (like `ReactDOM`). [See below for details](#globalname-and-other-details) |
| `urlTransformer` | A path or module path to a module that exports a url transforming function.                               |
| \*               | _required_                                                                                                |

## `globalName` and other details

If `globalName` is not provided, `IsolatedExternalsPlugin` will try to match the `packageName` to one of your [`externals`](https://webpack.js.org/configuration/externals/#externals) entries, and will use the value from that as the `globalName`

The external files will be loaded and applied to your context in the order that they're listed, so if you have dependencies that depend on other dependencies (like `ReactDOM` depends on `React`), then you'll want to make sure you list the ones they depend on first.

## How It Works

`IsolatedExternalsPlugin` loads the text of your externals URLs via a shared [Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache) (or a shared global object if `Cache` is not available), and processes the text on a context object which is singular to your bundle. This allows you to load multiple bundles per page with different versions of a dependency—or with the same version of a dependency separately—without polluting a global scope, and without loading the same dependency over the wire more than once. This keeps bundle sizes down while also providing complete autonomy to any individual JS bundle.

## Why load externals locally instead of globally?

Here are two valid use cases. There may be others, but these are the reason we built this plugin!:

1. You want to load different javascript apps on the same page with different versions of the same dependency (like React).
2. You want to load more than one javascript app onto the same page with the same dependency, but ignorant of each other and the global context (like in micro frontends). This allows each app to be small in byte size, and allows the overall page to never load the same dependency more than once.

## Contributing

This package uses `semantic-release`. Changes will be compiled into a changelog and the package versioned, tagged and published automatically.
Please ensure your commit messages adhere to the following structure:

```
<type>: <subject>
<BLANK LINE>
<body>
```

Only the header is mandatory. The supported types are based off of the [ESLint Convention](https://github.com/conventional-changelog/conventional-changelog/tree/35e279d40603b0969c6d622514f5c0984c5bf309/packages/conventional-changelog-eslint).
