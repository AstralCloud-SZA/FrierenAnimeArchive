// preload.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Preload Script
//  Responsibilities:
//    - Bridge between the renderer (app.js / nav.js) and
//      Electron APIs, safely via contextBridge.
//    - Exposes a single `window.api` object — nothing else
//      from Node/Electron leaks into the renderer.
//    - All IPC is one-directional unless noted:
//        Renderer → Main : ipcRenderer.send()
//        Main → Renderer : ipcRenderer.on()
//
//  Security notes:
//    - contextIsolation: true  — renderer JS cannot access
//      Node globals directly; only what is exposed here.
//    - nodeIntegration: false  — no require() in renderer.
//    - sandbox: false          — required so fetch() works
//      inside this preload script (sandbox blocks fetch).
//
//  Exposed API surface (window.api):
//    .get(path)              → Rails API GET
//    .post(path, body)       → Rails API POST
//    .openExternal(url)      → open URL in OS browser
//    .winMinimize()          → minimise window
//    .winMaximize()          → maximise / restore window
//    .winClose()             → close window
//    .onWinMaximized(cb)     → callback when max state changes
//    .onNav(cb)              → callback on Ctrl+1…6 nav event
// ═══════════════════════════════════════════════════════════

const { contextBridge, shell, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api',
    {
        // ── Rails API — Generic GET ──────────────────────────
        // Used by every data fetch in app.js (news, health, MAL
        // search, article content). Always returns { ok, data }.
        // On network failure returns { ok: false, data: null }.
        async get (path)
        {
            try
            {
                const resp = await fetch(`http://localhost:3001${path}`)
                const data = await resp.json()
                return { ok: resp.ok, data }
            }
            catch (err)
            {
                console.error('[preload] GET failed:', err.message)
                return { ok: false, data: null, error: err.message }
            }
        },

        // ── Rails API — Generic POST ─────────────────────────
        // Used for news refresh (wipe DB + re-fetch from RSS).
        async post (path, body = {})
        {
            try
            {
                const resp = await fetch(`http://localhost:3001${path}`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(body)
                })
                const data = await resp.json()
                return { ok: resp.ok, data }
            }
            catch (err)
            {
                console.error('[preload] POST failed:', err.message)
                return { ok: false, data: null, error: err.message }
            }
        },

        // ── Open URL in OS default browser ───────────────────
        // Used for: YouTube trailers, external article links,
        // and any URL that should not load inside the app.
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

        // ── Custom title bar — window controls ───────────────
        winMinimize () { ipcRenderer.send('win-minimize') },
        winMaximize () { ipcRenderer.send('win-maximize') },
        winClose ()    { ipcRenderer.send('win-close')    },

        // ── Custom title bar — maximise state listener ───────
        onWinMaximized (callback)
        {
            if (typeof callback !== 'function') return
            ipcRenderer.on('win-maximized', (_event, isMax) => callback(isMax))
        },

        // ── Navigation events from main process ──────────────
        onNav (callback)
        {
            if (typeof callback !== 'function') return
            ipcRenderer.on('navigate', (_event, section) => callback(section))
        }
    })