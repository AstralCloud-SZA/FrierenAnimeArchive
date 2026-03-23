// preload.js
const { contextBridge, shell, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api',
    {

    // ── Generic GET — used by ALL app.js calls ──────────────
    async get (path)
    {
        try
        {
            const resp = await fetch(`http://localhost:3000${path}`)
            const data = await resp.json()
            return { ok: resp.ok, data }
        }
        catch (err)
        {
            console.error('[preload] GET failed:', err.message)
            return { ok: false, data: null, error: err.message }
        }
    },

    // ── Generic POST ────────────────────────────────────────
    async post (path, body = {})
    {
        try
        {
            const resp = await fetch(`http://localhost:3000${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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

    // ── Open URL in OS default browser (for trailers, links, etc.) ────────
    openExternal (url)
    {
        if (!url) return
        try
        {
            shell.openExternal(url)  // uses Electron shell API
        }
        catch (err)
        {
            console.error('[preload] openExternal failed:', err.message)
        }
    },

    // ── Nav events from main process (Ctrl+1…5) ─────────────
    onNav (callback) {
        if (typeof callback !== 'function') return
        ipcRenderer.on('navigate', (_event, section) => callback(section))
    }

})
