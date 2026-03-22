// main.js
const { app, BrowserWindow, session, Menu, shell } = require('electron')
const path = require('node:path')

function createWindow ()
{
    // ── Allow fetch → Rails API (CSP) ──────────────────────
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    [
                        "default-src 'self' 'unsafe-inline'",
                        "script-src 'self' 'unsafe-inline'",
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: https:",
                        "connect-src 'self' http://localhost:3000"   // Rails API
                    ].join('; ')
                ]
            }
        })
    })

    const mainWindow = new BrowserWindow(
        {
        width:  1400,
        height: 900,
        minWidth:  900,
        minHeight: 600,
        backgroundColor: '#020408',    // Frieren void black — no white flash
        titleBarStyle: 'default',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false               // needed for fetch in preload
        }
    })

    mainWindow.loadFile('index.html')

    // ── DevTools in dev only ───────────────────────────────
    if (process.env.NODE_ENV === 'development')
    {
        mainWindow.webContents.openDevTools()
    }

    // ── External links open in browser ────────────────────
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })
}

// ── App lifecycle ────────────────────────────────────────
app.whenReady().then(() =>
{
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
