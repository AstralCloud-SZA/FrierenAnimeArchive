/* ============================================================
   renderer/js/app.js — Main application logic
   Connects UI to Rails API via window.api (preload bridge)

   Sections:
     1.  Constants + DOM refs
     2.  UI helpers (cards, states, escaping)
     3.  API status
     4.  News (load + health)
     5.  MAL search + in-app detail view
     6.  DuckDuckGo in-app webview browser
     7.  Settings (SFW toggle)
     8.  Event listeners
     9.  Boot sequence
============================================================ */

const API = window.api   // injected by preload.js

// ═══════════════════════════════════════════════════════════
//  1. DOM REFS
// ═══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id)

const apiDot        = $('api-dot')
const apiStatus     = $('api-status')
const settingsBadge = $('settings-api-badge')
const newsList      = $('news-list')
const btnHealth     = $('btn-health')
const btnNews       = $('btn-news')
const globalSearch  = $('global-search')
const malInput      = $('mal-input')
const malBtn        = $('mal-btn')
const malOutput     = $('mal-output')
const malEmpty      = $('mal-empty')
const sfwToggle     = $('sfw-toggle')
const ddgInput      = $('ddg-input')
const ddgBtn        = $('ddg-btn')
const ddgWebview    = $('ddg-webview')
const ddgBack       = $('ddg-back')
const ddgForward    = $('ddg-forward')
const ddgReload     = $('ddg-reload')

// ═══════════════════════════════════════════════════════════
//  2. UI HELPERS
// ═══════════════════════════════════════════════════════════

// Escape HTML — prevents XSS in all dynamic content
function escHtml (str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
}

// Glassmorphism card wrapper
function glassCard (heading, bodyHTML) {
    return `
    <div class="glass-card">
      <div class="card-heading">${heading}</div>
      <div class="card-body" style="font-size:16px;line-height:1.75;">${bodyHTML}</div>
    </div>`
}

