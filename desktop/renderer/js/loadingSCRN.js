// ═══════════════════════════════════════════════════════════
//  CANVAS SETUP
// ═══════════════════════════════════════════════════════════
const snowCanvas = document.getElementById('snow-canvas')
const fxCanvas   = document.getElementById('fx-canvas')
const sCtx       = snowCanvas.getContext('2d')
const fCtx       = fxCanvas.getContext('2d')

let W, H

function resize() {
    W = snowCanvas.width  = fxCanvas.width  = window.innerWidth
    H = snowCanvas.height = fxCanvas.height = window.innerHeight
}

window.addEventListener('resize', resize)
resize()

// ═══════════════════════════════════════════════════════════
//  🌨️  SNOW — gold-tinted + frost particles
// ═══════════════════════════════════════════════════════════
let flakes = []

function randomFlake() {
    return {
        x:       Math.random() * W,
        y:       Math.random() * H - H,
        r:       Math.random() * 1.6 + 0.4,
        hue:     Math.random() < 0.70 ? 45 : 185,
        sat:     Math.random() < 0.70 ? 70 : 40,
        spd:     Math.random() * 0.55 + 0.18,
        drift:   (Math.random() - 0.5) * 0.28,
        opacity: Math.random() * 0.55 + 0.20,
    }
}

flakes = Array.from({ length: 140 }, randomFlake)

function drawSnow() {
    sCtx.clearRect(0, 0, W, H)
    for (const f of flakes) {
        sCtx.beginPath()
        sCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        sCtx.fillStyle = `hsla(${f.hue}, ${f.sat}%, 85%, ${f.opacity})`
        sCtx.fill()
        f.y += f.spd
        f.x += f.drift
        if (f.y > H + 4) Object.assign(f, randomFlake(), { y: -4 })
    }
}

// ═══════════════════════════════════════════════════════════
//  🌟  EFFECT 1 — STAR TWINKLE FIELD
//  50 fixed stars that independently breathe in opacity/size
// ═══════════════════════════════════════════════════════════
const stars = Array.from({ length: 55 }, () => ({
    x:       Math.random() * 1,      // normalised 0-1, scaled at draw time
    y:       Math.random() * 1,
    r:       Math.random() * 1.2 + 0.3,
    // Gold-white vs frost split ~70/30
    hue:     Math.random() < 0.70 ? 48 : 190,
    sat:     Math.random() < 0.70 ? 80 : 45,
    // Each star has its own phase and period so they don't sync
    phase:   Math.random() * Math.PI * 2,
    period:  2800 + Math.random() * 4200,   // ms
    baseOp:  0.25 + Math.random() * 0.35,
    peakOp:  0.70 + Math.random() * 0.30,
}))

