module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Frieren Anime Archive',
    extraResources: [
      {
        from: './ruby-runtime',
        to:   'ruby-runtime'
        // no filter needed — copy everything
      },
      {
        from:   '../',
        to:     'rails-api',
        filter: [            // ← glob strings, NOT regex
          '!desktop/**',
          '!.git/**',
          '!log/**',
          '!tmp/**',
          '!test/**',
          '!coverage/**',
          '!node_modules/**',
          '!vendor/bundle/**',
          '!.env',
          '!.env.*',
          '!.env.local'
        ]
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