// Centred empty / error state with optional Frieren quote
function emptyState (icon, msg, quote = '') {
    return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <p>${msg}</p>
      ${quote ? `<em>${escHtml(quote)}</em>` : ''}
    </div>`
}

// Animated loading state — pulsing orb
function loading (msg = 'Casting spell…') {
    return `
    <div class="empty-state">
      <div class="empty-icon"
           style="animation:orb-pulse 1.2s ease-in-out infinite;">🔮</div>
      <p>${msg}</p>
    </div>`
}

// ── News card ─────────────────────────────────────────────
function newsCardHTML (article) {
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('en-ZA', {
            day: 'numeric', month: 'short', year: 'numeric'
        })
        : '—'

    return `
    <div class="news-card" data-url="${escHtml(article.url || '')}"
         style="cursor:pointer;">
      <div class="news-card-source">${escHtml(article.source_name || 'Archive')}</div>
      <div class="news-card-title">${escHtml(article.title || 'Untitled')}</div>
      <div class="news-card-summary">${escHtml(article.summary || '')}</div>
      <div class="news-card-time">${date}</div>
    </div>`
}

// ── MAL search result card ────────────────────────────────
function malCardHTML (anime) {
    const score   = anime.score    ? `⭐ ${anime.score}`       : ''
    const eps     = anime.episodes ? `· ${anime.episodes} eps` : ''
    const status  = anime.status   || ''
    const synopsis = anime.synopsis
        ? escHtml(anime.synopsis.slice(0, 180)) + '…'
        : '<em style="opacity:0.5;">No synopsis available.</em>'
    const img = anime.images?.jpg?.image_url
        || anime.images?.webp?.image_url || ''

    // Embed full anime JSON for fallback detail view
    const safeJson = escHtml(JSON.stringify(anime))

    return `
    <div class="news-card mal-card"
         data-mal-id="${anime.mal_id}"
         data-anime="${safeJson}"
         style="display:flex;gap:14px;align-items:flex-start;cursor:pointer;">
      ${img
        ? `<img src="${escHtml(img)}" alt=""
             style="width:54px;height:76px;object-fit:cover;
                    border-radius:6px;flex-shrink:0;opacity:0.90;">`
        : ''}
      <div style="flex:1;min-width:0;">
        <div class="news-card-source">
          ${escHtml(anime.type || 'Anime')} ${eps} ${score}
        </div>
        <div class="news-card-title">${escHtml(anime.title || '')}</div>
        <div class="news-card-summary">${synopsis}</div>
        <div class="news-card-time">${escHtml(status)}</div>
      </div>
    </div>`
}

// ── MAL in-app detail view ────────────────────────────────
function showAnimeDetail (anime) {
    const img     = anime.images?.jpg?.large_image_url
        || anime.images?.jpg?.image_url || ''
    const score   = anime.score    ? `⭐ ${anime.score}`    : 'N/A'
    const eps     = anime.episodes ? `${anime.episodes} eps` : '?'
    const status  = anime.status   || '—'
    const aired   = anime.aired?.string || '—'
    const genres  = anime.genres?.map(g => g.name).join(', ')  || '—'
    const studios = anime.studios?.map(s => s.name).join(', ') || '—'
    const syn     = anime.synopsis || 'No synopsis available.'
    const trailer = anime.trailer?.embed_url || null

    malOutput.innerHTML = `
    <div class="glass-card">

      <!-- Back button -->
      <div class="card-heading"
           style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span id="mal-back"
              style="cursor:pointer;opacity:0.65;font-size:14px;
                     letter-spacing:0.1em;transition:opacity 0.2s;"
              onmouseover="this.style.opacity=1"
              onmouseout="this.style.opacity=0.65">
          ← Back to results
        </span>
        <span>${escHtml(anime.title || '')}</span>
      </div>

      <div class="card-body">

        <!-- Cover + meta -->
        <div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;">

          ${img
        ? `<img src="${escHtml(img)}" alt="${escHtml(anime.title || '')}"
                 style="width:170px;height:240px;object-fit:cover;
                        border-radius:10px;border:1px solid var(--border);
                        flex-shrink:0;box-shadow:0 8px 32px rgba(0,0,0,0.5);">`
        : ''}

          <div style="flex:1;min-width:200px;">

            <!-- Badges -->
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
              <span class="badge">${escHtml(anime.type || 'Anime')}</span>
              <span class="badge">${escHtml(status)}</span>
              <span class="badge">${score}</span>
              <span class="badge">${eps}</span>
            </div>

            <!-- Detail rows -->
            <div class="detail-row">
              <span class="detail-label">Aired</span>
              <span>${escHtml(aired)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Genres</span>
              <span>${escHtml(genres)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Studios</span>
              <span>${escHtml(studios)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rating</span>
              <span>${escHtml(anime.rating || '—')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rank</span>
              <span>#${anime.rank || '—'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Popularity</span>
              <span>#${anime.popularity || '—'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Members</span>
              <span>${anime.members?.toLocaleString() || '—'}</span>
            </div>

          </div>
        </div>

        <!-- Synopsis -->
        <div style="margin-top:20px;font-size:17px;
                    line-height:1.85;color:var(--text-mid);">
          ${escHtml(syn)}
        </div>

        <!-- Trailer embed (in-app) -->
        ${trailer ? `
        <div style="margin-top:24px;">
          <div class="card-heading"
               style="font-size:15px;margin-bottom:12px;">
            🎬 Trailer
          </div>
          <iframe src="${escHtml(trailer)}"
            style="width:100%;height:340px;
                   border:1px solid var(--border);
                   border-radius:10px;"
            allowfullscreen frameborder="0"
            allow="autoplay; encrypted-media">
          </iframe>
        </div>` : ''}

      </div>
    </div>`

    // Back → re-run the last search
    $('mal-back').addEventListener('click', () => searchMAL(malInput.value))
}

// ═══════════════════════════════════════════════════════════
//  3. API STATUS
// ═══════════════════════════════════════════════════════════

function setApiStatus (online) {
    apiDot.style.background = online ? '#4ade80' : '#f87171'
    apiDot.style.boxShadow  = online
        ? '0 0 8px rgba(74,222,128,0.80)'
        : '0 0 8px rgba(248,113,113,0.80)'
    apiStatus.textContent = online ? 'Rails API' : 'API offline'
    if (settingsBadge) settingsBadge.textContent = online ? 'Connected' : 'Offline'
}

// ═══════════════════════════════════════════════════════════
//  4. NEWS
// ═══════════════════════════════════════════════════════════

async function checkHealth () {
    btnHealth.textContent = 'Checking…'
    btnHealth.disabled    = true
    const result = await API.get('/api/health')
    setApiStatus(result.ok)
    btnHealth.textContent = 'Check Health'
    btnHealth.disabled    = false
    return result.ok
}

async function loadNews () {
    newsList.innerHTML  = loading('Summoning news from the archive…')
    btnNews.disabled    = true
    btnNews.textContent = 'Loading…'

    const result = await API.get('/api/news')

    if (!result.ok) {
        newsList.innerHTML = emptyState(
            '❄️',
            'Could not reach the Rails API.<br>Make sure <code>rails s</code> is running.',
            '"Even the greatest mage cannot conjure what is not there."'
        )
        setApiStatus(false)
    } else {
        const articles = Array.isArray(result.data) ? result.data : []

        if (articles.length === 0) {
            newsList.innerHTML = emptyState(
                '🌿',
                'No articles in the archive yet.',
                '"A quiet world is still a world worth wandering."'
            )
        } else {
            newsList.innerHTML = articles.map(newsCardHTML).join('')

            // News cards open article in OS default browser
            newsList.querySelectorAll('.news-card[data-url]').forEach(card => {
                card.addEventListener('click', () => {
                    const url = card.dataset.url
                    if (url) window.open(url, '_blank')
                })
            })
        }
        setApiStatus(true)
    }

    btnNews.disabled    = false
    btnNews.textContent = 'Load News'
}

// ═══════════════════════════════════════════════════════════
//  5. MYANIME LIST / JIKAN — search + in-app detail
// ═══════════════════════════════════════════════════════════

async function searchMAL (query) {
    if (!query.trim()) return
    if (malEmpty) malEmpty.style.display = 'none'
    malOutput.innerHTML = loading('Searching the Grimoire…')

    const sfw    = localStorage.getItem('sfw_filter') === 'true'
    const url    = `/api/anime/search?q=${encodeURIComponent(query.trim())}&sfw=${sfw}`
    const result = await API.get(url)

    if (!result.ok) {
        malOutput.innerHTML = emptyState(
            '❄️',
            'Anime search failed. Make sure the Rails API is running.',
            '"Not every tome is open to those who seek it."'
        )
        setApiStatus(false)
        return
    }

    const list = result.data?.data || result.data || []

    if (list.length === 0) {
        malOutput.innerHTML = emptyState(
            '📖',
            'No results found for that title.',
            '"Not all knowledge is written in the grimoires of this world."'
        )
    } else {
        malOutput.innerHTML =
            `<div class="news-list">${list.map(malCardHTML).join('')}</div>`

        // Click card → show in-app detail view
        malOutput.querySelectorAll('.mal-card').forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.dataset.malId
                if (!id) return

                malOutput.innerHTML = loading('Opening grimoire entry…')

                // Fetch full details from Jikan via Rails
                const detail = await API.get(`/api/anime/${id}`)

                if (detail.ok && detail.data && Object.keys(detail.data).length) {
                    showAnimeDetail(detail.data)
                } else {
                    // Fallback — use search result data already on card
                    try {
                        showAnimeDetail(JSON.parse(card.dataset.anime || '{}'))
                    } catch {
                        malOutput.innerHTML = emptyState('❄️', 'Could not load details.', '')
                    }
                }
            })
        })
    }

    setApiStatus(true)
}

// ═══════════════════════════════════════════════════════════
//  6. DUCKDUCKGO — full in-app webview browser
//     Unrestricted — kae=d (dark), k1=-1 (no ads)
// ═══════════════════════════════════════════════════════════

function ddgSearch (query) {
    if (!query.trim()) return
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query.trim())}&kae=d&k1=-1`
    ddgWebview.src = url
}

// Webview browser controls
if (ddgWebview) {
    ddgBack.addEventListener('click',    () => ddgWebview.goBack())
    ddgForward.addEventListener('click', () => ddgWebview.goForward())
    ddgReload.addEventListener('click',  () => ddgWebview.reload())

    // Sync address bar input with current webview URL
    ddgWebview.addEventListener('did-navigate', e => {
        try {
            const url = new URL(e.url)
            const q   = url.searchParams.get('q')
            if (q) ddgInput.value = decodeURIComponent(q)
        } catch { /* non-DDG page, ignore */ }
    })
}

// ═══════════════════════════════════════════════════════════
//  7. SETTINGS — SFW TOGGLE
// ═══════════════════════════════════════════════════════════

if (sfwToggle) {
    // Restore saved preference on load
    sfwToggle.checked = localStorage.getItem('sfw_filter') === 'true'

    sfwToggle.addEventListener('change', () => {
        localStorage.setItem('sfw_filter', sfwToggle.checked)
        console.log(`[Settings] SFW filter: ${sfwToggle.checked ? 'ON ✅' : 'OFF ❌'}`)
    })
}

// ═══════════════════════════════════════════════════════════
//  8. EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

// Global header search → DDG webview (Enter)
globalSearch.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return
    const q = globalSearch.value.trim()
    if (!q) return
    window.navigateTo('search')
    ddgInput.value = q
    ddgSearch(q)
    globalSearch.value = ''
})

// Health + News
btnHealth.addEventListener('click', checkHealth)
btnNews.addEventListener('click',   loadNews)

// DDG toolbar
ddgBtn.addEventListener('click', () => ddgSearch(ddgInput.value))
ddgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') ddgSearch(ddgInput.value)
})

// MAL
malBtn.addEventListener('click', () => searchMAL(malInput.value))
malInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchMAL(malInput.value)
})

// Ctrl+K → focus global search from anywhere
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        globalSearch.focus()
    }
})

// IPC nav — Ctrl+1…5 from main.js menu
if (window.api?.onNav) {
    window.api.onNav(section => window.navigateTo(section))
}

// ═══════════════════════════════════════════════════════════
//  9. BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════
;(async () => {
    setApiStatus(false)
    apiStatus.textContent = 'Connecting…'
    await checkHealth()
})()
