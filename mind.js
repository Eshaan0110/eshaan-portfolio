/* ============================================================
   mind.js — all the interactive behaviour for the portfolio.

   Sections in this file:
     1. Helpers & feature flags
     2. Background "fabric" grid (bends under the cursor)
     3. Scroll reveals + navigation bar behaviour
     4. Hero text animation + name auto-fit
     5. Custom cursor (dot + trailing ring)
     6. About: interactive "evolution" graph
     7. Project scene drawings (shared data + draw helpers)
     8. Home page "Selected Work" preview switcher
     9. Projects page "engineering archive" toggles
    10. Experience tabs (Internships / Leadership)
    11. Skills: curved wires from the core to each cluster
    12. Experience: progress rail that fills on scroll

   IMPORTANT: every number here (sizes, speeds, delays) is tuned
   to match the visuals. Changing them changes how the site looks.
   ============================================================ */

(() => {
'use strict';

/* ============================================================
   1. HELPERS & FEATURE FLAGS
   ============================================================ */

// True if the visitor asked their OS to reduce animation.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// True on devices with a real mouse (so hover effects make sense).
const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// The grey used everywhere, written as "r, g, b" so we can drop it
// straight into `rgba(...)` strings with any opacity.
const GREY = '158, 162, 178';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Create an SVG element, set its attributes, and (optionally) append it
// to a parent. Used by all the project drawings below.
function createSvgElement(tagName, attributes, parent) {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);
    for (const name in attributes) {
        element.setAttribute(name, attributes[name]);
    }
    if (parent) {
        parent.appendChild(element);
    }
    return element;
}


/* ============================================================
   2. BACKGROUND "FABRIC" GRID
   A perspective grid drawn on a full-screen canvas. Each line
   crossing is a "point" connected to its resting spot by a
   spring. The mouse pushes nearby points away, and the springs
   pull them back — so the grid ripples like cloth.
   ============================================================ */

const fieldCanvas = document.getElementById('field');

// Work out the resting position of every grid point for a given
// screen size. Returns the points plus how many rows/columns there are.
function buildGridPositions(screenWidth, screenHeight) {
    const spacing = Math.max(54, Math.min(72, screenWidth / 22));
    const rowCount = 20;
    const columnCount = Math.ceil(screenWidth / (spacing * 0.72)) + 2;

    const points = [];
    for (let row = 0; row <= rowCount; row++) {
        const rowFraction = row / rowCount;
        // Rows bunch up near the top and spread out near the bottom (perspective).
        const restingY = screenHeight * (0.02 + 0.98 * Math.pow(rowFraction, 1.28));
        // Columns fan out slightly as they go down the screen.
        const fan = 0.74 + 0.36 * rowFraction;
        for (let column = 0; column <= columnCount; column++) {
            points.push({
                restingX: screenWidth / 2 + (column - columnCount / 2) * spacing * fan,
                restingY: restingY
            });
        }
    }
    return { points, rowCount, columnCount };
}

if (fieldCanvas && !prefersReducedMotion) {
    // ---- Animated version (default) ----
    const ctx = fieldCanvas.getContext('2d');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);

    const MOUSE_RANGE = 185;   // how close the mouse must be to push a point (px)
    const PUSH_STRENGTH = 1100;
    const SPRING_STRENGTH = 42; // how hard points are pulled back to rest
    const DAMPING = 7.5;        // friction, so points settle instead of wobbling forever

    let screenWidth = 0;
    let screenHeight = 0;
    let rowCount = 0;
    let columnCount = 0;
    let gridPoints = [];
    let isRunning = true;
    let mouse = { x: -9999, y: -9999 };  // off-screen until the mouse moves
    let lastFrameTime = performance.now();

    // Size the canvas to the window and rebuild the grid at rest.
    function resizeGrid() {
        screenWidth = window.innerWidth;
        screenHeight = window.innerHeight;
        fieldCanvas.width = screenWidth * pixelRatio;
        fieldCanvas.height = screenHeight * pixelRatio;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const grid = buildGridPositions(screenWidth, screenHeight);
        rowCount = grid.rowCount;
        columnCount = grid.columnCount;
        // Each point starts at its resting spot with zero velocity.
        gridPoints = grid.points.map(point => ({
            restingX: point.restingX,
            restingY: point.restingY,
            x: point.restingX,
            y: point.restingY,
            velocityX: 0,
            velocityY: 0,
            displacement: 0
        }));
    }
    resizeGrid();
    window.addEventListener('resize', resizeGrid);

    window.addEventListener('mousemove', event => {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
    }, { passive: true });

    // When the mouse leaves the window, park it off-screen so the grid relaxes.
    window.addEventListener('mouseout', event => {
        if (!event.relatedTarget) {
            mouse.x = -9999;
            mouse.y = -9999;
        }
    });

    // Draw one line segment between two points. Lines that are bent
    // away from rest are drawn slightly brighter.
    function drawSegment(pointA, pointB) {
        const bend = Math.min(14, pointA.displacement + pointB.displacement);
        ctx.strokeStyle = `rgba(${GREY}, ${0.07 + bend * 0.016})`;
        ctx.beginPath();
        ctx.moveTo(pointA.x, pointA.y);
        ctx.lineTo(pointB.x, pointB.y);
        ctx.stroke();
    }

    // One animation frame: update the physics, then redraw the grid.
    function renderGridFrame(now) {
        if (!isRunning) return;

        // If the window changed size between frames, rebuild first.
        if (screenWidth !== window.innerWidth || screenHeight !== window.innerHeight) {
            resizeGrid();
        }

        // Seconds since the last frame, capped so a long pause can't "explode" the spring.
        const deltaTime = Math.min(0.04, (now - lastFrameTime) / 1000);
        lastFrameTime = now;

        // --- physics: move every point ---
        for (const point of gridPoints) {
            // Spring pulling the point back to its resting spot, minus friction.
            let accelX = (point.restingX - point.x) * SPRING_STRENGTH - point.velocityX * DAMPING;
            let accelY = (point.restingY - point.y) * SPRING_STRENGTH - point.velocityY * DAMPING;

            // Extra push away from the mouse if it's close enough.
            const toMouseX = mouse.x - point.x;
            const toMouseY = mouse.y - point.y;
            const distance = Math.hypot(toMouseX, toMouseY);
            if (distance < MOUSE_RANGE && distance > 4) {
                const falloff = Math.pow(1 - distance / MOUSE_RANGE, 2);
                const force = PUSH_STRENGTH * falloff / distance;
                accelX += toMouseX * force;
                accelY += toMouseY * force;
            }

            point.velocityX += accelX * deltaTime;
            point.velocityY += accelY * deltaTime;
            point.x += point.velocityX * deltaTime;
            point.y += point.velocityY * deltaTime;
            point.displacement = Math.hypot(point.x - point.restingX, point.y - point.restingY);
        }

        // --- draw: horizontal lines, then vertical lines ---
        ctx.clearRect(0, 0, screenWidth, screenHeight);
        ctx.lineWidth = 1;
        const pointsPerRow = columnCount + 1;

        for (let row = 0; row <= rowCount; row++) {
            for (let column = 0; column < columnCount; column++) {
                const index = row * pointsPerRow + column;
                drawSegment(gridPoints[index], gridPoints[index + 1]);
            }
        }
        for (let column = 0; column <= columnCount; column++) {
            for (let row = 0; row < rowCount; row++) {
                const index = row * pointsPerRow + column;
                drawSegment(gridPoints[index], gridPoints[index + pointsPerRow]);
            }
        }

        requestAnimationFrame(renderGridFrame);
    }
    requestAnimationFrame(renderGridFrame);

    // Pause the animation when the tab is hidden; resume when it returns.
    document.addEventListener('visibilitychange', () => {
        const wasRunning = isRunning;
        isRunning = !document.hidden;
        if (isRunning && !wasRunning) {
            lastFrameTime = performance.now();
            requestAnimationFrame(renderGridFrame);
        }
    });

} else if (fieldCanvas && prefersReducedMotion) {
    // ---- Static version (reduced motion): draw the grid once, no animation ----
    const ctx = fieldCanvas.getContext('2d');
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    fieldCanvas.width = screenWidth;
    fieldCanvas.height = screenHeight;

    const grid = buildGridPositions(screenWidth, screenHeight);
    const pointsPerRow = grid.columnCount + 1;
    ctx.strokeStyle = `rgba(${GREY}, 0.06)`;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Horizontal lines.
    for (let row = 0; row <= grid.rowCount; row++) {
        const start = grid.points[row * pointsPerRow];
        ctx.moveTo(start.restingX, start.restingY);
        for (let column = 1; column <= grid.columnCount; column++) {
            const point = grid.points[row * pointsPerRow + column];
            ctx.lineTo(point.restingX, point.restingY);
        }
    }
    // Vertical lines.
    for (let column = 0; column <= grid.columnCount; column++) {
        const start = grid.points[column];
        ctx.moveTo(start.restingX, start.restingY);
        for (let row = 1; row <= grid.rowCount; row++) {
            const point = grid.points[row * pointsPerRow + column];
            ctx.lineTo(point.restingX, point.restingY);
        }
    }
    ctx.stroke();
}


