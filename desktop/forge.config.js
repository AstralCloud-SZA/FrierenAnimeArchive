// forge.config.js
// ═══════════════════════════════════════════════════════════
//  Electron Forge — Build Configuration
//  Frieren Archive
//
//  Strategy:
//    extraResources is unreliable for large folder trees, so
//    we use a postPackage hook to copy both ruby-runtime and
//    the Rails repo directly into the packaged resources dir.
//
//  Resources layout after packaging:
//    resources/
//      app.asar          ← Electron frontend (ASAR)
//      ruby-runtime/     ← Portable Ruby 3.4 runtime
//      rails-api/        ← Rails app + vendor/bundle gems
// ═══════════════════════════════════════════════════════════

const path = require('path')
const fs   = require('fs')

// Top-level entries to skip when copying the Rails repo.
const RAILS_EXCLUDE = [
  'desktop',      // Electron project (already in app.asar)
  '.git',         // Git history
  'log',          // Runtime logs
  'tmp',          // Temp / cache files
  'test',         // Test suite
  'coverage',     // Test coverage reports
  'node_modules', // JS deps (not needed in Rails)
  '.bundle',      // Bundler machine config
  'vendor',       // Excluded here so we can copy vendor/bundle explicitly
  'out'           // Forge build output
]

function copyDir(src, dst)
{
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src))
  {
    if (RAILS_EXCLUDE.includes(entry)) continue
    const s    = path.join(src, entry)
    const d    = path.join(dst, entry)
    const stat = fs.statSync(s)
    stat.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d)
  }
}

// Same as copyDir, but without exclusions, ensuring everything copies.
function copyDirForce(src, dst)
{
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src))
  {
    const s    = path.join(src, entry)
    const d    = path.join(dst, entry)
    const stat = fs.statSync(s)
    stat.isDirectory() ? copyDirForce(s, d) : fs.copyFileSync(s, d)
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Frieren Anime Archive'
    // No extraResources — postPackage hook handles all copying
  },

  hooks: {
    // ── postPackage ───────────────────────────────────────
    postPackage: async (forgeConfig, options) =>
    {
      const resDir = path.join(options.outputPaths[0], 'resources')

      // ── 1. Portable Ruby runtime ─────────────────────────
      const rubySrc = path.join(__dirname, 'ruby-runtime')
      const rubyDst = path.join(resDir, 'ruby-runtime')
      console.log('[hook] Copying ruby-runtime →', rubyDst)
      copyDirForce(rubySrc, rubyDst)

      // ── 2. Rails app (exclusions apply) ──────────────────
      const railsSrc = path.join(__dirname, '..')
      const railsDst = path.join(resDir, 'rails-api')
      console.log('[hook] Copying rails-api →', railsDst)
      copyDir(railsSrc, railsDst)

      // ── 3. Explicitly copy vendor/bundle ─────────────────
      const gemsSrc = path.join(__dirname, '..', 'vendor', 'bundle')
      const gemsDst = path.join(railsDst, 'vendor', 'bundle')
      if (fs.existsSync(gemsSrc))
      {
        console.log('[hook] Copying vendor/bundle →', gemsDst)
        copyDirForce(gemsSrc, gemsDst)
      }
      else
      {
        console.error('[hook] ✗ vendor/bundle MISSING — run bundle install first!')
      }

      console.log('[hook] Done. Resources:', fs.readdirSync(resDir))
    }
  },

  rebuildConfig: {},

  makers: [
    {
      name:   '@electron-forge/maker-squirrel',
      config: { name: 'FrierenAnimeArchive' }
    },
    {
      name:      '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],

  plugins: [
    {
      name:   '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
}