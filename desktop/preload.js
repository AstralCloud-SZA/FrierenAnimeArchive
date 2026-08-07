// preload.js
// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Electron Preload Script
// ═══════════════════════════════════════════════════════════

const { contextBridge, shell, ipcRenderer } = require('electron')

// Keep this identical to main.js:
// Rails command: bin/rails server -p 4376
const RAILS_BASE = 'http://127.0.0.1:4376'
const API_TIMEOUT_MS = 10_000

// ═══════════════════════════════════════════════════════════
//  Generic IPC helper
// ═══════════════════════════════════════════════════════════
async function safeInvoke(channel, ...args)
{
    try
    {
        return await ipcRenderer.invoke(channel, ...args)
    }
    catch (err)
    {
        console.error('[preload] IPC invoke failed:', channel, err)
        return null
    }
}

// ═══════════════════════════════════════════════════════════
//  Rails API helpers
// ═══════════════════════════════════════════════════════════
async function parseResponse(response)
{
    const raw = await response.text()

    if (!raw || !raw.trim())
    {
        return {
            data: null,
            raw: ''
        }
    }

    try
    {
        return {
            data: JSON.parse(raw),
            raw
        }
    }
    catch
    {
        return {
            data: null,
            raw
        }
    }
}

function errorMessageFromResponse(status, data, raw)
{
    if (data && typeof data === 'object')
    {
        if (typeof data.error === 'string') return data.error

        if (Array.isArray(data.errors))
        {
            return data.errors.join(', ')
        }

        if (data.errors && typeof data.errors === 'object')
        {
            return Object.entries(data.errors)
                .map(([field, messages]) =>
                {
                    const text = Array.isArray(messages) ? messages.join(', ') : String(messages)
                    return `${field}: ${text}`
                }).join(' | ')
        }

        if (typeof data.message === 'string') return data.message
    }

    if (raw)
    {
        return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw
    }

    return `HTTP ${status}`
}

async function apiRequest(path, options = {})
{
    const controller = new AbortController()

    const timer = setTimeout(() => {controller.abort()}, API_TIMEOUT_MS)

    try
    {
        const response = await fetch(`${RAILS_BASE}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {Accept: 'application/json', ...(options.headers || {})}
        })

        const { data, raw } = await parseResponse(response)

        const result = {
            ok: response.ok,
            status: response.status,
            data,
            error: response.ok ? null : errorMessageFromResponse(response.status, data, raw)
        }

        if (!result.ok)
        {
            console.warn('[preload] API response failed:', {path, status: result.status, error: result.error})
        }

        return result
    }
    catch (err)
    {
        const timedOut = err?.name === 'AbortError'

        const error = timedOut ? `Request timed out after ${API_TIMEOUT_MS / 1000}s` : (err?.message || String(err))

        console.error('[preload] API request failed:', {path, error})

        return {
            ok: false,
            status: 0,
            data: null,
            error
        }
    }
    finally
    {
        clearTimeout(timer)
    }
}

// ═══════════════════════════════════════════════════════════
//  Renderer API bridge — window.api
// ═══════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('api',
    {
        get(path)
        {
            return apiRequest(path)
        },

        post(path, body = {})
        {
            return apiRequest(path, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            })
        },

        put(path, body = {})
        {
            return apiRequest(path, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            })
        },

        patch(path, body = {})
        {
            return apiRequest(path, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            })
        },

        delete(path)
        {
            return apiRequest(path, {
                method: 'DELETE'
            })
        },

        openExternal(url)
        {
            if (!url || typeof url !== 'string') return Promise.resolve(false)

            try
            {
                return shell.openExternal(url)
            }
            catch (err)
            {
                console.error('[preload] openExternal failed:', err)
                return Promise.resolve(false)
            }
        },

        openLog()
        {
            return safeInvoke('open-log')
        },

        winMinimize()
        {
            ipcRenderer.send('win-minimize')
        },

        winMaximize()
        {
            ipcRenderer.send('win-maximize')
        },

        winClose()
        {
            ipcRenderer.send('win-close')
        },

        onWinMaximized(callback)
        {
            if (typeof callback !== 'function') return

            ipcRenderer.on('win-maximized', (_event, isMaximized) =>
            {
                callback(Boolean(isMaximized))
            })
        },

        onNav(callback)
        {
            if (typeof callback !== 'function') return

            ipcRenderer.on('navigate', (_event, section) =>
            {
                callback(section)
            })
        },

        config: {
            railsBase: RAILS_BASE,
            apiTimeoutMs: API_TIMEOUT_MS
        }
    })

// ═══════════════════════════════════════════════════════════
//  FMOD bridge — window.sound
// ═══════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('sound',
    {
        playSfx(category)
        {
            const normalized = String(category || '').trim().toLowerCase()

            if (!normalized) return Promise.resolve(false)

            return safeInvoke('sound:play-sfx', normalized)
        },

        playAny()
        {
            return safeInvoke('sound:play-any')
        },

        playMusic(name = null)
        {
            return safeInvoke('sound:play-music', name || null)
        },

        stopMusic()
        {
            return safeInvoke('sound:stop-music')
        },

        async listMusic()
        {
            const result = await safeInvoke('sound:list-music')
            return Array.isArray(result) ? result : []
        },

        async isMusicPlaying()
        {
            return Boolean(await safeInvoke('sound:is-music-playing'))
        },

        setMasterVolume(value)
        {
            return safeInvoke('sound:set-master-volume', normaliseVolume(value))
        },

        setSfxVolume(value)
        {
            return safeInvoke('sound:set-sfx-volume', normaliseVolume(value))
        },

        setMusicVolume(value)
        {
            return safeInvoke('sound:set-music-volume', normaliseVolume(value))
        },

        setMuteAll(muted)
        {
            return safeInvoke('sound:set-mute-all', Boolean(muted))
        },

        async listOutputDevices()
        {
            const result = await safeInvoke('sound:list-output-devices')
            return Array.isArray(result) ? result : []
        },

        setOutputDevice(index)
        {
            const outputIndex = Number(index)

            if (!Number.isInteger(outputIndex) || outputIndex < 0)
            {
                return Promise.resolve(false)
            }

            return safeInvoke('sound:set-output-device', outputIndex)
        },

        async categories()
        {
            const result = await safeInvoke('sound:categories')
            return Array.isArray(result) ? result : []
        }
    })

// Accept either 0.0–1.0 values or a raw 0–100 HTML range value.
function normaliseVolume(value)
{
    const number = Number(value)

    if (!Number.isFinite(number)) return 1

    const fraction = number > 1 ? number / 100 : number

    return Math.max(0, Math.min(1, fraction))
}

console.log('[preload] bridge ready', {
    railsBase: RAILS_BASE,
    timeoutMs: API_TIMEOUT_MS,
    apiExposed: true,
    soundExposed: true
})