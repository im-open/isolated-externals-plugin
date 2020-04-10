# isolated-externals-plugin

[![Build Status](https://travis-ci.com/WTW-IM/isolated-externals-plugin.svg?branch=master)](https://travis-ci.com/github/WTW-IM/isolated-externals-plugin)
[![npm version](https://badge.fury.io/js/isolated-externals-plugin.svg)](https://badge.fury.io/js/isolated-externals-plugin)

## Installation

To install, simply run:

```bash
npm install --save isolated-externals-plugin
```

## Usage

The `IsolatedExternalsPlugin` allows you to load external dependencies into the scope of your webpack bundle without having to have them in your global scope.

The plugin is built as an ES Module, so you'll need to load it in by using the `default` property:

```javascript
const IsolatedExternalsPlugin = require('isolated-externals-plugin').default;
```

It currently only works with UMD javascript dependencies, and with an `externals` declaration that has a similar shape to this:

```javascript
  ...
  externals: {
    ["react-dom"]: "ReactDOM",
    react: "React",
  },
  ...
```

For the `externals` above, your `IsolatedExternalsPlugin` cofniguration might look like the following:

```javascript
new IsolatedExternalsPlugin({
  entryName: {
    react: {
      url: 'https://unpkg.com/react@16/umd/react.development.js'
    },
    ['react-dom']: {
      url: 'https://unpkg.com/react-dom@16/umd/react-dom.development.js'
    }
  }
});
```

The external files will be loaded and applied to your context in the order that they're listed, so if you have dependencies that depend on other dependencies (like `ReactDOM` depends on `React`), then you'll want to make sure you list them first.

## How It Works

`IsolatedExternalsPlugin` wraps your webpack bundle in a self-calling function, evaluating the function and the external dependencies with an in-memory context object. This allows those external dependencies to only exist on that in-memory context, and will not require them to exist on the broader global context.

## Why load externals locally instead of globally?

Here are two valid use cases. There may be others, but these are the reason we built this plugin!:

1. You want to load different javascript apps on the same page with different versions of the same dependency (like React).
2. You want to load more than one javascript app onto the same page with the same dependency, but ignorant each other and the global context (like in micro frontends). This case leverages browser caching to allow each app to be small in byte size, but to load the same libraries more than once on the page without transferring them more than once over the wire

## Contributing

This package uses `semantic-release`. Changes will be compiled into a changelog and the package versioned, tagged and published automatically.
Please ensure your commit messages adhere to the following structure:

```
<type>: <subject>
<BLANK LINE>
<body>
```

Only the header is mandatory. The supported types are based off of the [ESLint Convention](https://github.com/conventional-changelog/conventional-changelog/tree/35e279d40603b0969c6d622514f5c0984c5bf309/packages/conventional-changelog-eslint).
