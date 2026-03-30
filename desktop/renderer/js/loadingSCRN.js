// ═══════════════════════════════════════════════════════════
//  CANVAS SETUP
// ═══════════════════════════════════════════════════════════
const snowCanvas = document.getElementById('snow-canvas')
const fxCanvas   = document.getElementById('fx-canvas')
const sCtx = snowCanvas.getContext('2d')
const fCtx = fxCanvas.getContext('2d')
let W, H

function resize()
{
    W = snowCanvas.width = fxCanvas.width  = window.innerWidth
    H = snowCanvas.height = fxCanvas.height = window.innerHeight
}
window.addEventListener('resize', () => { resize(); initMicroOrbs() })
resize()

// ═══════════════════════════════════════════════════════════
//  🌨️  SNOW
// ═══════════════════════════════════════════════════════════
let flakes = []
function randomFlake()
{
    return {
        x: Math.random() * W, y: Math.random() * H - H,
        r: Math.random() * 1.6 + 0.4,
        hue: Math.random() < 0.70 ? 45 : 185,
        sat: Math.random() < 0.70 ? 70 : 40,
        spd: Math.random() * 0.55 + 0.18,
        drift: (Math.random() - 0.5) * 0.28,
        opacity: Math.random() * 0.55 + 0.20,
    }
}
flakes = Array.from({ length: 140 }, randomFlake)

function drawSnow()
{
    sCtx.clearRect(0, 0, W, H)
    for (const f of flakes) {
        sCtx.beginPath()
        sCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        sCtx.fillStyle = `hsla(${f.hue}, ${f.sat}%, 85%, ${f.opacity})`
        sCtx.fill()
        f.y += f.spd; f.x += f.drift
        if (f.y > H + 4) Object.assign(f, randomFlake(), { y: -4 })
    }
}

// ═══════════════════════════════════════════════════════════
//  🌟  STAR TWINKLE FIELD
// ═══════════════════════════════════════════════════════════
const stars = Array.from({ length: 55 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.2 + 0.3,
    hue: Math.random() < 0.70 ? 48 : 190,
    sat: Math.random() < 0.70 ? 80 : 45,
    phase: Math.random() * Math.PI * 2,
    period: 2800 + Math.random() * 4200,
    baseOp: 0.25 + Math.random() * 0.35,
    peakOp: 0.70 + Math.random() * 0.30,
}))

