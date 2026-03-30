const path = require('path')
const fs   = require('fs')

// Dirs to exclude when copying the Rails repo into rails-api-dist
const EXCLUDE = [
  'desktop', '.git', 'log', 'tmp', 'test', 'coverage',
  'node_modules', '.bundle', 'vendor'
]

function copyRailsApp (src, dst)
{
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src))
  {
    if (EXCLUDE.includes(entry)) continue
    const srcPath = path.join(src, entry)
    const dstPath = path.join(dst, entry)
    const stat    = fs.statSync(srcPath)
    if (stat.isDirectory()) copyRailsApp(srcPath, dstPath)
    else                    fs.copyFileSync(srcPath, dstPath)
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Frieren Anime Archive',
    extraResources: [
      './ruby-runtime',      // ← simple string, copies whole folder
      './rails-api-dist'     // ← prepared by the hook below
    ]
  },

  hooks: {
    // Runs before Forge packages — prepares a clean Rails copy
    generateAssets: async () =>
    {
      const src = path.join(__dirname, '..')
      const dst = path.join(__dirname, 'rails-api-dist')
      console.log('[hook] Copying Rails app → rails-api-dist ...')
      fs.rmSync(dst, { recursive: true, force: true })
      copyRailsApp(src, dst)

      // Copy vendor/bundle (gems) into the dist too
      const gemsSrc = path.join(__dirname, '..', 'vendor', 'bundle')
      const gemsDst = path.join(dst, 'vendor', 'bundle')
      if (fs.existsSync(gemsSrc)) copyRailsApp(gemsSrc, gemsDst)

      console.log('[hook] Rails copy done.')
    }
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