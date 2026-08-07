// main.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Main Process
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const http = require('node:http')

const RAILS_PORT = 4376
const RAILS_HOST = '127.0.0.1'
const RAILS_BASE_URL = `http://${RAILS_HOST}:${RAILS_PORT}`
const RAILS_HEALTH_URL = `${RAILS_BASE_URL}/api/health`

const isDev = process.env.NODE_ENV === 'development'

let railsProcess = null
let mainWindow = null
let sessionHooksInstalled = false
let soundInitialized = false
let isQuitting = false

let soundengine = null

// ═══════════════════════════════════════════════════════════
//  Electron Paths
// ═══════════════════════════════════════════════════════════
app.setPath(
    'userData',
    app.isPackaged
        ? path.join(path.dirname(process.execPath), '.electron-cache')
        : path.join(__dirname, '.electron-cache')
)

function ensureUserDataDirectory()
{
    const userData = app.getPath('userData')

    if (!fs.existsSync(userData))
    {
        fs.mkdirSync(userData, { recursive: true })
    }

    return userData
}

// ═══════════════════════════════════════════════════════════
//  FMOD Resolution / Initialisation
// ═══════════════════════════════════════════════════════════
function findFmodModulePath()
{
    const candidates = [
        path.resolve(__dirname, 'soundengine', 'fmod_js', 'fmod.js'),
        path.resolve(__dirname, 'soundengine', 'fmod', 'fmod.js'),
        path.resolve(__dirname, 'renderer', 'soundengine', 'fmod_js', 'fmod.js'),
        path.resolve(__dirname, 'renderer', 'soundengine', 'fmod', 'fmod.js'),

        path.resolve(process.resourcesPath || '', 'soundengine', 'fmod_js', 'fmod.js'),
        path.resolve(process.resourcesPath || '', 'soundengine', 'fmod', 'fmod.js'),
        path.resolve(process.resourcesPath || '', 'renderer', 'soundengine', 'fmod_js', 'fmod.js'),
        path.resolve(process.resourcesPath || '', 'renderer', 'soundengine', 'fmod', 'fmod.js')
    ]

    for (const candidate of candidates)
    {
        if (!candidate) continue

        const exists = fs.existsSync(candidate)

        console.log('[FMOD] checking module path:', candidate, 'exists=', exists)

        if (exists) return candidate
    }

    throw new Error(
        `FMOD module not found. Tried: ${candidates.join(' | ')}`
    )
}

function loadSoundEngine()
{
    try
    {
        const fmodModulePath = findFmodModulePath()

        console.log('[FMOD] loading module from:', fmodModulePath)

        soundengine = require(fmodModulePath)

        return true
    }
    catch (err)
    {
        soundengine = null
        console.error('[FMOD] module load failed:', err)
        return false
    }
}

function initSoundEngine()
{
    if (!soundengine)
    {
        console.warn('[FMOD] Cannot initialise: module did not load')
        soundInitialized = false
        return false
    }

    try
    {
        soundengine.init()
        soundInitialized = true

        console.log('[FMOD] Sound engine initialized')

        return true
    }
    catch (err)
    {
        soundInitialized = false

        console.error('[FMOD] init failed:', err)

        return false
    }
}

function shutdownSoundEngine()
{
    if (!soundInitialized || !soundengine) return

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

function clampVolume(value)
{
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) return 1

    return Math.max(0, Math.min(1, parsed))
}

// ═══════════════════════════════════════════════════════════
//  Rails Process Helpers
// ═══════════════════════════════════════════════════════════
function getRailsPaths()
{
    if (app.isPackaged)
    {
        return {
            rubyExe: path.join(
                process.resourcesPath,
                'ruby-runtime',
                'bin',
                process.platform === 'win32' ? 'ruby.exe' : 'ruby'
            ),
            railsDir: path.join(process.resourcesPath, 'rails-api')
        }
    }

    return {
        rubyExe: process.platform === 'win32' ? 'ruby.exe' : 'ruby',
        railsDir: path.resolve(__dirname, '..')
    }
}

