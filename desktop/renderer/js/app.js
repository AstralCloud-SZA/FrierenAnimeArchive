const apiDot    = document.getElementById("api-dot")
const apiStatus = document.getElementById("api-status")

async function checkHealth() {
    try {
        const data = await window.frieren.getHealth()
        apiDot.style.background = "#4ade80"
        apiStatus.textContent = "Rails API ✓"
        switchSection("news")
        document.getElementById("news-list").innerHTML = `
      <div class="glass-card">
        <div class="card-heading">Health Response</div>
        <pre class="console-out">${JSON.stringify(data, null, 2)}</pre>
      </div>`
    } catch (e) {
        apiDot.style.background = "#f87171"
        apiStatus.textContent = "API offline"
    }
}

async function loadNews() {
    try {
        const articles = await window.frieren.getNews()
        switchSection("news")
        const list = document.getElementById("news-list")
        if (!articles.length) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">🌿</div><p>No articles found.</p></div>`
            return
        }
        list.innerHTML = articles.map(a => `
      <div class="news-card">
        <div class="news-card-source">Rails API · Sample</div>
        <div class="news-card-title">${a.title}</div>
        <div class="news-card-summary">${a.summary}</div>
        <div class="news-card-time">${new Date(a.published_at).toLocaleString()}</div>
      </div>`).join("")
    } catch (e) {
        document.getElementById("news-list").innerHTML =
            `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Could not load news.<br>Is Rails running on localhost:3000?</p></div>`
    }
}

document.getElementById("btn-health").addEventListener("click", checkHealth)
document.getElementById("btn-news").addEventListener("click", loadNews)

document.getElementById("ddg-btn").addEventListener("click", () => {
    const q = document.getElementById("ddg-input").value
    if (!q) return
    document.getElementById("ddg-output").innerHTML =
        `<div class="glass-card"><div class="card-body">DuckDuckGo → Rails <code>/api/search/web?q=${encodeURIComponent(q)}</code> coming next.</div></div>`
})

window.addEventListener("DOMContentLoaded", () => setTimeout(checkHealth, 600))