/* ============================================================
   3. SCROLL REVEALS + NAVIGATION BAR
   ============================================================ */

// Fade/slide elements in the first time they scroll into view.
// (Any element with class "rv", plus the about graph and timeline items.)
const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (entry.isIntersecting) {
            entry.target.classList.add('vis');
            revealObserver.unobserve(entry.target);  // only reveal once
        }
    }
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.rv, .evolution, .gevent').forEach((element) => {
    revealObserver.observe(element);
});

// Hide the nav bar when scrolling down, show it when scrolling up.
const navBar = document.getElementById('nav');
if (navBar) {
    let previousScrollY = 0;
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > previousScrollY;
        const pastTop = currentScrollY > 140;
        navBar.classList.toggle('hidden', scrollingDown && pastTop);
        previousScrollY = currentScrollY;
    }, { passive: true });
}

// Highlight the nav link for whichever section is currently on screen.
const navLinks = document.querySelectorAll('.nav-link');
const pageSections = document.querySelectorAll('section[id]');
if (navLinks.length && pageSections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const activeHref = '#' + entry.target.id;
            navLinks.forEach((link) => {
                link.classList.toggle('active', link.getAttribute('href') === activeHref);
            });
        }
    }, { rootMargin: '-40% 0px -55% 0px' });

    pageSections.forEach((section) => sectionObserver.observe(section));
}


/* ============================================================
   4. HERO TEXT
   ============================================================ */

// Light up "perceive", "reason", "interact" one after another.
document.querySelectorAll('.vital').forEach((word) => {
    const order = parseInt(word.dataset.v, 10) || 1;
    const delay = 900 + order * 450;
    setTimeout(() => word.classList.add('on'), delay);
});

// Scale the big name so the longest line exactly fills its column width.
const heroName = document.querySelector('.hero-name');
if (heroName) {
    const nameLines = [...heroName.querySelectorAll('.hn-line')];

    // Measure the real width of the text inside a line (not the full box).
    function measureTextWidth(lineElement) {
        const range = document.createRange();
        range.selectNodeContents(lineElement);
        return range.getBoundingClientRect().width;
    }

    function fitNameToColumn() {
        if (!nameLines.length) return;

        heroName.style.fontSize = '';  // reset to the CSS default before measuring
        const columnWidth = heroName.clientWidth;
        if (columnWidth < 80) return;

        const baseFontSize = parseFloat(getComputedStyle(heroName).fontSize);
        const widestLine = Math.max(...nameLines.map(measureTextWidth));
        if (widestLine < 10) return;

        // Grow/shrink the font so the widest line ≈ the column width.
        heroName.style.fontSize = (baseFontSize * columnWidth / widestLine * 0.995) + 'px';
    }

    // Re-fit after the next paint, after fonts load, and on window load.
    const refit = () => requestAnimationFrame(fitNameToColumn);
    refit();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refit);
    }
    window.addEventListener('load', refit);

    // Re-fit on resize, but wait until the user stops dragging (debounce).
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitNameToColumn, 120);
    });
}


