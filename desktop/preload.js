// preload.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Preload Script
//
//  Purpose:
//    Acts as the secure bridge between the sandboxed renderer
//    process (app.js / nav.js) and privileged Electron/Node
//    APIs. Only what is explicitly listed here is accessible
//    to renderer code via window.api — nothing else leaks.
//
//  Architecture:
//    ┌─────────────┐   window.api.*   ┌──────────────┐
//    │  Renderer   │ ←─────────────→ │   Preload    │
//    │  (app.js)   │                 │ (this file)  │
//    └─────────────┘                 └──────┬───────┘
//                                           │ ipcRenderer
//                                    ┌──────▼───────┐
//                                    │  Main Process │
//                                    │  (main.js)   │
//                                    └──────────────┘
//
//  Security model:
//    - contextIsolation: true  — renderer JS runs in a separate
//      V8 context; it cannot access Node globals or require().
//    - nodeIntegration:  false — no Node.js APIs in renderer.
//    - sandbox:          false — required so that fetch() works
//      inside this preload script (full sandbox blocks fetch).
//    - Only string/plain-object data crosses the bridge;
//      no functions or Node objects are ever forwarded.
//
//  IPC directions:
//    Renderer → Main  :  ipcRenderer.send()    (fire-and-forget)
//    Renderer → Main  :  ipcRenderer.invoke()  (async request/reply)
//    Main → Renderer  :  ipcRenderer.on()      (push event)
//
//  Exposed API  (window.api):
//  ┌─────────────────────┬────────────┬─────────────────────────────────┐
//  │ Method              │ Direction  │ Description                     │
//  ├─────────────────────┼────────────┼─────────────────────────────────┤
//  │ .get(path)          │ R → Rails  │ HTTP GET to Rails API           │
//  │ .post(path, body)   │ R → Rails  │ HTTP POST to Rails API          │
//  │ .openExternal(url)  │ R → Main   │ Open URL in OS default browser  │
//  │ .openLog()          │ R → Main   │ Open rails.log in text editor   │
//  │ .winMinimize()      │ R → Main   │ Minimise window                 │
//  │ .winMaximize()      │ R → Main   │ Toggle maximise / restore       │
//  │ .winClose()         │ R → Main   │ Close window                    │
//  │ .onWinMaximized(cb) │ Main → R   │ Fires when max state changes    │
//  │ .onNav(cb)          │ Main → R   │ Fires on Ctrl+1…6 nav shortcut  │
//  └─────────────────────┴────────────┴─────────────────────────────────┘
// ═══════════════════════════════════════════════════════════

const { contextBridge, shell, ipcRenderer } = require('electron')

const RAILS_BASE = 'http://localhost:3001'

contextBridge.exposeInMainWorld('api',
    {
        // ── Rails API — GET ──────────────────────────────────────
        // Performs a GET request to the local Rails API server.
        // Used throughout app.js for news, health checks, MAL
        // searches, and article content fetches.
        //
        // @param  {string} path  — e.g. '/api/v1/news'
        // @return {Promise<{ ok: boolean, data: any, error?: string }>}
        //
        async get (path)
        {
            try
            {
                const resp = await fetch(`${RAILS_BASE}${path}`)
                const data = await resp.json()
                return { ok: resp.ok, data }
            }
            catch (err)
            {
                console.error('[preload] GET failed:', path, err.message)
                return { ok: false, data: null, error: err.message }
            }
        },

        // ── Rails API — POST ─────────────────────────────────────
        // Performs a POST request to the local Rails API server.
        // Currently used for news refresh (wipes DB + re-fetches
        // from RSS feeds).
        //
        // @param  {string} path  — e.g. '/api/v1/news/refresh'
        // @param  {object} body  — JSON-serialisable payload
        // @return {Promise<{ ok: boolean, data: any, error?: string }>}
        //
        async post (path, body = {})
        {
            try
            {
                const resp = await fetch(`${RAILS_BASE}${path}`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(body)
                })
                const data = await resp.json()
                return { ok: resp.ok, data }
            }
            catch (err)
            {
                console.error('[preload] POST failed:', path, err.message)
                return { ok: false, data: null, error: err.message }
            }
        },

        // ── Open URL in OS default browser ───────────────────────
        // Hands a URL to the operating system's default browser.
        // Used for: YouTube trailers, external article links, and
        // any URL that must not load inside the Electron window.
        // Silently no-ops on null/undefined input.
        //
        // @param {string} url — fully-qualified URL
        //
        openExternal (url)
        {
            if (!url) return
            try
            {
                shell.openExternal(url)
            }
            catch (err)
            {
                console.error('[preload] openExternal failed:', err.message)
            }
        },

        // ── Open Rails log in default text editor ────────────────
        // Asks main.js to open the rails.log file that lives in
        // userData/.electron-cache/rails.log. Useful for debugging
        // API startup failures in packaged (production) builds
        // where the DevTools console is not available.
        //
        // Usage (DevTools console): window.api.openLog()
        //
        openLog () { ipcRenderer.invoke('open-log') },

        // ── Custom title bar — window controls ───────────────────
        // The frameless window has no OS title bar; these methods
        // drive the custom .titlebar buttons rendered in index.html.
        //
        winMinimize () { ipcRenderer.send('win-minimize') },
        winMaximize () { ipcRenderer.send('win-maximize') },  // toggles restore too
        winClose ()    { ipcRenderer.send('win-close')    },

        // ── Custom title bar — maximise state listener ───────────
        // Registers a callback that fires whenever the window moves
        // between maximised and restored states. Used by nav.js to
        // swap the ▢ / ❐ icon on the maximise button.
        //
        // @param {function} callback — receives (isMaximized: boolean)
        //
        onWinMaximized (callback)
        {
            if (typeof callback !== 'function') return
            ipcRenderer.on('win-maximized', (_event, isMax) => callback(isMax))
        },

        // ── Navigation events from main process ──────────────────
        // Registers a callback for Ctrl+1…6 global shortcut events
        // forwarded from main.js. nav.js uses this to switch the
        // active sidebar section without a mouse click.
        //
        // @param {function} callback — receives (section: string)
        //
        onNav (callback)
        {
            if (typeof callback !== 'function') return
            ipcRenderer.on('navigate', (_event, section) => callback(section))
        }
    })