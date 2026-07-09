/* ═══════════════════════════════════════════════════════════
   mind.js — the engine behind the experience.
   Signature interaction: a perspective engineering grid that
   bends like fabric under the cursor. Signature content:
   the Selected Work exhibition + engineering archive.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const GREY = '158, 162, 178';
const SVGNS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
}

/* ───────────────────────────────────────────────
   1 · THE FABRIC
   A perspective engineering grid — a physical surface.
   The cursor is nothing but a point; the world reacts.
   ─────────────────────────────────────────────── */
const field = document.getElementById('field');

function gridRest(W, H) {
    const SP = Math.max(54, Math.min(72, W / 22));
    const rows = 20;
    const cols = Math.ceil(W / (SP * 0.72)) + 2;
    const verts = [];
    for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        const y = H * (0.02 + 0.98 * Math.pow(t, 1.28));
        const fan = 0.74 + 0.36 * t;
        for (let c = 0; c <= cols; c++) {
            verts.push({ rx: W / 2 + (c - cols / 2) * SP * fan, ry: y });
        }
    }
    return { verts, rows, cols };
}

if (field && !REDUCED) {
    const ctx = field.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    const RANGE = 185, PULL = 1100, SPRING = 42, DAMP = 7.5;
    let W = 0, H = 0, rows = 0, cols = 0, verts = [];
    let running = true;
    let mouse = { x: -9999, y: -9999 };
    let last = performance.now();

    function resize() {
        W = window.innerWidth; H = window.innerHeight;
        field.width = W * DPR; field.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        const g = gridRest(W, H);
        rows = g.rows; cols = g.cols;
        verts = g.verts.map(v => ({ ...v, x: v.rx, y: v.ry, vx: 0, vy: 0, d: 0 }));
    }
    resize();
    window.addEventListener('resize', resize);

    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('mouseout', e => { if (!e.relatedTarget) { mouse.x = -9999; mouse.y = -9999; } });

    function frame(now) {
        if (!running) return;
        if (W !== window.innerWidth || H !== window.innerHeight) resize();
        const dt = Math.min(0.04, (now - last) / 1000);
        last = now;

        for (const v of verts) {
            let ax = (v.rx - v.x) * SPRING - v.vx * DAMP;
            let ay = (v.ry - v.y) * SPRING - v.vy * DAMP;
            const dx = mouse.x - v.x, dy = mouse.y - v.y;
            const d = Math.hypot(dx, dy);
            if (d < RANGE && d > 4) {
                const f = PULL * Math.pow(1 - d / RANGE, 2) / d;
                ax += dx * f;
                ay += dy * f;
            }
            v.vx += ax * dt; v.vy += ay * dt;
            v.x += v.vx * dt; v.y += v.vy * dt;
            v.d = Math.hypot(v.x - v.rx, v.y - v.ry);
        }

        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 1;
        const stride = cols + 1;
        function segment(a, b) {
            const bend = Math.min(14, a.d + b.d);
            ctx.strokeStyle = `rgba(${GREY}, ${0.07 + bend * 0.016})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        for (let r = 0; r <= rows; r++)
            for (let c = 0; c < cols; c++)
                segment(verts[r * stride + c], verts[r * stride + c + 1]);
        for (let c = 0; c <= cols; c++)
            for (let r = 0; r < rows; r++)
                segment(verts[r * stride + c], verts[(r + 1) * stride + c]);

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
        const was = running;
        running = !document.hidden;
        if (running && !was) { last = performance.now(); requestAnimationFrame(frame); }
    });
} else if (field && REDUCED) {
    const ctx = field.getContext('2d');
    const W = window.innerWidth, H = window.innerHeight;
    field.width = W; field.height = H;
    const g = gridRest(W, H);
    const stride = g.cols + 1;
    ctx.strokeStyle = `rgba(${GREY}, 0.06)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r <= g.rows; r++) {
        ctx.moveTo(g.verts[r * stride].rx, g.verts[r * stride].ry);
        for (let c = 1; c <= g.cols; c++) ctx.lineTo(g.verts[r * stride + c].rx, g.verts[r * stride + c].ry);
    }
    for (let c = 0; c <= g.cols; c++) {
        ctx.moveTo(g.verts[c].rx, g.verts[c].ry);
        for (let r = 1; r <= g.rows; r++) ctx.lineTo(g.verts[r * stride + c].rx, g.verts[r * stride + c].ry);
    }
    ctx.stroke();
}

/* ───────────────────────────────────────────────
   2 · REVEALS + NAV
   ─────────────────────────────────────────────── */
const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
document.querySelectorAll('.rv, .evolution, .gevent').forEach(n => obs.observe(n));

const nav = document.getElementById('nav');
if (nav) {
    let lastY = 0;
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        nav.classList.toggle('hidden', y > lastY && y > 140);
        lastY = y;
    }, { passive: true });
}

