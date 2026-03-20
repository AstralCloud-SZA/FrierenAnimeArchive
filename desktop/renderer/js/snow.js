const canvas = document.getElementById("snow-canvas")
const ctx = canvas.getContext("2d")
const flakes = []

function resizeCanvas() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
}

resizeCanvas()
window.addEventListener("resize", resizeCanvas)

for (let i = 0; i < 80; i++) {
    flakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.8 + 0.4,
        dx: (Math.random() - 0.5) * 0.3,
        dy: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.5 + 0.15
    })
}

function drawSnow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    flakes.forEach(f => {
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(212, 216, 226, ${f.opacity})`
        ctx.fill()
        f.x += f.dx
        f.y += f.dy
        if (f.y > canvas.height) { f.y = -5; f.x = Math.random() * canvas.width }
        if (f.x > canvas.width) f.x = 0
        if (f.x < 0) f.x = canvas.width
    })
    requestAnimationFrame(drawSnow)
}

drawSnow()
