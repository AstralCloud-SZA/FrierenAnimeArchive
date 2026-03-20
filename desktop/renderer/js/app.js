/* ============================================================
   app.js — Main application logic
   Connects UI to Rails API via window.api (preload bridge)
============================================================ */

const API = window.api   // injected by preload.js

// ── DOM refs ──────────────────────────────────────────────
const $ = id => document.getElementById(id)

const apiDot        = $('api-dot')
const apiStatus     = $('api-status')
const settingsBadge = $('settings-api-badge')
const newsList      = $('news-list')
const btnHealth     = $('btn-health')
const btnNews       = $('btn-news')
const globalSearch  = $('global-search')
const ddgInput      = $('ddg-input')
const ddgBtn        = $('ddg-btn')
const ddgOutput     = $('ddg-output')
const malInput      = $('mal-input')
const malBtn        = $('mal-btn')
const malOutput     = $('mal-output')
const malEmpty      = $('mal-empty')

// ── Helpers ───────────────────────────────────────────────
function setApiStatus (online) {
    apiDot.style.background    = online ? '#4ade80' : '#f87171'
    apiDot.style.boxShadow     = online
        ? '0 0 8px rgba(74,222,128,0.80)'
        : '0 0 8px rgba(248,113,113,0.80)'
    apiStatus.textContent      = online ? 'Rails API' : 'API offline'
    if (settingsBadge) settingsBadge.textContent = online ? 'Connected' : 'Offline'
}

function newsCardHTML (article) {
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('en-ZA', {
            day: 'numeric', month: 'short', year: 'numeric'
        })
        : '—'

    return `
    <div class="news-card" data-url="${escHtml(article.url || '')}">
      <div class="news-card-source">${escHtml(article.source_name || 'Archive')}</div>
      <div class="news-card-title">${escHtml(article.title || 'Untitled')}</div>
      <div class="news-card-summary">${escHtml(article.summary || '')}</div>
      <div class="news-card-time">${date}</div>
    </div>
  `
}

function malCardHTML (anime) {
    const score  = anime.score ? `⭐ ${anime.score}` : ''
    const eps    = anime.episodes ? `· ${anime.episodes} eps` : ''
    const status = anime.status || ''
    return `
    <div class="news-card" data-mal-id="${anime.mal_id}">
      <div class="news-card-source">
        ${escHtml(anime.type || 'Anime')} ${eps} ${score}
      </div>
      <div class="news-card-title">${escHtml(anime.title || '')}</div>
      <div class="news-card-summary">${escHtml(anime.synopsis ? anime.synopsis.slice(0, 160) + '…' : '')}</div>
      <div class="news-card-time">${escHtml(status)}</div>
    </div>
  `
}

function ddgResultHTML (data) {
    if (!data.Abstract && !data.Heading && (!data.Results || data.Results.length === 0)) {
        return glassCard('🔮 No instant answer found',
            'DuckDuckGo has no instant answer for this query. Try rewording it.')
    }
    const heading  = data.Heading || ''
    const abstract = data.Abstract || ''
    const img      = data.Image
        ? `<img src="${escHtml(data.Image)}"
             style="max-height:80px;border-radius:8px;margin-bottom:10px;opacity:0.85;" /><br>`
        : ''
    const link = data.AbstractURL
        ? `<a href="${escHtml(data.AbstractURL)}"
           style="color:var(--teal-bright);font-family:var(--font-body);font-size:16px;"
           target="_blank">Open source ↗</a>`
        : ''
    let related = ''
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const items = data.RelatedTopics.slice(0, 5)
            .filter(t => t.Text)
            .map(t => `<li style="margin-bottom:6px;color:var(--text-mid);font-size:16px;">${escHtml(t.Text)}</li>`)
            .join('')
        related = items
            ? `<div style="margin-top:14px;">
           <div style="font-family:var(--font-title);font-size:13px;
                       letter-spacing:0.15em;color:var(--gold);margin-bottom:6px;">
             Related Topics
           </div>
           <ul style="list-style:none;padding:0;">${items}</ul>
         </div>`
            : ''
    }
    return glassCard(
        `🔮 ${escHtml(heading) || 'Result'}`,
        `${img}${escHtml(abstract)}${link ? '<br><br>' + link : ''}${related}`
    )
}

