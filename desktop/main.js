// main.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Main Process
//  Responsibilities:
//    - Create + configure the BrowserWindow
//    - CSP: allow fetch → Rails API, pass-through for webview
//    - External link routing (open in OS browser)
//    - Keyboard shortcut menu (Ctrl+1…5 section nav)
//    - App lifecycle (ready, activate, window-all-closed)
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')

const isDev = process.env.NODE_ENV === 'development'

// ── Create main window ───────────────────────────────────
function createWindow () {

    // ── Content Security Policy ────────────────────────────
    // Only apply CSP to our local file:// pages.
    // External requests (webview, fonts, etc.) pass through
    // untouched so DuckDuckGo webview loads without issues.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (!details.url.startsWith('file://')) {
            // Pass-through — don't block webview or external content
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
                        "font-src    'self' https://fonts.gstatic.com",
                        "img-src     'self' data: https: blob:",
                        "connect-src 'self' http://localhost:3000",
                        "frame-src   *",
                        "child-src   *"
                    ].join('; ')
                ]
            }
        })
    })

    const mainWindow = new BrowserWindow({
        width:           1400,
        height:          900,
        minWidth:        960,
        minHeight:       600,
        backgroundColor: '#020408',   // Frieren void black — no white flash on load
        titleBarStyle:   'default',
        title:           'Frieren Archive',
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,    // required for fetch() in preload
            webviewTag:       true      // required for <webview> DDG browser
        }
    })

    mainWindow.loadFile('index.html')

    // ── DevTools (dev mode only) ─────────────────────────
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
    }

    // ── External links → OS default browser ─────────────
    // Prevents Electron opening news articles / MAL links
    // inside the main app window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    // Catch anchor clicks with target="_blank"
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault()
            shell.openExternal(url)
        }
    })

    return mainWindow
}

// ── Application menu ─────────────────────────────────────
// Ctrl+1…5 → sends 'navigate' IPC to renderer (nav.js)
// Standard Edit menu → cut/copy/paste work in all inputs
function buildMenu (mainWindow) {
    const template = [
        {
            label: 'Navigate',
            submenu: [
                {
                    label:       'News',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => mainWindow.webContents.send('navigate', 'news')
                },
                {
                    label:       'MyAnimeList',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => mainWindow.webContents.send('navigate', 'mal')
                },
                {
                    label:       'Quick Search',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => mainWindow.webContents.send('navigate', 'search')
                },
                {
                    label:       'Favourites',
                    accelerator: 'CmdOrCtrl+4',
                    click: () => mainWindow.webContents.send('navigate', 'favorites')
                },
                {
                    label:       'Settings',
                    accelerator: 'CmdOrCtrl+5',
                    click: () => mainWindow.webContents.send('navigate', 'settings')
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload',         accelerator: 'CmdOrCtrl+R'       },
                { role: 'forceReload',    accelerator: 'CmdOrCtrl+Shift+R' },
                { type: 'separator' },
                { role: 'resetZoom'   },
                { role: 'zoomIn'      },
                { role: 'zoomOut'     },
                { type: 'separator'   },
                { role: 'togglefullscreen' },
                // DevTools always available via F12 regardless of isDev
                { type: 'separator' },
                {
                    label:       'Toggle DevTools',
                    accelerator: 'F12',
                    click: () => mainWindow.webContents.toggleDevTools()
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close'    }
            ]
        }
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ═══════════════════════════════════════════════════════════
//  App lifecycle
// ═══════════════════════════════════════════════════════════

app.whenReady().then(() => {
    const mainWindow = createWindow()
    buildMenu(mainWindow)

    // macOS: re-create window when dock icon clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows closed (Windows / Linux)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