const navLinks = document.querySelectorAll('.nav-link');
const navSections = document.querySelectorAll('section[id]');
if (navLinks.length && navSections.length) {
    const secObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px' });
    navSections.forEach(s => secObs.observe(s));
}

/* ───────────────────────────────────────────────
   3 · HERO — perceive / reason / interact come alive,
   and the portrait reveals its edges under observation
   ─────────────────────────────────────────────── */
document.querySelectorAll('.vital').forEach(v => {
    const order = parseInt(v.dataset.v, 10) || 1;
    setTimeout(() => v.classList.add('on'), 900 + order * 450);
});

// the name fills its column edge-to-edge, poster style:
// the longest line sets the size, shorter lines letter-space to match
const nameEl = document.querySelector('.hero-name');
if (nameEl) {
    const lines = [...nameEl.querySelectorAll('.hn-line')];
    const inkWidth = l => {                      // true text width, not the block box
        const range = document.createRange();
        range.selectNodeContents(l);
        return range.getBoundingClientRect().width;
    };
    function fitName() {
        if (!lines.length) return;
        nameEl.style.fontSize = '';
        const W = nameEl.clientWidth;
        if (W < 80) return;
        const fs = parseFloat(getComputedStyle(nameEl).fontSize);
        const maxW = Math.max(...lines.map(inkWidth));
        if (maxW < 10) return;
        nameEl.style.fontSize = (fs * W / maxW * 0.995) + 'px';
    }
    const refit = () => requestAnimationFrame(fitName);
    refit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    window.addEventListener('load', refit);
    let fnT;
    window.addEventListener('resize', () => { clearTimeout(fnT); fnT = setTimeout(fitName, 120); });
}

/* ───────────────────────────────────────────────
   3b · CURSOR — a precision instrument.
   A lime point with a thin ring trailing on inertia;
   the ring locks onto anything interactive.
   ─────────────────────────────────────────────── */
if (CAN_HOVER && !REDUCED) {
    const dot = document.createElement('div');
    dot.id = 'cursor-dot';
    const ring = document.createElement('div');
    ring.id = 'cursor-ring';
    document.body.append(dot, ring);
    document.body.classList.add('has-cursor');

    let mx = -100, my = -100, rx = -100, ry = -100, shown = false;
    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        if (!shown) { shown = true; dot.style.opacity = '1'; ring.style.opacity = '1'; }
    }, { passive: true });
    document.addEventListener('mouseleave', () => {
        shown = false; dot.style.opacity = '0'; ring.style.opacity = '0';
    });

    const HOT = 'a, button, .sw-item, .cap-node, .tab-btn, .ex-toggle, .ex-visual, [role="button"]';
    document.addEventListener('mouseover', e => { if (e.target.closest(HOT)) ring.classList.add('lock'); });
    document.addEventListener('mouseout', e => { if (e.target.closest(HOT)) ring.classList.remove('lock'); });
    document.addEventListener('mousedown', () => ring.classList.add('press'));
    document.addEventListener('mouseup', () => ring.classList.remove('press'));

    (function follow() {
        rx += (mx - rx) * 0.18;
        ry += (my - ry) * 0.18;
        dot.style.transform = `translate(${mx}px, ${my}px)`;
        ring.style.transform = `translate(${rx}px, ${ry}px)`;
        requestAnimationFrame(follow);
    })();
}

/* ───────────────────────────────────────────────
   3c · EVOLUTION GRAPH (interactive)
   The same idea — curiosity branching into a practice —
   but now a draggable force-directed graph with springy
   physics, instead of a static drawing. Three colours
   only: black, lime, grey. Curiosity is the lit root.
   ─────────────────────────────────────────────── */
