/* ============================================================
   nav.js — Section navigation + keyboard shortcuts + title bar
============================================================ */

const SECTIONS = {
    news:      { label: 'News',         el: null },
    mal:       { label: 'MyAnimeList',  el: null },
    search:    { label: 'Quick Search', el: null },
    favorites: { label: 'Favourites',   el: null },
    anime:     { label: 'Watch Anime',  el: null },
    settings:  { label: 'Settings',     el: null }
}

let currentSection = 'news'

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
            '6': 'settings'
        }
        if (map[e.key]) { e.preventDefault(); navigateTo(map[e.key]) }
    }
    if (e.ctrlKey && e.key === 'k')
    {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
    }
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