/* ============================================================
   5. CUSTOM CURSOR
   A small lime dot that tracks the mouse exactly, plus a ring
   that lags behind for an inertia feel and grows when hovering
   something clickable. Only on devices with a real mouse.
   ============================================================ */

if (hasMouse && !prefersReducedMotion) {
    const cursorDot = document.createElement('div');
    cursorDot.id = 'cursor-dot';
    const cursorRing = document.createElement('div');
    cursorRing.id = 'cursor-ring';
    document.body.append(cursorDot, cursorRing);
    document.body.classList.add('has-cursor');

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let cursorShown = false;

    document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        if (!cursorShown) {
            cursorShown = true;
            cursorDot.style.opacity = '1';
            cursorRing.style.opacity = '1';
        }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
        cursorShown = false;
        cursorDot.style.opacity = '0';
        cursorRing.style.opacity = '0';
    });

    // Elements that should make the ring "lock on" (grow + turn lime).
    const CLICKABLE_SELECTOR = 'a, button, .sw-item, .cap-node, .tab-btn, .ex-toggle, .ex-visual, [role="button"]';
    document.addEventListener('mouseover', (event) => {
        if (event.target.closest(CLICKABLE_SELECTOR)) cursorRing.classList.add('lock');
    });
    document.addEventListener('mouseout', (event) => {
        if (event.target.closest(CLICKABLE_SELECTOR)) cursorRing.classList.remove('lock');
    });
    document.addEventListener('mousedown', () => cursorRing.classList.add('press'));
    document.addEventListener('mouseup', () => cursorRing.classList.remove('press'));

    // The dot snaps to the mouse; the ring eases toward it (18% per frame).
    function moveCursor() {
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        cursorRing.style.transform = `translate(${ringX}px, ${ringY}px)`;
        requestAnimationFrame(moveCursor);
    }
    moveCursor();
}


/* ============================================================
   6. ABOUT — INTERACTIVE "EVOLUTION" GRAPH
   A small force-directed graph on its own canvas. Nodes repel
   each other, edges act like springs, and a gentle pull keeps
   everything centred. You can drag nodes and hover for details.
   "Curiosity" is the root and is always lit.
   ============================================================ */

