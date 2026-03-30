// main.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Main Process
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path   = require('node:path')
const fs     = require('node:fs')
const { spawn } = require('child_process')
const http   = require('http')

const isDev = process.env.NODE_ENV === 'development'

app.setPath('userData', path.join(__dirname, '.electron-cache'))

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
    return {
        rubyExe:  'ruby',
        railsDir: path.join(__dirname, '..')
    }
}

function startRails()
{
    const { rubyExe, railsDir } = getRailsPaths()

    // ── File log — visible even in production builds ──────
    const logPath   = path.join(app.getPath('userData'), 'rails.log')
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })
    logStream.write(`\n\n=== Rails Start ${new Date().toISOString()} ===\n`)
    logStream.write(`isPackaged : ${app.isPackaged}\n`)
    logStream.write(`rubyExe    : ${rubyExe}\n`)
    logStream.write(`railsDir   : ${railsDir}\n`)

    const bundlePath = app.isPackaged
        ? path.join(railsDir, 'vendor', 'bundle')
        : undefined

    railsProcess = spawn(
        rubyExe,
        ['bin/rails', 'server', '-p', '3001', '-e', 'production'],
        {
            cwd: railsDir,
            windowsHide: true,
            stdio: 'pipe',
            env: {
                ...process.env,
                RAILS_ENV:           'production',
                BUNDLE_GEMFILE:      path.join(railsDir, 'Gemfile'),   // ← critical
                BUNDLE_PATH:         bundlePath,
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
        frame:           false,
        title:           'Frieren Archive',
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,
            webviewTag:       true,
            webSecurity:      false
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

    mainWindow.on('maximize',   () => mainWindow.webContents.send('win-maximized', true))
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('win-maximized', false))

    // ── Open rails.log in default text editor ─────────────
    // Call from DevTools: window.api.openLog()
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

    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () =>
{
    if (process.platform !== 'darwin') app.quit()
})