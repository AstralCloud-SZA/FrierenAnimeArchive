// main.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Main Process
//  Responsibilities:
//    - Create + configure the BrowserWindow (frameless)
//    - Custom title bar IPC (minimise / maximise / close)
//    - CSP: allow fetch → Rails API, pass-through for webview
//    - Strip Referer from image requests (CDN hotlink fix)
//    - External link routing (open in OS browser)
//    - Rails API auto-start + health-check wait
//    - Port eviction before Rails spawn (Windows stale-process fix)
//    - Loading screen while Rails boots
//    - App lifecycle (ready, activate, window-all-closed)
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path      = require('node:path')
const fs        = require('node:fs')
const { spawn } = require('child_process')
const http      = require('http')

const isDev = process.env.NODE_ENV === 'development'

// ── userData path ─────────────────────────────────────────
// In packaged builds __dirname is inside a read-only ASAR,
// so we anchor userData to the exe's sibling directory instead.
app.setPath('userData',
    app.isPackaged
        ? path.join(path.dirname(process.execPath), '.electron-cache')
        : path.join(__dirname, '.electron-cache')
)

// ═══════════════════════════════════════════════════════════
//  Port Eviction — Windows stale-process fix
// ═══════════════════════════════════════════════════════════
// On Windows, if a previous Rails / Puma process wasn't killed
// cleanly it keeps port 3001 open. The next spawn attempts to
// bind the same port, fails immediately, and Puma exits with
// SIGTERM before it can write anything to stderr — making the
// log appear totally empty.
//
// freePort() runs netstat, extracts every PID bound to the
// target port, force-kills the entire process tree for each
// one via `taskkill /f /t`, then waits 600 ms for the OS to
// fully release the socket before we return.
//
// This is a no-op on macOS / Linux where the problem does
// not occur (those platforms handle SIGTERM reliably).
// ─────────────────────────────────────────────────────────
function freePort(port)
{
    return new Promise(resolve =>
    {
        if (process.platform !== 'win32') return resolve()

        // netstat -ano → all TCP/UDP connections with owning PID.
        // findstr ":3001 " → lines whose local address ends in the port.
        const finder = spawn(
            'cmd',
            ['/c', `netstat -ano | findstr ":${port} "`],
            { windowsHide: true, shell: false }
        )

        let output = ''
        finder.stdout?.on('data', d => { output += d.toString() })

        finder.on('close', () =>
        {
            // Last whitespace-delimited token on each line is the PID.
            const pids = [...new Set(
                output.split('\n')
                    .map(line => line.trim().split(/\s+/).pop())
                    .filter(pid => pid && /^\d+$/.test(pid) && pid !== '0')
            )]

            if (pids.length === 0) return resolve()

            console.log(`[Port] Evicting PIDs on :${port} →`, pids)

            let pending = pids.length
            for (const pid of pids)
            {
                // /f = force  /t = include entire child-process tree
                const killer = spawn(
                    'taskkill', ['/pid', pid, '/f', '/t'],
                    { windowsHide: true }
                )
                killer.on('close', () => { if (--pending === 0) resolve() })
            }

            // Extra breathing room: give the OS 600 ms to release
            // the socket after the owning process is gone.
            setTimeout(resolve, 600)
        })
    })
}

// ═══════════════════════════════════════════════════════════
//  Rails API — Path Resolution
// ═══════════════════════════════════════════════════════════
let railsProcess

function getRailsPaths()
{
    if (app.isPackaged)
    {
        return {
            rubyExe:  path.join(process.resourcesPath, 'ruby-runtime', 'bin', 'ruby.exe'),
            railsDir: path.join(process.resourcesPath, 'rails-api')
        }
    }
    // Development — use system Ruby and the repo root
    return {
        rubyExe:  'ruby',
        railsDir: path.join(__dirname, '..')
    }
}

