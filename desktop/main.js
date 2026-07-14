// main.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Main Process
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('child_process')
const http = require('http')

function findFmodModulePath()
{
    const candidates = [
        path.resolve(__dirname, 'soundengine', 'fmod_js', 'fmod.js'),
        path.resolve(__dirname, 'soundengine', 'fmod', 'fmod.js'),
        path.resolve(__dirname, 'renderer', 'soundengine', 'fmod_js', 'fmod.js'),
        path.resolve(__dirname, 'renderer', 'soundengine', 'fmod', 'fmod.js')
    ]

    for (const p of candidates)
    {
        console.log('[FMOD] checking module path:', p, 'exists=', fs.existsSync(p))
        if (fs.existsSync(p)) return p
    }

    throw new Error(`FMOD module not found. Tried: ${candidates.join(' | ')}`)
}

const fmodModulePath = findFmodModulePath()
console.log('[FMOD] loading module from:', fmodModulePath)
const soundengine = require(fmodModulePath)

const isDev = process.env.NODE_ENV === 'development'

app.setPath(
    'userData',
    app.isPackaged ? path.join(path.dirname(process.execPath), '.electron-cache') : path.join(__dirname, '.electron-cache')
)

let railsProcess = null
let mainWindow = null
let sessionHooksInstalled = false
let soundInitialized = false

// ═══════════════════════════════════════════════════════════
//  Sound Engine
// ═══════════════════════════════════════════════════════════
function initSoundEngine()
{
    try
    {
        soundengine.init()
        soundInitialized = true
        console.log('[FMOD] Sound engine initialized')
    }
    catch (err)
    {
        soundInitialized = false
        console.error('[FMOD] init failed:', err)
    }
}

function shutdownSoundEngine()
{
    if (!soundInitialized) return

    try
    {
        soundengine.shutdown()
        console.log('[FMOD] Sound engine shut down')
    }
    catch (err)
    {
        console.error('[FMOD] shutdown failed:', err)
    }
    finally
    {
        soundInitialized = false
    }
}

// ═══════════════════════════════════════════════════════════
//  Port Eviction — Windows stale-process fix
// ═══════════════════════════════════════════════════════════
function freePort(port)
{
    return new Promise(resolve =>
    {
        if (process.platform !== 'win32') return resolve()

        const finder = spawn(
            'cmd',
            ['/c', `netstat -ano | findstr ":${port} "`],
            { windowsHide: true, shell: false }
        )

        let output = ''
        finder.stdout?.on('data', d => { output += d.toString() })

        finder.on('close', () =>
        {
            const pids = [...new Set(
                output.split('\n')
                    .map(line => line.trim().split(/\s+/).pop())
                    .filter(pid => pid && /^\d+$/.test(pid) && pid !== '0')
            )]

            if (pids.length === 0) return resolve()

            console.log(`[Port] Evicting PIDs on :${port} →`, pids)

            let pending = pids.length
            let resolved = false

            const done = () =>
            {
                if (resolved) return
                resolved = true
                resolve()
            }

            for (const pid of pids)
            {
                const killer = spawn('taskkill', ['/pid', pid, '/f', '/t'], { windowsHide: true })
                killer.on('close', () =>
                {
                    pending -= 1
                    if (pending === 0) setTimeout(done, 600)
                })
            }

            setTimeout(done, 1500)
        })
    })
}

// ═══════════════════════════════════════════════════════════
//  Rails API — Path Resolution
// ═══════════════════════════════════════════════════════════
function getRailsPaths()
{
    if (app.isPackaged)
    {
        return {
            rubyExe: path.join(process.resourcesPath, 'ruby-runtime', 'bin', 'ruby.exe'),
            railsDir: path.join(process.resourcesPath, 'rails-api')
        }
    }

    return {
        rubyExe: 'ruby',
        railsDir: path.join(__dirname, '..')
    }
}

