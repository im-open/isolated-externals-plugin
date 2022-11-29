module.exports = {
  repositoryUrl: 'git@github.com:WTW-IM/isolated-externals-plugin.git',
  branches: [
    'main',
    {
      name: '*',
      prerelease: true,
      channel: 'development',
    },
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    [
      '@semantic-release/github',
      {
        assets: ['*.tgz'],
      },
    ],
    [
      '@semantic-release/git',
      {
        message:
          'Docs: ${nextRelease.version} [skip ci]\n\n${nextRelease.note}',
      },
    ],
  ],
  preset: 'eslint',
};
