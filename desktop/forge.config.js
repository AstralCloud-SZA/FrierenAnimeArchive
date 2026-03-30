module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Frieren Anime Archive',
    extraResources: [
      {
        from: '../',              // Rails repo root
        to: 'rails-api',
        ignore: [
          /^\/desktop/,          // skip Electron folder
          /^\/\.git/,            // skip git history
          /^\/log/,              // skip logs
          /^\/tmp/,              // skip temp files
          /^\/test/,             // skip tests
          /^\/coverage/,         // skip test coverage
          /node_modules/,        // skip node modules
          /\.env(?!\.example)/,  // skip .env files
          /\.DS_Store/
        ]
      },
      {
        from: './ruby-runtime',  // your slimmed Ruby 3.4.9
        to: 'ruby-runtime'
      }
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { name: 'FrierenAnimeArchive' }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
}