// ═══════════════════════════════════════════════════════════
//  Rails API — Spawn
// ═══════════════════════════════════════════════════════════
function startRails()
{
    const { rubyExe, railsDir } = getRailsPaths()

    const logPath = path.join(app.getPath('userData'), 'rails.log')
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })
    logStream.write(`\n\n=== Rails Start ${new Date().toISOString()} ===\n`)
    logStream.write(`isPackaged : ${app.isPackaged}\n`)
    logStream.write(`rubyExe    : ${rubyExe}\n`)
    logStream.write(`railsDir   : ${railsDir}\n`)

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
    logStream.write(`gemPath    : ${gemPath}\n`)

    const inheritedEnv = { ...process.env }
    const RUBY_ENV_SCRUB = [
        'BUNDLE_PATH', 'BUNDLE_GEMFILE', 'BUNDLE_BIN',
        'BUNDLE_APP_CONFIG', 'BUNDLE_WITHOUT', 'BUNDLE_FROZEN',
        'GEM_HOME', 'GEM_PATH', 'RUBYOPT', 'RUBYLIB',
        'RUBYARCHDIR', 'GEM_SPEC_CACHE'
    ]
    for (const key of RUBY_ENV_SCRUB) delete inheritedEnv[key]

    const userData = app.getPath('userData')

    railsProcess = spawn(
        rubyExe,
        ['bin/rails', 'server', '-p', '3001', '-e', 'production'],
        {
            cwd: railsDir,
            windowsHide: true,
            detached: true,
            stdio: 'pipe',
            env: {
                ...inheritedEnv,
                RAILS_ENV: 'production',
                BUNDLE_GEMFILE: path.join(railsDir, 'Gemfile'),
                BUNDLE_PATH: bundlePath,
                BUNDLE_WITHOUT: 'development:test',
                BUNDLE_APP_CONFIG: path.join(railsDir, '.bundle'),
                GEM_HOME: gemHome,
                GEM_PATH: gemPath,
                SECRET_KEY_BASE: 'electron_offline_secret_frieren_archive_000000000',
                RAILS_LOG_TO_STDOUT: '1',
                BOOTSNAP_CACHE_DIR: path.join(userData, 'bootsnap-cache'),
                RAILS_DB_PATH: path.join(userData, 'production.sqlite3'),
                RAILS_DB_CACHE_PATH: path.join(userData, 'production_cache.sqlite3'),
                RAILS_DB_QUEUE_PATH: path.join(userData, 'production_queue.sqlite3'),
                RAILS_DB_CABLE_PATH: path.join(userData, 'production_cable.sqlite3')
            }
        }
    )

    logStream.write(`railsPID   : ${railsProcess.pid}\n`)
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
//  Health check polling
// ═══════════════════════════════════════════════════════════
function waitForRails(callback, retries = 60)
{
    http.get('http://localhost:3001/api/health', res =>
    {
        if (res.statusCode === 200)
        {
            console.log('[Rails] Ready!')
            callback()
        }
        else
        {
            retry()
        }
    }).on('error', retry)

    function retry()
    {
        if (retries <= 0)
        {
            callback()
            return
        }
        setTimeout(() => waitForRails(callback, retries - 1), 500)
    }
}

// ═══════════════════════════════════════════════════════════
//  Session hooks
// ═══════════════════════════════════════════════════════════
function setupSessionHooks()
{
    if (sessionHooksInstalled) return
    sessionHooksInstalled = true

    session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
    {
        if (!details.url.startsWith('file://'))
        {
            return callback({ responseHeaders: details.responseHeaders })
        }

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [[
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                    "font-src 'self' https://fonts.gstatic.com data:",
                    "img-src * data: blob:",
                    "connect-src 'self' http://localhost:3001 https:",
                    "frame-src *",
                    "child-src *",
                    "media-src *"
                ].join('; ')]
            }
        })
    })

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
}

