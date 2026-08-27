// The Memory Bowl - generative Saddledome seating map
//
// Engineering showpiece: generateBowlSections()
// Every section polygon is produced from an ellipse, not hand-drawn
// path data. A point on the oval is:
//   x = cx + rx * cos(theta)
//   y = cy + ry * sin(theta)
// A section is the region between two concentric ellipses (inner/outer
// radii of its tier) spanning an equal slice of 2*PI, with a small angular
// gap for aisles. Samples along each arc become an SVG path.
// Tiers: FLOOR; lower 101-122; loge 201-222 (the C of Red belt); upper 301-326.
(function () {
  const data = window.MEMORY_BOWL_DATA
  const SVG_NS = "http://www.w3.org/2000/svg"
  const CX = 500
  const CY = 390
  const VIEW = { w: 1000, h: 780 }
  let mode = "game"
  let liveOn = false
  let liveTimer = 0
  let liveIndex = 0
  function ellipsePoint(cx, cy, rx, ry, theta) {
    return { x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) }
  }
  function arcPoints(cx, cy, rx, ry, t0, t1, samples) {
    const pts = []
      for (let i = 0; i <= samples; i++) {
        const t = t0 + ((t1 - t0) * i) / samples
        pts.push(ellipsePoint(cx, cy, rx, ry, t))
      }
    return pts
  }
  function pointsToPath(points) {
    return points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" ") + " Z"
  }
  // Build one seating ring. theta = 0 is screen-right; rotate by -PI/2 so
 // section start sits at 12 o'clock, then proceed clockwise.
 function ringSections(start, count, innerRx, innerRy, outerRx, outerRy, samples) {
   const aisle = (Math.PI * 2 * 0.012) / count
   const sweep = (Math.PI * 2) / count
   const origin = -Math.PI / 2
   const out = []
     for (let i = 0; i < count; i++) {
       const num = String(start + i)
       const t0 = origin + i * sweep + aisle
       const t1 = origin + (i + 1) * sweep - aisle
       const outer = arcPoints(CX, CY, outerRx, outerRy, t0, t1, samples)
       const inner = arcPoints(CX, CY, innerRx, innerRy, t1, t0, samples)
       const midT = (t0 + t1) / 2
       const label = ellipsePoint(CX, CY, (innerRx + outerRx) / 2, (innerRy + outerRy) / 2, midT)
       out.push({ id: num, label: "SEC " + num, d: pointsToPath(outer.concat(inner)), lx: label.x, ly: label.y, midT: midT })
     }
   return out
 }
  function generateBowlSections() {
    const floorPts = arcPoints(CX, CY, 118, 78, 0, Math.PI * 2 - 0.001, 48)
    const floor = { id: "FLOOR", label: "FLOOR", d: pointsToPath(floorPts), lx: CX, ly: CY, isFloor: true }
    return {
      floor: floor,
      lower: ringSections(101, 22, 148, 100, 242, 168, 8),
      loge: ringSections(201, 22, 252, 176, 338, 232, 8),
      upper: ringSections(301, 26, 348, 240, 455, 312, 7)
    }
  }
  function maxCount() {
    return Math.max.apply(null, Object.values(data.SECTION_COUNTS))
  }
  function heatFill(sectionId) {
    const n = data.SECTION_COUNTS[sectionId] || 0
    const t = n / maxCount()
    const ink = mode === "game" ? [26, 18, 8] : [42, 28, 16]
    const hot = mode === "game" ? [200, 16, 46] : [201, 150, 58]
    const r = Math.round(ink[0] + (hot[0] - ink[0]) * t)
    const g = Math.round(ink[1] + (hot[1] - ink[1]) * t)
    const b = Math.round(ink[2] + (hot[2] - ink[2]) * t)
    return "rgb(" + r + "," + g + "," + b + ")"
  }
  function memoriesFor(sectionId) {
    return data.MEMORIES.filter(function (m) { return m.section === sectionId })
  }
  function daysUntilWreckingBall() {
    const end = new Date(data.WRECKING_BALL)
    return Math.max(0, Math.ceil((end - new Date()) / 86400000))
  }
  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name)
    Object.entries(attrs).forEach(function (kv) { node.setAttribute(kv[0], kv[1]) })
    if (parent) parent.appendChild(node)
    return node
  }
  function hottestSectionIds() {
    return Object.entries(data.SECTION_COUNTS).sort(function (a, b) { return b[1] - a[1] }).slice(0, 4).map(function (e) { return e[0] })
  }
  function renderBowl() {
    const svg = document.getElementById("bowl-svg")
    svg.setAttribute("viewBox", "0 0 " + VIEW.w + " " + VIEW.h)
    svg.setAttribute("role", "img")
    svg.setAttribute("aria-label", "Saddledome seating bowl heatmap of memories by section")
    // Ice-up light + two-layer heat halo (tight core + wide blur). No libraries.
  svg.innerHTML = '<defs><filter id="ice-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="iceSoft"/><feMerge><feMergeNode in="iceSoft"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="heat-glow" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="core"/><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="halo"/><feMerge><feMergeNode in="halo"/><feMergeNode in="core"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    const generated = generateBowlSections()
    const hottest = hottestSectionIds()
    const all = generated.lower.concat(generated.loge, generated.upper)
    all.forEach(function (sec) {
      const isHot = hottest.indexOf(sec.id) !== -1
      const attrs = {
        d: sec.d,
        class: "section" + (isHot ? " hot-pulse" : ""),
        fill: heatFill(sec.id),
        "data-section": sec.id,
        tabindex: "0",
        role: "button",
        "aria-label": "Section " + sec.id + ", " + (data.SECTION_COUNTS[sec.id] || 0) + " memories"
      }
      if (isHot) attrs.filter = "url(#heat-glow)"
      el("path", attrs, svg)
      el("text", { x: sec.lx.toFixed(1), y: sec.ly.toFixed(1), class: "sec-label", dy: "0.35em" }, svg).textContent = sec.id
    })
    const floorHot = hottest.indexOf("FLOOR") !== -1
    const floorAttrs = {
      d: generated.floor.d,
      class: "section" + (floorHot ? " hot-pulse" : ""),
      fill: heatFill("FLOOR"),
      "data-section": "FLOOR",
      tabindex: "0",
      role: "button",
      "aria-label": "Floor, " + data.SECTION_COUNTS.FLOOR + " memories"
    }
    if (floorHot) floorAttrs.filter = "url(#heat-glow)"
    el("path", floorAttrs, svg)
    // Bowl lit from the ice up: cool ellipse with ice-glow, then game line or stage.
  el("ellipse", { cx: CX, cy: CY, rx: 92, ry: 58, class: "ice", filter: "url(#ice-glow)", "pointer-events": "none" }, svg)
    if (mode === "game") {
      el("line", { x1: CX - 92, y1: CY, x2: CX + 92, y2: CY, stroke: "#c8102e", "stroke-width": "2", "pointer-events": "none" }, svg)
    } else {
      el("rect", { x: CX - 70, y: CY + 18, width: 140, height: 36, rx: 4, class: "stage", "pointer-events": "none" }, svg)
    }
    el("text", { x: CX, y: CY + (mode === "game" ? 4 : -6), class: "floor-label" }, svg).textContent = "FLOOR"
    bindSections(svg)
    window.__bowlLayout = { generated: generated, svg: svg }
  }
  function bindSections(svg) {
    const tip = document.getElementById("tooltip")
    svg.querySelectorAll("[data-section]").forEach(function (node) {
      const id = node.getAttribute("data-section")
      const n = data.SECTION_COUNTS[id] || 0
      const label = id === "FLOOR" ? "FLOOR" : "SEC " + id
      function show(ev) {
        tip.hidden = false
        tip.textContent = label + " · " + n + (n === 1 ? " memory" : " memories")
        moveTip(ev)
        node.classList.add("is-hot")
      }
      function hide() {
        tip.hidden = true
        node.classList.remove("is-hot")
      }
      node.addEventListener("pointerenter", show)
      node.addEventListener("pointermove", moveTip)
      node.addEventListener("pointerleave", hide)
      node.addEventListener("click", function () { openPanel(id) })
      node.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openPanel(id)
        }
      })
    })
  }
  function moveTip(ev) {
    const tip = document.getElementById("tooltip")
    tip.style.left = ev.clientX + "px"
    tip.style.top = ev.clientY + "px"
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }
  function openPanel(sectionId) {
    const panel = document.getElementById("panel")
    const stories = memoriesFor(sectionId)
    const n = data.SECTION_COUNTS[sectionId] || 0
    const title = sectionId === "FLOOR" ? "FLOOR" : "SEC " + sectionId
    document.getElementById("panel-title").textContent = title
    document.getElementById("panel-count").textContent = n + (n === 1 ? " memory in the archive" : " memories in the archive")
    const list = document.getElementById("panel-list")
    list.innerHTML = ""
    if (!stories.length) {
      list.innerHTML = "<p>No story on this page yet - the heat is from the wider archive. File yours.</p>"
    } else {
      stories.forEach(function (m) {
        const card = document.createElement("article")
        card.className = "memory-card"
        card.innerHTML = '<p class="filed">FILED BY ' + escapeHtml(m.name) + " · " + escapeHtml(m.year) + " · " + escapeHtml(m.event) + (m.real ? '<span class="real-tag">real filing</span>' : "") + '</p><p class="body">' + escapeHtml(m.text) + "</p>"
        list.appendChild(card)
      })
    }
    const link = document.getElementById("file-link")
    link.href = "https://calgarysaddledome.com/memories/new?section=" + encodeURIComponent(sectionId)
    link.textContent = "File yours from " + title
    panel.classList.add("is-open")
    panel.setAttribute("aria-hidden", "false")
    panel.querySelector(".panel-close").focus()
  }
  function closePanel() {
    const panel = document.getElementById("panel")
    panel.classList.remove("is-open")
    panel.setAttribute("aria-hidden", "true")
  }
  function setMode(next) {
    mode = next
    document.documentElement.classList.toggle("concert", mode === "concert")
    document.getElementById("btn-game").setAttribute("aria-pressed", String(mode === "game"))
    document.getElementById("btn-concert").setAttribute("aria-pressed", String(mode === "concert"))
    renderBowl()
  }
  function tickCountdown() {
    document.getElementById("days-n").textContent = String(daysUntilWreckingBall())
  }
  // Layer 2: the living wall. Cards rise from their home section.
 function sectionAnchor(sectionId) {
   const layout = window.__bowlLayout
   if (!layout) return { x: 50, y: 50 }
   const svg = layout.svg
   const all = [layout.generated.floor].concat(layout.generated.lower, layout.generated.loge, layout.generated.upper)
   const sec = all.find(function (s) { return s.id === sectionId }) || layout.generated.floor
   const pt = svg.createSVGPoint()
   pt.x = sec.lx
   pt.y = sec.ly
   const ctm = svg.getScreenCTM()
   if (!ctm) return { x: 50, y: 50 }
   const screen = pt.matrixTransform(ctm)
   const frame = document.getElementById("bowl-frame").getBoundingClientRect()
   return { x: screen.x - frame.left, y: screen.y - frame.top }
 }
  function riseMemory(memory) {
    const frame = document.getElementById("bowl-frame")
    const origin = sectionAnchor(memory.section)
    const card = document.createElement("div")
    card.className = "rising"
    const rise = 120 + Math.floor(Math.random() * 41)
    const drift = Math.round((Math.random() * 48 - 24) * 10) / 10
    card.style.left = origin.x + "px"
    card.style.top = origin.y + "px"
    card.style.setProperty("--rise", "-" + rise + "px")
    card.style.setProperty("--drift", drift + "px")
    card.innerHTML = '<p class="filed">FILED BY ' + escapeHtml(memory.name) + " · " + escapeHtml(memory.year) + " · " + escapeHtml(memory.event) + '</p><p class="body">' + escapeHtml(memory.text) + "</p>"
    frame.appendChild(card)
    const path = document.querySelector('[data-section="' + memory.section + '"]')
    if (path) {
      path.classList.add("is-hot")
      setTimeout(function () { path.classList.remove("is-hot") }, 900)
    }
    setTimeout(function () { card.remove() }, 7200)
  }
  function startLive() {
    liveOn = true
    document.getElementById("live-badge").hidden = false
    function tick() {
      const airborne = document.querySelectorAll("#bowl-frame .rising").length
      if (airborne < 2) {
        const m = data.MEMORIES[liveIndex % data.MEMORIES.length]
        liveIndex += 1
        riseMemory(m)
      }
      liveTimer = setTimeout(tick, 4000 + Math.random() * 2000)
    }
    tick()
  }
  function init() {
    tickCountdown()
    document.getElementById("total-n").textContent = String(data.TOTAL_MEMORIES)
    document.getElementById("btn-game").addEventListener("click", function () { setMode("game") })
    document.getElementById("btn-concert").addEventListener("click", function () { setMode("concert") })
    document.querySelector(".panel-close").addEventListener("click", closePanel)
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel() })
    setMode("game")
    startLive()
  }
  document.addEventListener("DOMContentLoaded", init)
})()