function getRailsLogPath()
{
    return path.join(ensureUserDataDirectory(), 'rails.log')
}

function writeRailsLog(stream, message)
{
    try
    {
        stream.write(message)
    }
    catch (err)
    {
        console.error('[Rails Log] Write failed:', err)
    }
}

function freePort(port)
{
    return new Promise(resolve =>
    {
        if (process.platform !== 'win32')
        {
            resolve()
            return
        }

        const finder = spawn(
            'cmd',
            ['/c', `netstat -ano | findstr ":${port} "`],
            {
                windowsHide: true,
                shell: false
            }
        )

        let output = ''

        finder.stdout?.on('data', data =>
        {
            output += data.toString()
        })

        finder.on('error', err =>
        {
            console.warn('[Port] Could not inspect port:', err.message)
            resolve()
        })

        finder.on('close', () =>
        {
            const pids = [
                ...new Set(
                    output
                        .split(/\r?\n/)
                        .map(line => line.trim().split(/\s+/).pop())
                        .filter(pid => pid && /^\d+$/.test(pid) && pid !== '0')
                )
            ]

            if (pids.length === 0)
            {
                resolve()
                return
            }

            console.log(`[Port] Evicting PIDs using :${port}:`, pids)

            let remaining = pids.length
            let finished = false

            const done = () =>
            {
                if (finished) return

                finished = true
                resolve()
            }

            for (const pid of pids)
            {
                const killer = spawn(
                    'taskkill',
                    ['/pid', pid, '/f', '/t'],
                    {
                        windowsHide: true,
                        shell: false
                    }
                )

                killer.on('error', err =>
                {
                    console.warn(`[Port] Could not kill PID ${pid}:`, err.message)
                })

                killer.on('close', () =>
                {
                    remaining -= 1

                    if (remaining <= 0)
                    {
                        setTimeout(done, 600)
                    }
                })
            }

            setTimeout(done, 2500)
        })
    })
}