(function setUpEvolutionGraph() {
    const canvas = document.getElementById('evo-net');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('evo-wrap');
    const detailBox = document.getElementById('net-detail');
    const detailKicker = document.getElementById('net-kicker');
    const detailTitle = document.getElementById('net-title');
    const detailDesc = document.getElementById('net-desc');

    const rootStyles = getComputedStyle(document.documentElement);
    const LIME = (rootStyles.getPropertyValue('--lime') || '#c6f135').trim();
    const GRAPH_GREY = '158, 162, 178';
    const BG = (rootStyles.getPropertyValue('--bg') || '#040405').trim();

    // The nodes. `root: true` marks "Curiosity" as the always-lit origin.
    const NODE_DATA = [
        { id: 'curiosity',   title: 'Curiosity',        kicker: 'WHERE IT STARTS',  desc: 'How could a machine understand the world? Every branch below grew from that one question.', size: 13, root: true },
        { id: 'programming', title: 'Programming',      kicker: 'THE FIRST TOOL',   desc: 'Curiosity turned into code — the language for building things that think.', size: 11 },
        { id: 'robotics',    title: 'Robotics',         kicker: 'CODE MEETS WORLD', desc: 'Software reached into hardware — perception, control, and motion in the physical world.', size: 12 },
        { id: 'leadership',  title: 'Leadership',       kicker: 'PEOPLE SYSTEMS',   desc: 'The same systems instinct, applied to teams — leading, mentoring, building communities.', size: 9 },
        { id: 'cv',          title: 'Computer Vision',  kicker: 'BRANCH',           desc: 'Teaching machines to see — detection, tracking, perception in degraded environments.', size: 10 },
        { id: 'autonomy',    title: 'Autonomy',         kicker: 'BRANCH',           desc: 'Systems that decide and act on their own — from underwater vehicles to control loops.', size: 9 },
        { id: 'ml',          title: 'Machine Learning', kicker: 'BRANCH',           desc: 'Models that learn from data — from neural nets built by hand to applied forecasting.', size: 10 },
        { id: 'research',    title: 'Research',         kicker: 'BRANCH',           desc: 'Published work in 6D pose estimation and medical image segmentation — IEEE & Elsevier.', size: 9 }
    ];
    // Which nodes are connected. The last two are cross-links between disciplines.
    const EDGE_DATA = [
        ['curiosity', 'programming'],
        ['programming', 'robotics'],
        ['programming', 'leadership'],
        ['robotics', 'cv'],
        ['robotics', 'autonomy'],
        ['robotics', 'ml'],
        ['robotics', 'research'],
        ['cv', 'ml'],
        ['cv', 'autonomy']
    ];

    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    function resizeCanvas() {
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    // Turn the plain data into live nodes (start spread around a circle).
    const nodes = NODE_DATA.map((data, index) => {
        const angle = (index / NODE_DATA.length) * Math.PI * 2;
        return {
            ...data,
            x: Math.cos(angle),
            y: Math.sin(angle),
            velocityX: 0,
            velocityY: 0,
            isHeld: false,                              // true while being dragged
            wobblePhase: Math.random() * 6.28,         // for the gentle idle drift
            wobbleSpeed: 0.016 + Math.random() * 0.012
        };
    });
    const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));

    // Place nodes: the root in the centre, the rest on a ring around it.
    function seedPositions() {
        for (const node of nodes) {
            const angle = Math.atan2(node.y || 0.01, node.x || 0.01);
            const radius = node.root ? 0 : Math.min(width, height) * 0.3;
            node.x = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 24;
            node.y = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 24;
        }
    }
    resizeCanvas();
    seedPositions();

    // Re-seed once the wrap first gets a real size (it starts at 0 wide).
    new ResizeObserver(() => {
        const hadSize = width;
        resizeCanvas();
        if (!hadSize && width) seedPositions();
    }).observe(wrap);

    // Physics tuning.
    const REPULSION = 4600;     // how strongly nodes push apart
    const EDGE_SPRING = 0.012;  // how strongly edges pull connected nodes
    const EDGE_LENGTH = 84;     // the spring's natural length
    const FRICTION = 0.88;      // velocity kept each frame (lower = more drag)
    const CENTER_PULL = 0.0014; // gentle pull back toward the middle

    let draggedNode = null;
    let hoveredNode = null;

    // Convert a mouse/touch event into x,y relative to the canvas.
    function pointerPosition(event) {
        const bounds = canvas.getBoundingClientRect();
        const source = event.touches ? event.touches[0] : event;
        return { x: source.clientX - bounds.left, y: source.clientY - bounds.top };
    }

    // Find the node under a point, if any (search topmost first).
    function nodeAt(x, y) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const dx = node.x - x;
            const dy = node.y - y;
            const reach = node.size + 8;
            if (dx * dx + dy * dy <= reach * reach) return node;
        }
        return null;
    }

    function showDetail(node) {
        detailKicker.textContent = node.kicker;
        detailTitle.textContent = node.title;
        detailDesc.textContent = node.desc;
        detailBox.classList.add('on');
        detailBox.setAttribute('aria-hidden', 'false');
        positionDetail(node);
    }

    function hideDetail() {
        detailBox.classList.remove('on');
        detailBox.setAttribute('aria-hidden', 'true');
    }

    // Put the detail card next to the node, nudged to stay inside the canvas.
    function positionDetail(node) {
        const boxWidth = detailBox.offsetWidth || 220;
        const boxHeight = detailBox.offsetHeight || 88;
        let x = node.x + 18;
        let y = node.y + 18;
        if (x + boxWidth > width) x = node.x - boxWidth - 18;
        if (y + boxHeight > height) y = height - boxHeight - 6;
        detailBox.style.left = Math.max(4, x) + 'px';
        detailBox.style.top = Math.max(4, y) + 'px';
    }

    // ---- Mouse input ----
    canvas.addEventListener('mousedown', (event) => {
        const point = pointerPosition(event);
        draggedNode = nodeAt(point.x, point.y);
        if (draggedNode) draggedNode.isHeld = true;
    });

    window.addEventListener('mousemove', (event) => {
        if (!width) return;
        const point = pointerPosition(event);

        if (draggedNode) {
            // Pull the held node toward the cursor.
            draggedNode.velocityX += (point.x - draggedNode.x) * 0.35;
            draggedNode.velocityY += (point.y - draggedNode.y) * 0.35;
            if (hoveredNode) positionDetail(hoveredNode);
            return;
        }

        // Not dragging: update which node is hovered.
        const nodeUnderCursor = nodeAt(point.x, point.y);
        if (nodeUnderCursor !== hoveredNode) {
            hoveredNode = nodeUnderCursor;
            if (hoveredNode) showDetail(hoveredNode);
            else hideDetail();
        } else if (nodeUnderCursor) {
            positionDetail(nodeUnderCursor);
        }
    }, { passive: true });

    window.addEventListener('mouseup', () => {
        if (draggedNode) {
            draggedNode.isHeld = false;
            draggedNode = null;
        }
    });

    // ---- Touch input ----
    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const point = pointerPosition(event);
        draggedNode = nodeAt(point.x, point.y);
        if (draggedNode) {
            draggedNode.isHeld = true;
            hoveredNode = draggedNode;
            showDetail(draggedNode);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();
        if (!draggedNode) return;
        const point = pointerPosition(event);
        draggedNode.velocityX += (point.x - draggedNode.x) * 0.35;
        draggedNode.velocityY += (point.y - draggedNode.y) * 0.35;
        positionDetail(draggedNode);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        if (draggedNode) draggedNode.isHeld = false;
        draggedNode = null;
        setTimeout(hideDetail, 1600);
    });

    // ---- Physics step ----
    let frameCount = 0;
    let nudgeCooldown = 70;  // frames until the next random "keep it alive" nudge
    let isRunning = true;

    function stepPhysics() {
        frameCount++;

        // Every so often, give a random free node a tiny shove so the graph
        // never goes completely still.
        if (!prefersReducedMotion) {
            nudgeCooldown--;
            if (nudgeCooldown <= 0 && !draggedNode) {
                const freeNodes = nodes.filter((node) => !node.isHeld);
                if (freeNodes.length) {
                    const target = freeNodes[Math.floor(Math.random() * freeNodes.length)];
                    const angle = Math.random() * 6.28;
                    const strength = 0.3 + Math.random() * 0.7;
                    target.velocityX += Math.cos(angle) * strength;
                    target.velocityY += Math.sin(angle) * strength;
                }
                nudgeCooldown = 50 + Math.floor(Math.random() * 80);
            }
        }

        // Repulsion: every pair of nodes pushes apart.
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distanceSquared = dx * dx + dy * dy || 1;
                const distance = Math.sqrt(distanceSquared);
                const force = REPULSION / distanceSquared;
                const forceX = dx / distance * force;
                const forceY = dy / distance * force;
                if (!a.isHeld) { a.velocityX -= forceX; a.velocityY -= forceY; }
                if (!b.isHeld) { b.velocityX += forceX; b.velocityY += forceY; }
            }
        }

        // Edge springs: connected nodes pull toward EDGE_LENGTH apart.
        for (const [fromId, toId] of EDGE_DATA) {
            const a = nodesById[fromId];
            const b = nodesById[toId];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.max(Math.hypot(dx, dy), 0.01);
            const force = EDGE_SPRING * (distance - EDGE_LENGTH);
            const forceX = dx / distance * force;
            const forceY = dy / distance * force;
            if (!a.isHeld) { a.velocityX += forceX; a.velocityY += forceY; }
            if (!b.isHeld) { b.velocityX -= forceX; b.velocityY -= forceY; }
        }

        // Centre pull + idle wobble + friction + move + keep inside the canvas.
        for (const node of nodes) {
            node.velocityX += (width / 2 - node.x) * CENTER_PULL;
            node.velocityY += (height / 2 - node.y) * CENTER_PULL;

            if (!node.isHeld && !prefersReducedMotion) {
                node.velocityX += Math.sin(frameCount * node.wobbleSpeed + node.wobblePhase) * 0.025;
                node.velocityY += Math.cos(frameCount * node.wobbleSpeed * 0.83 + node.wobblePhase * 1.3) * 0.025;
            }

            node.velocityX *= FRICTION;
            node.velocityY *= FRICTION;
            node.x += node.velocityX;
            node.y += node.velocityY;

            // Bounce softly off the edges.
            const edge = node.size + 6;
            if (node.x < edge) { node.x = edge; node.velocityX *= -0.4; }
            if (node.x > width - edge) { node.x = width - edge; node.velocityX *= -0.4; }
            if (node.y < edge) { node.y = edge; node.velocityY *= -0.4; }
            if (node.y > height - edge) { node.y = height - edge; node.velocityY *= -0.4; }
        }
    }

    // ---- Draw ----
    function drawGraph() {
        ctx.clearRect(0, 0, width, height);

        // Edges. An edge lights up lime if either end is hovered.
        for (const [fromId, toId] of EDGE_DATA) {
            const a = nodesById[fromId];
            const b = nodesById[toId];
            const isLit = hoveredNode && (hoveredNode.id === fromId || hoveredNode.id === toId);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = isLit ? LIME : `rgba(${GRAPH_GREY}, 0.22)`;
            ctx.lineWidth = isLit ? 1.4 : 1;
            ctx.stroke();
        }

        // Nodes.
        for (const node of nodes) {
            const isActive = hoveredNode === node || draggedNode === node;
            const isLit = node.root || isActive;
            const radius = node.size;

            // Soft lime glow behind active nodes.
            if (isActive) {
                const glow = ctx.createRadialGradient(node.x, node.y, radius, node.x, node.y, radius * 3.2);
                glow.addColorStop(0, 'rgba(198, 241, 53, 0.26)');
                glow.addColorStop(1, 'rgba(198, 241, 53, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 3.2, 0, 6.2832);
                ctx.fill();
            }

            if (node.root) {
                // Root: filled lime disc with a dark hole in the middle.
                ctx.fillStyle = LIME;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 6.2832);
                ctx.fill();
                ctx.fillStyle = BG;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 0.34, 0, 6.2832);
                ctx.fill();
            } else {
                // Branch: hollow circle that turns lime when active.
                ctx.fillStyle = BG;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 6.2832);
                ctx.fill();
                ctx.strokeStyle = isActive ? LIME : `rgba(${GRAPH_GREY}, 0.8)`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 6.2832);
                ctx.stroke();
            }

            // Label under the node.
            ctx.font = '700 10px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = isLit ? LIME : `rgba(${GRAPH_GREY}, 0.9)`;
            ctx.fillText(node.title, node.x, node.y + radius + 15);
        }
    }

    function animationLoop() {
        if (isRunning) {
            stepPhysics();
            drawGraph();
        }
        requestAnimationFrame(animationLoop);
    }
    animationLoop();

    document.addEventListener('visibilitychange', () => {
        isRunning = !document.hidden;
    });
})();