// ═══════════════════════════════════════════════════════════
//  Rails API — Spawn
// ═══════════════════════════════════════════════════════════
function startRails()
{
    const { rubyExe, railsDir } = getRailsPaths()

    // ── File log — readable even in production builds ─────
    // Written to userData so it survives across builds and is
    // always in a writable location. Opened in append mode so
    // each launch adds a new dated section rather than wiping.
    const logPath   = path.join(app.getPath('userData'), 'rails.log')
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })
    logStream.write(`\n\n=== Rails Start ${new Date().toISOString()} ===\n`)
    logStream.write(`isPackaged : ${app.isPackaged}\n`)
    logStream.write(`rubyExe    : ${rubyExe}\n`)
    logStream.write(`railsDir   : ${railsDir}\n`)

    // ── Gem paths ─────────────────────────────────────────
    // In packaged builds we point Ruby exclusively at the gems
    // vendored inside rails-api/vendor/bundle so it never
    // touches the user's system Ruby or gem directories.
    const bundlePath = app.isPackaged
        ? path.join(railsDir, 'vendor', 'bundle')
        : undefined

    const gemHome = app.isPackaged
        ? path.join(railsDir, 'vendor', 'bundle', 'ruby', '3.4.0')
        : undefined

    // GEM_PATH must include BOTH the vendored gems AND the Ruby
    // runtime's built-in stdlib gems (e.g. json, psych, stringio).
    // Without the stdlib path, boot-time requires fail silently.
    const gemPath = app.isPackaged
        ? [
            path.join(railsDir, 'vendor', 'bundle', 'ruby', '3.4.0'),
            path.join(process.resourcesPath, 'ruby-runtime', 'lib', 'ruby', 'gems', '3.4.0')
        ].join(path.delimiter)
        : undefined

    logStream.write(`bundlePath : ${bundlePath}\n`)
    logStream.write(`gemHome    : ${gemHome}\n`)
    logStream.write(`gemPath    : ${gemPath}\n`)

    // ── Scrub inherited Ruby / Bundler env vars ───────────
    // A dev machine's BUNDLE_PATH / GEM_HOME leaks into the
    // spawned process and can override our packaged-path vars,
    // causing GemNotFound even when vendor/bundle is intact.
    // We delete every Bundler / RubyGems key before applying ours.
    const inheritedEnv = { ...process.env }
    const RUBY_ENV_SCRUB = [
        'BUNDLE_PATH', 'BUNDLE_GEMFILE', 'BUNDLE_BIN',
        'BUNDLE_APP_CONFIG', 'BUNDLE_WITHOUT', 'BUNDLE_FROZEN',
        'GEM_HOME', 'GEM_PATH', 'RUBYOPT', 'RUBYLIB',
        'RUBYARCHDIR', 'GEM_SPEC_CACHE'
    ]
    for (const key of RUBY_ENV_SCRUB) delete inheritedEnv[key]

    // ── SQLite DB paths ───────────────────────────────────
    // storage/ inside resources/ is read-only in packaged builds.
    // All four production databases are redirected to userData,
    // which is always writable on the user's machine.
    const userData = app.getPath('userData')

    railsProcess = spawn(
        rubyExe,
        ['bin/rails', 'server', '-p', '3001', '-e', 'production'],
        {
            cwd:         railsDir,
            windowsHide: true,
            // detached: true puts Rails in its own process group so
            // Windows does not place it in the same job object as
            // Electron. Without this, the OS terminates Rails with
            // SIGTERM the moment Electron's job object is cleaned up.
            detached:    true,
            stdio:       'pipe',
            env: {
                ...inheritedEnv,                              // clean base — no stale Ruby env
                RAILS_ENV:           'production',
                BUNDLE_GEMFILE:      path.join(railsDir, 'Gemfile'),
                BUNDLE_PATH:         bundlePath,
                BUNDLE_WITHOUT:      'development:test',
                BUNDLE_APP_CONFIG:   path.join(railsDir, '.bundle'), // config written by forge hook
                GEM_HOME:            gemHome,
                GEM_PATH:            gemPath,
                SECRET_KEY_BASE:     'electron_offline_secret_frieren_archive_000000000',
                RAILS_LOG_TO_STDOUT: '1',
                // Bootsnap writes a compile cache on first boot.
                // resources/ is read-only in a packaged build, so we
                // redirect the cache to userData which is always writable.
                BOOTSNAP_CACHE_DIR:  path.join(userData, 'bootsnap-cache'),
                // SQLite databases — one per Rails subsystem.
                // database.yml reads these via ENV.fetch() so all four
                // files land in userData rather than the read-only resources dir.
                RAILS_DB_PATH:       path.join(userData, 'production.sqlite3'),
                RAILS_DB_CACHE_PATH: path.join(userData, 'production_cache.sqlite3'),
                RAILS_DB_QUEUE_PATH: path.join(userData, 'production_queue.sqlite3'),
                RAILS_DB_CABLE_PATH: path.join(userData, 'production_cable.sqlite3')
            }
        }
    )

    // Log the OS-assigned PID so it can be cross-referenced
    // with Task Manager when diagnosing unexpected exits.
    logStream.write(`railsPID   : ${railsProcess.pid}\n`)

    // Unreference the child so Electron's event loop does not
    // wait on Rails — keeps the app responsive while Rails boots.
    railsProcess.unref()

    railsProcess.stdout.on('data', d =>
    {
        const msg = d.toString()
        console.log('[Rails]', msg)
        logStream.write('[OUT] ' + msg)
    })
    railsProcess.stderr.on('data', d =>
    {
        const msg = d.toString()
        console.error('[Rails ERR]', msg)
        logStream.write('[ERR] ' + msg)
    })
    railsProcess.on('error', err =>
    {
        console.error('[Rails FAILED]', err)
        logStream.write('[SPAWN ERROR] ' + err.toString() + '\n')
    })
    railsProcess.on('exit', (code, signal) =>
    {
        logStream.write(`[EXIT] code=${code} signal=${signal}\n`)
    })
}

