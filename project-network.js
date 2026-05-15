/* ═══════════════════════════════════════════════
   PROJECT NETWORK — force-directed graph for Eshaan's projects
   Drag nodes · hover for details · click to open · springy water physics
   Adapted from rahulbk.com constellation, dark theme + Eshaan's data
   ═══════════════════════════════════════════════ */
(function () {
    const canvas = document.getElementById('project-network');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const detail = document.getElementById('node-detail');
    const dKicker = document.getElementById('node-kicker');
    const dTitle  = document.getElementById('node-title');
    const dDesc   = document.getElementById('node-desc');
    const dCta    = document.getElementById('node-cta');

    /* ── colors ── */
    const css = getComputedStyle(document.documentElement);
    const LIME    = (css.getPropertyValue('--lime')    || '#c6f135').trim();
    const CYAN    = (css.getPropertyValue('--cyan')    || '#35f1e4').trim();
    const MAGENTA = (css.getPropertyValue('--magenta') || '#f135c6').trim();
    const ORANGE  = (css.getPropertyValue('--orange')  || '#f1a035').trim();
    const TEXT_3  = (css.getPropertyValue('--text-3')  || '#5c5c72').trim();
    const BORDER  = (css.getPropertyValue('--border-bright') || '#3a3a55').trim();
    const BG      = (css.getPropertyValue('--bg')      || '#0b0b0f').trim();

    /* ── data: 6 projects + key tech as nodes ── */
    const BUILDS = [
        /* Projects */
        { id: 'auv',   kicker: '2025 · ACTIVE',     title: 'AUV Mira',                  desc: 'Full CV perception stack for Team Dreadnought\'s autonomous underwater vehicle. YOLO detection, sonar preprocessing, real-time inference for international competitions.', cluster: 'robotics', size: 14, kind: 'project', link: 'https://github.com/Dreadnought-Robotics/mira' },
        { id: 'arm',   kicker: '2025 · COMPLETE',   title: '3-DOF Robotic Arm',         desc: 'Real-time hand-tracking robotic arm using MediaPipe + Arduino. End-to-end vision pipeline, dual-hand tracking, joint-angle mapping. Validated in hardware at Coratia Technologies.', cluster: 'robotics', size: 12, kind: 'project', link: 'https://github.com/Eshaan0110/Eshaan--Coratia-Technologies' },
        { id: 'dl',    kicker: '2024 · 46 COMMITS', title: 'Deep Learning Journey',     desc: 'Ground-up DL curriculum. NumPy fundamentals → neural networks from scratch → PyTorch tensor ops, backprop, CNNs, transfer learning.', cluster: 'ml',       size: 11, kind: 'project', link: 'https://github.com/Eshaan0110/Deep-Learning-Journey' },
        { id: 'mpi',   kicker: '2024 · 2.1% MAPE',  title: 'MPi Platform',              desc: 'RBI Payment Systems ML pipeline. Playwright scrape → Parquet → Prophet forecasting on card-payment volumes. Includes production architecture design doc.', cluster: 'ml',       size: 11, kind: 'project', link: 'https://github.com/Eshaan0110/mpi-market-intelligence' },
        { id: 'agri',  kicker: '2024 · SIH',        title: 'Agri-Mitra',                desc: 'Smart India Hackathon project. Crop recommendations, disease detection, market prices. Contributed CV components + backend data pipeline.',                                                cluster: 'cv',       size: 10, kind: 'project', link: 'https://github.com/Eshaan0110/Agri-Mitra' },
        { id: 'yolo',  kicker: '2024 · EDGE',       title: 'Custom YOLO Pipeline',      desc: 'Trained and deployed a custom YOLO model on a domain-specific dataset. Roboflow annotation, edge-optimised inference. Directly applied in AUV Mira perception stack.', cluster: 'cv',       size: 10, kind: 'project', link: 'https://github.com/Eshaan0110/AUV-Mira' },
        /* Tech / skill hubs */
        { id: 'python',    kicker: 'TECH', title: 'Python',    desc: 'Primary language across robotics, CV, and ML projects.', cluster: 'tech', size: 8, kind: 'tech' },
        { id: 'opencv',    kicker: 'TECH', title: 'OpenCV',    desc: 'Real-time vision pipelines, hand-tracking, AUV preprocessing.', cluster: 'tech', size: 8, kind: 'tech' },
        { id: 'yolo-t',    kicker: 'TECH', title: 'YOLO',      desc: 'Detection backbone for AUV and the custom pipeline.', cluster: 'tech', size: 7, kind: 'tech' },
        { id: 'pytorch',   kicker: 'TECH', title: 'PyTorch',   desc: 'Deep learning framework — DL Journey + YOLO training.', cluster: 'tech', size: 8, kind: 'tech' },
        { id: 'mediapipe', kicker: 'TECH', title: 'MediaPipe', desc: 'Hand-landmark detection for the gesture-controlled arm.', cluster: 'tech', size: 7, kind: 'tech' },
        { id: 'ros',       kicker: 'TECH', title: 'ROS',       desc: 'Middleware glueing the AUV perception stack together.', cluster: 'tech', size: 7, kind: 'tech' },
        { id: 'arduino',   kicker: 'TECH', title: 'Arduino',   desc: 'Embedded servo control for the gesture-controlled arm.', cluster: 'tech', size: 7, kind: 'tech' },
    ];

    /* edges: project → its tech (auto-clusters projects that share tech) */
    const EDGES = [
        ['auv','yolo-t'], ['auv','opencv'], ['auv','ros'], ['auv','python'],
        ['arm','mediapipe'], ['arm','opencv'], ['arm','arduino'], ['arm','python'],
        ['dl','pytorch'], ['dl','python'],
        ['mpi','python'], ['mpi','pytorch'],
        ['agri','opencv'], ['agri','python'],
        ['yolo','yolo-t'], ['yolo','pytorch'], ['yolo','opencv'], ['yolo','python'],
        ['opencv','yolo-t'], ['pytorch','yolo-t']
    ];

    const clusterColor = {
        robotics: CYAN,
        cv:       LIME,
        ml:       MAGENTA,
        software: ORANGE,
        tech:     TEXT_3
    };

    let W, H, DPR;
    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width  = W * DPR;
        canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', () => {
        resize();
        /* gently nudge nodes back into bounds */
        for (const n of nodes) {
            n.x = Math.max(n.size + 8, Math.min(W - n.size - 8, n.x));
            n.y = Math.max(n.size + 8, Math.min(H - n.size - 8, n.y));
        }
    });

    /* initial positions: cluster projects loosely around center */
    const nodes = BUILDS.map((b, i) => {
        const angle = (i / BUILDS.length) * Math.PI * 2;
        const r = b.kind === 'project' ? 110 : 180;
        return {
            ...b,
            x: W / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
            y: H / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
            vx: 0, vy: 0,
            fixed: false,
            phase: Math.random() * Math.PI * 2,
            phaseSpd: 0.018 + Math.random() * 0.012,
            color: clusterColor[b.cluster] || TEXT_3
        };
    });
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

    /* ── physics (tuned for water-jelly feel) ── */
    const REPEL       = 5200;
    const SPRING      = 0.011;
    const SPRING_LEN  = 95;
    const DAMPING     = 0.88;     /* higher than Rahul's 0.86 = more wobble */
    const CENTER_PULL = 0.0009;

    let dragging = null;
    let hovered  = null;
    let pressStart = null;        /* to distinguish click from drag */
    let mouseX = 0, mouseY = 0;

    function getMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        return { x: cx, y: cy };
    }

    function pickNode(mx, my) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = n.x - mx, dy = n.y - my;
            const pad = n.size + 6;
            if (dx*dx + dy*dy <= pad * pad) return n;
        }
        return null;
    }

    function showDetail(n) {
        dKicker.textContent = n.kicker;
        dTitle.textContent  = n.title;
        dDesc.textContent   = n.desc;
        if (n.kind === 'project' && n.link) {
            dCta.style.display = '';
            dCta.textContent = 'Open on GitHub →';
        } else {
            dCta.style.display = 'none';
        }
        detail.style.borderColor = n.color;
        detail.classList.add('visible');
    }
    function hideDetail() {
        detail.classList.remove('visible');
    }
    function moveDetail(n) {
        detail.style.left = n.x + 'px';
        detail.style.top  = n.y + 'px';
    }

    /* ── input ── */
    canvas.addEventListener('mousedown', e => {
        const { x, y } = getMouse(e);
        dragging = pickNode(x, y);
        if (dragging) {
            dragging.fixed = true;
            pressStart = { x, y, t: Date.now(), node: dragging };
            canvas.style.cursor = 'grabbing';
        }
    });
    canvas.addEventListener('mousemove', e => {
        const { x, y } = getMouse(e);
        mouseX = x; mouseY = y;
        if (dragging) {
            /* water physics: instead of clamping, apply a soft pull so the node bobs toward cursor */
            const k = 0.35;
            dragging.vx += (x - dragging.x) * k;
            dragging.vy += (y - dragging.y) * k;
        }
        const h = pickNode(x, y);
        if (h !== hovered) {
            hovered = h;
            if (h) { showDetail(h); moveDetail(h); canvas.style.cursor = 'pointer'; }
            else   { hideDetail();  canvas.style.cursor = dragging ? 'grabbing' : 'grab'; }
        } else if (h) {
            moveDetail(h);
        }
    });
    canvas.addEventListener('mouseup', e => {
        if (dragging) {
            dragging.fixed = false;
            /* click vs drag: if barely moved AND short press, treat as click → open link */
            if (pressStart && dragging.kind === 'project' && dragging.link) {
                const { x, y } = getMouse(e);
                const dx = x - pressStart.x, dy = y - pressStart.y;
                const dist2 = dx*dx + dy*dy;
                const elapsed = Date.now() - pressStart.t;
                if (dist2 < 25 && elapsed < 280) {
                    window.open(dragging.link, '_blank', 'noopener');
                }
            }
            dragging = null;
            pressStart = null;
            canvas.style.cursor = hovered ? 'pointer' : 'grab';
        }
    });
    canvas.addEventListener('mouseleave', () => {
        if (dragging) { dragging.fixed = false; dragging = null; }
        hovered = null;
        hideDetail();
        canvas.style.cursor = 'grab';
    });

    /* touch */
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const { x, y } = getMouse(e);
        dragging = pickNode(x, y);
        if (dragging) {
            dragging.fixed = true;
            pressStart = { x, y, t: Date.now(), node: dragging };
            showDetail(dragging); moveDetail(dragging);
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (dragging) {
            const { x, y } = getMouse(e);
            const k = 0.35;
            dragging.vx += (x - dragging.x) * k;
            dragging.vy += (y - dragging.y) * k;
            moveDetail(dragging);
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
        if (dragging) { dragging.fixed = false; dragging = null; }
        setTimeout(hideDetail, 1500);
    });

    /* ── ambient motion state ── */
    let frame = 0;
    let perturbCooldown = 60;

    /* ── simulation step ── */
    function step() {
        frame++;

        /* periodic gentle impulse — keeps the network alive between interactions */
        perturbCooldown--;
        if (perturbCooldown <= 0 && !dragging) {
            const free = nodes.filter(n => !n.fixed);
            if (free.length) {
                const target = free[Math.floor(Math.random() * free.length)];
                const ang = Math.random() * Math.PI * 2;
                const mag = 0.5 + Math.random() * 0.9;
                target.vx += Math.cos(ang) * mag;
                target.vy += Math.sin(ang) * mag;
            }
            perturbCooldown = 30 + Math.floor(Math.random() * 60);
        }

        /* repulsion */
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                let d2 = dx*dx + dy*dy;
                if (d2 < 1) d2 = 1;
                const d = Math.sqrt(d2);
                const f = REPEL / d2;
                const fx = (dx / d) * f, fy = (dy / d) * f;
                if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
                if (!b.fixed) { b.vx += fx; b.vy += fy; }
            }
        }
        /* springs */
        for (const [aId, bId] of EDGES) {
            const a = byId[aId], b = byId[bId];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.max(Math.sqrt(dx*dx + dy*dy), 0.01);
            const f = SPRING * (d - SPRING_LEN);
            const fx = (dx / d) * f, fy = (dy / d) * f;
            if (!a.fixed) { a.vx += fx; a.vy += fy; }
            if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
        }
        /* center pull + ambient breathing + damping + integration */
        for (const n of nodes) {
            n.vx += (W/2 - n.x) * CENTER_PULL;
            n.vy += (H/2 - n.y) * CENTER_PULL;
            /* gentle per-node breathing — never settles */
            if (!n.fixed) {
                n.vx += Math.sin(frame * n.phaseSpd + n.phase) * 0.04;
                n.vy += Math.cos(frame * n.phaseSpd * 0.83 + n.phase * 1.3) * 0.04;
            }
            n.vx *= DAMPING;
            n.vy *= DAMPING;
            n.x += n.vx;
            n.y += n.vy;
            /* containment */
            const pad = n.size + 6;
            if (n.x < pad)     { n.x = pad;     n.vx *= -0.4; }
            if (n.x > W - pad) { n.x = W - pad; n.vx *= -0.4; }
            if (n.y < pad)     { n.y = pad;     n.vy *= -0.4; }
            if (n.y > H - pad) { n.y = H - pad; n.vy *= -0.4; }
        }
    }

    /* ── render ── */
    function hexA(h, a) {
        const c = h.replace('#', '');
        return `rgba(${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)},${a})`;
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        /* edges */
        for (const [aId, bId] of EDGES) {
            const a = byId[aId], b = byId[bId];
            const isHot = hovered && (hovered.id === aId || hovered.id === bId);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = isHot ? hexA(LIME, 0.55) : hexA(BORDER, 0.28);
            ctx.lineWidth   = isHot ? 1.5 : 1;
            ctx.stroke();
        }

        /* nodes */
        for (const n of nodes) {
            const isHot = hovered === n || dragging === n;
            const r = n.size;
            const isProject = n.kind === 'project';

            /* soft halo on hover */
            if (isHot) {
                const grd = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 3.2);
                grd.addColorStop(0, hexA(n.color, 0.35));
                grd.addColorStop(1, hexA(n.color, 0));
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 3.2, 0, Math.PI * 2);
                ctx.fill();
            }

            if (isProject) {
                /* outer ring */
                ctx.strokeStyle = hexA(n.color, 0.45);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
                ctx.stroke();
                /* filled circle */
                ctx.fillStyle = n.color;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                ctx.fill();
                /* tiny dark dot in middle */
                ctx.fillStyle = BG;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 0.35, 0, Math.PI * 2);
                ctx.fill();
            } else {
                /* tech node = small SQUARE (matches retro pixel aesthetic) */
                const s = r * 1.4;
                ctx.fillStyle = isHot ? n.color : hexA(n.color, 0.65);
                ctx.fillRect(n.x - s/2, n.y - s/2, s, s);
                ctx.strokeStyle = isHot ? n.color : hexA(n.color, 0.9);
                ctx.lineWidth = 1;
                ctx.strokeRect(n.x - s/2 - 0.5, n.y - s/2 - 0.5, s + 1, s + 1);
            }

            /* label for projects, small mono */
            if (isProject) {
                ctx.font = '600 10px "Space Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillStyle = hexA(n.color, isHot ? 1 : 0.85);
                ctx.fillText(n.title.split(' — ')[0].split(' · ')[0].toUpperCase(), n.x, n.y + r + 16);
            }
        }
    }

    function loop() {
        step();
        draw();
        if (hovered) moveDetail(hovered);
        requestAnimationFrame(loop);
    }
    loop();
})();