(function evolutionGraph() {
    const canvas = document.getElementById('evo-net');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('evo-wrap');
    const detail = document.getElementById('net-detail');
    const dKicker = document.getElementById('net-kicker');
    const dTitle = document.getElementById('net-title');
    const dDesc = document.getElementById('net-desc');

    const LIME = (getComputedStyle(document.documentElement).getPropertyValue('--lime') || '#c6f135').trim();
    const GREY = '158, 162, 178';
    const BG = (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#040405').trim();

    // the evolution: one idea → a practice. root = Curiosity (lit).
    const NODES = [
        { id: 'curiosity',  title: 'Curiosity',       kicker: 'WHERE IT STARTS', desc: 'How could a machine understand the world? Every branch below grew from that one question.', size: 13, root: true },
        { id: 'programming', title: 'Programming',    kicker: 'THE FIRST TOOL',  desc: 'Curiosity turned into code — the language for building things that think.', size: 11 },
        { id: 'robotics',   title: 'Robotics',        kicker: 'CODE MEETS WORLD', desc: 'Software reached into hardware — perception, control, and motion in the physical world.', size: 12 },
        { id: 'leadership', title: 'Leadership',      kicker: 'PEOPLE SYSTEMS',  desc: 'The same systems instinct, applied to teams — leading, mentoring, building communities.', size: 9 },
        { id: 'cv',         title: 'Computer Vision', kicker: 'BRANCH',          desc: 'Teaching machines to see — detection, tracking, perception in degraded environments.', size: 10 },
        { id: 'autonomy',   title: 'Autonomy',        kicker: 'BRANCH',          desc: 'Systems that decide and act on their own — from underwater vehicles to control loops.', size: 9 },
        { id: 'ml',         title: 'Machine Learning', kicker: 'BRANCH',         desc: 'Models that learn from data — from neural nets built by hand to applied forecasting.', size: 10 },
        { id: 'research',   title: 'Research',        kicker: 'BRANCH',          desc: 'Published work in 6D pose estimation and medical image segmentation — IEEE & Elsevier.', size: 9 }
    ];
    const EDGES = [
        ['curiosity', 'programming'],
        ['programming', 'robotics'],
        ['programming', 'leadership'],
        ['robotics', 'cv'],
        ['robotics', 'autonomy'],
        ['robotics', 'ml'],
        ['robotics', 'research'],
        ['cv', 'ml'],            // the disciplines cross-pollinate
        ['cv', 'autonomy']
    ];

    let W = 0, H = 0, DPR = 1;
    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth; H = canvas.clientHeight;
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    const nodes = NODES.map((b, i) => {
        const a = (i / NODES.length) * Math.PI * 2;
        return { ...b, x: Math.cos(a), y: Math.sin(a), vx: 0, vy: 0,
                 fixed: false, phase: Math.random() * 6.28, phaseSpd: 0.016 + Math.random() * 0.012 };
    });
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    function seed() {
        for (const n of nodes) {
            const a = Math.atan2(n.y || 0.01, n.x || 0.01);
            const r = n.root ? 0 : Math.min(W, H) * 0.3;
            n.x = W / 2 + Math.cos(a) * r + (Math.random() - 0.5) * 24;
            n.y = H / 2 + Math.sin(a) * r + (Math.random() - 0.5) * 24;
        }
    }
    resize(); seed();
    new ResizeObserver(() => { const had = W; resize(); if (!had && W) seed(); }).observe(wrap);

    const REPEL = 4600, SPRING = 0.012, SPRING_LEN = 84, DAMPING = 0.88, CENTER_PULL = 0.0014;
    let dragging = null, hovered = null;

    function pos(e) {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: p.clientX - r.left, y: p.clientY - r.top };
    }
    function pick(mx, my) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i], dx = n.x - mx, dy = n.y - my, pad = n.size + 8;
            if (dx * dx + dy * dy <= pad * pad) return n;
        }
        return null;
    }
    function showDetail(n) {
        dKicker.textContent = n.kicker;
        dTitle.textContent = n.title;
        dDesc.textContent = n.desc;
        detail.classList.add('on');
        detail.setAttribute('aria-hidden', 'false');
        moveDetail(n);
    }
    function hideDetail() { detail.classList.remove('on'); detail.setAttribute('aria-hidden', 'true'); }
    function moveDetail(n) {
        const w = detail.offsetWidth || 220, h = detail.offsetHeight || 88;
        let x = n.x + 18, y = n.y + 18;
        if (x + w > W) x = n.x - w - 18;
        if (y + h > H) y = H - h - 6;
        detail.style.left = Math.max(4, x) + 'px';
        detail.style.top = Math.max(4, y) + 'px';
    }

    canvas.addEventListener('mousedown', e => {
        const { x, y } = pos(e);
        dragging = pick(x, y);
        if (dragging) dragging.fixed = true;
    });
    window.addEventListener('mousemove', e => {
        if (!W) return;
        const { x, y } = pos(e);
        if (dragging) {
            dragging.vx += (x - dragging.x) * 0.35;
            dragging.vy += (y - dragging.y) * 0.35;
            if (hovered) moveDetail(hovered);
            return;
        }
        const h = pick(x, y);
        if (h !== hovered) { hovered = h; h ? showDetail(h) : hideDetail(); }
        else if (h) moveDetail(h);
    }, { passive: true });
    window.addEventListener('mouseup', () => { if (dragging) { dragging.fixed = false; dragging = null; } });
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const { x, y } = pos(e);
        dragging = pick(x, y);
        if (dragging) { dragging.fixed = true; hovered = dragging; showDetail(dragging); }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!dragging) return;
        const { x, y } = pos(e);
        dragging.vx += (x - dragging.x) * 0.35;
        dragging.vy += (y - dragging.y) * 0.35;
        moveDetail(dragging);
    }, { passive: false });
    canvas.addEventListener('touchend', () => { if (dragging) dragging.fixed = false; dragging = null; setTimeout(hideDetail, 1600); });

    let frame = 0, cooldown = 70, running = true;
    function step() {
        frame++;
        if (!REDUCED) {
            cooldown--;
            if (cooldown <= 0 && !dragging) {
                const free = nodes.filter(n => !n.fixed);
                if (free.length) { const t = free[(Math.random() * free.length) | 0], a = Math.random() * 6.28, m = 0.3 + Math.random() * 0.7; t.vx += Math.cos(a) * m; t.vy += Math.sin(a) * m; }
                cooldown = 50 + (Math.random() * 80 | 0);
            }
        }
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1;
                const d = Math.sqrt(d2), f = REPEL / d2, fx = dx / d * f, fy = dy / d * f;
                if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
                if (!b.fixed) { b.vx += fx; b.vy += fy; }
            }
        }
        for (const [aId, bId] of EDGES) {
            const a = byId[aId], b = byId[bId];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(Math.hypot(dx, dy), 0.01);
            const f = SPRING * (d - SPRING_LEN), fx = dx / d * f, fy = dy / d * f;
            if (!a.fixed) { a.vx += fx; a.vy += fy; }
            if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
        }
        for (const n of nodes) {
            n.vx += (W / 2 - n.x) * CENTER_PULL;
            n.vy += (H / 2 - n.y) * CENTER_PULL;
            if (!n.fixed && !REDUCED) {
                n.vx += Math.sin(frame * n.phaseSpd + n.phase) * 0.025;
                n.vy += Math.cos(frame * n.phaseSpd * 0.83 + n.phase * 1.3) * 0.025;
            }
            n.vx *= DAMPING; n.vy *= DAMPING;
            n.x += n.vx; n.y += n.vy;
            const pad = n.size + 6;
            if (n.x < pad) { n.x = pad; n.vx *= -0.4; }
            if (n.x > W - pad) { n.x = W - pad; n.vx *= -0.4; }
            if (n.y < pad) { n.y = pad; n.vy *= -0.4; }
            if (n.y > H - pad) { n.y = H - pad; n.vy *= -0.4; }
        }
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const [aId, bId] of EDGES) {
            const a = byId[aId], b = byId[bId];
            const hot = hovered && (hovered.id === aId || hovered.id === bId);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = hot ? LIME : `rgba(${GREY}, 0.22)`;
            ctx.lineWidth = hot ? 1.4 : 1;
            ctx.stroke();
        }
        for (const n of nodes) {
            const hot = hovered === n || dragging === n;
            const lit = n.root || hot;
            const r = n.size;
            if (hot) {
                const g = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 3.2);
                g.addColorStop(0, 'rgba(198, 241, 53, 0.26)');
                g.addColorStop(1, 'rgba(198, 241, 53, 0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(n.x, n.y, r * 3.2, 0, 6.2832); ctx.fill();
            }
            if (n.root) {
                // the lit origin: filled lime
                ctx.fillStyle = LIME;
                ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
                ctx.fillStyle = BG;
                ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.34, 0, 6.2832); ctx.fill();
            } else {
                // a branch: outlined circle, lights up on hover
                ctx.fillStyle = BG;
                ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
                ctx.strokeStyle = hot ? LIME : `rgba(${GREY}, 0.8)`;
                ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.stroke();
            }
            ctx.font = '700 10px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = lit ? LIME : `rgba(${GREY}, 0.9)`;
            ctx.fillText(n.title, n.x, n.y + r + 15);
        }
    }
    function loop() { if (running) { step(); draw(); } requestAnimationFrame(loop); }
    loop();
    document.addEventListener('visibilitychange', () => { running = !document.hidden; });
})();