function glassCard (heading, bodyHTML) {
    return `
    <div class="glass-card">
      <div class="card-heading">${heading}</div>
      <div class="card-body" style="font-size:16px;line-height:1.75;">${bodyHTML}</div>
    </div>
  `
}

function emptyState (icon, msg, quote) {
    return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <p>${msg}</p>
      ${quote ? `<em>${escHtml(quote)}</em>` : ''}
    </div>
  `
}

function escHtml (str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function loading (msg = 'Casting spell…') {
    return `
    <div class="empty-state">
      <div class="empty-icon" style="animation:orb-pulse 1.2s ease-in-out infinite;">🔮</div>
      <p>${msg}</p>
    </div>
  `
}

// ── Health check ──────────────────────────────────────────
async function checkHealth () {
    btnHealth.textContent = 'Checking…'
    btnHealth.disabled    = true
    const result = await API.get('/api/health')
    setApiStatus(result.ok)
    btnHealth.textContent = 'Check Health'
    btnHealth.disabled    = false
    return result.ok
}

// ── Load news ─────────────────────────────────────────────
async function loadNews () {
    newsList.innerHTML = loading('Summoning news from the archive…')
    btnNews.disabled   = true
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
        const articles = result.data || []
        if (articles.length === 0) {
            newsList.innerHTML = emptyState(
                '🌿',
                'No articles in the archive yet.',
                '"A quiet world is still a world worth wandering."'
            )
        } else {
            newsList.innerHTML = articles.map(newsCardHTML).join('')
            // Click → open article URL externally
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

// ── DuckDuckGo search ─────────────────────────────────────
async function searchDDG (query) {
    if (!query.trim()) return
    ddgOutput.innerHTML = loading('Searching the world…')
    const result = await API.get(`/api/search/web?q=${encodeURIComponent(query.trim())}`)

    if (!result.ok) {
        ddgOutput.innerHTML = emptyState(
            '❄️',
            'Search failed. Make sure the Rails API is running.',
            '"Some things remain hidden, no matter how long you search."'
        )
        setApiStatus(false)
    } else {
        ddgOutput.innerHTML = ddgResultHTML(result.data)
        setApiStatus(true)
    }
}

// ── MyAnimeList / Jikan search ────────────────────────────
async function searchMAL (query) {
    if (!query.trim()) return
    malEmpty.style.display  = 'none'
    malOutput.innerHTML = loading('Searching the Grimoire…')

    const result = await API.get(`/api/anime/search?q=${encodeURIComponent(query.trim())}`)

    if (!result.ok) {
        malOutput.innerHTML = emptyState(
            '❄️',
            'Anime search failed. Make sure the Rails API is running.',
            '"Not every tome is open to those who seek it."'
        )
        setApiStatus(false)
    } else {
        const list = result.data?.data || result.data || []
        if (list.length === 0) {
            malOutput.innerHTML = emptyState('📖', 'No results found for that title.', '')
        } else {
            malOutput.innerHTML = `<div class="news-list">${list.map(malCardHTML).join('')}</div>`
        }
        setApiStatus(true)
    }
}

// ── Global search bar (top header) ───────────────────────
globalSearch.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return
    const q = globalSearch.value.trim()
    if (!q) return
    window.navigateTo('search')
    ddgInput.value = q
    searchDDG(q)
    globalSearch.value = ''
})

// ── Button events ─────────────────────────────────────────
btnHealth.addEventListener('click', checkHealth)
btnNews.addEventListener('click', loadNews)

ddgBtn.addEventListener('click', () => searchDDG(ddgInput.value))
ddgInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchDDG(ddgInput.value) })

malBtn.addEventListener('click', () => searchMAL(malInput.value))
malInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchMAL(malInput.value) })

// ── Boot sequence ─────────────────────────────────────────
;(async () => {
    // Show offline state immediately, then check
    setApiStatus(false)
    apiStatus.textContent = 'Connecting…'
    await checkHealth()
})()
