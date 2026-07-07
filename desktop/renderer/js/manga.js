// ═══════════════════════════════════════════════════════════
//  Frieren Archive — Manga Section
//  Handles: search → Rails API → webview load, local history
// ═══════════════════════════════════════════════════════════

(function ()
{
    const mangaInput   = document.getElementById('manga-input')
    const mangaBtn      = document.getElementById('manga-btn')
    const mangaWebview  = document.getElementById('manga-webview')

    if (!mangaInput || !mangaBtn || !mangaWebview) return // section not on this page

    // ── Fetch manga URL from Rails and load it ──────────────
    async function loadManga(query)
    {
        try
        {
            const res  = await fetch(`http://localhost:3001/api/anime/manga?q=${encodeURIComponent(query)}`)
            const json = await res.json()

            if (json.error)
            {
                console.error('Manga error:', json.error)
                return
            }

            mangaWebview.src = json.data.url
            saveMangaHistory(query, json.data.url)
        } catch (err)
        {
            console.error('Manga load failed:', err)
        }
    }

    // ── Local history (localStorage) ────────────────────────
    function saveMangaHistory(title, url)
    {
        const history = JSON.parse(localStorage.getItem('mangaHistory') || '[]')
        history.unshift({ title, url, ts: Date.now() })
        localStorage.setItem('mangaHistory', JSON.stringify(history.slice(0, 20)))
        renderMangaHistory()
    }

    function renderMangaHistory()
    {
        const history = JSON.parse(localStorage.getItem('mangaHistory') || '[]')
        const list = document.getElementById('manga-history-list')
        if (!list) return

        if (history.length === 0)
        {
            list.innerHTML = `<div class="empty-state"><p>No manga read yet.</p></div>`
            return
        }

        list.innerHTML = history.map(h => `<div class="news-item" data-url="${h.url}">${h.title}</div>`).join('')

        list.querySelectorAll('.news-item').forEach(el => {el.addEventListener('click', () => { mangaWebview.src = el.dataset.url })})
    }

    // ── Event listeners ──────────────────────────────────────
    mangaBtn.addEventListener('click', () => {
        const q = mangaInput.value.trim()
        if (q) loadManga(q)
    })

    mangaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') mangaBtn.click()
    })

    document.getElementById('manga-back')?.addEventListener('click', () => mangaWebview.goBack())
    document.getElementById('manga-forward')?.addEventListener('click', () => mangaWebview.goForward())
    document.getElementById('manga-reload')?.addEventListener('click', () => mangaWebview.reload())

    // ── Init ──────────────────────────────────────────────────
    renderMangaHistory()
})()