function startRails()
{
    const { rubyExe, railsDir } = getRailsPaths()
    const userData = ensureUserDataDirectory()
    const logPath = getRailsLogPath()
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })

    const railsBin = path.join(railsDir, 'bin', 'rails')
    const gemfile = path.join(railsDir, 'Gemfile')

    writeRailsLog(logStream, '\n\n')
    writeRailsLog(logStream, `=== Rails Start ${new Date().toISOString()} ===\n`)
    writeRailsLog(logStream, `isPackaged : ${app.isPackaged}\n`)
    writeRailsLog(logStream, `rubyExe    : ${rubyExe}\n`)
    writeRailsLog(logStream, `railsDir   : ${railsDir}\n`)
    writeRailsLog(logStream, `railsBin   : ${railsBin}\n`)
    writeRailsLog(logStream, `gemfile    : ${gemfile}\n`)
    writeRailsLog(logStream, `port       : ${RAILS_PORT}\n`)

    if (!fs.existsSync(railsDir))
    {
        const message = `[Rails] Rails directory does not exist: ${railsDir}\n`

        console.error(message)
        writeRailsLog(logStream, message)
        logStream.end()

        return false
    }

    if (!fs.existsSync(railsBin))
    {
        const message = `[Rails] bin/rails does not exist: ${railsBin}\n`

        console.error(message)
        writeRailsLog(logStream, message)
        logStream.end()

        return false
    }

    if (app.isPackaged && !fs.existsSync(rubyExe))
    {
        const message = `[Rails] Bundled Ruby executable does not exist: ${rubyExe}\n`

        console.error(message)
        writeRailsLog(logStream, message)
        logStream.end()

        return false
    }

    const bundlePath = app.isPackaged ? path.join(railsDir, 'vendor', 'bundle') : undefined

    const gemHome = app.isPackaged ? path.join(railsDir, 'vendor', 'bundle', 'ruby', '3.4.0') : undefined

    const gemPath = app.isPackaged
        ? [
            gemHome,
            path.join(
                process.resourcesPath,
                'ruby-runtime',
                'lib',
                'ruby',
                'gems',
                '3.4.0'
            )
        ].join(path.delimiter)
        : undefined

    writeRailsLog(logStream, `bundlePath : ${bundlePath || '(development default)'}\n`)
    writeRailsLog(logStream, `gemHome    : ${gemHome || '(development default)'}\n`)
    writeRailsLog(logStream, `gemPath    : ${gemPath || '(development default)'}\n`)

    const inheritedEnv = { ...process.env }

    const rubyEnvKeys = [
        'BUNDLE_PATH',
        'BUNDLE_GEMFILE',
        'BUNDLE_BIN',
        'BUNDLE_APP_CONFIG',
        'BUNDLE_WITHOUT',
        'BUNDLE_FROZEN',
        'GEM_HOME',
        'GEM_PATH',
        'RUBYOPT',
        'RUBYLIB',
        'RUBYARCHDIR',
        'GEM_SPEC_CACHE'
    ]

    for (const key of rubyEnvKeys)
    {
        delete inheritedEnv[key]
    }

    const railsEnv = {
        ...inheritedEnv,
        RAILS_ENV: 'production',
        BUNDLE_GEMFILE: gemfile,
        BUNDLE_WITHOUT: 'development:test',
        BUNDLE_APP_CONFIG: path.join(railsDir, '.bundle'),
        SECRET_KEY_BASE: 'electron_offline_secret_frieren_archive_000000000',
        RAILS_LOG_TO_STDOUT: '1',
        BOOTSNAP_CACHE_DIR: path.join(userData, 'bootsnap-cache'),
        RAILS_DB_PATH: path.join(userData, 'production.sqlite3'),
        RAILS_DB_CACHE_PATH: path.join(userData, 'production_cache.sqlite3'),
        RAILS_DB_QUEUE_PATH: path.join(userData, 'production_queue.sqlite3'),
        RAILS_DB_CABLE_PATH: path.join(userData, 'production_cable.sqlite3')
    }

    if (bundlePath) railsEnv.BUNDLE_PATH = bundlePath
    if (gemHome) railsEnv.GEM_HOME = gemHome
    if (gemPath) railsEnv.GEM_PATH = gemPath

    try
    {
        railsProcess = spawn(
            rubyExe,
            [
                'bin/rails',
                'server',
                '-b',
                RAILS_HOST,
                '-p',
                String(RAILS_PORT),
                '-e',
                'production'
            ],
            {
                cwd: railsDir,
                windowsHide: true,
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: railsEnv
            }
        )
    }
    catch (err)
    {
        console.error('[Rails] Spawn threw:', err)
        writeRailsLog(logStream, `[SPAWN THROW] ${err.stack || err}\n`)
        logStream.end()

        return false
    }

    writeRailsLog(logStream, `railsPID   : ${railsProcess.pid}\n`)

    railsProcess.stdout?.on('data', data =>
    {
        const message = data.toString()

        console.log('[Rails]', message.trim())
        writeRailsLog(logStream, `[OUT] ${message}`)
    })

    railsProcess.stderr?.on('data', data =>
    {
        const message = data.toString()

        console.error('[Rails ERR]', message.trim())
        writeRailsLog(logStream, `[ERR] ${message}`)
    })

    railsProcess.on('error', err =>
    {
        console.error('[Rails FAILED]', err)
        writeRailsLog(logStream, `[SPAWN ERROR] ${err.stack || err}\n`)
    })

    railsProcess.on('exit', (code, signal) =>
    {
        console.warn(`[Rails] Exited: code=${code}, signal=${signal}`)
        writeRailsLog(logStream, `[EXIT] code=${code} signal=${signal}\n`)
        logStream.end()

        railsProcess = null
    })

    return true
}