function drawStars(ts) {
    for (const s of stars) {
        const t   = (ts % s.period) / s.period
        const osc = (Math.sin(t * Math.PI * 2 + s.phase) + 1) / 2   // 0..1
        const op  = s.baseOp + (s.peakOp - s.baseOp) * osc
        const r   = s.r * (0.85 + 0.30 * osc)

        fCtx.beginPath()
        fCtx.arc(s.x * W, s.y * H, r, 0, Math.PI * 2)
        fCtx.fillStyle = `hsla(${s.hue}, ${s.sat}%, 90%, ${op})`
        fCtx.fill()

        // Soft cross-flare on the brightest stars at peak
        if (s.peakOp > 0.90 && osc > 0.75) {
            const len = r * 3.5 * osc
            fCtx.save()
            fCtx.globalAlpha = (osc - 0.75) * op * 0.8
            fCtx.strokeStyle = `hsla(${s.hue}, ${s.sat}%, 95%, 1)`
            fCtx.lineWidth   = 0.5
            fCtx.beginPath()
            fCtx.moveTo(s.x * W - len, s.y * H)
            fCtx.lineTo(s.x * W + len, s.y * H)
            fCtx.moveTo(s.x * W, s.y * H - len)
            fCtx.lineTo(s.x * W, s.y * H + len)
            fCtx.stroke()
            fCtx.restore()
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  ☄️  EFFECT 2 — SHOOTING STARS
//  Fire at random intervals, diagonal trails, gold → teal tip
// ═══════════════════════════════════════════════════════════
let shooters = []
let nextShoot = Date.now() + 800 + Math.random() * 1400

function spawnShooter() {
    // Start from top-left quadrant, angle ~30-50° downward
    const angle  = (28 + Math.random() * 22) * (Math.PI / 180)
    const startX = Math.random() * W * 0.7
    const startY = Math.random() * H * 0.35
    const speed  = 6 + Math.random() * 7
    const length = 90 + Math.random() * 120

    shooters.push({
        x:      startX,
        y:      startY,
        vx:     Math.cos(angle) * speed,
        vy:     Math.sin(angle) * speed,
        len:    length,
        life:   1.0,
        decay:  0.018 + Math.random() * 0.014,
        // colour: gold head → teal tail, occasionally pure white head
        headH:  Math.random() < 0.3 ? 0 : 48,
        tailH:  185,
    })
}

function drawShooters() {
    for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i]

        // Tail gradient: head bright gold/white → transparent teal
        const grad = fCtx.createLinearGradient(
            s.x, s.y,
            s.x - s.vx / Math.hypot(s.vx, s.vy) * s.len,
            s.y - s.vy / Math.hypot(s.vx, s.vy) * s.len
        )
        grad.addColorStop(0,   `hsla(${s.headH}, 90%, 96%, ${s.life})`)
        grad.addColorStop(0.3, `hsla(48, 85%, 75%, ${s.life * 0.6})`)
        grad.addColorStop(0.7, `hsla(${s.tailH}, 60%, 65%, ${s.life * 0.25})`)
        grad.addColorStop(1,   'transparent')

        fCtx.save()
        fCtx.strokeStyle = grad
        fCtx.lineWidth   = 1.5 * s.life
        fCtx.lineCap     = 'round'
        fCtx.beginPath()
        fCtx.moveTo(s.x, s.y)
        fCtx.lineTo(
            s.x - s.vx / Math.hypot(s.vx, s.vy) * s.len,
            s.y - s.vy / Math.hypot(s.vx, s.vy) * s.len
        )
        fCtx.stroke()
        fCtx.restore()

        // Bright head dot
        fCtx.beginPath()
        fCtx.arc(s.x, s.y, 1.8 * s.life, 0, Math.PI * 2)
        fCtx.fillStyle = `hsla(${s.headH}, 100%, 98%, ${s.life})`
        fCtx.fill()

        s.x    += s.vx
        s.y    += s.vy
        s.life -= s.decay

        if (s.life <= 0 || s.x > W + 50 || s.y > H + 50) {
            shooters.splice(i, 1)
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  🌊  EFFECT 3 — AURORA WAVE BANDS
//  Two slow horizontal shimmer bands drifting upward
//  One gold, one teal — sinusoidal edge, very subtle
// ═══════════════════════════════════════════════════════════
const aurora = [
    {
        // Gold band
        yBase:  0.68,       // normalised Y position centre
        yOff:   0,          // animated offset
        speed:  0.00012,    // upward drift speed (normalised / ms)
        color1: 'rgba(240, 208, 112, 0.055)',
        color2: 'rgba(240, 208, 112, 0)',
        height: 0.18,       // band height as fraction of H
        waveAmp: 0.025,
        waveFreq: 2.2,
        waveSpeed: 0.0004,
        wavePhase: 0,
    },
    {
        // Teal band
        yBase:  0.82,
        yOff:   0,
        speed:  0.000085,
        color1: 'rgba(77, 212, 188, 0.040)',
        color2: 'rgba(77, 212, 188, 0)',
        height: 0.14,
        waveAmp: 0.018,
        waveFreq: 1.8,
        waveSpeed: 0.00030,
        wavePhase: Math.PI,
    },
]

function drawAurora(ts) {
    for (const a of aurora) {
        // Drift upward, wrap around
        a.yOff = (a.yOff + a.speed) % 1
        a.wavePhase += a.waveSpeed

        const cy = ((a.yBase - a.yOff + 1) % 1) * H
        const ht = a.height * H

        // Draw as a series of thin horizontal slices for the wave edge
        const slices = 60
        for (let i = 0; i < slices; i++) {
            const t  = i / slices
            const y  = cy - ht / 2 + t * ht
            // Wave-modulated x offset creates the shimmer undulation
            const xShift = Math.sin(t * Math.PI * a.waveFreq + a.wavePhase) * W * a.waveAmp

            // Opacity envelope: peaks at band centre, 0 at edges
            const env = Math.sin(t * Math.PI)
            const op  = env * (a.color1.match(/[\d.]+(?=\))/)?.[0] || 0.05)

            fCtx.save()
            fCtx.globalAlpha = env
            const grad = fCtx.createLinearGradient(xShift, y, W + xShift, y)
            grad.addColorStop(0,    'transparent')
            grad.addColorStop(0.15, a.color1)
            grad.addColorStop(0.50, a.color1)
            grad.addColorStop(0.85, a.color1)
            grad.addColorStop(1,    'transparent')
            fCtx.fillStyle = grad
            fCtx.fillRect(xShift, y, W, H / slices + 1)
            fCtx.restore()
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  🎬  MASTER LOOP
// ═══════════════════════════════════════════════════════════
function loop(ts) {
    // Snow on its own canvas
    drawSnow()

    // All fx on the fx canvas — clear first
    fCtx.clearRect(0, 0, W, H)

    // ── Aurora (drawn first, behind everything) ──
    drawAurora(ts)

    // ── Twinkling stars ──
    drawStars(ts)

    // ── Shooting stars — spawn if due ──
    if (Date.now() >= nextShoot) {
        spawnShooter()
        nextShoot = Date.now() + 1000 + Math.random() * 2200
    }
    drawShooters()

    requestAnimationFrame(loop)
}

requestAnimationFrame(loop)