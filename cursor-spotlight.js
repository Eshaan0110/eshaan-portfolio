/* ═══════════════════════════════════════════════
   CURSOR GRID — your grid lines BEND toward the cursor.
   Replaces the dot-based spotlight with a gravitational-lens warp.
   ═══════════════════════════════════════════════ */
(function () {
    const canvas = document.getElementById('cursor-spotlight');
    if (!canvas) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.remove(); return; }
    if (matchMedia('(pointer: coarse)').matches) { canvas.remove(); return; }

    /* JS owns the grid now — hide the static CSS body::before grid */
    document.body.classList.add('js-grid-active');

    const ctx = canvas.getContext('2d');

    /* match the existing 60px grid spacing */
    const GRID      = 60;
    const INFLUENCE = 240;   /* radius of warp effect */
    const STRENGTH  = 34;    /* max pixels a point gets pulled toward cursor */
    const SEG       = 10;    /* segment length when discretising warped lines */

    function hexRGB(h) {
        const c = h.replace('#', '');
        return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
    }

    /* colors: var(--border-bright) at rest, blending toward var(--lime) near cursor */
    const css = getComputedStyle(document.documentElement);
    const BORDER_HEX = (css.getPropertyValue('--border-bright') || '#3a3a55').trim();
    const LIME_HEX   = (css.getPropertyValue('--lime')          || '#c6f135').trim();
    const BORDER = hexRGB(BORDER_HEX);
    const LIME   = hexRGB(LIME_HEX);
    const BASE_A = 0.22;  /* matches the original CSS grid opacity */
    const HOT_A  = 0.55;  /* extra alpha near cursor */

    let W = 0, H = 0, DPR = 1;
    const target = { x: -9999, y: -9999 };
    const pos    = { x: -9999, y: -9999 };
    let alpha = 0;
    let fading = false;
    let rafId = null;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width  = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.lineWidth = 1;
        if (!rafId) rafId = requestAnimationFrame(loop);
    }
    resize();
    addEventListener('resize', resize, { passive: true });

    function setTarget(x, y) {
        target.x = x; target.y = y;
        fading = false;
        if (!rafId) rafId = requestAnimationFrame(loop);
    }
    addEventListener('pointermove', e => setTarget(e.clientX, e.clientY), { passive: true });
    addEventListener('pointerleave', () => { fading = true; if (!rafId) rafId = requestAnimationFrame(loop); });
    addEventListener('blur',         () => { fading = true; if (!rafId) rafId = requestAnimationFrame(loop); });

    /* warp a single point toward the cursor (gravitational-lens style)
       returns [warpedX, warpedY, normalizedStrength 0..1] */
    function warp(x, y) {
        const dx = pos.x - x, dy = pos.y - y;
        const d2 = dx * dx + dy * dy;
        const INF2 = INFLUENCE * INFLUENCE;
        if (d2 >= INF2) return [x, y, 0];
        const d = Math.sqrt(d2);
        const t = 1 - d / INFLUENCE;
        /* quadratic falloff for soft edge, scaled by current alpha */
        let pull = STRENGTH * t * t * alpha;
        /* cap so points never overshoot the cursor */
        pull = Math.min(pull, Math.max(0, d - 4));
        if (d < 0.1) return [x, y, t];
        return [x + (dx / d) * pull, y + (dy / d) * pull, t];
    }

    /* color for a segment based on (t, alpha) of its endpoints */
    function strokeColor(t) {
        const ts = Math.pow(t * alpha, 0.7);
        const r = Math.round(BORDER[0] + (LIME[0] - BORDER[0]) * ts);
        const g = Math.round(BORDER[1] + (LIME[1] - BORDER[1]) * ts);
        const b = Math.round(BORDER[2] + (LIME[2] - BORDER[2]) * ts);
        const a = BASE_A + t * HOT_A * alpha;
        return `rgba(${r},${g},${b},${a})`;
    }

    function drawLineV(gx) {
        const horizD = Math.abs(gx - pos.x);
        if (horizD > INFLUENCE || alpha < 0.025) {
            ctx.strokeStyle = `rgba(${BORDER.join(',')},${BASE_A})`;
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, H);
            ctx.stroke();
            return;
        }
        let [px, py, pt] = warp(gx, 0);
        for (let y = SEG; y <= H; y += SEG) {
            const [nx, ny, nt] = warp(gx, y);
            ctx.strokeStyle = strokeColor((pt + nt) / 2);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            px = nx; py = ny; pt = nt;
        }
    }

    function drawLineH(gy) {
        const vertD = Math.abs(gy - pos.y);
        if (vertD > INFLUENCE || alpha < 0.025) {
            ctx.strokeStyle = `rgba(${BORDER.join(',')},${BASE_A})`;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
            ctx.stroke();
            return;
        }
        let [px, py, pt] = warp(0, gy);
        for (let x = SEG; x <= W; x += SEG) {
            const [nx, ny, nt] = warp(x, gy);
            ctx.strokeStyle = strokeColor((pt + nt) / 2);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            px = nx; py = ny; pt = nt;
        }
    }

    function drawAllStatic() {
        ctx.strokeStyle = `rgba(${BORDER.join(',')},${BASE_A})`;
        for (let gx = 0; gx <= W + GRID; gx += GRID) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (let gy = 0; gy <= H + GRID; gy += GRID) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }
    }

    function loop() {
        /* fade alpha toward target (1 when active, 0 when fading) */
        alpha += ((fading ? 0 : 1) - alpha) * 0.08;
        /* smooth cursor follow */
        pos.x += (target.x - pos.x) * 0.16;
        pos.y += (target.y - pos.y) * 0.16;

        ctx.clearRect(0, 0, W, H);

        for (let gx = 0; gx <= W + GRID; gx += GRID) drawLineV(gx);
        for (let gy = 0; gy <= H + GRID; gy += GRID) drawLineH(gy);

        /* stop loop when fully idle — but leave one clean static frame painted */
        const moving = Math.abs(target.x - pos.x) > 0.2 || Math.abs(target.y - pos.y) > 0.2;
        if (!moving && alpha < 0.012 && fading) {
            ctx.clearRect(0, 0, W, H);
            drawAllStatic();
            rafId = null;
            return;
        }
        rafId = requestAnimationFrame(loop);
    }
})();
