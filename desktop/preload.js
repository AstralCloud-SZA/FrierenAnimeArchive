const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('frieren', {
    async getHealth() {
        const response = await fetch('http://localhost:3000/api/health')
        return response.json()
    },
    async getNews() {
        const response = await fetch('http://localhost:3000/api/news')
        return response.json()
    }
})