/* ============================================================
   7. PROJECT SCENE DRAWINGS
   Each project has a small technical drawing with two layers:
     - "show":  the calm showcase view
     - "eng":   the engineering / blueprint view (drawn on hover/toggle)
   These are used by both the home page preview (section 8) and the
   projects archive page (section 9).
   ============================================================ */

// Draw a left-to-right pipeline of labelled boxes joined by arrows.
// `stages` is a list of { l: label, s: sub-label, hot: highlight? }.
function drawPipeline(group, stages, centerY) {
    centerY = centerY || 290;
    const margin = 42;
    const gap = 26;
    const boxWidth = (800 - margin * 2 - gap * (stages.length - 1)) / stages.length;
    let delay = 0.15;  // staggered animation delay, grows per stage

    stages.forEach((stage, index) => {
        const x = margin + index * (boxWidth + gap);

        const box = createSvgElement('g', { class: 'eng-box pop', style: `--d:${delay}s` }, group);
        createSvgElement('rect', { x, y: centerY - 30, width: boxWidth, height: 60, rx: 1 }, box);

        const label = createSvgElement('text', { x: x + boxWidth / 2, y: centerY - 4, 'text-anchor': 'middle', class: 'ex-label' }, box);
        label.textContent = stage.l;

        if (stage.s) {
            const subLabel = createSvgElement('text', { x: x + boxWidth / 2, y: centerY + 15, 'text-anchor': 'middle', class: 'ex-sublabel' }, box);
            subLabel.textContent = stage.s;
        }

        // Arrow to the next box (line + arrowhead), except after the last box.
        if (index < stages.length - 1) {
            const lineStartX = x + boxWidth;
            const lineEndX = x + boxWidth + gap;
            createSvgElement('path', { d: `M${lineStartX} ${centerY} H${lineEndX}`, class: 'eng-line draw', pathLength: 1, style: `--d:${delay + 0.1}s` }, group);
            createSvgElement('path', { d: `M${lineEndX - 7} ${centerY - 4} L${lineEndX} ${centerY} L${lineEndX - 7} ${centerY + 4}`, class: 'eng-line pop', pathLength: 1, style: `--d:${delay + 0.25}s` }, group);
        }

        delay += 0.16;
    });
}

// The faint blueprint grid behind the engineering view.
function drawBlueprintGrid(group) {
    let pathData = '';
    for (let x = 50; x < 800; x += 50) pathData += `M${x} 0 V560 `;
    for (let y = 50; y < 560; y += 50) pathData += `M0 ${y} H800 `;
    createSvgElement('path', { d: pathData, class: 'eng-bp' }, group);
}

