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
//    - App lifecycle (ready, activate, window-all-closed)
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path       = require('node:path')
const fs         = require('node:fs')
const { spawn }  = require('child_process')
const http       = require('http')

const isDev = process.env.NODE_ENV === 'development'

// ── userData path ────────────────────────────────────────
// In packaged builds __dirname is inside a read-only ASAR,
// so we anchor userData to the exe's sibling directory instead.
app.setPath('userData',
    app.isPackaged
        ? path.join(path.dirname(process.execPath), '.electron-cache')
        : path.join(__dirname, '.electron-cache')
)

// ═══════════════════════════════════════════════════════════
//  Rails API — Auto Start
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

function startRails()
{
    const { rubyExe, railsDir } = getRailsPaths()

    // ── File log — readable even in production builds ─────
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

    const gemPath = app.isPackaged
        ? [
            path.join(railsDir, 'vendor', 'bundle', 'ruby', '3.4.0'),
            path.join(process.resourcesPath, 'ruby-runtime', 'lib', 'ruby', 'gems', '3.4.0')
        ].join(path.delimiter)
        : undefined

    logStream.write(`bundlePath : ${bundlePath}\n`)
    logStream.write(`gemHome    : ${gemHome}\n`)

    railsProcess = spawn(
        rubyExe,
        ['bin/rails', 'server', '-p', '3001', '-e', 'production'],
        {
            cwd:         railsDir,
            windowsHide: true,
            stdio:       'pipe',
            env: {
                ...process.env,
                RAILS_ENV:           'production',
                BUNDLE_GEMFILE:      path.join(railsDir, 'Gemfile'),
                BUNDLE_PATH:         bundlePath,
                BUNDLE_WITHOUT:      'development:test',
                GEM_HOME:            gemHome,
                GEM_PATH:            gemPath,
                SECRET_KEY_BASE:     'electron_offline_secret_frieren_archive_000000000',
                RAILS_LOG_TO_STDOUT: '1'
            }
        }
    )

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

// Poll /up every 500 ms — open the window once Rails responds 200.
// Falls through after 40 retries (20 s) so the app still opens
// even if Rails fails, letting the user inspect the log.
function waitForRails(callback, retries = 40)
{
    http.get('http://localhost:3001/up', res =>
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

app.on('before-quit', () =>
{
    if (railsProcess)
    {
        railsProcess.kill()
        railsProcess = null
    }
})

// ═══════════════════════════════════════════════════════════
//  Create main window
// ═══════════════════════════════════════════════════════════
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

    const mainWindow = new BrowserWindow({
        width:           1400,
        height:          900,
        minWidth:        960,
        minHeight:       600,
        backgroundColor: '#020408',
        frame:           false,      // custom title bar in index.html
        title:           'Frieren Archive',
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,    // required for fetch() in preload
            webviewTag:       true,     // required for <webview> elements
            webSecurity:      false     // required for cross-origin images + webviews
        }
    })

    mainWindow.loadFile('index.html')

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

    // ── Custom title bar IPC ───────────────────────────────
    ipcMain.on('win-minimize', () => mainWindow.minimize())
    ipcMain.on('win-maximize', () =>
    {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
    })
    ipcMain.on('win-close', () => mainWindow.close())

    // Push maximise state to renderer so nav.js can swap ▢ / ❐
    mainWindow.on('maximize',   () => mainWindow.webContents.send('win-maximized', true))
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('win-maximized', false))

    // ── Open Rails log in default text editor ─────────────
    // Usage from DevTools console: window.api.openLog()
    ipcMain.handle('open-log', () =>
    {
        shell.openPath(path.join(app.getPath('userData'), 'rails.log'))
    })

    return mainWindow
}

// ═══════════════════════════════════════════════════════════
//  App lifecycle
// ═══════════════════════════════════════════════════════════
app.whenReady().then(() =>
{
    startRails()
    waitForRails(() => createWindow())

    // macOS: re-create window when dock icon clicked and no windows open
    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit on all windows closed — except macOS (conventional behaviour)
app.on('window-all-closed', () =>
{
    if (process.platform !== 'darwin') app.quit()
})