// ═══════════════════════════════════════════════════════════
//  Create Main Window
// ═══════════════════════════════════════════════════════════
function createWindow()
{
    Menu.setApplicationMenu(null)
    setupSessionHooks()

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 960,
        minHeight: 600,
        backgroundColor: '#020408',
        frame: false,
        title: 'Frieren Archive',
        icon: path.join(__dirname, 'Icon', 'frieren2.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webviewTag: true,
            webSecurity: false
        }
    })

    mainWindow.loadFile('loading.html')

    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })

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

    mainWindow.on('maximize',   () => mainWindow?.webContents.send('win-maximized', true))
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win-maximized', false))
    mainWindow.on('closed',     () => { mainWindow = null })

    return mainWindow
}

// ═══════════════════════════════════════════════════════════
//  App — Before Quit
// ═══════════════════════════════════════════════════════════
app.on('before-quit', () =>
{
    shutdownSoundEngine()

    if (railsProcess)
    {
        if (process.platform === 'win32')
        {
            spawn(
                'taskkill',
                ['/pid', String(railsProcess.pid), '/f', '/t'],
                { windowsHide: true, detached: false }
            )
        }
        else
        {
            railsProcess.kill()
        }

        railsProcess = null
    }
})

// ═══════════════════════════════════════════════════════════
//  App Lifecycle
// ═══════════════════════════════════════════════════════════
app.whenReady().then(() =>
{
    ipcMain.handle('open-log', () =>
    {
        return shell.openPath(path.join(app.getPath('userData'), 'rails.log'))
    })

    ipcMain.on('win-minimize', () => mainWindow?.minimize())
    ipcMain.on('win-maximize', () =>
    {
        if (!mainWindow) return
        if (mainWindow.isMaximized()) mainWindow.unmaximize()
        else mainWindow.maximize()
    })
    ipcMain.on('win-close', () => mainWindow?.close())

    // ── FMOD IPC ──────────────────────────────────────────
    ipcMain.handle('sound:play-sfx', (_event, category) =>
    {
        if (!soundInitialized) return false
        soundengine.play(category)
        return true
    })

    ipcMain.handle('sound:play-any', () =>
    {
        if (!soundInitialized) return false
        soundengine.playAny()
        return true
    })

    ipcMain.handle('sound:play-music', (_event, name) =>
    {
        if (!soundInitialized) return false
        soundengine.playMusic(name || undefined)
        return true
    })

    ipcMain.handle('sound:stop-music', () =>
    {
        if (!soundInitialized) return false
        soundengine.stopMusic()
        return true
    })

    ipcMain.handle('sound:list-music', () =>
    {
        if (!soundInitialized) return []
        return soundengine.listMusic()
    })

    ipcMain.handle('sound:is-music-playing', () =>
    {
        if (!soundInitialized) return false
        return !!soundengine.isMusicPlaying()
    })

    ipcMain.handle('sound:set-master-volume', (_event, v) =>
    {
        if (!soundInitialized) return false
        soundengine.setMasterVolume(v)
        return true
    })

    ipcMain.handle('sound:set-sfx-volume', (_event, v) =>
    {
        if (!soundInitialized) return false
        soundengine.setSfxVolume(v)
        return true
    })

    ipcMain.handle('sound:set-music-volume', (_event, v) =>
    {
        if (!soundInitialized) return false
        soundengine.setMusicVolume(v)
        return true
    })

    ipcMain.handle('sound:set-mute-all', (_event, muted) =>
    {
        if (!soundInitialized) return false
        soundengine.setMuteAll(!!muted)
        return true
    })

    ipcMain.handle('sound:list-output-devices', () =>
    {
        if (!soundInitialized) return []
        return soundengine.listOutputDevices()
    })

    ipcMain.handle('sound:set-output-device', (_event, index) =>
    {
        if (!soundInitialized) return false
        soundengine.setOutputDevice(index)
        return true
    })


    ipcMain.handle('sound:categories', () =>
    {
        if (!soundInitialized) return []
        return soundengine.categories()
    })

    createWindow()
    initSoundEngine()

    freePort(3001).then(() =>
    {
        startRails()
        waitForRails(() => mainWindow?.loadFile('index.html'))
    })

    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () =>
{
    if (process.platform !== 'darwin') app.quit()
})