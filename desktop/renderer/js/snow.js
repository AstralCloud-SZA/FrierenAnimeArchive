/* ============================================================
   snow.js — Frieren Magic Canvas
   ─────────────────────────────────────────────────────────
   Three layered effects:
     1. Snow      — warm gold-white drifting particles
     2. Petals    — Frieren's flower field magic, rising blooms
     3. Rune rings — expanding magic circles (gold/teal)
     4. Sparkles  — 4-point star twinkles (gold/silver)
============================================================ */

const canvas = document.getElementById('snow-canvas')
const ctx    = canvas.getContext('2d')

// ── Resize ────────────────────────────────────────────────
function resizeCanvas () {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

// ── Palette ───────────────────────────────────────────────
const GOLD_PALE  = [245, 232, 208]  // silver-hair warm
const GOLD       = [240, 208, 112]  // staff gold
const GOLD_WARM  = [253, 224, 144]  // bright staff
const TEAL       = [77,  184, 160]  // eye teal
const WHITE      = [255, 255, 250]  // robe white

function rgba(rgb, a) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`
}

// ── Helpers ───────────────────────────────────────────────
function rand   (min, max) { return Math.random() * (max - min) + min }
function randInt(min, max) { return Math.floor(rand(min, max)) }
function pick   (...arr)   { return arr[Math.floor(Math.random() * arr.length)] }

// ═══════════════════════════════════════════════════════════
//  1. SNOW PARTICLES
// ═══════════════════════════════════════════════════════════
const SNOW_COUNT = 70
const snow = []

function makeFlake () {
    return {
        x:       rand(0, canvas.width),
        y:       rand(-10, canvas.height),
        r:       rand(0.5, 2.0),
        dx:      rand(-0.25, 0.25),
        dy:      rand(0.15, 0.55),
        opacity: rand(0.12, 0.50),
        color:   pick(GOLD_PALE, GOLD_WARM, WHITE)
    }
}

for (let i = 0; i < SNOW_COUNT; i++) snow.push(makeFlake())

function stepSnow () {
    snow.forEach(f => {
        f.x += f.dx
        f.y += f.dy
        if (f.y > canvas.height + 5) { Object.assign(f, makeFlake()); f.y = -5 }
        if (f.x > canvas.width  + 5) f.x = -5
        if (f.x < -5)                f.x = canvas.width + 5
    })
}

function drawSnow () {
    snow.forEach(f => {
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fillStyle = rgba(f.color, f.opacity)
        ctx.fill()
    })
}

// ═══════════════════════════════════════════════════════════
//  2. FLOWER PETALS — Frieren's Blumen spell
// ═══════════════════════════════════════════════════════════
const PETAL_COUNT = 28
const petals = []

// Draw a single organic petal using bezier curves
function drawPetal (cx, cy, w, h, angle, color, alpha) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    // Petal: two cubic bezier curves forming an almond/leaf shape
    ctx.moveTo(0, -h / 2)
    ctx.bezierCurveTo( w / 2, -h / 4,  w / 2,  h / 4, 0,  h / 2)
    ctx.bezierCurveTo(-w / 2,  h / 4, -w / 2, -h / 4, 0, -h / 2)
    ctx.closePath()

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2)
    grad.addColorStop(0,   rgba(WHITE, 0.95))
    grad.addColorStop(0.4, rgba(color, 0.85))
    grad.addColorStop(1,   rgba(color, 0.20))
    ctx.fillStyle = grad
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.restore()
}

function makePetal () {
    return {
        x:       rand(0, canvas.width),
        y:       rand(canvas.height * 0.3, canvas.height + 20),
        w:       rand(5, 12),
        h:       rand(9, 22),
        angle:   rand(0, Math.PI * 2),
        dAngle:  rand(-0.008, 0.008),
        dx:      rand(-0.35, 0.35),
        dy:      rand(-0.55, -0.18),   // rises upward
        opacity: rand(0.30, 0.75),
        dOpacity: rand(-0.0008, -0.0003),  // slowly fades as it rises
        color:   pick(GOLD, GOLD_WARM, GOLD_PALE, TEAL)
    }
}

for (let i = 0; i < PETAL_COUNT; i++) {
    const p = makePetal()
    p.y = rand(0, canvas.height)  // scatter on load
    petals.push(p)
}

function stepPetals () {
    petals.forEach(p => {
        p.x     += p.dx
        p.y     += p.dy
        p.angle += p.dAngle
        p.opacity = Math.max(0, p.opacity + p.dOpacity)

        // Recycle when off-screen or faded
        if (p.y < -30 || p.opacity <= 0) {
            Object.assign(p, makePetal())
        }
        if (p.x < -20)              p.x = canvas.width  + 10
        if (p.x > canvas.width + 20) p.x = -10
    })
}

function drawPetals () {
    petals.forEach(p => {
        drawPetal(p.x, p.y, p.w, p.h, p.angle, p.color, p.opacity)
    })
}

// ═══════════════════════════════════════════════════════════
//  3. MAGIC RUNE RINGS
// ═══════════════════════════════════════════════════════════
const rings = []
const RING_INTERVAL_MS = 3800   // new ring every ~3.8s
let   lastRingTime = 0

function makeRing () {
    return {
        x:       rand(canvas.width  * 0.15, canvas.width  * 0.85),
        y:       rand(canvas.height * 0.15, canvas.height * 0.85),
        r:       0,
        maxR:    rand(55, 130),
        speed:   rand(0.4, 0.8),
        opacity: 0.55,
        rings:   randInt(2, 4),       // concentric count
        color:   pick(GOLD, TEAL, GOLD_WARM),
        dashes:  randInt(6, 16)       // tick marks on ring
    }
}

function stepRings (now) {
    if (now - lastRingTime > RING_INTERVAL_MS) {
        rings.push(makeRing())
        lastRingTime = now
    }

    for (let i = rings.length - 1; i >= 0; i--) {
        const rng = rings[i]
        rng.r += rng.speed
        rng.opacity = 0.55 * (1 - rng.r / rng.maxR)
        if (rng.r >= rng.maxR) rings.splice(i, 1)
    }
}

function drawRings () {
    rings.forEach(rng => {
        for (let k = 0; k < rng.rings; k++) {
            const kr = rng.r * (1 - k * 0.18)
            if (kr <= 0) continue
            const alpha = rng.opacity * (1 - k * 0.28)

            ctx.save()
            ctx.translate(rng.x, rng.y)

            // Main ring
            ctx.beginPath()
            ctx.arc(0, 0, kr, 0, Math.PI * 2)
            ctx.strokeStyle = rgba(rng.color, alpha)
            ctx.lineWidth   = 0.8
            ctx.stroke()

            // Rune tick marks around ring
            const ticks = rng.dashes
            for (let t = 0; t < ticks; t++) {
                const a  = (t / ticks) * Math.PI * 2
                const r0 = kr - 3
                const r1 = kr + 3
                ctx.beginPath()
                ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
                ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
                ctx.strokeStyle = rgba(rng.color, alpha * 0.7)
                ctx.lineWidth   = 0.6
                ctx.stroke()
            }

            // Glow
            ctx.beginPath()
            ctx.arc(0, 0, kr, 0, Math.PI * 2)
            ctx.shadowColor = rgba(rng.color, alpha * 0.9)
            ctx.shadowBlur  = 8
            ctx.strokeStyle = rgba(rng.color, alpha * 0.3)
            ctx.lineWidth   = 2.5
            ctx.stroke()
            ctx.shadowBlur  = 0

            ctx.restore()
        }
    })
}

// ═══════════════════════════════════════════════════════════
//  4. SPARKLES — 4-point gold/white twinkles
// ═══════════════════════════════════════════════════════════
const SPARKLE_COUNT = 22
const sparkles = []

function makeSparkle () {
    return {
        x:      rand(0, canvas.width),
        y:      rand(0, canvas.height),
        size:   rand(2.5, 6),
        angle:  rand(0, Math.PI / 4),
        dAngle: rand(0.005, 0.020),
        life:   0,
        maxLife: rand(90, 200),
        color:  pick(GOLD_WARM, GOLD, WHITE, GOLD_PALE)
    }
}

for (let i = 0; i < SPARKLE_COUNT; i++) {
    const s = makeSparkle()
    s.life = randInt(0, s.maxLife)  // stagger starts
    sparkles.push(s)
}

function draw4Star (cx, cy, size, angle, color, alpha) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    // 4-point star: two overlapping diamond strokes
    for (let arm = 0; arm < 4; arm++) {
        const a = (arm / 4) * Math.PI * 2
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size)
    }
    ctx.strokeStyle = rgba(color, 0.85)
    ctx.lineWidth   = 0.9
    ctx.shadowColor = rgba(color, 0.6)
    ctx.shadowBlur  = size * 1.8
    ctx.stroke()
    ctx.shadowBlur  = 0
    ctx.globalAlpha = 1
    ctx.restore()
}

function stepSparkles () {
    sparkles.forEach(s => {
        s.life   += 1
        s.angle  += s.dAngle
        if (s.life >= s.maxLife) {
            Object.assign(s, makeSparkle())
        }
    })
}

function drawSparkles () {
    sparkles.forEach(s => {
        const t     = s.life / s.maxLife         // 0 → 1
        const alpha = Math.sin(t * Math.PI)      // fade in, then out
        draw4Star(s.x, s.y, s.size, s.angle, s.color, alpha * 0.70)
    })
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
function loop (now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    stepSnow()
    stepPetals()
    stepRings(now)
    stepSparkles()

    drawRings()     // back layer
    drawPetals()
    drawSparkles()
    drawSnow()      // front layer — delicate on top

    requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
