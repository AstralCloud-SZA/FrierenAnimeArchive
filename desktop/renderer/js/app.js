/* ============================================================
   renderer/js/app.js — Main application logic
   Connects UI to Rails API via window.api (preload bridge)
   Connects sound UI to FMOD via window.sound (preload bridge)

   Sections:
     1.  Constants + DOM refs
     2.  UI helpers (cards, states, escaping)
     3.  Sound helpers + settings
     4.  API status
     5.  News — load, in-app reader, star/save
     6.  MAL search + in-app detail + star/save
     7.  Favourites — render, tabs, remove
     8.  DuckDuckGo in-app webview browser
     9.  Watch Anime — 9Anime webview
     10. Settings (SFW toggle + audio)
     11. Event listeners
     12. Boot sequence
============================================================ */

const API   = window.api
const SOUND = window.sound || null

// ═══════════════════════════════════════════════════════════
//  1. DOM REFS
// ═══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id)

const apiDot          = $('api-dot')
const apiStatus       = $('api-status')
const settingsBadge   = $('settings-api-badge')
const newsList        = $('news-list')
const newsReader      = $('news-reader')
const newsReaderBack  = $('news-reader-back')
const newsReaderTitle = $('news-reader-title')
const newsWebview     = $('news-webview')
const btnHealth       = $('btn-health')
const btnNews         = $('btn-news')
const globalSearch    = $('global-search')
const malInput        = $('mal-input')
const malBtn          = $('mal-btn')
const malOutput       = $('mal-output')
const malEmpty        = $('mal-empty')
const sfwToggle       = $('sfw-toggle')
const ddgInput        = $('ddg-input')
const ddgBtn          = $('ddg-btn')
const ddgWebview      = $('ddg-webview')
const ddgBack         = $('ddg-back')
const ddgForward      = $('ddg-forward')
const ddgReload       = $('ddg-reload')
const animeWebview    = $('anime-webview')
const animeBack       = $('anime-back')
const animeForward    = $('anime-forward')
const animeReload     = $('anime-reload')

// Optional future settings controls if you add them in HTML:
// <input id="music-volume" type="range" min="0" max="100">
// <input id="master-volume" type="range" min="0" max="100">
// <input id="mute-all-toggle" type="checkbox">
const musicVolumeSlider = $('music-volume')
const masterVolumeSlider = $('master-volume')
const muteAllToggle = $('mute-all-toggle')

// ═══════════════════════════════════════════════════════════
//  2. UI HELPERS
// ═══════════════════════════════════════════════════════════

function escHtml (str)
{
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
}

function unescHtml (str)
{
    return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
}

function glassCard (heading, bodyHTML)
{
    return `
    <div class="glass-card">
      <div class="card-heading">${heading}</div>
      <div class="card-body" style="font-size:16px;line-height:1.75;">${bodyHTML}</div>
    </div>`
}