/* ───────────────────────────────────────────────
   4 · SCENES — every visual states its technology.
   Shared by the Selected Work exhibition (index) and
   the engineering archive (projects page).
   ─────────────────────────────────────────────── */
function pipeline(g, stages, y) {
    y = y || 290;
    const M = 42, GAP = 26;
    const w = (800 - M * 2 - GAP * (stages.length - 1)) / stages.length;
    let d = 0.15;
    stages.forEach((st, i) => {
        const x = M + i * (w + GAP);
        const box = el('g', { class: 'eng-box pop', style: `--d:${d}s` }, g);
        el('rect', { x, y: y - 30, width: w, height: 60, rx: 1 }, box);
        const t = el('text', { x: x + w / 2, y: y - 4, 'text-anchor': 'middle', class: 'ex-label' }, box);
        t.textContent = st.l;
        if (st.s) {
            const s = el('text', { x: x + w / 2, y: y + 15, 'text-anchor': 'middle', class: 'ex-sublabel' }, box);
            s.textContent = st.s;
        }
        if (i < stages.length - 1) {
            el('path', { d: `M${x + w} ${y} H${x + w + GAP}`, class: 'eng-line draw', pathLength: 1, style: `--d:${d + 0.1}s` }, g);
            el('path', { d: `M${x + w + GAP - 7} ${y - 4} L${x + w + GAP} ${y} L${x + w + GAP - 7} ${y + 4}`, class: 'eng-line pop', pathLength: 1, style: `--d:${d + 0.25}s` }, g);
        }
        d += 0.16;
    });
}

