/* ============================================================
   snow.js — Frieren Magic Canvas
   ─────────────────────────────────────────────────────────
   Effects:
     1. Snow          — warm gold-white drifting particles (bright)
     2. Ground Glow   — soft magical light strip along the base
     3. Flower Field  — Frieren's Blumen spell, carpet at bottom
     4. Rising Petals — petals drifting upward from the field
     5. Rune Rings    — expanding magic circles (gold/teal)
     6. Sparkles      — 4-point star twinkles (gold/silver)
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
const GOLD_PALE  = [245, 232, 208]
const GOLD       = [240, 208, 112]
const GOLD_WARM  = [253, 224, 144]
const TEAL       = [77,  184, 160]
const WHITE      = [255, 255, 250]
const WARM_WHITE = [255, 245, 235]  // warm robe white for petals

function rgba (rgb, a) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`
}

// ── Helpers ───────────────────────────────────────────────
function rand    (min, max) { return Math.random() * (max - min) + min }
function randInt (min, max) { return Math.floor(rand(min, max)) }
function pick    (...arr)   { return arr[Math.floor(Math.random() * arr.length)] }

// ═══════════════════════════════════════════════════════════
//  1. SNOW — bright, glowing flakes
// ═══════════════════════════════════════════════════════════
const SNOW_COUNT = 120
const snow = []

function makeFlake () {
    return {
        x:       rand(0, canvas.width),
        y:       rand(-10, canvas.height),
        r:       rand(1.2, 3.2),
        dx:      rand(-0.30, 0.30),
        dy:      rand(0.20, 0.65),
        opacity: rand(0.45, 1.00),
        color:   pick(WHITE, WHITE, GOLD_PALE, GOLD_WARM)
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
        ctx.shadowColor = rgba(f.color, 0.85)
        ctx.shadowBlur  = f.r * 3.5
        ctx.fillStyle   = rgba(f.color, f.opacity)
        ctx.fill()
        ctx.shadowBlur  = 0
    })
}

// ═══════════════════════════════════════════════════════════
//  2. GROUND GLOW — magical light emanating from the base
// ═══════════════════════════════════════════════════════════
function drawGroundGlow () {
    const glowH = canvas.height * 0.30
    const y0    = canvas.height - glowH

    // Vertical upward bloom
    const vert = ctx.createLinearGradient(0, canvas.height, 0, y0)
    vert.addColorStop(0.00, rgba(GOLD_WARM, 0.28))
    vert.addColorStop(0.25, rgba(GOLD,      0.12))
    vert.addColorStop(0.60, rgba(TEAL,      0.05))
    vert.addColorStop(1.00, rgba(WHITE,     0.00))
    ctx.fillStyle = vert
    ctx.fillRect(0, y0, canvas.width, glowH)

    // Horizontal shimmer line at very base
    const horiz = ctx.createLinearGradient(0, 0, canvas.width, 0)
    horiz.addColorStop(0.00, rgba(WHITE, 0.00))
    horiz.addColorStop(0.20, rgba(GOLD_WARM, 0.35))
    horiz.addColorStop(0.50, rgba(WHITE,     0.55))
    horiz.addColorStop(0.80, rgba(GOLD_WARM, 0.35))
    horiz.addColorStop(1.00, rgba(WHITE, 0.00))
    ctx.fillStyle = horiz
    ctx.fillRect(0, canvas.height - 2, canvas.width, 2)
}

// ═══════════════════════════════════════════════════════════
//  3. FLOWER FIELD — Frieren's Blumen Spell
//     Dense carpet at bottom, blooming lifecycle
// ═══════════════════════════════════════════════════════════
const FLOWER_COUNT = 42
const flowers = []

// Weighted y-spawn — 65% in bottom 18%, 35% in next 14% up
function flowerY ()
{
    return Math.random() < 0.65 ? rand(canvas.height * 0.82, canvas.height - 6) : rand(canvas.height * 0.68, canvas.height * 0.82)
}

function makeFlower ()
{
    return {
        x:       rand(0, canvas.width),
        y:       flowerY(),
        size:    0,
        maxSize: rand(7, 21),
        petals:  randInt(5, 7),
        angle:   rand(0, Math.PI * 2),
        dAngle:  rand(-0.003, 0.003),  // gentle sway
        life:    0,
        maxLife: rand(600, 1500),
        color:   pick(WHITE, WHITE, WARM_WHITE, GOLD_PALE, GOLD_WARM, TEAL)
    }
}

// Stagger initial flowers so they don't all bloom at once
for (let i = 0; i < FLOWER_COUNT; i++)
{
    const f   = makeFlower()
    f.life    = randInt(0, f.maxLife)
    f.size    = f.maxSize * Math.min(1, f.life / (f.maxLife * 0.15))
    flowers.push(f)
}

function drawFlower (cx, cy, size, petals, angle, color, alpha)
{
    if (size < 0.5 || alpha < 0.01) return

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.globalAlpha = alpha

    // Outer halo glow
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.0)
    halo.addColorStop(0.0, rgba(color, 0.40))
    halo.addColorStop(0.5, rgba(color, 0.12))
    halo.addColorStop(1.0, rgba(color, 0.00))
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, 0, size * 3.0, 0, Math.PI * 2)
    ctx.fill()

    // Individual petals
    for (let i = 0; i < petals; i++)
    {
        const a = (i / petals) * Math.PI * 2
        ctx.save()
        ctx.rotate(a)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.bezierCurveTo(size * 0.45, -size * 0.22, size * 0.55, -size * 0.85, 0, -size)
        ctx.bezierCurveTo(-size * 0.55, -size * 0.85, -size * 0.45, -size * 0.22,0, 0)
        // Petal: white base → colour tip
        const pg = ctx.createLinearGradient(0, -size * 0.1, 0, -size)
        pg.addColorStop(0.0, rgba(WHITE, 1.00))
        pg.addColorStop(0.4, rgba(color, 0.92))
        pg.addColorStop(1.0, rgba(color, 0.50))
        ctx.fillStyle = pg
        ctx.fill()
        ctx.restore()
    }

    // Golden stamen centre
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2)
    ctx.fillStyle   = rgba(GOLD_WARM, 1.0)
    ctx.shadowColor = rgba(GOLD_WARM, 0.95)
    ctx.shadowBlur  = size * 1.0
    ctx.fill()
    ctx.shadowBlur  = 0

    ctx.globalAlpha = 1
    ctx.restore()
}

function flowerAlpha (f) {
    const t = f.life / f.maxLife
    if (t < 0.12) return t / 0.12          // bloom in
    if (t < 0.82) return 1.0               // full bloom
    return 1.0 - (t - 0.82) / 0.18        // fade out
}

function stepFlowers () {
    flowers.forEach(f => {
        f.life  += 1
        f.angle += f.dAngle

        const t = f.life / f.maxLife
        f.size  = t < 0.15
            ? f.maxSize * (t / 0.15)       // growing
            : f.maxSize                    // full size

        if (f.life >= f.maxLife) {
            Object.assign(f, makeFlower())
            f.life = 0
            f.size = 0
        }
    })
}

function drawFlowers () {
    flowers.forEach(f => {
        drawFlower(f.x, f.y, f.size, f.petals, f.angle, f.color, flowerAlpha(f))
    })
}

// ═══════════════════════════════════════════════════════════
//  4. RISING PETALS — spawned from flower field, drift upward
// ═══════════════════════════════════════════════════════════
const PETAL_COUNT = 32
const petals = []

function makePetal ()
{
    return {
        x:        rand(0, canvas.width),
        y:        rand(canvas.height * 0.72, canvas.height + 20), // from flower zone
        w:        rand(4, 11),
        h:        rand(8, 20),
        angle:    rand(0, Math.PI * 2),
        dAngle:   rand(-0.012, 0.012),
        dx:       rand(-0.30, 0.30),
        dy:       rand(-0.50, -0.12),   // upward drift
        opacity:  rand(0.60, 1.00),
        dOpacity: rand(-0.00030, -0.00012),
        color:    pick(WHITE, WHITE, WARM_WHITE, GOLD_PALE, GOLD_WARM, TEAL)
    }
}

for (let i = 0; i < PETAL_COUNT; i++)
{
    const p = makePetal()
    p.y = rand(canvas.height * 0.25, canvas.height)  // scatter on load
    petals.push(p)
}

function drawPetal (cx, cy, w, h, angle, color, alpha)
{
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(0, -h / 2)
    ctx.bezierCurveTo( w / 2, -h / 4,  w / 2,  h / 4, 0,  h / 2)
    ctx.bezierCurveTo(-w / 2,  h / 4, -w / 2, -h / 4, 0, -h / 2)
    ctx.closePath()

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2)
    grad.addColorStop(0.00, rgba(WHITE, 1.00))
    grad.addColorStop(0.35, rgba(color, 0.95))
    grad.addColorStop(0.85, rgba(color, 0.35))
    grad.addColorStop(1.00, rgba(color, 0.00))
    ctx.fillStyle = grad
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.restore()
}

function stepPetals ()
{
    petals.forEach(p => {
        p.x      += p.dx
        p.y      += p.dy
        p.angle  += p.dAngle
        p.opacity = Math.max(0, p.opacity + p.dOpacity)

        if (p.y < -30 || p.opacity <= 0) Object.assign(p, makePetal())
        if (p.x < -20)               p.x = canvas.width  + 10
        if (p.x > canvas.width + 20) p.x = -10
    })
}

function drawPetals ()
{
    petals.forEach(p =>
    {
        drawPetal(p.x, p.y, p.w, p.h, p.angle, p.color, p.opacity)
    })
}

// ═══════════════════════════════════════════════════════════
//  5. RUNE RINGS — vivid expanding magic circles
// ═══════════════════════════════════════════════════════════
const rings = []
const RING_INTERVAL_MS = 3800
let   lastRingTime = 0

function makeRing ()
{
    return {
        x:       rand(canvas.width  * 0.15, canvas.width  * 0.85),
        y:       rand(canvas.height * 0.15, canvas.height * 0.85),
        r:       0,
        maxR:    rand(70, 150),
        speed:   rand(0.5, 0.9),
        opacity: 0.90,
        rings:   randInt(2, 4),
        color:   pick(GOLD, TEAL, GOLD_WARM),
        dashes:  randInt(8, 18)
    }
}

function stepRings (now)
{
    if (now - lastRingTime > RING_INTERVAL_MS)
    {
        rings.push(makeRing())
        lastRingTime = now
    }
    for (let i = rings.length - 1; i >= 0; i--)
    {
        const rng = rings[i]
        rng.r      += rng.speed
        rng.opacity = 0.9 * (1 - rng.r / rng.maxR)
        if (rng.r >= rng.maxR) rings.splice(i, 1)
    }
}

function drawRings () {
    rings.forEach(rng => {
        for (let k = 0; k < rng.rings; k++)
        {
            const kr = rng.r * (1 - k * 0.18)
            if (kr <= 0) continue
            const alpha = rng.opacity * (1 - k * 0.20)

            ctx.save()
            ctx.translate(rng.x, rng.y)

            ctx.beginPath()
            ctx.arc(0, 0, kr, 0, Math.PI * 2)
            ctx.strokeStyle = rgba(rng.color, alpha)
            ctx.lineWidth   = 1.4
            ctx.stroke()

            for (let t = 0; t < rng.dashes; t++)
            {
                const a  = (t / rng.dashes) * Math.PI * 2
                ctx.beginPath()
                ctx.moveTo(Math.cos(a) * (kr - 4), Math.sin(a) * (kr - 4))
                ctx.lineTo(Math.cos(a) * (kr + 4), Math.sin(a) * (kr + 4))
                ctx.strokeStyle = rgba(rng.color, alpha * 0.9)
                ctx.lineWidth   = 0.9
                ctx.stroke()
            }

            ctx.beginPath()
            ctx.arc(0, 0, kr, 0, Math.PI * 2)
            ctx.shadowColor = rgba(rng.color, alpha)
            ctx.shadowBlur  = 14
            ctx.strokeStyle = rgba(rng.color, alpha * 0.5)
            ctx.lineWidth   = 3
            ctx.stroke()
            ctx.shadowBlur  = 0

            ctx.restore()
        }
    })
}

// ═══════════════════════════════════════════════════════════
//  6. SPARKLES — 4-point gold/white twinkles
// ═══════════════════════════════════════════════════════════
const SPARKLE_COUNT = 26
const sparkles = []

function makeSparkle ()
{
    return {
        x:       rand(0, canvas.width),
        y:       rand(0, canvas.height),
        size:    rand(3.5, 7.5),
        angle:   rand(0, Math.PI / 4),
        dAngle:  rand(0.006, 0.020),
        life:    0,
        maxLife: rand(120, 220),
        color:   pick(GOLD_WARM, GOLD, WHITE, GOLD_PALE)
    }
}

for (let i = 0; i < SPARKLE_COUNT; i++)
{
    const s = makeSparkle()
    s.life = randInt(0, s.maxLife)
    sparkles.push(s)
}

function draw4Star (cx, cy, size, angle, color, alpha) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    for (let arm = 0; arm < 4; arm++)
    {
        const a = (arm / 4) * Math.PI * 2
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size)
    }
    ctx.strokeStyle = rgba(color, 1.0)
    ctx.lineWidth   = 1.1
    ctx.shadowColor = rgba(color, 0.9)
    ctx.shadowBlur  = size * 2.2
    ctx.stroke()
    ctx.shadowBlur  = 0
    ctx.globalAlpha = 1
    ctx.restore()
}

function stepSparkles () {
    sparkles.forEach(s => {
        s.life  += 1
        s.angle += s.dAngle
        if (s.life >= s.maxLife) Object.assign(s, makeSparkle())
    })
}

function drawSparkles () {
    sparkles.forEach(s => {
        const t     = s.life / s.maxLife
        const alpha = Math.pow(Math.sin(t * Math.PI), 1.2)
        draw4Star(s.x, s.y, s.size, s.angle, s.color, alpha * 0.95)
    })
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
function loop (now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    stepSnow()
    stepFlowers()
    stepPetals()
    stepRings(now)
    stepSparkles()

    drawGroundGlow()  // magical light from the ground
    drawRings()       // rune circles — deep back
    drawFlowers()     // flower carpet at base
    drawPetals()      // petals rising from field
    drawSparkles()    // star twinkles mid-air
    drawSnow()        // snow drifts on top

    requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