// One entry per project theme. `show(group)` draws the showcase art;
// `eng(group)` draws the blueprint + pipeline for the engineering view.
const SCENES = {
    auv: {
        show(group) {
            // Depth markers down the right edge.
            [['10m', 140], ['20m', 280], ['30m', 420]].forEach(([label, y]) => {
                createSvgElement('path', { d: `M740 ${y} H760`, class: 'es-soft' }, group);
                const text = createSvgElement('text', { x: 735, y: y + 4, 'text-anchor': 'end', class: 'ex-sublabel' }, group);
                text.textContent = label;
            });
        },
        eng(group) {
            drawBlueprintGrid(group);
            drawPipeline(group, [
                { l: 'Camera · Sonar', s: 'raw streams' },
                { l: 'Preprocess', s: 'denoise' },
                { l: 'YOLO Detect', s: 'gates · buoys', hot: true },
                { l: 'ROS Graph', s: 'publish' },
                { l: 'Navigate', s: 'act' }
            ]);
            const caption = createSvgElement('text', { x: 42, y: 80, class: 'ex-label pop', style: '--d:.9s' }, group);
            caption.textContent = 'perception stack — runs on board, real time';
        }
    },

    kinematics: {
        show(group) {
            // The robot arm: links, joints, a base, and a reach arc.
            createSvgElement('path', { d: 'M150 470 L260 300 L420 350 L530 230', class: 'es-chain' }, group);
            createSvgElement('path', { d: 'M120 470 H180', class: 'es-soft' }, group);
            [[150, 470], [260, 300], [420, 350]].forEach(([x, y]) => {
                createSvgElement('circle', { cx: x, cy: y, r: 6, class: 'es-joint' }, group);
            });
            createSvgElement('path', { d: 'M285 285 A 38 38 0 0 1 295 320', class: 'es-dash' }, group);
            createSvgElement('path', { d: 'M440 330 A 32 32 0 0 1 448 365', class: 'es-dash' }, group);
            createSvgElement('path', { d: 'M530 230 C 590 180, 650 170, 700 190', class: 'es-dash' }, group);
            createSvgElement('circle', { cx: 700, cy: 190, r: 4, class: 'es-waypoint' }, group);
        },
        eng(group) {
            drawBlueprintGrid(group);
            drawPipeline(group, [
                { l: 'Camera', s: '30 fps' },
                { l: 'MediaPipe', s: '21 keypoints' },
                { l: 'Joint Map', s: 'θ1 θ2 θ3', hot: true },
                { l: 'PyFirmata', s: 'serial' },
                { l: 'Servos', s: '3 DOF' }
            ], 440);
        }
    },

    vision: {
        show(group) {
            // Scattered feature points (little plus marks).
            const featurePoints = [
                [120, 120], [200, 180], [310, 90], [430, 150], [560, 110], [660, 200],
                [150, 320], [260, 380], [390, 300], [520, 360], [640, 320], [220, 470],
                [460, 460], [600, 440], [340, 200], [580, 250]
            ];
            featurePoints.forEach(([x, y]) => {
                createSvgElement('path', { d: `M${x - 4} ${y} H${x + 4} M${x} ${y - 4} V${y + 4}`, class: 'es-feature' }, group);
            });

            // A detection box with a confidence label.
            const boxX = 330, boxY = 270, boxW = 150, boxH = 110, corner = 16;
            createSvgElement('path', {
                d: [
                    `M${boxX} ${boxY + corner} V${boxY} H${boxX + corner}`,
                    `M${boxX + boxW - corner} ${boxY} H${boxX + boxW} V${boxY + corner}`,
                    `M${boxX + boxW} ${boxY + boxH - corner} V${boxY + boxH} H${boxX + boxW - corner}`,
                    `M${boxX + corner} ${boxY + boxH} H${boxX} V${boxY + boxH - corner}`
                ].join(' '),
                class: 'es-soft', stroke: 'rgba(198,241,53,0.6)'
            }, group);
            const text = createSvgElement('text', { x: boxX, y: boxY - 9, class: 'ex-sublabel', fill: 'rgba(198,241,53,0.55)' }, group);
            text.textContent = 'target 0.97';
        },
        eng(group) {
            drawBlueprintGrid(group);
            drawPipeline(group, [
                { l: 'Roboflow', s: 'annotate' },
                { l: 'YOLO Train', s: 'custom set', hot: true },
                { l: 'Optimize', s: 'edge real-time' },
                { l: 'Deploy', s: '→ MIRA' }
            ], 470);
            // Short motion vectors on a few feature points (optical flow).
            [[120, 120, 26, 8], [430, 150, 22, 10], [640, 320, -24, -6], [260, 380, 20, -8]].forEach(([x, y, dx, dy], index) => {
                createSvgElement('path', { d: `M${x} ${y} l${dx} ${dy}`, class: 'eng-line draw', pathLength: 1, style: `--d:${0.7 + index * 0.12}s` }, group);
            });
        }
    },

    forecast: {
        show(group) {
            // Axes, an "observed" solid line, then a dashed "forecast" line.
            createSvgElement('path', { d: 'M90 470 V90 M90 470 H720', class: 'es-soft' }, group);
            createSvgElement('path', { d: 'M90 430 C 200 420, 280 380, 400 330', class: 'es-chain' }, group);
            createSvgElement('path', { d: 'M400 330 C 500 290, 600 220, 700 160', class: 'es-dash' }, group);
            createSvgElement('circle', { cx: 700, cy: 160, r: 4.5, fill: 'rgba(198,241,53,0.65)' }, group);
            const text = createSvgElement('text', { x: 400, y: 500, class: 'ex-sublabel' }, group);
            text.textContent = 'observed · · · forecast';
        },
        eng(group) {
            drawBlueprintGrid(group);
            drawPipeline(group, [
                { l: 'Playwright', s: 'RBI DBIE' },
                { l: 'Parse', s: 'xlsx → parquet' },
                { l: 'Prophet', s: 'time-series', hot: true },
                { l: 'Forecast', s: '2.1% MAPE' }
            ], 250);
            // The two edges of the confidence band.
            createSvgElement('path', { d: 'M400 310 C 500 270, 600 200, 700 135', class: 'eng-line draw', pathLength: 1, style: '--d:.8s' }, group);
            createSvgElement('path', { d: 'M400 350 C 500 310, 600 240, 700 185', class: 'eng-line draw', pathLength: 1, style: '--d:.9s' }, group);
            const text = createSvgElement('text', { x: 590, y: 120, class: 'ex-label pop', style: '--d:1.1s' }, group);
            text.textContent = 'confidence interval';
        }
    },

    learning: {
        show(group) {
            // A loss curve dropping and flattening, with axis labels and ticks.
            createSvgElement('path', { d: 'M120 120 C 220 380, 300 440, 400 450 S 600 430, 700 410', class: 'es-chain' }, group);
            createSvgElement('circle', { cx: 430, cy: 451, r: 4.5, fill: 'rgba(198,241,53,0.65)' }, group);
            const lossLabel = createSvgElement('text', { x: 120, y: 95, class: 'ex-sublabel' }, group);
            lossLabel.textContent = 'loss';
            const epochsLabel = createSvgElement('text', { x: 660, y: 500, class: 'ex-sublabel' }, group);
            epochsLabel.textContent = 'epochs';
            for (let x = 120; x <= 700; x += 58) {
                createSvgElement('path', { d: `M${x} 478 v6`, class: 'es-soft' }, group);
            }
        },
        eng(group) {
            drawBlueprintGrid(group);
            drawPipeline(group, [
                { l: 'NumPy', s: 'nets by hand' },
                { l: 'Backprop', s: 'from scratch', hot: true },
                { l: 'PyTorch', s: 'training loops' },
                { l: 'CNN · Transfer', s: 'applied' }
            ], 230);
            const caption = createSvgElement('text', { x: 42, y: 80, class: 'ex-label pop', style: '--d:.9s' }, group);
            caption.textContent = '46 notebooks — every concept proven in code';
        }
    },

    fieldwork: {
        show(group) {
            // A ground line with little plants growing out of it.
            createSvgElement('path', { d: 'M60 480 H740', class: 'es-soft' }, group);
            createSvgElement('path', { d: 'M400 480 C 395 380, 380 320, 390 240 M392 350 C 350 320, 330 300, 322 260 M394 300 C 440 270, 455 250, 462 215', class: 'es-dash' }, group);
            [[390, 240], [322, 260], [462, 215]].forEach(([x, y]) => {
                createSvgElement('circle', { cx: x, cy: y, r: 4, class: 'es-waypoint' }, group);
            });
        },
        eng(group) {
            drawBlueprintGrid(group);
            drawPipeline(group, [
                { l: 'Field Data', s: 'crops · prices' },
                { l: 'CV Guidance', s: 'disease', hot: true },
                { l: 'Recommend', s: 'engine' },
                { l: 'Web App', s: 'for farmers' }
            ], 160);
        }
    }
};


