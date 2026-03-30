const path = require('path')
const fs   = require('fs')

const RAILS_EXCLUDE = [
  'desktop', '.git', 'log', 'tmp', 'test', 'coverage',
  'node_modules', '.bundle', 'vendor', 'out'
]

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    if (RAILS_EXCLUDE.includes(entry)) continue
    const s = path.join(src, entry)
    const d = path.join(dst, entry)
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d)
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Frieren Anime Archive'
    // ← no extraResources here — hook handles it below
  },

  hooks: {
    postPackage: async (forgeConfig, options) => {
      const outputDir  = options.outputPaths[0]                  // .../Frieren Anime Archive-win32-x64
      const resDir     = path.join(outputDir, 'resources')

      // ── Copy Ruby runtime ────────────────────────────────
      const rubySrc = path.join(__dirname, 'ruby-runtime')
      const rubyDst = path.join(resDir, 'ruby-runtime')
      console.log('[hook] Copying ruby-runtime →', rubyDst)
      copyDir(rubySrc, rubyDst)

      // ── Copy Rails app ───────────────────────────────────
      const railsSrc = path.join(__dirname, '..')
      const railsDst = path.join(resDir, 'rails-api')
      console.log('[hook] Copying rails-api →', railsDst)
      copyDir(railsSrc, railsDst)

      // ── Copy vendored gems into rails-api ────────────────
      const gemsSrc = path.join(__dirname, '..', 'vendor', 'bundle')
      const gemsDst = path.join(railsDst, 'vendor', 'bundle')
      if (fs.existsSync(gemsSrc)) {
        console.log('[hook] Copying vendor/bundle →', gemsDst)
        copyDir(gemsSrc, gemsDst)
      }

      console.log('[hook] Done. Resources:', fs.readdirSync(resDir))
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