function requestRailsHealth()
{
    return new Promise(resolve =>
    {
        let settled = false

        const finish = healthy =>
        {
            if (settled) return

            settled = true
            resolve(healthy)
        }

        const request = http.get(
            RAILS_HEALTH_URL,
            {
                timeout: 1500
            },
            response =>
            {
                response.resume()
                finish(response.statusCode === 200)
            }
        )

        request.on('timeout', () =>
        {
            request.destroy()
            finish(false)
        })

        request.on('error', () =>
        {
            finish(false)
        })
    })
}

async function waitForRails({ attempts = 60, delayMs = 500 } = {})
{
    for (let attempt = 1; attempt <= attempts; attempt += 1)
    {
        const healthy = await requestRailsHealth()

        if (healthy)
        {
            console.log('[Rails] Ready:', RAILS_HEALTH_URL)
            return true
        }

        if (attempt < attempts)
        {
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    console.error(
        `[Rails] Health check failed after ${attempts} attempts: ${RAILS_HEALTH_URL}`
    )

    return false
}

function stopRails()
{
    if (!railsProcess || railsProcess.killed) return

    const pid = railsProcess.pid

    console.log('[Rails] Stopping Rails process:', pid)

    if (process.platform === 'win32')
    {
        const killer = spawn(
            'taskkill',
            ['/pid', String(pid), '/f', '/t'],
            {
                windowsHide: true,
                detached: false,
                stdio: 'ignore'
            }
        )

        killer.on('error', err =>
        {
            console.error('[Rails] taskkill failed:', err)
        })
    }
    else
    {
        try
        {
            railsProcess.kill('SIGTERM')
        }
        catch (err)
        {
            console.error('[Rails] SIGTERM failed:', err)
        }
    }

    railsProcess = null
}

// ═══════════════════════════════════════════════════════════
//  Content Security Policy
// ═══════════════════════════════════════════════════════════
function setupSessionHooks()
{
    if (sessionHooksInstalled) return

    sessionHooksInstalled = true

    session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
    {
        if (!details.url.startsWith('file://'))
        {
            callback({ responseHeaders: details.responseHeaders })
            return
        }

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [[
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                    "font-src 'self' https://fonts.gstatic.com data:",
                    "img-src 'self' data: blob: http: https:",
                    `connect-src 'self' ${RAILS_BASE_URL} https:`,
                    "media-src 'self' data: blob: http: https:"
                ].join('; ')]
            }
        })
    })
}

// ═══════════════════════════════════════════════════════════
//  Window
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
        show: true,
        title: 'Frieren Archive',
        icon: path.join(__dirname, 'Icon', 'frieren2.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webviewTag: true
        }
    })

    mainWindow.loadFile(path.join(__dirname, 'loading.html'))

    if (isDev)
    {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) =>
    {
        if (/^https?:\/\//i.test(url))
        {
            shell.openExternal(url)
        }

        return { action: 'deny' }
    })

    mainWindow.webContents.on('will-navigate', (event, url) =>
    {
        if (!url.startsWith('file://'))
        {
            event.preventDefault()

            if (/^https?:\/\//i.test(url))
            {
                shell.openExternal(url)
            }
        }
    })

    mainWindow.on('maximize', () =>
    {
        mainWindow?.webContents.send('win-maximized', true)
    })

    mainWindow.on('unmaximize', () =>
    {
        mainWindow?.webContents.send('win-maximized', false)
    })

    mainWindow.on('closed', () =>
    {
        mainWindow = null
    })

    return mainWindow
}

