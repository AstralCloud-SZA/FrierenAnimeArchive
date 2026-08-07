/* ============================================================
   nav.js — Section navigation + keyboard shortcuts + title bar
============================================================ */

const SECTIONS = {
    news:      { label: 'News',         el: null },
    mal:       { label: 'MyAnimeList',  el: null },
    search:    { label: 'Quick Search', el: null },
    favorites: { label: 'Favourites',   el: null },
    anime:     { label: 'Watch Anime',  el: null },
    manga:     { label: 'Read Manga',   el: null },
    settings:  { label: 'Settings',     el: null }
}

// ── Webviews that must not load their src while hidden ────────
// Loading src while display:none gives the guest page a 0×0
// viewport at layout time, causing the "small area / flat
// color box" bug. Defer src assignment until first activation.
const WEBVIEW_DEFERRED = {
    anime: 'anime-webview',
    manga: 'manga-webview'
}

// ── Webviews present in each section, for the resize nudge ────
// (news + search webviews load eagerly / on-demand already,
// but still benefit from a resize nudge on tab switch)
const WEBVIEW_MAP = {
    news:   'news-webview',
    search: 'ddg-webview',
    anime:  'anime-webview',
    manga:  'manga-webview'
}

let currentSection = 'news'

function activateSectionWebview (key)
{
    const webviewId = WEBVIEW_MAP[key]
    if (!webviewId) return

    const webview = document.getElementById(webviewId)
    if (!webview) return

    // Deferred load — only assign src the first time this
    // section becomes visible, so the guest page never computes
    // layout against a 0×0 hidden container.
    const deferredId = WEBVIEW_DEFERRED[key]
    if (deferredId === webviewId && webview.dataset.src && webview.getAttribute('src') === 'about:blank')
    {
        webview.src = webview.dataset.src
    }

    // Nudge the guest page to recompute layout now that its
    // container is visible at full size. Handles cases where
    // the webview was already loaded but sized incorrectly
    // while hidden (e.g. window resized while on another tab).
    requestAnimationFrame(() =>
    {
        webview.executeJavaScript?.('window.dispatchEvent(new Event("resize"));').catch(() => {})
    })
}

function navigateTo (key)
{
    if (!SECTIONS[key]) return

    // Hide all sections
    Object.keys(SECTIONS).forEach(k =>
    {
        const el = document.getElementById(`section-${k}`)
        if (el) el.classList.remove('visible')
    })

    // Show target
    const target = document.getElementById(`section-${key}`)
    if (target) target.classList.add('visible')

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item =>
    {
        item.classList.toggle('active', item.dataset.section === key)
    })

    // Update breadcrumb
    const pageNameEl = document.getElementById('page-name')
    if (pageNameEl) pageNameEl.textContent = SECTIONS[key].label

    currentSection = key

    // Fix webview layout/load timing for this section
    activateSectionWebview(key)
}

// Sidebar click
document.querySelectorAll('.nav-item').forEach(item =>
{
    item.addEventListener('click', () => navigateTo(item.dataset.section))
})

// Menu shortcuts from main process
if (window.api?.onNav)
{
    window.api.onNav(section => navigateTo(section))
}

// Keyboard shortcuts within renderer
document.addEventListener('keydown', e =>
{
    if (e.ctrlKey) {
        const map = {
            '1': 'news',
            '2': 'mal',
            '3': 'search',
            '4': 'favorites',
            '5': 'anime',
            '6': 'manga',
            '7': 'settings'
        }
        if (map[e.key]) { e.preventDefault(); navigateTo(map[e.key]) }
    }
    if (e.ctrlKey && e.key === 'k')
    {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
    }
})

// ── Resize whole window while a webview tab is active ─────────
window.addEventListener('resize', () =>
{
    const webviewId = WEBVIEW_MAP[currentSection]
    if (!webviewId) return
    const webview = document.getElementById(webviewId)
    webview?.executeJavaScript?.('window.dispatchEvent(new Event("resize"));').catch(() => {})
})

// ── Custom title bar controls ────────────────────────────────
document.getElementById('tb-min')?.addEventListener('click',   () => window.api.winMinimize())
document.getElementById('tb-max')?.addEventListener('click',   () => window.api.winMaximize())
document.getElementById('tb-close')?.addEventListener('click', () => window.api.winClose())

// Swap ▢ ↔ ❐ icon based on maximise state
window.api?.onWinMaximized(isMax =>
{
    const btn = document.getElementById('tb-max')
    if (btn) btn.innerHTML = isMax ? '&#10697;' : '&#9633;'
})

// Expose for app.js
window.navigateTo = navigateTo