/* ============================================================
   8. HOME PAGE — "SELECTED WORK" PREVIEW SWITCHER
   A list of featured projects on the left; choosing one (hover,
   click, or keyboard focus) updates the big preview on the right.
   ============================================================ */

const FEATURED_PROJECTS = [
    {
        num: '01', name: 'MIRA 2.0', sub: 'Autonomous Underwater Vehicle',
        theme: 'auv', photo: true,
        idx: 'PRJ 01 — underwater autonomy',
        challenge: 'real-time underwater perception — light distortion, turbidity, and a live competition latency budget, all on the vehicle’s own hardware.',
        href: 'projects.html#mira'
    },
    {
        num: '02', name: 'Dexterous Robotic Arm', sub: 'Human–Robot Interaction',
        theme: 'kinematics', video: 'image/robarm.mp4',
        idx: 'PRJ 02 — human–machine interface',
        challenge: 'turning noisy hand landmarks into smooth, stable physical motion on a real 3-DOF manipulator.',
        href: 'projects.html#arm'
    },
    {
        num: '03', name: 'Object Detection Pipeline', sub: 'Computer Vision',
        theme: 'vision',
        idx: 'PRJ 03 — custom vision pipeline',
        challenge: 'surviving underwater domain shift while staying real-time on a constrained edge device.',
        href: 'projects.html#detect'
    },
    {
        num: '04', name: 'MPi Market Intelligence', sub: 'Forecasting & Data Engineering',
        theme: 'forecast',
        idx: 'PRJ 04 — time-series intelligence',
        challenge: 'forecasting reliably from a brittle government portal that publishes irregular Excel files.',
        href: 'projects.html#mpi'
    }
];

const selectedWorkList = document.getElementById('sw-list');
const selectedWorkStage = document.getElementById('sw-stage');

if (selectedWorkList && selectedWorkStage) {
    const stageWrap = document.getElementById('sw-stage-wrap');
    const previewPhoto = document.getElementById('sw-photo');
    const previewVideo = document.getElementById('sw-video');
    const indexLabel = document.getElementById('sw-index');
    const challengeText = document.getElementById('sw-challenge');
    const caseStudyLink = document.getElementById('sw-case');

    // Build the clickable list of projects.
    FEATURED_PROJECTS.forEach((project, index) => {
        const button = document.createElement('button');
        button.className = 'sw-item';
        button.setAttribute('role', 'tab');
        button.innerHTML =
            `<span class="sw-num mono">${project.num}</span>` +
            `<span class="sw-text">` +
                `<span class="sw-name">${project.name}</span>` +
                `<span class="sw-sub">${project.sub}</span>` +
            `</span>`;
        button.addEventListener('click', () => selectProject(index));
        if (hasMouse) button.addEventListener('mouseenter', () => selectProject(index));
        button.addEventListener('focus', () => selectProject(index));
        selectedWorkList.appendChild(button);
    });

    let currentProjectIndex = -1;

    function selectProject(index) {
        if (index === currentProjectIndex) return;
        currentProjectIndex = index;
        const project = FEATURED_PROJECTS[index];

        // Highlight the chosen list item.
        selectedWorkList.querySelectorAll('.sw-item').forEach((button, i) => {
            const isChosen = i === index;
            button.classList.toggle('on', isChosen);
            button.setAttribute('aria-selected', String(isChosen));
        });

        // Update the text bits.
        previewPhoto.hidden = !project.photo;
        indexLabel.textContent = project.idx;
        challengeText.textContent = project.challenge;
        caseStudyLink.href = project.href;

        // A project can show a looping video as its showcase. The engineering
        // blueprint still draws in over it.
        if (previewVideo) {
            previewVideo.hidden = !project.video;
            if (project.video) {
                previewVideo.currentTime = 0;
                previewVideo.play().catch(() => {});  // ignore autoplay rejections
            } else {
                previewVideo.pause();
            }
        }

        // Redraw the SVG scene. Skip the "show" layer when a video is playing.
        selectedWorkStage.innerHTML = '';
        if (!project.video) {
            const showLayer = createSvgElement('g', { class: 'show' }, selectedWorkStage);
            SCENES[project.theme].show(showLayer);
        }
        const engLayer = createSvgElement('g', { class: 'eng' }, selectedWorkStage);
        SCENES[project.theme].eng(engLayer);

        // Restart the entry + line-draw animations.
        stageWrap.classList.remove('eng-on', 'swap');
        void stageWrap.offsetWidth;            // force a reflow so the animation replays
        stageWrap.classList.add('swap');
        requestAnimationFrame(() => requestAnimationFrame(() => stageWrap.classList.add('eng-on')));
    }

    selectProject(0);  // start on the first project
}