function emptyState (icon, msg, quote = '')
{
    return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <p>${msg}</p>
      ${quote ? `<em>${escHtml(quote)}</em>` : ''}
    </div>`
}

function loading (msg = 'Casting spell…')
{
    return `
    <div class="empty-state">
      <div class="empty-icon"
           style="animation:orb-pulse 1.2s ease-in-out infinite;">🔮</div>
      <p>${msg}</p>
    </div>`
}

// ── Plain text → HTML paragraphs ──────────────────────────
function plainToHtml (text)
{
    if (!text) return ''
    const patched = text.replace(/<img(\s)/gi, '<img referrerpolicy="no-referrer"$1')
    if (/<[a-z][\s\S]*>/i.test(patched)) return patched
    return patched
        .split(/\n{2,}/)
        .filter(p => p.trim())
        .map(p => `<p style="margin:0 0 1em 0;">${p.replace(/\n/g, '<br>')}</p>`)
        .join('')
}

// ═══════════════════════════════════════════════════════════
//  3. SOUND HELPERS + SETTINGS
// ═══════════════════════════════════════════════════════════

const AUDIO_ENABLED_KEY       = 'audio_enabled'
const AUDIO_MASTER_VOLUME_KEY = 'audio_master_volume'
const AUDIO_MUSIC_VOLUME_KEY  = 'audio_music_volume'
const AUDIO_MUTED_KEY         = 'audio_muted'
const AUDIO_MUSIC_TRACK_KEY   = 'audio_music_track'

function clamp01 (v)
{
    const n = Number(v)
    if (Number.isNaN(n)) return 1
    return Math.max(0, Math.min(1, n))
}

function getAudioEnabled ()
{
    return localStorage.getItem(AUDIO_ENABLED_KEY) !== 'false'
}

function getMasterVolume ()
{
    return clamp01(localStorage.getItem(AUDIO_MASTER_VOLUME_KEY) ?? 1)
}

function getMusicVolume ()
{
    return clamp01(localStorage.getItem(AUDIO_MUSIC_VOLUME_KEY) ?? 0.55)
}

function getMuted ()
{
    return localStorage.getItem(AUDIO_MUTED_KEY) === 'true'
}

function setAudioEnabled (enabled)
{
    localStorage.setItem(AUDIO_ENABLED_KEY, String(!!enabled))
}

function setMasterVolumeSetting (v)
{
    localStorage.setItem(AUDIO_MASTER_VOLUME_KEY, String(clamp01(v)))
}

function setMusicVolumeSetting (v)
{
    localStorage.setItem(AUDIO_MUSIC_VOLUME_KEY, String(clamp01(v)))
}

function setMutedSetting (muted)
{
    localStorage.setItem(AUDIO_MUTED_KEY, String(!!muted))
}

async function soundInvoke (method, ...args)
{
    if (!SOUND || typeof SOUND[method] !== 'function') return null
    try
    {
        return await SOUND[method](...args)
    }
    catch (err)
    {
        console.warn(`[sound] ${method} failed:`, err?.message || err)
        return null
    }
}

async function playSfx (category)
{
    if (!getAudioEnabled() || getMuted()) return
    await soundInvoke('playSfx', category)
}

async function playMusic (name = null)
{
    if (!getAudioEnabled() || getMuted()) return
    if (name) localStorage.setItem(AUDIO_MUSIC_TRACK_KEY, name)
    await soundInvoke('playMusic', name)
}

async function stopMusic ()
{
    await soundInvoke('stopMusic')
}

async function setMasterVolume (v)
{
    const n = clamp01(v)
    setMasterVolumeSetting(n)
    await soundInvoke('setMasterVolume', n)
}

async function setMusicVolume (v)
{
    const n = clamp01(v)
    setMusicVolumeSetting(n)
    await soundInvoke('setMusicVolume', n)
}

async function setMuteAll (muted)
{
    setMutedSetting(!!muted)
    await soundInvoke('setMuteAll', !!muted)
}

async function applyAudioSettings ()
{
    await setMasterVolume(getMasterVolume())
    await setMusicVolume(getMusicVolume())
    await setMuteAll(getMuted())
}

async function ensureBackgroundMusic ()
{
    if (!getAudioEnabled() || getMuted()) return
    const alreadyPlaying = await soundInvoke('isMusicPlaying')
    if (alreadyPlaying === true) return

    const savedTrack = localStorage.getItem(AUDIO_MUSIC_TRACK_KEY)
    const tracks = await soundInvoke('listMusic')

    if (savedTrack && Array.isArray(tracks) && tracks.includes(savedTrack))
    {
        await playMusic(savedTrack)
        return
    }

    if (Array.isArray(tracks) && tracks.length > 0)
    {
        await playMusic(tracks[0])
    }
    else
    {
        await playMusic(null)
    }
}

function wireUiClickSounds ()
{
    document.addEventListener('click', e =>
    {
        const target = e.target?.closest?.('button, .fav-tab, .news-card, .mal-card, [role="button"]')
        if (!target) return
        playSfx('ui')
    })

    document.addEventListener('mouseover', e =>
    {
        const target = e.target?.closest?.('button, .fav-tab')
        if (!target) return
        if (target.dataset.soundHoverBound === '1') return
        target.dataset.soundHoverBound = '1'
        target.addEventListener('mouseenter', () => playSfx('hover'), { passive: true })
    })
}

// ═══════════════════════════════════════════════════════════
//  4. API STATUS
// ═══════════════════════════════════════════════════════════

function setApiStatus (online)
{
    apiDot.style.background = online ? '#4ade80' : '#f87171'
    apiDot.style.boxShadow  = online
        ? '0 0 8px rgba(74,222,128,0.80)'
        : '0 0 8px rgba(248,113,113,0.80)'
    apiStatus.textContent = online ? 'Rails API' : 'API offline'
    if (settingsBadge) settingsBadge.textContent = online ? 'Connected' : 'Offline'
}

// ═══════════════════════════════════════════════════════════
//  5. NEWS — load, in-app reader, star/save
// ═══════════════════════════════════════════════════════════

function newsCardHTML (article)
{
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('en-ZA', {
            day: 'numeric', month: 'short', year: 'numeric'
        })
        : '—'
    const saved    = isFavArticle(article.url)
    const safeJson = escHtml(JSON.stringify(article))
    const img      = article.image || article.thumbnail || article.image_url || ''
    const summary  = article.summary
        ? escHtml(article.summary.slice(0, 180)) + '…'
        : '<em style="opacity:0.5;">No summary available.</em>'

    return `
    <div class="news-card"
         data-url="${escHtml(article.url || '')}"
         data-article="${safeJson}"
         style="display:flex;gap:14px;align-items:flex-start;cursor:pointer;">
      ${img
        ? `<img src="${escHtml(img)}" alt=""
               referrerpolicy="no-referrer"
               style="width:54px;height:76px;object-fit:cover;
                      border-radius:6px;flex-shrink:0;opacity:0.90;">`
        : `<div style="width:54px;height:76px;flex-shrink:0;border-radius:6px;
                       background:var(--border);display:flex;align-items:center;
                       justify-content:center;font-size:22px;opacity:0.4;">📰</div>`}
      <div style="flex:1;min-width:0;">
        <div class="news-card-source"
             style="display:flex;justify-content:space-between;align-items:center;">
          <span>${escHtml(article.source_name || 'Archive')} · ${date}</span>
          <button class="fav-star-btn"
                  data-url="${escHtml(article.url || '')}"
                  title="${saved ? 'Remove from favourites' : 'Save to favourites'}"
                  style="background:none;border:none;cursor:pointer;
                         font-size:16px;color:var(--gold);
                         opacity:${saved ? 1 : 0.35};padding:0 2px;">
            ${saved ? '⭐' : '☆'}
          </button>
        </div>
        <div class="news-card-title">${escHtml(article.title || 'Untitled')}</div>
        <div class="news-card-summary">${summary}</div>
      </div>
    </div>`
}

const newsReaderOrigCard = () => newsReader.querySelector('.glass-card')

function closeNewsDetail ()
{
    const orig = newsReaderOrigCard()
    if (orig) orig.style.display = ''
    newsReader.style.display  = 'none'
    newsWebview.style.display = ''
    newsList.style.display    = 'block'
    newsWebview.src           = 'about:blank'
    const old = $('news-native-detail')
    if (old) old.remove()
    playSfx('back')
}

async function showArticleDetail (article)
{
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('en-ZA', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        : '—'
    const img = article.image || article.thumbnail || article.image_url || ''

    const orig = newsReaderOrigCard()
    if (orig) orig.style.display = 'none'
    newsWebview.style.display = 'none'
    newsWebview.src           = 'about:blank'
    newsList.style.display    = 'none'
    newsReader.style.display  = 'block'

    const old = $('news-native-detail')
    if (old) old.remove()

    const detail = document.createElement('div')
    detail.id = 'news-native-detail'
    detail.innerHTML = `
    <div class="glass-card" style="margin-top:12px;">
      <div class="card-heading"
           style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span id="news-detail-back"
              style="font-size:14px;opacity:0.65;cursor:pointer;
                     letter-spacing:0.1em;transition:opacity 0.2s;"
              onmouseover="this.style.opacity=1"
              onmouseout="this.style.opacity=0.65">← Back to News</span>
        <span style="flex:1;">${escHtml(article.title || 'Article')}</span>
      </div>
      <div class="card-body" id="news-detail-body">
        ${loading('Fetching full article…')}
      </div>
    </div>`

    newsReader.appendChild(detail)
    $('news-detail-back').addEventListener('click', () => closeNewsDetail())

    playSfx('open')

    const result = await API.get(`/api/news/content?url=${encodeURIComponent(article.url)}`)
    const body   = $('news-detail-body')

    if (result.ok && result.data?.content)
    {
        body.innerHTML = `
        <div style="display:flex;gap:22px;flex-wrap:wrap;
                    align-items:flex-start;margin-bottom:24px;">
          ${img ? `
          <img src="${escHtml(img)}" alt=""
               referrerpolicy="no-referrer"
               style="width:160px;height:220px;object-fit:cover;border-radius:10px;
                      border:1px solid var(--border);flex-shrink:0;
                      box-shadow:0 8px 32px rgba(0,0,0,0.5);">` : ''}
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
              <span class="badge">${escHtml(article.source_name || 'Archive')}</span>
              <span class="badge">${escHtml(date)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Source</span>
              <span>${escHtml(article.source_name || '—')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Published</span>
              <span>${escHtml(date)}</span>
            </div>
          </div>
        </div>

        <div id="article-full-content" class="article-full-content"
             style="font-size:16px;line-height:1.9;color:var(--silver-Kawaii);
                    border-top:1px solid var(--border);padding-top:20px;">
          ${plainToHtml(result.data.content)}
        </div>`

        detail.querySelectorAll('.article-full-content a').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault()
                const href = a.getAttribute('href')
                if (href) {
                    playSfx('open')
                    window.navigateTo('search')
                    ddgWebview.src = href
                    ddgInput.value = a.textContent || ''
                }
            })
        })

        detail.querySelectorAll('.article-full-content img').forEach(el => {
            el.style.maxWidth     = '100%'
            el.style.borderRadius = '8px'
            el.style.margin       = '12px 0'
            el.style.display      = 'block'
            el.onerror = () => {
                el.style.display = 'none'
                const placeholder = document.createElement('div')
                placeholder.style.cssText = `
                    width:100%;height:80px;border-radius:8px;margin:12px 0;
                    background:var(--glass);border:1px solid var(--border);
                    display:flex;align-items:center;justify-content:center;
                    font-size:13px;color:var(--text-dim);letter-spacing:0.08em;`
                placeholder.textContent = '🖼  Image unavailable'
                el.parentNode?.insertBefore(placeholder, el.nextSibling)
            }
        })
    }
    else
    {
        body.innerHTML = `
        <div style="display:flex;gap:22px;flex-wrap:wrap;
                    align-items:flex-start;margin-bottom:24px;">
          ${img ? `
          <img src="${escHtml(img)}" alt=""
               referrerpolicy="no-referrer"
               style="width:160px;height:220px;object-fit:cover;border-radius:10px;
                      border:1px solid var(--border);flex-shrink:0;
                      box-shadow:0 8px 32px rgba(0,0,0,0.5);">` : ''}
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
              <span class="badge">${escHtml(article.source_name || 'Archive')}</span>
              <span class="badge">${escHtml(date)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Source</span>
              <span>${escHtml(article.source_name || '—')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Published</span>
              <span>${escHtml(date)}</span>
            </div>
          </div>
        </div>

        <div class="article-full-content"
             style="font-size:16px;line-height:1.9;color:var(--silver-Kawaii);
                    border-top:1px solid var(--border);padding-top:20px;">
          ${plainToHtml(article.summary || 'No content available.')}
        </div>

        <div style="margin-top:20px;">
          <button class="search-btn" id="news-open-external"
                  style="font-size:14px;padding:10px 22px;">
            🔗 Read on ${escHtml(article.source_name || 'Source')}
          </button>
        </div>`

        $('news-open-external')?.addEventListener('click', () => {
            playSfx('open')
            window.navigateTo('search')
            ddgWebview.src = article.url
            ddgInput.value = article.title || ''
        })
    }
}

newsReaderBack?.addEventListener('click', () => closeNewsDetail())

async function checkHealth ()
{
    btnHealth.textContent = 'Checking…'
    btnHealth.disabled    = true

    playSfx('ui')

    const result = await API.get('/api/health')
    setApiStatus(result.ok)

    btnHealth.textContent = 'Check Health'
    btnHealth.disabled    = false

    if (result.ok) playSfx('success')
    else playSfx('error')

    return result.ok
}

async function loadNews ()
{
    newsList.innerHTML  = loading('Summoning news from the archive…')
    btnNews.disabled    = true
    btnNews.textContent = 'Loading…'

    newsReader.style.display = 'none'
    newsList.style.display   = 'block'

    playSfx('ui')

    const result = await API.post('/api/news/refresh')

    if (!result.ok)
    {
        newsList.innerHTML = emptyState(
            '❄️',
            'Could not reach the Rails API.<br>Make sure <code>rails s</code> is running.',
            '\"Even the greatest mage cannot conjure what is not there.\"'
        )
        setApiStatus(false)
        playSfx('error')
    }
    else
    {
        const articles = Array.isArray(result.data) ? result.data : []

        if (articles.length === 0)
        {
            newsList.innerHTML = emptyState(
                '🌿',
                'No articles in the archive yet.',
                '\"A quiet world is still a world worth wandering.\"'
            )
        }
        else
        {
            newsList.innerHTML = articles.map(newsCardHTML).join('')

            newsList.querySelectorAll('.fav-star-btn').forEach(btn =>
            {
                btn.addEventListener('click', e =>
                {
                    e.stopPropagation()
                    try
                    {
                        const card        = btn.closest('.news-card')
                        const article     = JSON.parse(unescHtml(card.dataset.article))
                        toggleFavArticle(article)
                        const now         = isFavArticle(article.url)
                        btn.textContent   = now ? '⭐' : '☆'
                        btn.style.opacity = now ? '1' : '0.35'
                        btn.title         = now ? 'Remove from favourites' : 'Save to favourites'
                        playSfx(now ? 'success' : 'back')
                    }
                    catch (err)
                    {
                        console.error('[Star] article parse error:', err)
                        playSfx('error')
                    }
                })
            })

            newsList.querySelectorAll('.news-card').forEach(card =>
            {
                card.addEventListener('click', e =>
                {
                    if (e.target.classList.contains('fav-star-btn')) return
                    try
                    {
                        const article = JSON.parse(unescHtml(card.dataset.article))
                        showArticleDetail(article)
                    }
                    catch (err)
                    {
                        console.error('[News] card parse error:', err)
                        playSfx('error')
                    }
                })
            })
        }
        setApiStatus(true)
        playSfx('success')
    }

    btnNews.disabled    = false
    btnNews.textContent = 'Load News'
}

// ═══════════════════════════════════════════════════════════
//  6. MAL SEARCH + IN-APP DETAIL + STAR/SAVE
// ═══════════════════════════════════════════════════════════

function malCardHTML (anime)
{
    const score    = anime.score    ? `⭐ ${anime.score}`        : ''
    const eps      = anime.episodes ? `· ${anime.episodes} eps` : ''
    const status   = anime.status   || ''
    const synopsis = anime.synopsis
        ? escHtml(anime.synopsis.slice(0, 180)) + '…'
        : '<em style="opacity:0.5;">No synopsis available.</em>'
    const img      = anime.images?.jpg?.image_url || anime.images?.webp?.image_url || ''
    const saved    = isFavAnime(anime.mal_id)
    const safeJson = escHtml(JSON.stringify(anime))

    return `
    <div class="news-card mal-card"
         data-mal-id="${anime.mal_id}"
         data-anime="${safeJson}"
         style="display:flex;gap:14px;align-items:flex-start;cursor:pointer;">
      ${img
        ? `<img src="${escHtml(img)}" alt=""
               referrerpolicy="no-referrer"
               style="width:54px;height:76px;object-fit:cover;
                      border-radius:6px;flex-shrink:0;opacity:0.90;">`
        : ''}
      <div style="flex:1;min-width:0;">
        <div class="news-card-source"
             style="display:flex;justify-content:space-between;align-items:center;">
          <span>${escHtml(anime.type || 'Anime')} ${eps} ${score}</span>
          <button class="fav-star-btn"
                  data-mal-id="${anime.mal_id}"
                  title="${saved ? 'Remove from favourites' : 'Save to favourites'}"
                  style="background:none;border:none;cursor:pointer;
                         font-size:16px;color:var(--gold);
                         opacity:${saved ? 1 : 0.35};padding:0 2px;">
            ${saved ? '⭐' : '☆'}
          </button>
        </div>
        <div class="news-card-title">${escHtml(anime.title || '')}</div>
        <div class="news-card-summary">${synopsis}</div>
        <div class="news-card-time">${escHtml(status)}</div>
      </div>
    </div>`
}

function showAnimeDetail (anime)
{
    const img     = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || ''
    const score   = anime.score    ? `⭐ ${anime.score}`      : 'N/A'
    const eps     = anime.episodes ? `${anime.episodes} eps` : '?'
    const status  = anime.status   || '—'
    const aired   = anime.aired?.string || '—'
    const genres  = anime.genres?.map(g => g.name).join(', ')  || '—'
    const studios = anime.studios?.map(s => s.name).join(', ') || '—'
    const syn     = anime.synopsis || 'No synopsis available.'
    const trailer = anime.trailer?.embed_url || null
    const saved   = isFavAnime(anime.mal_id)

    const videoId  = trailer?.match(/embed\/([^?&/]+)/)?.[1] || null
    const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null

    malOutput.innerHTML = `
    <div class="glass-card">
      <div class="card-heading"
           style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span id="mal-back"
              style="cursor:pointer;opacity:0.65;font-size:14px;
                     letter-spacing:0.1em;transition:opacity 0.2s;"
              onmouseover="this.style.opacity=1"
              onmouseout="this.style.opacity=0.65">← Back to results</span>
        <span style="flex:1;">${escHtml(anime.title || '')}</span>
        <button id="detail-star-btn"
                style="background:none;border:none;cursor:pointer;
                       font-size:20px;color:var(--gold);
                       opacity:${saved ? 1 : 0.4};"
                title="${saved ? 'Remove from favourites' : 'Save to favourites'}">
          ${saved ? '⭐' : '☆'}
        </button>
      </div>

      <div class="card-body">
        <div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;">
          ${img ? `
          <img src="${escHtml(img)}" alt="${escHtml(anime.title || '')}"
               referrerpolicy="no-referrer"
               style="width:170px;height:240px;object-fit:cover;
                      border-radius:10px;border:1px solid var(--border);
                      flex-shrink:0;box-shadow:0 8px 32px rgba(0,0,0,0.5);">` : ''}
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
              <span class="badge">${escHtml(anime.type || 'Anime')}</span>
              <span class="badge">${escHtml(status)}</span>
              <span class="badge">${score}</span>
              <span class="badge">${eps}</span>
            </div>
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

        <div style="margin-top:20px;font-size:17px;
                    line-height:1.85;color:var(--silver-Kawaii);">
          ${escHtml(syn)}
        </div>

        ${watchUrl ? `
        <div style="margin-top:24px;">
          <div class="card-heading" style="font-size:15px;margin-bottom:12px;">
            🎬 Trailer
          </div>
          <div style="width:100%;border-radius:10px;
                      border:1px solid var(--border);padding:20px;
                      display:flex;flex-direction:column;align-items:center;
                      justify-content:center;gap:12px;background:#020408;">
            <div style="font-size:42px;">▶</div>
            <button id="trailer-open-btn"
                    class="search-btn"
                    style="font-size:14px;padding:10px 26px;letter-spacing:0.12em;">
              Watch trailer on YouTube
            </button>
            <div style="font-size:12px;opacity:0.5;letter-spacing:0.08em;">
              Opens in your browser
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>`

    $('mal-back').addEventListener('click', () => {
        playSfx('back')
        searchMAL(malInput.value)
    })

    $('detail-star-btn').addEventListener('click', () =>
    {
        toggleFavAnime(anime)
        const now = isFavAnime(anime.mal_id)
        const btn = $('detail-star-btn')
        btn.textContent   = now ? '⭐' : '☆'
        btn.style.opacity = now ? '1' : '0.4'
        btn.title         = now ? 'Remove from favourites' : 'Save to favourites'
        playSfx(now ? 'success' : 'back')
    })

    if (watchUrl && window.api?.openExternal) {
        const btn = $('trailer-open-btn')
        if (btn) {
            btn.addEventListener('click', () =>
            {
                playSfx('open')
                window.api.openExternal(watchUrl)
            })
        }
    }
}

async function searchMAL (query)
{
    if (!query.trim()) return
    if (malEmpty) malEmpty.style.display = 'none'
    malOutput.innerHTML = loading('Searching the Grimoire…')

    playSfx('ui')

    const sfw    = localStorage.getItem('sfw_filter') === 'true'
    const url    = `/api/anime/search?q=${encodeURIComponent(query.trim())}&sfw=${sfw}`
    const result = await API.get(url)

    if (!result.ok)
    {
        malOutput.innerHTML = emptyState(
            '❄️',
            'Anime search failed. Make sure the Rails API is running.',
            '"Not every tome is open to those who seek it."'
        )
        setApiStatus(false)
        playSfx('error')
        return
    }

    const list = result.data?.data || result.data || []

    if (list.length === 0)
    {
        malOutput.innerHTML = emptyState(
            '📖',
            'No results found for that title.',
            '"Not all knowledge is written in the grimoires of this world."'
        )
    }
    else
    {
        malOutput.innerHTML =
            `<div class="news-list">${list.map(malCardHTML).join('')}</div>`

        malOutput.querySelectorAll('.mal-card').forEach(card => {
            card.querySelector('.fav-star-btn')?.addEventListener('click', e => {
                e.stopPropagation()
                try
                {
                    const anime       = JSON.parse(unescHtml(card.dataset.anime))
                    toggleFavAnime(anime)
                    const now         = isFavAnime(anime.mal_id)
                    const btn         = e.currentTarget
                    btn.textContent   = now ? '⭐' : '☆'
                    btn.style.opacity = now ? '1' : '0.35'
                    btn.title         = now ? 'Remove from favourites' : 'Save to favourites'
                    playSfx(now ? 'success' : 'back')
                }
                catch (err)
                {
                    console.error('[Star] anime parse error:', err)
                    playSfx('error')
                }
            })

            card.addEventListener('click', async e =>
            {
                if (e.target.classList.contains('fav-star-btn')) return
                const id = card.dataset.malId
                if (!id) return

                playSfx('open')
                malOutput.innerHTML = loading('Opening grimoire entry…')
                const detail = await API.get(`/api/anime/${id}`)

                if (detail.ok && detail.data && Object.keys(detail.data).length)
                {
                    showAnimeDetail(detail.data)
                }
                else
                {
                    try
                    {
                        showAnimeDetail(JSON.parse(unescHtml(card.dataset.anime)))
                    }
                    catch
                    {
                        malOutput.innerHTML = emptyState('❄️', 'Could not load details.', '')
                        playSfx('error')
                    }
                }
            })
        })
    }

    setApiStatus(true)
    playSfx('success')
}

// ═══════════════════════════════════════════════════════════
//  7. FAVOURITES — render, tabs, remove
// ═══════════════════════════════════════════════════════════

const FAV_ANIME_KEY    = 'fav_anime'
const FAV_ARTICLES_KEY = 'fav_articles'

function getFavAnime ()      { return JSON.parse(localStorage.getItem(FAV_ANIME_KEY)    || '[]') }
function getFavArticles ()   { return JSON.parse(localStorage.getItem(FAV_ARTICLES_KEY) || '[]') }
function saveFavAnime (l)    { localStorage.setItem(FAV_ANIME_KEY,    JSON.stringify(l)) }
function saveFavArticles (l) { localStorage.setItem(FAV_ARTICLES_KEY, JSON.stringify(l)) }
function isFavAnime (mal_id) { return getFavAnime().some(a => String(a.mal_id) === String(mal_id)) }
function isFavArticle (url)  { return getFavArticles().some(a => a.url === url) }

function toggleFavAnime (anime)
{
    let list = getFavAnime()
    if (isFavAnime(anime.mal_id))
    {
        list = list.filter(a => String(a.mal_id) !== String(anime.mal_id))
    }
    else
    {
        list.push({
            mal_id:   anime.mal_id,
            title:    anime.title,
            image:    anime.images?.jpg?.image_url || '',
            score:    anime.score,
            episodes: anime.episodes,
            status:   anime.status,
            type:     anime.type,
            url:      anime.url
        })
    }
    saveFavAnime(list)
    renderFavourites()
}

function toggleFavArticle (article)
{
    let list = getFavArticles()
    if (isFavArticle(article.url))
    {
        list = list.filter(a => a.url !== article.url)
    }
    else
    {
        list.push({
            title:        article.title,
            url:          article.url,
            source_name:  article.source_name,
            summary:      article.summary,
            published_at: article.published_at
        })
    }
    saveFavArticles(list)
    renderFavourites()
}

function renderFavourites ()
{
    const animeList     = $('fav-anime-list')
    const animeEmpty    = $('fav-anime-empty')
    const articlesList  = $('fav-articles-list')
    const articlesEmpty = $('fav-articles-empty')

    const anime    = getFavAnime()
    const articles = getFavArticles()

    if (anime.length === 0)
    {
        animeEmpty.style.display = 'block'
        animeList.innerHTML      = ''
    }
    else
    {
        animeEmpty.style.display = 'none'
        animeList.innerHTML = anime.map(a => `
        <div class="news-card mal-card"
             data-mal-id="${a.mal_id}"
             style="display:flex;gap:14px;align-items:flex-start;cursor:pointer;">
          ${a.image
            ? `<img src="${escHtml(a.image)}" alt=""
                   referrerpolicy="no-referrer"
                   style="width:54px;height:76px;object-fit:cover;
                          border-radius:6px;flex-shrink:0;opacity:0.90;">`
            : ''}
          <div style="flex:1;min-width:0;">
            <div class="news-card-source">
              ${escHtml(a.type || 'Anime')}
              ${a.episodes ? `· ${a.episodes} eps` : ''}
              ${a.score    ? `⭐ ${a.score}`       : ''}
            </div>
            <div class="news-card-title">${escHtml(a.title || '')}</div>
            <div class="news-card-time">${escHtml(a.status || '')}</div>
          </div>
          <button class="fav-remove-btn" data-mal-id="${a.mal_id}"
                  title="Remove from favourites"
                  style="background:none;border:none;cursor:pointer;
                         color:var(--gold);font-size:18px;opacity:0.55;
                         flex-shrink:0;align-self:center;"
                  onmouseover="this.style.opacity=1"
                  onmouseout="this.style.opacity=0.55">✕</button>
        </div>`).join('')

        animeList.querySelectorAll('.fav-remove-btn').forEach(btn =>
        {
            btn.addEventListener('click', e =>
            {
                e.stopPropagation()
                saveFavAnime(getFavAnime().filter(a => String(a.mal_id) !== String(btn.dataset.malId)))
                renderFavourites()
                playSfx('back')
            })
        })

        animeList.querySelectorAll('.mal-card').forEach(card =>
        {
            card.addEventListener('click', async e =>
            {
                if (e.target.classList.contains('fav-remove-btn')) return
                const id = card.dataset.malId
                if (!id) return
                playSfx('open')
                window.navigateTo('mal')
                if (malEmpty) malEmpty.style.display = 'none'
                malOutput.innerHTML = loading('Opening grimoire entry…')
                const detail = await API.get(`/api/anime/${id}`)
                if (detail.ok && detail.data) showAnimeDetail(detail.data)
            })
        })
    }

    if (articles.length === 0)
    {
        articlesEmpty.style.display = 'block'
        articlesList.innerHTML      = ''
    }
    else
    {
        articlesEmpty.style.display = 'none'
        articlesList.innerHTML = articles.map(a =>
        {
            const date = a.published_at
                ? new Date(a.published_at).toLocaleDateString('en-ZA',
                    { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'
            return `
            <div class="news-card"
                 data-url="${escHtml(a.url || '')}"
                 data-article="${escHtml(JSON.stringify(a))}"
                 style="cursor:pointer;">
              <div class="news-card-source">${escHtml(a.source_name || 'ANN')}</div>
              <div class="news-card-title">${escHtml(a.title || '')}</div>
              <div class="news-card-summary">${escHtml(a.summary || '')}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div class="news-card-time">${date}</div>
                <button class="fav-remove-btn"
                        data-url="${escHtml(a.url)}"
                        style="background:none;border:none;cursor:pointer;
                               color:var(--gold);font-size:18px;opacity:0.55;"
                        onmouseover="this.style.opacity=1"
                        onmouseout="this.style.opacity=0.55">✕</button>
              </div>
            </div>`
        }).join('')

        articlesList.querySelectorAll('.fav-remove-btn').forEach(btn =>
        {
            btn.addEventListener('click', e =>
            {
                e.stopPropagation()
                saveFavArticles(getFavArticles().filter(a => a.url !== btn.dataset.url))
                renderFavourites()
                playSfx('back')
            })
        })

        articlesList.querySelectorAll('.news-card').forEach(card =>
        {
            card.addEventListener('click', e =>
            {
                if (e.target.classList.contains('fav-remove-btn')) return
                try
                {
                    const article = JSON.parse(unescHtml(card.dataset.article))
                    playSfx('open')
                    window.navigateTo('news')
                    showArticleDetail(article)
                }
                catch (err)
                {
                    console.error('[Fav] article parse error:', err)
                    playSfx('error')
                }
            })
        })
    }
}

document.querySelectorAll('.fav-tab').forEach(tab =>
{
    tab.addEventListener('click', () =>
    {
        document.querySelectorAll('.fav-tab').forEach(t => t.classList.remove('active'))
        document.querySelectorAll('.fav-panel').forEach(p => p.style.display = 'none')
        tab.classList.add('active')
        $(tab.dataset.tab).style.display = 'block'
        playSfx('ui')
    })
})

// ═══════════════════════════════════════════════════════════
//  8. DUCKDUCKGO — full in-app webview
// ═══════════════════════════════════════════════════════════

function ddgSearch (query)
{
    if (!query.trim()) return
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query.trim())}&kae=d&k1=-1&kp=-2`
    ddgWebview.src = url
    playSfx('open')
}

if (ddgWebview)
{
    ddgBack?.addEventListener('click', () => {
        ddgWebview.goBack()
        playSfx('back')
    })

    ddgForward?.addEventListener('click', () => {
        ddgWebview.goForward()
        playSfx('ui')
    })

    ddgReload?.addEventListener('click', () => {
        ddgWebview.reload()
        playSfx('ui')
    })

    ddgWebview.addEventListener('did-navigate', e =>
    {
        try
        {
            const q = new URL(e.url).searchParams.get('q')
            if (q) ddgInput.value = decodeURIComponent(q)
        }
        catch { /* non-DDG URL — ignore */ }

        playSfx('ui')
    })
}

// ═══════════════════════════════════════════════════════════
//  9. WATCH ANIME — 9Anime in-app webview
// ═══════════════════════════════════════════════════════════

if (animeWebview)
{
    animeBack?.addEventListener('click', () => {
        animeWebview.goBack()
        playSfx('back')
    })

    animeForward?.addEventListener('click', () => {
        animeWebview.goForward()
        playSfx('ui')
    })

    animeReload?.addEventListener('click', () => {
        animeWebview.reload()
        playSfx('ui')
    })

    animeWebview.addEventListener('did-navigate', e =>
    {
        console.log('[9Anime] navigated to:', e.url)
        playSfx('ui')
    })

    animeWebview.addEventListener('did-fail-load', e =>
    {
        if (e.errorCode === -3) return
        console.warn('[9Anime] load failed:', e.errorDescription)
        playSfx('error')
    })
}

// ═══════════════════════════════════════════════════════════
//  10. SETTINGS — SFW TOGGLE + AUDIO
// ═══════════════════════════════════════════════════════════

if (sfwToggle)
{
    sfwToggle.checked = localStorage.getItem('sfw_filter') === 'true'
    sfwToggle.addEventListener('change', () =>
    {
        localStorage.setItem('sfw_filter', sfwToggle.checked)
        console.log(`[Settings] SFW filter: ${sfwToggle.checked ? 'ON ✅' : 'OFF ❌'}`)
        playSfx('ui')
    })
}

if (musicVolumeSlider)
{
    musicVolumeSlider.value = String(Math.round(getMusicVolume() * 100))
    musicVolumeSlider.addEventListener('input', () =>
    {
        setMusicVolume(Number(musicVolumeSlider.value) / 100)
    })
}

if (masterVolumeSlider)
{
    masterVolumeSlider.value = String(Math.round(getMasterVolume() * 100))
    masterVolumeSlider.addEventListener('input', () =>
    {
        setMasterVolume(Number(masterVolumeSlider.value) / 100)
    })
}

if (muteAllToggle)
{
    muteAllToggle.checked = getMuted()
    muteAllToggle.addEventListener('change', async () =>
    {
        await setMuteAll(muteAllToggle.checked)
        if (!muteAllToggle.checked) await ensureBackgroundMusic()
    })
}

// ═══════════════════════════════════════════════════════════
//  11. EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

globalSearch?.addEventListener('keydown', e =>
{
    if (e.key !== 'Enter') return
    const q = globalSearch.value.trim()
    if (!q) return
    playSfx('open')
    window.navigateTo('search')
    ddgInput.value = q
    ddgSearch(q)
    globalSearch.value = ''
})

btnHealth?.addEventListener('click', checkHealth)
btnNews?.addEventListener('click',   loadNews)

ddgBtn?.addEventListener('click', () => ddgSearch(ddgInput.value))
ddgInput?.addEventListener('keydown', e =>
{
    if (e.key === 'Enter') ddgSearch(ddgInput.value)
})

malBtn?.addEventListener('click', () => searchMAL(malInput.value))
malInput?.addEventListener('keydown', e =>
{
    if (e.key === 'Enter') searchMAL(malInput.value)
})

document.addEventListener('keydown', e =>
{
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        globalSearch?.focus()
        playSfx('ui')
    }
})

if (window.api?.onNav) {
    window.api.onNav(section => {
        playSfx('ui')
        window.navigateTo(section)
    })
}

// ═══════════════════════════════════════════════════════════
//  12. BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════
;(async () =>
{
    setApiStatus(false)
    apiStatus.textContent = 'Connecting…'

    wireUiClickSounds()
    await applyAudioSettings()

    const healthy = await checkHealth()
    renderFavourites()

    if (healthy)
    {
        await ensureBackgroundMusic()
    }
})()