// ═══════════════════════════════════════════════════════════
//  Health-check polling
// ═══════════════════════════════════════════════════════════
// Poll /api/health every 500 ms — swap loading → index once
// Rails responds 200. Falls through after 60 retries (30 s)
// and loads index anyway so the user can inspect the log.
// Retry count is 60 (not 40) to accommodate Bootsnap's
// cold-cache compile time on first launch.
//
// /api/health is used instead of Rails' built-in /up because
// this app does not mount the default healthcheck route.
function waitForRails(callback, retries = 60)
{
    http.get('http://localhost:3001/api/health', res =>
    {
        if (res.statusCode === 200)
        {
            console.log('[Rails] Ready!')
            callback()
        }
        else retry()
    }).on('error', retry)

    function retry()
    {
        if (retries <= 0) { callback(); return }
        setTimeout(() => waitForRails(callback, retries - 1), 500)
    }
}

// ═══════════════════════════════════════════════════════════
//  App — Before Quit
// ═══════════════════════════════════════════════════════════
// On Windows, railsProcess.kill() sends a weak signal that
// Ruby may ignore, leaving Puma alive and port 3001 occupied
// for the next launch. taskkill /f /t force-terminates the
// entire process tree (Ruby + all Puma worker children).
app.on('before-quit', () =>
{
    if (railsProcess)
    {
        if (process.platform === 'win32')
        {
            // /f = force-terminate  /t = include all child processes
            spawn('taskkill', ['/pid', String(railsProcess.pid), '/f', '/t'],
                { windowsHide: true, detached: false })
        }
        else
        {
            railsProcess.kill()
        }
        railsProcess = null
    }
})

// ═══════════════════════════════════════════════════════════
//  Create Main Window
// ═══════════════════════════════════════════════════════════
// Module-level reference so IPC handlers registered outside
// createWindow() can still reach the window instance.
let mainWindow = null

