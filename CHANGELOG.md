# [1.10.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.9.0...v1.10.0) (2021-08-06)

### Fix

- adding a retry on cache.add for a Chrome bug ([12b08d8](https://github.com/WTW-IM/isolated-externals-plugin/commit/12b08d80f8097c3a1d16749cf37644c945906620))

### Update

- adding error log when externals fail to load ([5c7ea4c](https://github.com/WTW-IM/isolated-externals-plugin/commit/5c7ea4c650f73764b077c0289c365dd189bf2e99))
- separating externals classes ([6ebecea](https://github.com/WTW-IM/isolated-externals-plugin/commit/6ebecea78a309f62bb00e5db38beaee208381ead))

# [1.9.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.8.1...v1.9.0) (2021-06-18)

### Build

- upgrading husky to v6 ([cc58241](https://github.com/WTW-IM/isolated-externals-plugin/commit/cc58241d730036328488133180bca2c88d11b762))

### Update

- converting to Cache and Promises ([a39cf0d](https://github.com/WTW-IM/isolated-externals-plugin/commit/a39cf0df024dcd414a9ffce215a1bc1e2956052b))
- removing unnecessary cache prop on CachedExternal ([4076829](https://github.com/WTW-IM/isolated-externals-plugin/commit/4076829f28a07929f107dad31d1a8de854970228))

### Upgrade

- updating for vulnerability fixes ([cb2be95](https://github.com/WTW-IM/isolated-externals-plugin/commit/cb2be958c5966c5bfdf37f7a24d637152f9f966f))

## [1.8.1](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.8.0...v1.8.1) (2021-06-01)

### Fix

- ensuring we remove readystatechange event listener with first run ([41d0f0b](https://github.com/WTW-IM/isolated-externals-plugin/commit/41d0f0b3f9a806afe2a7012a2edee6a538f671db))

# [1.8.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.7.1...v1.8.0) (2021-05-05)

### Build

- updating git author/committer info in Release ([2cdb6aa](https://github.com/WTW-IM/isolated-externals-plugin/commit/2cdb6aa2079c2ef2a9766c8edcbaa539aad36168))

### Fix

- adding the readystatechange listener to the correct object ([63a185c](https://github.com/WTW-IM/isolated-externals-plugin/commit/63a185cd2de8f98433a8e3c72b58adbff705c4f3))
- using Object.assign and awaiting result text before assign ([17be70b](https://github.com/WTW-IM/isolated-externals-plugin/commit/17be70bef30735ba5212ec4b9f5e3109f61b2808))

### Update

- enabling nested externals ([e0e8da4](https://github.com/WTW-IM/isolated-externals-plugin/commit/e0e8da4d2a35d330d819b699c34fc6ab232e349d))

### Upgrade

- updating packages for audit ([5fef82c](https://github.com/WTW-IM/isolated-externals-plugin/commit/5fef82cbcec361fe6747dd32de231f9e634c2eab))

## [1.7.1](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.7.0...v1.7.1) (2021-04-07)

### Build

- create Github Actions CI build ([8f65202](https://github.com/WTW-IM/isolated-externals-plugin/commit/8f65202c132436ebeffdec78efb3ac8b1269757c))
- not persisting credentials with checkout step ([e4a2790](https://github.com/WTW-IM/isolated-externals-plugin/commit/e4a2790966c858b3218f6c00015deca50ca36926))
- setting up semantic-release with Github Actions ([d9d5fe7](https://github.com/WTW-IM/isolated-externals-plugin/commit/d9d5fe7a5c351f0e436f84c27154f190c1b77c66))

### Fix

- falling back to xhr when fetch fails ([ce97fef](https://github.com/WTW-IM/isolated-externals-plugin/commit/ce97fef6623b4ebc05f1434dc738a44de165ab39))

# [1.7.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.6.0...v1.7.0) (2021-03-31)

### Build

- updating github/git after npm release ([113fc5f](https://github.com/WTW-IM/isolated-externals-plugin/commit/113fc5f2e9d798334564cf264df2a9b90e796d03))

### Update

- ensuring we only start loading externals when the document is ready ([7c1eb3a](https://github.com/WTW-IM/isolated-externals-plugin/commit/7c1eb3a5395e8f75af395099be5209c49945d589))
- using fetch when we can ([f2f33e1](https://github.com/WTW-IM/isolated-externals-plugin/commit/f2f33e15a28f569503487d86297cd2abb081b7d7))

# [1.6.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.5.0...v1.6.0) (2021-02-11)

### Update

- continue loading externals after eval failure ([ad56c08](https://github.com/WTW-IM/isolated-externals-plugin/commit/ad56c089e7b76425b07cb2c1c2a0c53e7e4d37d0))

# [1.5.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.4.0...v1.5.0) (2021-02-08)

### Build

- ensuring we have our peer dependency set to the lowest reasonable version ([a202c18](https://github.com/WTW-IM/isolated-externals-plugin/commit/a202c1865cf6cd27dd9c4456776661d809aa6103))

### Update

- setting self as a local var for anonymous externals ([7b6af85](https://github.com/WTW-IM/isolated-externals-plugin/commit/7b6af85e437566d4e027bc1f799bac5703794604))

### Upgrade

- upgrading most dependencies ([a53de0e](https://github.com/WTW-IM/isolated-externals-plugin/commit/a53de0e75414928960701c44f6cef73b59f51068))

# [1.4.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.3.0...v1.4.0) (2020-07-24)

### Build

- removing babel-cli as a dependency ([881500c](https://github.com/WTW-IM/isolated-externals-plugin/commit/881500cd0c56672415613a1211ab7aa02b1da63b))
- removing peer-dependency on html-webpack-plugin ([f0223a1](https://github.com/WTW-IM/isolated-externals-plugin/commit/f0223a18f0b1b8df3ab53a6335eb82bdbd958f40))

### Update

- change status code range considered as failure ([1325e02](https://github.com/WTW-IM/isolated-externals-plugin/commit/1325e028fd55d3ff5121fbd88d1ce933b2837fc1))
- continue loading externals after a failure ([35d67b3](https://github.com/WTW-IM/isolated-externals-plugin/commit/35d67b3278bc9701c01fa1c11a354cb010a74b5a))

# [1.3.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.2.0...v1.3.0) (2020-07-09)

### Update

- holding loaded content in memory ([be19cae](https://github.com/WTW-IM/isolated-externals-plugin/commit/be19cae7e96eeeee0d6131346cfc83a19d920025))
- using an in-window cache for subsequent externals loading ([ebf41b3](https://github.com/WTW-IM/isolated-externals-plugin/commit/ebf41b3f4a19205e747fd5487955b8188a3e9a8b))

# [1.2.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.1.0...v1.2.0) (2020-04-24)

### Build

- adding configuration for testing ([39f91bb](https://github.com/WTW-IM/isolated-externals-plugin/commit/39f91bb126e3d05ee90aad06ee8e27032afb79f2))

### Fix

- ensuring we only wrap JS files ([0ac1aeb](https://github.com/WTW-IM/isolated-externals-plugin/commit/0ac1aeb7178b83b1c505fd31e870496c6071ae3e))

### Update

- adding an optional testing parameter for loadExternals location ([ebce0dc](https://github.com/WTW-IM/isolated-externals-plugin/commit/ebce0dc0b2794abc96f2c575885cba9b3dc1435c))

# [1.1.0](https://github.com/WTW-IM/isolated-externals-plugin/compare/v1.0.0...v1.1.0) (2020-04-22)

### Docs

- adding better documentation around 'entryName' in the example ([f4a4fad](https://github.com/WTW-IM/isolated-externals-plugin/commit/f4a4fad2d8168493ce10673fc2eba9e5fb297aa0))

### Fix

- adding line breaks to account for source map comments ([9586bd8](https://github.com/WTW-IM/isolated-externals-plugin/commit/9586bd854b11b1e8359a73db77a224ec228e2b0a))
- ensuring random functions can't start with numbers ([577ec7f](https://github.com/WTW-IM/isolated-externals-plugin/commit/577ec7f57ed873f8026ef7d6e8dfd902f3a15f6f))
- rearranging external loading so they always finish loading in order ([9e7c2c9](https://github.com/WTW-IM/isolated-externals-plugin/commit/9e7c2c9461bf645846abf82c44449e0116f8a66e))

### Update

- using the global context as default if not on local context ([c845d54](https://github.com/WTW-IM/isolated-externals-plugin/commit/c845d5406afe2a42e0f7c7140a4b51c854f24f67))

# 1.0.0 (2020-04-13)

### Breaking

- making plugin config name its entries ([26a0e6b](https://github.com/WTW-IM/isolated-externals-plugin/commit/26a0e6b21cf5776488db06e0f00ce0e806493def))

### Build

- fixing eslint ([84543ae](https://github.com/WTW-IM/isolated-externals-plugin/commit/84543aef293c7b0279a0729dd7a8e2e608d2876e))
- updating husky ([31c2d25](https://github.com/WTW-IM/isolated-externals-plugin/commit/31c2d25a31e4b633bdc66656ad0895d7f2628ebd))

### Docs

- adding a Why section to the README ([cd602da](https://github.com/WTW-IM/isolated-externals-plugin/commit/cd602da7042f2be5acf3eafb8bb9ecb4a8b6bb24))
- adding some usage documentation ([0a9c1cc](https://github.com/WTW-IM/isolated-externals-plugin/commit/0a9c1cce52ccbb7d3d1d84b3986320d72288cb42))
- clarifying some wording around dependencies ([3203694](https://github.com/WTW-IM/isolated-externals-plugin/commit/3203694eae22b90ec20759a8cc4a4d36d5289adb))
- updating README to save-dev in install example ([4b4fcbf](https://github.com/WTW-IM/isolated-externals-plugin/commit/4b4fcbf71615b93a8aca1e19c96c5fc1c50f0351))
- updating README with a link to use cases ([f4e0ccc](https://github.com/WTW-IM/isolated-externals-plugin/commit/f4e0ccc83ee3b92d38daca8440afa7780019d739))
- updating some language around how it works ([6775f02](https://github.com/WTW-IM/isolated-externals-plugin/commit/6775f0201099b6a7fac8cd93dd3dc63d2e76a732))

### New

- first feature code. ([41adf07](https://github.com/WTW-IM/isolated-externals-plugin/commit/41adf07c6373b8da1e7c0f8f71f59a98f59fb568))

### Update

- generating appName so we don't see any variable conflicts ([6c4d60c](https://github.com/WTW-IM/isolated-externals-plugin/commit/6c4d60c2d152861475e3017d86a33f1f73aece85))
- removing unnecessary boolean conversion in loadExternals ([5e03f9c](https://github.com/WTW-IM/isolated-externals-plugin/commit/5e03f9c90c4405700e18ed28108ea2329ef9096b))
- renaming some types for clarity ([9985d21](https://github.com/WTW-IM/isolated-externals-plugin/commit/9985d219b266e0bad30acdd36088c9294c5bdc50))
- some minor syntax updates ([bfdf852](https://github.com/WTW-IM/isolated-externals-plugin/commit/bfdf852c2652d202f5c1836084574387cab15fd5))
