// main.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Main Process
//  Responsibilities:
//    - Create + configure the BrowserWindow (frameless)
//    - Custom title bar IPC (minimise / maximise / close)
//    - CSP: allow fetch → Rails API, pass-through for webview
//    - Strip Referer from image requests (CDN hotlink fix)
//    - External link routing (open in OS browser)
//    - App lifecycle (ready, activate, window-all-closed)
//
//  Notes:
//    - frame: false removes the OS title bar entirely.
//      The custom title bar lives in index.html (.titlebar).
//    - Menu.setApplicationMenu(null) removes the native menu
//      bar on Windows/Linux. Navigation is handled in nav.js
//      via Ctrl+1…6 keyboard shortcuts and the sidebar.
//    - webSecurity: false is intentional — required for
//      cross-origin image loading (ANN, MAL CDNs) and
//      webview content (DuckDuckGo, 9Anime).
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')

const isDev = process.env.NODE_ENV === 'development'

// ── Redirect Electron cache to a local, writable path ────
// Prevents "Unable to move the cache: Access is denied (0x5)"
// errors caused by Electron trying to write to a locked or
// permission-restricted AppData location. Keeping the cache
// inside the project directory ensures write access is always
// available during development.
app.setPath('userData', path.join(__dirname, '.electron-cache'))

// ── Create main window ───────────────────────────────────
function createWindow ()
{
    // ── Remove native menu bar entirely ──────────────────
    // Navigation is handled in-app via the sidebar + Ctrl+1…6.
    // Keeping the OS menu would show a themed mismatch strip
    // above the custom title bar.
    Menu.setApplicationMenu(null)

    // ── Content Security Policy ────────────────────────────
    // Only apply CSP to our local file:// pages.
    // External requests (webview, fonts, etc.) pass through
    // untouched so DuckDuckGo / 9Anime webviews load freely.
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
                        "img-src     * data: blob:",       // ← * allows ANN/MAL/CDN images
                        "connect-src 'self' http://localhost:3001 https:",
                        "frame-src   *",
                        "child-src   *",
                        "media-src   *"
                    ].join('; ')
                ]
            }
        })
    })

    // ── Intercept image requests — strip Referer header ───
    // ANN and most anime news CDNs block hotlinks when a
    // Referer is present. Removing it makes requests look
    // like direct browser visits, which CDNs allow.
    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ['https://*/*', 'http://*/*'] },
        (details, callback) =>
        {
            const headers = { ...details.requestHeaders }
            // Only strip Referer from image/media requests, not API calls
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
        frame:           false,      // ← frameless — custom title bar in index.html
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

    // ── DevTools (dev mode only) ─────────────────────────
    if (isDev)
    {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
    }

    // ── External links → OS default browser ─────────────
    // Prevents navigation inside the main BrowserWindow.
    // All external URLs (articles, trailers, etc.) are handed
    // to the OS and open in the user's default browser instead.
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

    // ── Custom title bar — window control IPC ────────────
    // The HTML title bar (.titlebar in index.html) sends these
    // IPC messages via preload.js (winMinimize / winMaximize /
    // winClose). Maximise toggles between maximised and restored.
    ipcMain.on('win-minimize', () => mainWindow.minimize())
    ipcMain.on('win-maximize', () =>
    {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
    })
    ipcMain.on('win-close', () => mainWindow.close())

    // Notify renderer when maximise state changes so nav.js
    // can swap the ▢ / ❐ icon on the maximise button.
    mainWindow.on('maximize',   () => mainWindow.webContents.send('win-maximized', true))
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('win-maximized', false))

    return mainWindow
}

// ═══════════════════════════════════════════════════════════
//  App lifecycle
// ═══════════════════════════════════════════════════════════

app.whenReady().then(() =>
{
    createWindow()

    // macOS: re-create window when dock icon is clicked
    // and no windows are open.
    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit on all windows closed — except macOS where apps
// conventionally stay active until the user quits explicitly.
app.on('window-all-closed', () =>
{
    if (process.platform !== 'darwin') app.quit()
})