/* ============================================================
   9. PROJECTS PAGE — ENGINEERING ARCHIVE TOGGLES
   Each project on the archive page can flip between its showcase
   and engineering view, by hovering the visual or clicking the
   toggle button.
   ============================================================ */

document.querySelectorAll('.exhibit').forEach((article) => {
    const theme = article.dataset.theme;
    const stage = article.querySelector('.ex-stage');
    const toggleButton = article.querySelector('.ex-toggle');
    const visual = article.querySelector('.ex-visual');
    if (!theme || !stage || !SCENES[theme]) return;

    // If a live video is the showcase, skip the abstract "show" art and keep
    // only the engineering blueprint (it draws over the darkened video).
    const hasVideo = !!article.querySelector('.ex-video');
    if (!hasVideo) {
        const showLayer = createSvgElement('g', { class: 'show' }, stage);
        SCENES[theme].show(showLayer);
    }
    const engLayer = createSvgElement('g', { class: 'eng' }, stage);
    SCENES[theme].eng(engLayer);

    // The view is "on" (engineering) if it's pinned by a click OR hovered.
    let isPinned = false;
    let isHovered = false;

    function updateView() {
        const showEngineering = isPinned || isHovered;
        article.classList.toggle('eng-on', showEngineering);
        if (toggleButton) {
            toggleButton.setAttribute('aria-pressed', String(showEngineering));
            toggleButton.textContent = showEngineering ? 'showcase view' : 'engineering view';
        }
    }

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            isPinned = !isPinned;
            updateView();
        });
    }
    if (hasMouse && visual) {
        visual.addEventListener('mouseenter', () => { isHovered = true; updateView(); });
        visual.addEventListener('mouseleave', () => { isHovered = false; updateView(); });
    }
});


/* ============================================================
   10. EXPERIENCE TABS (Internships / Leadership)
   Clicking a tab button shows its matching panel.
   ============================================================ */

const tabButtons = document.querySelectorAll('.tab-btn');
tabButtons.forEach((clickedButton) => {
    clickedButton.addEventListener('click', () => {
        // Mark the clicked button active, the others inactive.
        tabButtons.forEach((button) => {
            const isActive = button === clickedButton;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        // Show the matching panel (id "tab-<name>"), hide the rest.
        const targetPanelId = 'tab-' + clickedButton.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.id === targetPanelId);
        });

        // The newly shown panel needs its progress rail recalculated.
        updateExperienceRails();
    });
});


/* ============================================================
   11. SKILLS — CURVED WIRES FROM THE CORE TO EACH CLUSTER
   Draws an SVG curve from the centre "core" chip up to each
   skill cluster. Recomputed on resize because positions change.
   ============================================================ */

const skillsMap = document.getElementById('cap-map');
const skillsWires = document.getElementById('cap-wires');
const skillsCore = document.getElementById('cap-core');

if (skillsMap && skillsWires && skillsCore) {
    function drawSkillWires() {
        skillsWires.innerHTML = '';

        const mapBounds = skillsMap.getBoundingClientRect();
        const coreBounds = skillsCore.getBoundingClientRect();
        // Start point: bottom-centre of the core chip, relative to the map.
        const startX = coreBounds.left - mapBounds.left + coreBounds.width / 2;
        const startY = coreBounds.top - mapBounds.top + coreBounds.height;

        skillsMap.querySelectorAll('[data-cluster]').forEach((cluster) => {
            const clusterBounds = cluster.getBoundingClientRect();
            // End point: top-centre of the cluster, relative to the map.
            const endX = clusterBounds.left - mapBounds.left + clusterBounds.width / 2;
            const endY = clusterBounds.top - mapBounds.top;

            const wire = document.createElementNS(SVG_NAMESPACE, 'path');
            wire.setAttribute('d', `M${startX} ${startY} C${startX} ${startY + 50}, ${endX} ${endY - 50}, ${endX} ${endY}`);
            wire.setAttribute('class', 'cap-wire');
            skillsWires.appendChild(wire);
        });

        skillsMap.classList.add('wired');
    }

    // Draw the wires the first time the skills section scrolls into view.
    const skillsObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            drawSkillWires();
            skillsObserver.disconnect();
        }
    }, { threshold: 0.1 });
    skillsObserver.observe(skillsMap);

    // Redraw (debounced) on resize, but only after they've been drawn once.
    let wiresResizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(wiresResizeTimer);
        wiresResizeTimer = setTimeout(() => {
            if (skillsMap.classList.contains('wired')) drawSkillWires();
        }, 180);
    });
}


/* ============================================================
   12. EXPERIENCE — PROGRESS RAIL THAT FILLS ON SCROLL
   Each timeline ("growth") has a vertical rail that fills up as
   you scroll past it. Hidden tab panels are skipped.
   ============================================================ */

const experienceTracks = [...document.querySelectorAll('.growth')];

function updateExperienceRails() {
    if (prefersReducedMotion) return;

    experienceTracks.forEach((track) => {
        const fill = track.querySelector('.growth-rail-fill');
        if (!fill || track.offsetParent === null) return;  // skip hidden panels

        const bounds = track.getBoundingClientRect();
        // 0 when the track top is at 75% down the screen, 1 once fully passed.
        const rawProgress = (window.innerHeight * 0.75 - bounds.top) / bounds.height;
        const progress = Math.min(1, Math.max(0, rawProgress));
        fill.style.transform = `scaleY(${progress})`;
    });
}

if (experienceTracks.length && !prefersReducedMotion) {
    window.addEventListener('scroll', updateExperienceRails, { passive: true });
    updateExperienceRails();
}

})();