function drawStars(ts)
{
    for (const s of stars) {
        const t   = (ts % s.period) / s.period
        const osc = (Math.sin(t * Math.PI * 2 + s.phase) + 1) / 2
        const op  = s.baseOp + (s.peakOp - s.baseOp) * osc
        const r   = s.r * (0.85 + 0.30 * osc)
        fCtx.beginPath()
        fCtx.arc(s.x * W, s.y * H, r, 0, Math.PI * 2)
        fCtx.fillStyle = `hsla(${s.hue}, ${s.sat}%, 90%, ${op})`
        fCtx.fill()
        if (s.peakOp > 0.90 && osc > 0.75) {
            const len = r * 3.5 * osc
            fCtx.save()
            fCtx.globalAlpha = (osc - 0.75) * op * 0.8
            fCtx.strokeStyle = `hsla(${s.hue}, ${s.sat}%, 95%, 1)`
            fCtx.lineWidth = 0.5
            fCtx.beginPath()
            fCtx.moveTo(s.x * W - len, s.y * H); fCtx.lineTo(s.x * W + len, s.y * H)
            fCtx.moveTo(s.x * W, s.y * H - len); fCtx.lineTo(s.x * W, s.y * H + len)
            fCtx.stroke(); fCtx.restore()
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  ☄️  SHOOTING STARS
// ═══════════════════════════════════════════════════════════
let shooters = []
let nextShoot = Date.now() + 800 + Math.random() * 1400

function spawnShooter()
{
    const angle  = (28 + Math.random() * 22) * (Math.PI / 180)
    const startX = Math.random() * W * 0.7
    const startY = Math.random() * H * 0.35
    shooters.push({
        x: startX, y: startY,
        vx: Math.cos(angle) * (6 + Math.random() * 7),
        vy: Math.sin(angle) * (6 + Math.random() * 7),
        len: 90 + Math.random() * 120,
        life: 1.0,
        decay: 0.018 + Math.random() * 0.014,
        headH: Math.random() < 0.3 ? 0 : 48,
        tailH: 185,
    })
}

function drawShooters()
{
    for (let i = shooters.length - 1; i >= 0; i--)
    {
        const s = shooters[i]
        const mag = Math.hypot(s.vx, s.vy)
        const grad = fCtx.createLinearGradient(s.x, s.y, s.x - s.vx / mag * s.len, s.y - s.vy / mag * s.len)
        grad.addColorStop(0,   `hsla(${s.headH}, 90%, 96%, ${s.life})`)
        grad.addColorStop(0.3, `hsla(48, 85%, 75%, ${s.life * 0.6})`)
        grad.addColorStop(0.7, `hsla(${s.tailH}, 60%, 65%, ${s.life * 0.25})`)
        grad.addColorStop(1,   'transparent')
        fCtx.save()
        fCtx.strokeStyle = grad; fCtx.lineWidth = 1.5 * s.life; fCtx.lineCap = 'round'
        fCtx.beginPath(); fCtx.moveTo(s.x, s.y)
        fCtx.lineTo(s.x - s.vx / mag * s.len, s.y - s.vy / mag * s.len)
        fCtx.stroke(); fCtx.restore()
        fCtx.beginPath(); fCtx.arc(s.x, s.y, 1.8 * s.life, 0, Math.PI * 2)
        fCtx.fillStyle = `hsla(${s.headH}, 100%, 98%, ${s.life})`; fCtx.fill()
        s.x += s.vx; s.y += s.vy; s.life -= s.decay
        if (s.life <= 0 || s.x > W + 50 || s.y > H + 50) shooters.splice(i, 1)
    }
}

// ═══════════════════════════════════════════════════════════
//  💫  ORBITING MICRO-ORBS
//  5 glowing orbs orbit the centre at distinct radii,
//  speeds, and directions — each with a fading trail.
//
//  Orb roster:
//    1. Gold       — r:68,  CW fast,    Frieren's staff
//    2. Teal       — r:88,  CW medium,  Frieren's eyes
//    3. Frost      — r:106, CW slow,    her scarf blue
//    4. Warm amber — r:52,  CCW fast,   inner counter-orbit
//    5. Silver     — r:124, CCW slow,   outermost halo ring
// ═══════════════════════════════════════════════════════════
let cx, cy

const microOrbs = [
    // ── Original three ────────────────────────────────────
    // Gold — closest ring, clockwise, fastest
    { radius: 68,  speed:  0.0014, angle: 0,               r: 4,   hue: 48,  sat: 90, trail: [] },
    // Teal — middle ring, clockwise, medium pace
    { radius: 88,  speed:  0.0009, angle: Math.PI * 0.66,  r: 3,   hue: 172, sat: 75, trail: [] },
    // Frost — outer ring, clockwise, slow drift
    { radius: 106, speed:  0.0006, angle: Math.PI * 1.33,  r: 2.5, hue: 200, sat: 60, trail: [] },

    // ── Two new additions ──────────────────────────────────
    // Warm amber — innermost ring, COUNTER-clockwise, fast.
    // Sits inside the gold orb to create a crossing-orbits
    // effect reminiscent of a binary star system.
    { radius: 52,  speed: -0.0018, angle: Math.PI * 0.40,  r: 3,   hue: 32,  sat: 95, trail: [] },

    // Silver-white — outermost ring, COUNTER-clockwise, very slow.
    // Barely visible — a ghostly halo that completes one revolution
    // every ~90 s, grounding the whole composition.
    { radius: 124, speed: -0.0004, angle: Math.PI * 1.75,  r: 2,   hue: 48,  sat: 20, trail: [] },
]

function initMicroOrbs()
{
    cx = W / 2
    cy = H / 2
}
initMicroOrbs()

// Longer trail for the two new orbs since they move at extreme speeds
const TRAIL_LEN = 22

function drawMicroOrbs(ts)
{
    for (const o of microOrbs)
    {
        // Negative speed = counter-clockwise; positive = clockwise
        o.angle += o.speed * 16

        const x = cx + Math.cos(o.angle) * o.radius
        const y = cy + Math.sin(o.angle) * o.radius

        o.trail.push({ x, y })
        if (o.trail.length > TRAIL_LEN) o.trail.shift()

        // Fading trail — older points are smaller and more transparent
        for (let t = 0; t < o.trail.length - 1; t++)
        {
            const progress = t / (o.trail.length - 1)
            const alpha    = progress * 0.45
            const r        = o.r * (0.3 + 0.7 * progress)
            fCtx.beginPath()
            fCtx.arc(o.trail[t].x, o.trail[t].y, r, 0, Math.PI * 2)
            fCtx.fillStyle = `hsla(${o.hue}, ${o.sat}%, 80%, ${alpha})`
            fCtx.fill()
        }

        // Soft radial glow around the head
        const grd = fCtx.createRadialGradient(x, y, 0, x, y, o.r * 3)
        grd.addColorStop(0,   `hsla(${o.hue}, ${o.sat}%, 95%, 0.90)`)
        grd.addColorStop(0.4, `hsla(${o.hue}, ${o.sat}%, 75%, 0.50)`)
        grd.addColorStop(1,   `hsla(${o.hue}, ${o.sat}%, 60%, 0)`)
        fCtx.beginPath()
        fCtx.arc(x, y, o.r * 3, 0, Math.PI * 2)
        fCtx.fillStyle = grd
        fCtx.fill()

        // Solid bright core dot
        fCtx.beginPath()
        fCtx.arc(x, y, o.r, 0, Math.PI * 2)
        fCtx.fillStyle = `hsla(${o.hue}, ${o.sat}%, 96%, 0.95)`
        fCtx.fill()
    }
}

// ═══════════════════════════════════════════════════════════
//  📜  FADING RUNE CASCADE
// ═══════════════════════════════════════════════════════════
const RUNES = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ','ᛇ','ᛈ','ᛉ','ᛊ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ','ᛟ']
let runes = []
let nextRune = Date.now() + 162 + Math.random() * 221

function spawnRune()
{
    let x, y
    do {
        x = 60 + Math.random() * (W - 120)
        y = 80 + Math.random() * (H - 160)
    } while (Math.abs(x - W / 2) < 120 && Math.abs(y - H / 2) < 140)

    runes.push({
        glyph:  RUNES[Math.floor(Math.random() * RUNES.length)],
        x, y,
        size:   11 + Math.random() * 14,
        life:   1.0,
        vy:     -(0.15 + Math.random() * 0.25),
        vx:     (Math.random() - 0.5) * 0.12,
        hue:    Math.random() < 0.75 ? 48 : 172,
        sat:    Math.random() < 0.75 ? 80 : 70,
        decay:  0.004 + Math.random() * 0.005,
    })
}

function drawRunes()
{
    fCtx.save()
    fCtx.textAlign    = 'center'
    fCtx.textBaseline = 'middle'

    for (let i = runes.length - 1; i >= 0; i--)
    {
        const r = runes[i]
        const displayOp = r.life > 0.85
            ? (1 - r.life) / 0.15
            : r.life / 0.85
        const clampedOp = Math.min(1, Math.max(0, displayOp)) * 0.75

        fCtx.font         = `${r.size}px "Cinzel", serif`
        fCtx.fillStyle    = `hsla(${r.hue}, ${r.sat}%, 82%, ${clampedOp})`
        fCtx.shadowColor  = `hsla(${r.hue}, ${r.sat}%, 80%, ${clampedOp * 0.6})`
        fCtx.shadowBlur   = 8
        fCtx.fillText(r.glyph, r.x, r.y)
        fCtx.shadowBlur   = 0

        r.x    += r.vx
        r.y    += r.vy
        r.life -= r.decay
        if (r.life <= 0) runes.splice(i, 1)
    }
    fCtx.restore()
}

// ═══════════════════════════════════════════════════════════
//  🎬  MASTER LOOP
// ═══════════════════════════════════════════════════════════
function loop(ts)
{
    drawSnow()
    fCtx.clearRect(0, 0, W, H)

    drawStars(ts)

    if (Date.now() >= nextRune)
    {
        spawnRune()
        nextRune = Date.now() + 162 + Math.random() * 221
    }
    drawRunes()

    drawMicroOrbs(ts)

    if (Date.now() >= nextShoot)
    {
        spawnShooter()
        nextShoot = Date.now() + 1000 + Math.random() * 2200
    }
    drawShooters()

    requestAnimationFrame(loop)
}

requestAnimationFrame(loop)