function createWindow()
{
    Menu.setApplicationMenu(null)

    // ── Content Security Policy ────────────────────────────
    // Only applied to local file:// pages; external requests
    // (webview, fonts, CDN images) pass through untouched.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
    {
        if (!details.url.startsWith('file://'))
        {
            return callback({ responseHeaders: details.responseHeaders })
        }
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    [
                        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
                        "script-src  'self' 'unsafe-inline' 'unsafe-eval'",
                        "style-src   'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src    'self' https://fonts.gstatic.com data:",
                        "img-src     * data: blob:",
                        "connect-src 'self' http://localhost:3001 https:",
                        "frame-src   *",
                        "child-src   *",
                        "media-src   *"
                    ].join('; ')
                ]
            }
        })
    })

    // ── Strip Referer from image requests ─────────────────
    // ANN / MAL CDNs block hotlinks when a Referer header is
    // present. Removing it makes requests look like direct visits.
    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ['https://*/*', 'http://*/*'] },
        (details, callback) =>
        {
            const headers = { ...details.requestHeaders }
            if (
                headers['Accept']?.includes('image') ||
                /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(details.url)
            ) {
                delete headers['Referer']
                delete headers['Origin']
            }
            callback({ requestHeaders: headers })
        }
    )

    mainWindow = new BrowserWindow({
        width:           1400,
        height:          900,
        minWidth:        960,
        minHeight:       600,
        backgroundColor: '#020408',
        frame:           false,       // custom title bar in index.html
        title:           'Frieren Archive',
        icon:            path.join(__dirname, 'Icon', 'frieren2.ico'),
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,   // required for fetch() in preload
            webviewTag:       true,    // required for <webview> elements
            webSecurity:      false    // required for cross-origin images + webviews
        }
    })

    // ── Loading screen ─────────────────────────────────────
    // Shown immediately so the user sees something while Rails
    // boots. waitForRails() swaps it for index.html once the
    // API health-check passes.
    mainWindow.loadFile('loading.html')

    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })

    // ── External links → OS default browser ───────────────
    mainWindow.webContents.setWindowOpenHandler(({ url }) =>
    {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    mainWindow.webContents.on('will-navigate', (event, url) =>
    {
        if (!url.startsWith('file://'))
        {
            event.preventDefault()
            shell.openExternal(url)
        }
    })

    // Push maximise state to renderer so nav.js can swap ▢ / ❐
    mainWindow.on('maximize',   () => mainWindow.webContents.send('win-maximized', true))
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('win-maximized', false))

    mainWindow.on('closed', () => { mainWindow = null })

    return mainWindow
}

// ═══════════════════════════════════════════════════════════
//  App Lifecycle
// ═══════════════════════════════════════════════════════════
app.whenReady().then(() =>
{
    // ── IPC handlers — registered once only ───────────────
    // Placing these inside createWindow() would re-register
    // them on every macOS activate event, causing Electron to
    // throw "Attempted to register a second handler" errors.

    ipcMain.handle('open-log', () =>
    {
        shell.openPath(path.join(app.getPath('userData'), 'rails.log'))
    })

    // Title bar controls — reference mainWindow via the
    // module-level variable with optional chaining so they
    // silently no-op if the window has been destroyed.
    ipcMain.on('win-minimize', () => mainWindow?.minimize())
    ipcMain.on('win-maximize', () =>
    {
        mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
    })
    ipcMain.on('win-close', () => mainWindow?.close())

    // ── Boot sequence ──────────────────────────────────────
    // 1. Create window immediately          → shows loading.html
    // 2. Evict any stale process on :3001   → Windows-only, async
    // 3. Spawn Rails inside the promise     → clean port guaranteed
    // 4. Poll /api/health                   → swap to index.html
    createWindow()
    freePort(3001).then(() =>
    {
        startRails()
        waitForRails(() => mainWindow?.loadFile('index.html'))
    })

    // macOS: re-create the window when the dock icon is clicked
    // and no windows are currently open (conventional behaviour).
    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed — except on macOS where
// apps conventionally stay alive until Cmd+Q is pressed.
app.on('window-all-closed', () =>
{
    if (process.platform !== 'darwin') app.quit()
})