function blueprint(g) {
    let d = '';
    for (let x = 50; x < 800; x += 50) d += `M${x} 0 V560 `;
    for (let y = 50; y < 560; y += 50) d += `M0 ${y} H800 `;
    el('path', { d, class: 'eng-bp' }, g);
}

const SCENES = {
    auv: {
        show(g) {
            [['10m', 140], ['20m', 280], ['30m', 420]].forEach(([t, y]) => {
                el('path', { d: `M740 ${y} H760`, class: 'es-soft' }, g);
                const tx = el('text', { x: 735, y: y + 4, 'text-anchor': 'end', class: 'ex-sublabel' }, g);
                tx.textContent = t;
            });
        },
        eng(g) {
            blueprint(g);
            pipeline(g, [
                { l: 'Camera · Sonar', s: 'raw streams' },
                { l: 'Preprocess', s: 'denoise' },
                { l: 'YOLO Detect', s: 'gates · buoys', hot: true },
                { l: 'ROS Graph', s: 'publish' },
                { l: 'Navigate', s: 'act' }
            ]);
            const cap = el('text', { x: 42, y: 80, class: 'ex-label pop', style: '--d:.9s' }, g);
            cap.textContent = 'perception stack — runs on board, real time';
        }
    },
    kinematics: {
        show(g) {
            el('path', { d: 'M150 470 L260 300 L420 350 L530 230', class: 'es-chain' }, g);
            el('path', { d: 'M120 470 H180', class: 'es-soft' }, g);
            [[150, 470], [260, 300], [420, 350]].forEach(([x, y]) =>
                el('circle', { cx: x, cy: y, r: 6, class: 'es-joint' }, g));
            el('path', { d: 'M285 285 A 38 38 0 0 1 295 320', class: 'es-dash' }, g);
            el('path', { d: 'M440 330 A 32 32 0 0 1 448 365', class: 'es-dash' }, g);
            el('path', { d: 'M530 230 C 590 180, 650 170, 700 190', class: 'es-dash' }, g);
            el('circle', { cx: 700, cy: 190, r: 4, class: 'es-waypoint' }, g);
        },
        eng(g) {
            blueprint(g);
            pipeline(g, [
                { l: 'Camera', s: '30 fps' },
                { l: 'MediaPipe', s: '21 keypoints' },
                { l: 'Joint Map', s: 'θ1 θ2 θ3', hot: true },
                { l: 'PyFirmata', s: 'serial' },
                { l: 'Servos', s: '3 DOF' }
            ], 440);
        }
    },
    vision: {
        show(g) {
            const pts = [[120, 120], [200, 180], [310, 90], [430, 150], [560, 110], [660, 200],
                         [150, 320], [260, 380], [390, 300], [520, 360], [640, 320], [220, 470],
                         [460, 460], [600, 440], [340, 200], [580, 250]];
            pts.forEach(([x, y]) => {
                el('path', { d: `M${x - 4} ${y} H${x + 4} M${x} ${y - 4} V${y + 4}`, class: 'es-feature' }, g);
            });
            const x = 330, y = 270, w = 150, h = 110, c = 16;
            el('path', {
                d: [`M${x} ${y + c} V${y} H${x + c}`, `M${x + w - c} ${y} H${x + w} V${y + c}`,
                    `M${x + w} ${y + h - c} V${y + h} H${x + w - c}`, `M${x + c} ${y + h} H${x} V${y + h - c}`].join(' '),
                class: 'es-soft', stroke: 'rgba(198,241,53,0.6)'
            }, g);
            const t = el('text', { x, y: y - 9, class: 'ex-sublabel', fill: 'rgba(198,241,53,0.55)' }, g);
            t.textContent = 'target 0.97';
        },
        eng(g) {
            blueprint(g);
            pipeline(g, [
                { l: 'Roboflow', s: 'annotate' },
                { l: 'YOLO Train', s: 'custom set', hot: true },
                { l: 'Optimize', s: 'edge real-time' },
                { l: 'Deploy', s: '→ MIRA' }
            ], 470);
            [[120, 120, 26, 8], [430, 150, 22, 10], [640, 320, -24, -6], [260, 380, 20, -8]].forEach(([x, y, vx, vy], i) => {
                el('path', { d: `M${x} ${y} l${vx} ${vy}`, class: 'eng-line draw', pathLength: 1, style: `--d:${0.7 + i * 0.12}s` }, g);
            });
        }
    },
    forecast: {
        show(g) {
            el('path', { d: 'M90 470 V90 M90 470 H720', class: 'es-soft' }, g);
            el('path', { d: 'M90 430 C 200 420, 280 380, 400 330', class: 'es-chain' }, g);
            el('path', { d: 'M400 330 C 500 290, 600 220, 700 160', class: 'es-dash' }, g);
            el('circle', { cx: 700, cy: 160, r: 4.5, fill: 'rgba(198,241,53,0.65)' }, g);
            const t = el('text', { x: 400, y: 500, class: 'ex-sublabel' }, g);
            t.textContent = 'observed · · · forecast';
        },
        eng(g) {
            blueprint(g);
            pipeline(g, [
                { l: 'Playwright', s: 'RBI DBIE' },
                { l: 'Parse', s: 'xlsx → parquet' },
                { l: 'Prophet', s: 'time-series', hot: true },
                { l: 'Forecast', s: '2.1% MAPE' }
            ], 250);
            el('path', { d: 'M400 310 C 500 270, 600 200, 700 135', class: 'eng-line draw', pathLength: 1, style: '--d:.8s' }, g);
            el('path', { d: 'M400 350 C 500 310, 600 240, 700 185', class: 'eng-line draw', pathLength: 1, style: '--d:.9s' }, g);
            const t = el('text', { x: 590, y: 120, class: 'ex-label pop', style: '--d:1.1s' }, g);
            t.textContent = 'confidence interval';
        }
    },
    learning: {
        show(g) {
            el('path', { d: 'M120 120 C 220 380, 300 440, 400 450 S 600 430, 700 410', class: 'es-chain' }, g);
            el('circle', { cx: 430, cy: 451, r: 4.5, fill: 'rgba(198,241,53,0.65)' }, g);
            const t1 = el('text', { x: 120, y: 95, class: 'ex-sublabel' }, g);
            t1.textContent = 'loss';
            const t2 = el('text', { x: 660, y: 500, class: 'ex-sublabel' }, g);
            t2.textContent = 'epochs';
            for (let x = 120; x <= 700; x += 58) el('path', { d: `M${x} 478 v6`, class: 'es-soft' }, g);
        },
        eng(g) {
            blueprint(g);
            pipeline(g, [
                { l: 'NumPy', s: 'nets by hand' },
                { l: 'Backprop', s: 'from scratch', hot: true },
                { l: 'PyTorch', s: 'training loops' },
                { l: 'CNN · Transfer', s: 'applied' }
            ], 230);
            const t = el('text', { x: 42, y: 80, class: 'ex-label pop', style: '--d:.9s' }, g);
            t.textContent = '46 notebooks — every concept proven in code';
        }
    },
    fieldwork: {
        show(g) {
            el('path', { d: 'M60 480 H740', class: 'es-soft' }, g);
            el('path', { d: 'M400 480 C 395 380, 380 320, 390 240 M392 350 C 350 320, 330 300, 322 260 M394 300 C 440 270, 455 250, 462 215', class: 'es-dash' }, g);
            [[390, 240], [322, 260], [462, 215]].forEach(([x, y]) =>
                el('circle', { cx: x, cy: y, r: 4, class: 'es-waypoint' }, g));
        },
        eng(g) {
            blueprint(g);
            pipeline(g, [
                { l: 'Field Data', s: 'crops · prices' },
                { l: 'CV Guidance', s: 'disease', hot: true },
                { l: 'Recommend', s: 'engine' },
                { l: 'Web App', s: 'for farmers' }
            ], 160);
        }
    }
};

