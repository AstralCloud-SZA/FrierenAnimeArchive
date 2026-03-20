const pageNameEl = document.getElementById("page-name")

const sections = {
    news:      document.getElementById("section-news"),
    mal:       document.getElementById("section-mal"),
    search:    document.getElementById("section-search"),
    favorites: document.getElementById("section-favorites"),
    settings:  document.getElementById("section-settings")
}

const sectionLabels = {
    news:      "News",
    mal:       "MyAnimeList",
    search:    "Quick Search",
    favorites: "Favourites",
    settings:  "Settings"
}

function switchSection(name) {
    Object.values(sections).forEach(s => s.classList.remove("visible"))
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"))
    sections[name].classList.add("visible")
    document.querySelector(`[data-section="${name}"]`).classList.add("active")
    pageNameEl.textContent = sectionLabels[name]
}

document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => switchSection(item.dataset.section))
})

// Global search → switch to search tab
document.getElementById("global-search").addEventListener("keydown", e => {
    if (e.key === "Enter") {
        document.getElementById("ddg-input").value = e.target.value
        switchSection("search")
    }
})