// ═══════════════════════════════════════════════════════════
//  IPC Registration
// ═══════════════════════════════════════════════════════════
function registerIpcHandlers()
{
    ipcMain.handle('open-log', () =>
    {
        return shell.openPath(getRailsLogPath())
    })

    ipcMain.on('win-minimize', () =>
    {
        mainWindow?.minimize()
    })

    ipcMain.on('win-maximize', () =>
    {
        if (!mainWindow) return

        if (mainWindow.isMaximized())
        {
            mainWindow.unmaximize()
        }
        else
        {
            mainWindow.maximize()
        }
    })

    ipcMain.on('win-close', () =>
    {
        mainWindow?.close()
    })

    ipcMain.handle('sound:play-sfx', (_event, category) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.play(String(category || '').toLowerCase())
            return true
        }
        catch (err)
        {
            console.error('[FMOD] play-sfx failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:play-any', () =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.playAny()
            return true
        }
        catch (err)
        {
            console.error('[FMOD] play-any failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:play-music', (_event, name) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.playMusic(name || undefined)
            return true
        }
        catch (err)
        {
            console.error('[FMOD] play-music failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:stop-music', () =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.stopMusic()
            return true
        }
        catch (err)
        {
            console.error('[FMOD] stop-music failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:list-music', () =>
    {
        if (!soundInitialized || !soundengine) return []

        try
        {
            return soundengine.listMusic()
        }
        catch (err)
        {
            console.error('[FMOD] list-music failed:', err)
            return []
        }
    })

    ipcMain.handle('sound:is-music-playing', () =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            return !!soundengine.isMusicPlaying()
        }
        catch (err)
        {
            console.error('[FMOD] is-music-playing failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:set-master-volume', (_event, value) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.setMasterVolume(clampVolume(value))
            return true
        }
        catch (err)
        {
            console.error('[FMOD] set-master-volume failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:set-sfx-volume', (_event, value) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.setSfxVolume(clampVolume(value))
            return true
        }
        catch (err)
        {
            console.error('[FMOD] set-sfx-volume failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:set-music-volume', (_event, value) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.setMusicVolume(clampVolume(value))
            return true
        }
        catch (err)
        {
            console.error('[FMOD] set-music-volume failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:set-mute-all', (_event, muted) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.setMuteAll(!!muted)
            return true
        }
        catch (err)
        {
            console.error('[FMOD] set-mute-all failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:list-output-devices', () =>
    {
        if (!soundInitialized || !soundengine) return []

        try
        {
            return soundengine.listOutputDevices()
        }
        catch (err)
        {
            console.error('[FMOD] list-output-devices failed:', err)
            return []
        }
    })

    ipcMain.handle('sound:set-output-device', (_event, index) =>
    {
        if (!soundInitialized || !soundengine) return false

        try
        {
            soundengine.setOutputDevice(Number(index))
            return true
        }
        catch (err)
        {
            console.error('[FMOD] set-output-device failed:', err)
            return false
        }
    })

    ipcMain.handle('sound:categories', () =>
    {
        if (!soundInitialized || !soundengine) return []

        try
        {
            return soundengine.categories()
        }
        catch (err)
        {
            console.error('[FMOD] categories failed:', err)
            return []
        }
    })
}

// ═══════════════════════════════════════════════════════════
//  Application Lifecycle
// ═══════════════════════════════════════════════════════════
app.whenReady().then(async () =>
{
    ensureUserDataDirectory()
    registerIpcHandlers()
    loadSoundEngine()
    initSoundEngine()
    createWindow()

    await freePort(RAILS_PORT)

    const started = startRails()

    if (!started)
    {
        console.error('[Rails] Could not start; loading UI in offline mode')

        if (mainWindow && !mainWindow.isDestroyed())
        {
            mainWindow.loadFile(path.join(__dirname, 'index.html'))
        }

        return
    }

    const ready = await waitForRails({
        attempts: 60,
        delayMs: 500
    })

    if (!mainWindow || mainWindow.isDestroyed()) return

    if (!ready)
    {
        console.warn('[Rails] UI will load in offline mode')
    }

    mainWindow.loadFile(path.join(__dirname, 'index.html'))

    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0)
        {
            createWindow()
        }
    })
})

app.on('before-quit', () =>
{
    if (isQuitting) return

    isQuitting = true

    shutdownSoundEngine()
    stopRails()
})

app.on('window-all-closed', () =>
{
    if (process.platform !== 'darwin')
    {
        app.quit()
    }
})