/* ───────────────────────────────────────────────
   5 · SELECTED WORK — the exhibition (index page)
   A vertical list on the left; a large living preview
   on the right that changes as you move through it.
   ─────────────────────────────────────────────── */
const FEATURED = [
    { num: '01', name: 'MIRA 2.0', sub: 'Autonomous Underwater Vehicle', theme: 'auv', photo: true,
      idx: 'PRJ 01 — underwater autonomy',
      challenge: 'real-time underwater perception — light distortion, turbidity, and a live competition latency budget, all on the vehicle’s own hardware.',
      href: 'projects.html#mira' },
    { num: '02', name: 'Dexterous Robotic Arm', sub: 'Human–Robot Interaction', theme: 'kinematics',
      video: 'image/robarm.mp4',
      idx: 'PRJ 02 — human–machine interface',
      challenge: 'turning noisy hand landmarks into smooth, stable physical motion on a real 3-DOF manipulator.',
      href: 'projects.html#arm' },
    { num: '03', name: 'Object Detection Pipeline', sub: 'Computer Vision', theme: 'vision',
      idx: 'PRJ 03 — custom vision pipeline',
      challenge: 'surviving underwater domain shift while staying real-time on a constrained edge device.',
      href: 'projects.html#detect' },
    { num: '04', name: 'MPi Market Intelligence', sub: 'Forecasting & Data Engineering', theme: 'forecast',
      idx: 'PRJ 04 — time-series intelligence',
      challenge: 'forecasting reliably from a brittle government portal that publishes irregular Excel files.',
      href: 'projects.html#mpi' }
];

