// The Memory Bowl v2 - generative Saddledome seating map with seat-level zoom
// and live memory filing.
//
// Engineering notes:
// - Every section polygon is produced from an ellipse, never hand-drawn:
//     x = cx + rx * cos(theta), y = cy + ry * sin(theta)
//   A section is the region between two concentric ellipses spanning an equal
//   slice of 2*PI (small angular gap for aisles).
// - v2 goes one level deeper: clicking a section tweens the SVG viewBox into
//   that wedge and generates its individual seats with the same math - rows
//   are intermediate ellipses between the tier radii, seats are points along
//   each row's arc. ~19k seats exist implicitly; only the ~400 in the open
//   section are ever in the DOM.
// - Memories are real: the page reads and writes a Supabase table over plain
//   fetch() (PostgREST). Zero dependencies still.
(function () {
  const data = window.MEMORY_BOWL_DATA
  const REMOTE = window.MEMORY_BOWL_REMOTE || null
  const SVG_NS = "http://www.w3.org/2000/svg"
  const CX = 500
  const CY = 390
  const VIEW = { w: 1000, h: 780 }
  const HOME_BOX = [0, 0, 1000, 780]
  const TIER_ROWS = { lower: 16, loge: 12, upper: 18 }
  let mode = "game"
  let liveTimer = 0
  let liveIndex = 0
  let zoomedSection = null
  let viewBoxAnim = 0
  let liveMemories = []
    let panelContext = { section: null, row: null, seat: null }
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
    return points.map(function (p, i) { return (i === 0 ? "M" : "L") + p.x.toFixed(2) + "," + p.y.toFixed(2) }).join(" ") + " Z"
  }
  function ringSections(start, count, innerRx, innerRy, outerRx, outerRy, samples, tier) {
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
        out.push({ id: num, tier: tier, t0: t0, t1: t1, innerRx: innerRx, innerRy: innerRy, outerRx: outerRx, outerRy: outerRy, d: pointsToPath(outer.concat(inner)), lx: label.x, ly: label.y, midT: midT })
      }
    return out
  }
  function generateBowlSections() {
    const floorPts = arcPoints(CX, CY, 118, 78, 0, Math.PI * 2 - 0.001, 48)
    const floor = { id: "FLOOR", tier: "floor", d: pointsToPath(floorPts), lx: CX, ly: CY }
    return {
      floor: floor,
      lower: ringSections(101, 22, 148, 100, 242, 168, 8, "lower"),
      loge: ringSections(201, 22, 252, 176, 338, 232, 8, "loge"),
      upper: ringSections(301, 26, 348, 240, 455, 312, 7, "upper")
    }
  }
  function generateSeats(sec) {
    const seats = []
      if (sec.tier === "floor") {
        const rows = 12
        for (let r = 0; r < rows; r++) {
          const y = CY - 60 + (120 * (r + 0.5)) / rows
          const half = 104 * Math.sqrt(Math.max(0, 1 - Math.pow((y - CY) / 66, 2)))
          const n = Math.max(4, Math.floor((half * 2) / 9))
          for (let s = 0; s < n; s++) {
            const x = CX - half + 9 * s + 4.5
            seats.push({ row: String(r + 1), seat: String(s + 1), x: x, y: y })
          }
        }
        return seats
      }
    const rows = TIER_ROWS[sec.tier]
    const pad = (sec.t1 - sec.t0) * 0.06
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows
      const rx = sec.innerRx + (sec.outerRx - sec.innerRx) * t
      const ry = sec.innerRy + (sec.outerRy - sec.innerRy) * t
      const a0 = sec.t0 + pad
      const a1 = sec.t1 - pad
      let len = 0
      let prev = ellipsePoint(CX, CY, rx, ry, a0)
      for (let i = 1; i <= 12; i++) {
        const p = ellipsePoint(CX, CY, rx, ry, a0 + ((a1 - a0) * i) / 12)
        len += Math.hypot(p.x - prev.x, p.y - prev.y)
        prev = p
      }
      const n = Math.max(6, Math.round(len / 4.2))
      const letter = String.fromCharCode(65 + r)
      for (let s = 0; s < n; s++) {
        const a = a0 + ((a1 - a0) * (s + 0.5)) / n
        const p = ellipsePoint(CX, CY, rx, ry, a)
        seats.push({ row: letter, seat: String(s + 1), x: p.x, y: p.y })
      }
    }
    return seats
  }
  function liveCountsBySection() {
    const counts = {}
      liveMemories.forEach(function (m) { counts[m.section] = (counts[m.section] || 0) + 1 })
    return counts
  }
  function totalCount(sectionId) {
    return (data.SECTION_COUNTS[sectionId] || 0) + (liveCountsBySection()[sectionId] || 0)
  }
  function maxCount() {
    const lc = liveCountsBySection()
    let max = 1
    Object.keys(data.SECTION_COUNTS).forEach(function (k) {
      max = Math.max(max, data.SECTION_COUNTS[k] + (lc[k] || 0))
    })
    return max
  }
  function heatFill(sectionId) {
    const t = totalCount(sectionId) / maxCount()
    const ink = mode === "game" ? [26, 18, 8] : [42, 28, 16]
    const hot = mode === "game" ? [200, 16, 46] : [201, 150, 58]
    const r = Math.round(ink[0] + (hot[0] - ink[0]) * t)
    const g = Math.round(ink[1] + (hot[1] - ink[1]) * t)
    const b = Math.round(ink[2] + (hot[2] - ink[2]) * t)
    return "rgb(" + r + "," + g + "," + b + ")"
  }
  function normalizeLive(row) {
    return {
      id: row.id,
      section: row.section,
      row: row.seat_row || null,
      seat: row.seat || null,
      event: row.event,
      year: row.year,
      name: row.name,
      text: row.body,
      mediaUrl: row.media_status === "ready" && row.media_url ? row.media_url : null,
      live: true
    }
  }
  function allMemories() {
    return liveMemories.map(normalizeLive).concat(data.MEMORIES)
  }
  function memoriesForSection(sectionId) {
    return allMemories().filter(function (m) { return m.section === sectionId })
  }
  function memoriesForSeat(sectionId, row, seat) {
    return liveMemories.map(normalizeLive).filter(function (m) {
      return m.section === sectionId && m.row === row && m.seat === seat
    })
  }
  function seatKeySet() {
    const set = {}
      liveMemories.forEach(function (m) {
        if (m.seat_row && m.seat) set[m.section + "|" + m.seat_row + "|" + m.seat] = (set[m.section + "|" + m.seat_row + "|" + m.seat] || 0) + 1
      })
    return set
  }
  async function fetchLive() {
    if (!REMOTE) return
    try {
      const res = await fetch(REMOTE.url + "/rest/v1/saddledome_memories?select=*&approved=eq.true&order=created_at.desc&limit=500", {
        headers: { apikey: REMOTE.key, Authorization: "Bearer " + REMOTE.key }
      })
      if (!res.ok) return
      liveMemories = await res.json()
      refreshHeat()
      updateTotals()
    } catch (e) {}
  }
  async function submitMemory(payload) {
    if (!REMOTE) throw new Error("offline")
    const res = await fetch(REMOTE.url + "/rest/v1/saddledome_memories", {
      method: "POST",
      headers: {
        apikey: REMOTE.key,
        Authorization: "Bearer " + REMOTE.key,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || "submit failed")
    }
    const rows = await res.json()
    return rows[0]
  }
  function requestMedia(id) {
    if (!REMOTE || !REMOTE.mediaFn) return
    fetch(REMOTE.mediaFn, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + REMOTE.key },
      body: JSON.stringify({ id: id })
    }).catch(function () {})
  }
  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name)
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]) })
    if (parent) parent.appendChild(node)
    return node
  }
  function daysUntilWreckingBall() {
    const end = new Date(data.WRECKING_BALL)
    return Math.max(0, Math.ceil((end - new Date()) / 86400000))
  }
  function hottestSectionIds() {
    const lc = liveCountsBySection()
    return Object.keys(data.SECTION_COUNTS)
    .map(function (k) { return [k, data.SECTION_COUNTS[k] + (lc[k] || 0)] })
    .sort(function (a, b) { return b[1] - a[1] })
    .slice(0, 4)
    .map(function (e) { return e[0] })
  }
  function renderBowl() {
    const svg = document.getElementById("bowl-svg")
    svg.setAttribute("viewBox", HOME_BOX.join(" "))
    svg.setAttribute("role", "img")
    svg.setAttribute("aria-label", "Saddledome seating bowl heatmap of memories by section")
    svg.innerHTML = '<defs><filter id="ice-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="iceSoft"/><feMerge><feMergeNode in="iceSoft"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="heat-glow" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="core"/><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="halo"/><feMerge><feMergeNode in="halo"/><feMergeNode in="core"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="seat-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="halo"/><feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
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
        "aria-label": "Section " + sec.id + ", " + totalCount(sec.id) + " memories. Activate to zoom to seats."
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
      "aria-label": "Floor, " + totalCount("FLOOR") + " memories. Activate to zoom to seats."
    }
    if (floorHot) floorAttrs.filter = "url(#heat-glow)"
    el("path", floorAttrs, svg)
    el("ellipse", { cx: CX, cy: CY, rx: 92, ry: 58, class: "ice", filter: "url(#ice-glow)", "pointer-events": "none" }, svg)
    if (mode === "game") {
      el("line", { x1: CX - 92, y1: CY, x2: CX + 92, y2: CY, stroke: "#c8102e", "stroke-width": "2", "pointer-events": "none" }, svg)
    } else {
      el("rect", { x: CX - 70, y: CY + 18, width: 140, height: 36, rx: 4, class: "stage", "pointer-events": "none" }, svg)
    }
    el("text", { x: CX, y: CY + (mode === "game" ? 4 : -6), class: "floor-label" }, svg).textContent = "FLOOR"
    el("g", { id: "seat-layer" }, svg)
    bindSections(svg)
    window.__bowlLayout = { generated: generated, svg: svg }
    if (zoomedSection) {
      const sec = findSection(zoomedSection)
      if (sec) enterSection(sec, true)
    }
  }
  function refreshHeat() {
    const layout = window.__bowlLayout
    if (!layout) return
    layout.svg.querySelectorAll("[data-section]").forEach(function (node) {
      node.setAttribute("fill", heatFill(node.getAttribute("data-section")))
    })
  }
  function updateTotals() {
    const total = data.TOTAL_MEMORIES + liveMemories.length
    document.getElementById("total-n").textContent = String(total)
  }
  function findSection(id) {
    const layout = window.__bowlLayout
    if (!layout) return null
    if (id === "FLOOR") return layout.generated.floor
    const all = layout.generated.lower.concat(layout.generated.loge, layout.generated.upper)
    return all.find(function (s) { return s.id === id }) || null
  }
  function animateViewBox(svg, from, to, ms, done) {
    cancelAnimationFrame(viewBoxAnim)
    const start = performance.now()
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
    function frame(now) {
      const t = Math.min(1, (now - start) / ms)
      const e = ease(t)
      const box = from.map(function (v, i) { return v + (to[i] - v) * e })
      svg.setAttribute("viewBox", box.join(" "))
      if (t < 1) viewBoxAnim = requestAnimationFrame(frame)
      else if (done) done()
    }
    viewBoxAnim = requestAnimationFrame(frame)
  }
  function currentBox(svg) {
    return svg.getAttribute("viewBox").split(/\s+/).map(Number)
  }
  function sectionBox(sec) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    function take(p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
    if (sec.tier === "floor") {
      minX = CX - 122; maxX = CX + 122; minY = CY - 82; maxY = CY + 82
    } else {
      arcPoints(CX, CY, sec.outerRx, sec.outerRy, sec.t0, sec.t1, 12).forEach(take)
      arcPoints(CX, CY, sec.innerRx, sec.innerRy, sec.t0, sec.t1, 12).forEach(take)
    }
    const padX = (maxX - minX) * 0.18 + 6
    const padY = (maxY - minY) * 0.18 + 6
    return [minX - padX, minY - padY, (maxX - minX) + padX * 2, (maxY - minY) + padY * 2]
  }
  function enterSection(sec, instant) {
    const svg = document.getElementById("bowl-svg")
    zoomedSection = sec.id
    svg.classList.add("zoomed")
    document.getElementById("back-to-bowl").hidden = false
    renderSeats(sec)
    const target = sectionBox(sec)
    if (instant) svg.setAttribute("viewBox", target.join(" "))
    else animateViewBox(svg, currentBox(svg), target, 520)
    openPanel(sec.id)
  }
  function exitSection() {
    const svg = document.getElementById("bowl-svg")
    zoomedSection = null
    document.getElementById("back-to-bowl").hidden = true
    animateViewBox(svg, currentBox(svg), HOME_BOX, 480, function () {
      svg.classList.remove("zoomed")
      const layer = document.getElementById("seat-layer")
      if (layer) layer.innerHTML = ""
    })
    closePanel()
  }
  function renderSeats(sec) {
    const layer = document.getElementById("seat-layer")
    if (!layer) return
    layer.innerHTML = ""
    const taken = seatKeySet()
    const seats = generateSeats(sec)
    const tip = document.getElementById("tooltip")
    seats.forEach(function (st) {
      const key = sec.id + "|" + st.row + "|" + st.seat
      const has = taken[key] || 0
      const dot = el("circle", {
        cx: st.x.toFixed(2),
        cy: st.y.toFixed(2),
        r: sec.tier === "floor" ? 2.6 : 1.5,
        class: "seat" + (has ? " seat-has" : ""),
        "data-row": st.row,
        "data-seat": st.seat,
        tabindex: "-1"
      }, layer)
      if (has) dot.setAttribute("filter", "url(#seat-glow)")
      function label() {
        return (sec.id === "FLOOR" ? "FLOOR" : "SEC " + sec.id) + " · ROW " + st.row + " · SEAT " + st.seat + (has ? " · " + has + (has === 1 ? " memory" : " memories") : "")
      }
      dot.addEventListener("pointerenter", function (ev) {
        tip.hidden = false
        tip.textContent = label()
        moveTip(ev)
      })
      dot.addEventListener("pointermove", moveTip)
      dot.addEventListener("pointerleave", function () { tip.hidden = true })
      dot.addEventListener("click", function (ev) {
        ev.stopPropagation()
        openPanel(sec.id, st.row, st.seat)
      })
    })
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }
  function cardHtml(m, justFiled) {
    let media = ""
    if (m.mediaUrl) {
      media = '<img class="memory-media" loading="lazy" alt="Generated scene for this memory" src="' + escapeHtml(m.mediaUrl) + '">'
    }
    const where = m.row && m.seat ? '<span class="seat-tag">ROW ' + escapeHtml(m.row) + " · SEAT " + escapeHtml(m.seat) + "</span>" : ""
    return '<article class="memory-card' + (justFiled ? " just-filed" : "") + '"><p class="filed">FILED BY ' + escapeHtml(m.name).toUpperCase() + " · " + escapeHtml(m.year) + " · " + escapeHtml(m.event).toUpperCase() + (m.real ? '<span class="real-tag">real filing</span>' : "") + (justFiled ? '<span class="real-tag">just now</span>' : "") + where + '</p>' + media + '<p class="body">' + escapeHtml(m.text) + "</p></article>"
  }
  function openPanel(sectionId, row, seat) {
    const panel = document.getElementById("panel")
    panelContext = { section: sectionId, row: row || null, seat: seat || null }
    const title = sectionId === "FLOOR" ? "FLOOR" : "SEC " + sectionId
    const sub = row && seat ? "ROW " + row + " · SEAT " + seat : ""
    document.getElementById("panel-title").textContent = title + (sub ? " · " + sub : "")
    const n = totalCount(sectionId)
    document.getElementById("panel-count").textContent = n + (n === 1 ? " memory in the archive" : " memories in the archive")
    const list = document.getElementById("panel-list")
    let html = ""
    if (row && seat) {
      const exact = memoriesForSeat(sectionId, row, seat)
      if (exact.length) {
        html += '<p class="panel-sub">This seat remembers:</p>'
        exact.forEach(function (m) { html += cardHtml(m) })
      } else {
        html += '<p class="panel-sub">No one has filed from this exact seat yet. Be the first - the form below files to ROW ' + escapeHtml(row) + ", SEAT " + escapeHtml(seat) + ".</p>"
      }
      const others = memoriesForSection(sectionId).filter(function (m) { return !(m.row === row && m.seat === seat) }).slice(0, 4)
      if (others.length) {
        html += '<p class="panel-sub">Elsewhere in ' + title + ":</p>"
        others.forEach(function (m) { html += cardHtml(m) })
      }
    } else {
      const stories = memoriesForSection(sectionId)
      if (!stories.length) html += '<p class="panel-sub">The heat here is from the wider archive. File the first story.</p>'
      stories.slice(0, 8).forEach(function (m) { html += cardHtml(m) })
    }
    list.innerHTML = html
    renderForm()
    panel.classList.add("is-open")
    panel.setAttribute("aria-hidden", "false")
  }
  function closePanel() {
    const panel = document.getElementById("panel")
    panel.classList.remove("is-open")
    panel.setAttribute("aria-hidden", "true")
  }
  function renderForm() {
    const mount = document.getElementById("panel-form-mount")
    const ctx = panelContext
    const seatNote = ctx.row && ctx.seat ? "Files to ROW " + escapeHtml(ctx.row) + " · SEAT " + escapeHtml(ctx.seat) : "Pick a seat on the map to file seat-exact, or file to the section"
    if (!REMOTE) {
      mount.innerHTML = '<p class="panel-sub">Filing is open on the live site.</p>'
      return
    }
    mount.innerHTML =
      '<form id="memory-form" class="memory-form">' +
      '<h3>File your memory from here</h3>' +
      '<p class="panel-sub">' + seatNote + "</p>" +
      '<div class="form-row"><input required maxlength="40" name="name" placeholder="Your first name" aria-label="Your first name"><input required name="year" type="number" min="1983" max="2027" placeholder="Year" aria-label="Year"></div>' +
      '<select name="event" aria-label="Event type"><option>Flames</option><option>Concert</option><option>Olympics</option><option>Hitmen</option><option>Other</option></select>' +
      '<textarea required minlength="10" maxlength="500" name="body" rows="4" placeholder="What happened in this seat? (10-500 characters)" aria-label="Your memory"></textarea>' +
      '<button type="submit" class="file-btn">FILE THIS MEMORY</button>' +
      '<p class="form-status" id="form-status" role="status"></p>' +
      "</form>"
    document.getElementById("memory-form").addEventListener("submit", onSubmit)
  }
  async function onSubmit(ev) {
    ev.preventDefault()
    const form = ev.target
    const status = document.getElementById("form-status")
    const btn = form.querySelector("button")
    const payload = {
      section: panelContext.section,
      seat_row: panelContext.row,
      seat: panelContext.seat,
      name: form.name.value.trim(),
      year: Number(form.year.value),
      event: form.event.value,
      body: form.body.value.trim()
    }
    btn.disabled = true
    status.textContent = "Filing to the archive…"
    try {
      const row = await submitMemory(payload)
      liveMemories.unshift(row)
      requestMedia(row.id)
      refreshHeat()
      updateTotals()
      if (zoomedSection === panelContext.section) {
        const sec = findSection(zoomedSection)
        if (sec) renderSeats(sec)
      }
      riseMemory(normalizeLive(row))
      openPanel(panelContext.section, panelContext.row, panelContext.seat)
      const list = document.getElementById("panel-list")
      list.insertAdjacentHTML("afterbegin", cardHtml(normalizeLive(row), true))
    } catch (e) {
      btn.disabled = false
      status.textContent = "The archive didn't answer. Try again in a moment."
    }
  }
  function bindSections(svg) {
    const tip = document.getElementById("tooltip")
    svg.querySelectorAll("[data-section]").forEach(function (node) {
      const id = node.getAttribute("data-section")
      function show(ev) {
        if (zoomedSection) return
        const n = totalCount(id)
        tip.hidden = false
        tip.textContent = (id === "FLOOR" ? "FLOOR" : "SEC " + id) + " · " + n + (n === 1 ? " memory" : " memories") + " · click to sit"
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
      node.addEventListener("click", function () {
        if (zoomedSection === id) return
        const sec = findSection(id)
        if (sec) enterSection(sec)
      })
      node.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          const sec = findSection(id)
          if (sec) enterSection(sec)
        }
      })
    })
  }
  function moveTip(ev) {
    const tip = document.getElementById("tooltip")
    tip.style.left = ev.clientX + "px"
    tip.style.top = ev.clientY + "px"
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
  function sectionAnchor(sectionId) {
    const layout = window.__bowlLayout
    if (!layout) return { x: 50, y: 50 }
    const svg = layout.svg
    const all = [layout.generated.floor].concat(layout.generated.lower, layout.generated.loge, layout.generated.upper)
    const sec = all.find(function (s) { return s.id === sectionId }) || layout.generated.floor
    const pt = svg.createSVGPoint()
    pt.x = sec.lx || CX
    pt.y = sec.ly || CY
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
    card.innerHTML = '<p class="filed">FILED BY ' + escapeHtml(memory.name).toUpperCase() + " · " + escapeHtml(memory.year) + " · " + escapeHtml(memory.event).toUpperCase() + '</p><p class="body">' + escapeHtml(memory.text) + "</p>"
    frame.appendChild(card)
    const path = document.querySelector('[data-section="' + memory.section + '"]')
    if (path) {
      path.classList.add("is-hot")
      setTimeout(function () { path.classList.remove("is-hot") }, 900)
    }
    setTimeout(function () { card.remove() }, 7200)
  }
  function startLive() {
    document.getElementById("live-badge").hidden = false
    function tick() {
      if (!zoomedSection) {
        const airborne = document.querySelectorAll("#bowl-frame .rising").length
        if (airborne < 2) {
          const pool = allMemories()
          const m = pool[liveIndex % pool.length]
          liveIndex += 1
          riseMemory(m)
        }
      }
      liveTimer = setTimeout(tick, 4000 + Math.random() * 2000)
    }
    tick()
  }
  function init() {
    tickCountdown()
    updateTotals()
    document.getElementById("btn-game").addEventListener("click", function () { setMode("game") })
    document.getElementById("btn-concert").addEventListener("click", function () { setMode("concert") })
    document.querySelector(".panel-close").addEventListener("click", closePanel)
    document.getElementById("back-to-bowl").addEventListener("click", exitSection)
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const panel = document.getElementById("panel")
        if (panel.classList.contains("is-open")) closePanel()
        else if (zoomedSection) exitSection()
      }
    })
    setMode("game")
    startLive()
    fetchLive()
  }
  document.addEventListener("DOMContentLoaded", init)
})()