const swList = document.getElementById('sw-list');
const swStage = document.getElementById('sw-stage');
if (swList && swStage) {
    const wrap = document.getElementById('sw-stage-wrap');
    const photo = document.getElementById('sw-photo');
    const video = document.getElementById('sw-video');
    const idxEl = document.getElementById('sw-index');
    const chEl = document.getElementById('sw-challenge');
    const caseEl = document.getElementById('sw-case');

    FEATURED.forEach((p, i) => {
        const b = document.createElement('button');
        b.className = 'sw-item';
        b.setAttribute('role', 'tab');
        b.innerHTML = `<span class="sw-num mono">${p.num}</span><span class="sw-text"><span class="sw-name">${p.name}</span><span class="sw-sub">${p.sub}</span></span>`;
        b.addEventListener('click', () => select(i));
        if (CAN_HOVER) b.addEventListener('mouseenter', () => select(i));
        b.addEventListener('focus', () => select(i));
        swList.appendChild(b);
    });

    let current = -1;
    function select(i) {
        if (i === current) return;
        current = i;
        const p = FEATURED[i];
        swList.querySelectorAll('.sw-item').forEach((b, k) => {
            b.classList.toggle('on', k === i);
            b.setAttribute('aria-selected', String(k === i));
        });
        photo.hidden = !p.photo;
        idxEl.textContent = p.idx;
        chEl.textContent = p.challenge;
        caseEl.href = p.href;

        // a project can present a live video as its showcase; the blueprint
        // overlay still draws in over it for the engineering view.
        if (video) {
            video.hidden = !p.video;
            if (p.video) { video.currentTime = 0; video.play().catch(() => {}); }
            else video.pause();
        }

        swStage.innerHTML = '';
        if (!p.video) {
            const show = el('g', { class: 'show' }, swStage);
            SCENES[p.theme].show(show);
        }
        const eng = el('g', { class: 'eng' }, swStage);
        SCENES[p.theme].eng(eng);

        // restart the entry + draw animations
        wrap.classList.remove('eng-on', 'swap');
        void wrap.offsetWidth;
        wrap.classList.add('swap');
        requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('eng-on')));
    }
    select(0);
}

/* ───────────────────────────────────────────────
   6 · ENGINEERING ARCHIVE — case study visuals
   (projects page) with showcase / engineering modes
   ─────────────────────────────────────────────── */
document.querySelectorAll('.exhibit').forEach(article => {
    const theme = article.dataset.theme;
    const svg = article.querySelector('.ex-stage');
    const toggle = article.querySelector('.ex-toggle');
    const visual = article.querySelector('.ex-visual');
    if (!theme || !svg || !SCENES[theme]) return;

    // when a live video is the showcase, skip the abstract scene and keep
    // only the engineering blueprint — it draws in over the darkened video.
    const hasVideo = !!article.querySelector('.ex-video');
    if (!hasVideo) {
        const show = el('g', { class: 'show' }, svg);
        SCENES[theme].show(show);
    }
    const eng = el('g', { class: 'eng' }, svg);
    SCENES[theme].eng(eng);

    let pinned = false, hovered = false;
    function update() {
        const on = pinned || hovered;
        article.classList.toggle('eng-on', on);
        if (toggle) {
            toggle.setAttribute('aria-pressed', String(on));
            toggle.textContent = on ? 'showcase view' : 'engineering view';
        }
    }
    if (toggle) toggle.addEventListener('click', () => { pinned = !pinned; update(); });
    if (CAN_HOVER && visual) {
        visual.addEventListener('mouseenter', () => { hovered = true; update(); });
        visual.addEventListener('mouseleave', () => { hovered = false; update(); });
    }
});

/* ───────────────────────────────────────────────
   7 · EXPERIENCE TABS — internships ↔ leadership
   ─────────────────────────────────────────────── */
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => btn.addEventListener('click', () => {
    tabBtns.forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.tab-panel').forEach(p =>
        p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
    updateRails();
}));

/* ───────────────────────────────────────────────
   8 · SKILLS — wires from the core to clusters
   ─────────────────────────────────────────────── */
const capMap = document.getElementById('cap-map');
const capWires = document.getElementById('cap-wires');
const capCore = document.getElementById('cap-core');
if (capMap && capWires && capCore) {
    function drawWires() {
        capWires.innerHTML = '';
        const mapRect = capMap.getBoundingClientRect();
        const coreRect = capCore.getBoundingClientRect();
        const x0 = coreRect.left - mapRect.left + coreRect.width / 2;
        const y0 = coreRect.top - mapRect.top + coreRect.height;
        capMap.querySelectorAll('[data-cluster]').forEach(cl => {
            const r = cl.getBoundingClientRect();
            const x1 = r.left - mapRect.left + r.width / 2;
            const y1 = r.top - mapRect.top;
            const path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('d', `M${x0} ${y0} C${x0} ${y0 + 50}, ${x1} ${y1 - 50}, ${x1} ${y1}`);
            path.setAttribute('class', 'cap-wire');
            capWires.appendChild(path);
        });
        capMap.classList.add('wired');
    }
    const wireObs = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { drawWires(); wireObs.disconnect(); }
    }, { threshold: 0.1 });
    wireObs.observe(capMap);
    let rT;
    window.addEventListener('resize', () => {
        clearTimeout(rT);
        rT = setTimeout(() => { if (capMap.classList.contains('wired')) drawWires(); }, 180);
    });
}

/* ───────────────────────────────────────────────
   9 · EXPERIENCE — each visible rail fills on scroll
   ─────────────────────────────────────────────── */
const rails = [...document.querySelectorAll('.growth')];
function updateRails() {
    if (REDUCED) return;
    rails.forEach(track => {
        const fill = track.querySelector('.growth-rail-fill');
        if (!fill || track.offsetParent === null) return;   // skip hidden tab panels
        const r = track.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.75 - r.top) / r.height));
        fill.style.transform = `scaleY(${progress})`;
    });
}
if (rails.length && !REDUCED) {
    window.addEventListener('scroll', updateRails, { passive: true });
    updateRails();
}

})();
