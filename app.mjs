import { buildSpring, easingCSS, reference, sampleEasing } from './spring.mjs'

const get = id => document.getElementById(id)
const presets = {
  snappy: { stiffness: 330, damping: 30, mass: 1 },
  bounce: { stiffness: 180, damping: 12, mass: 1 },
  soft: { stiffness: 100, damping: 22, mass: 1.4 },
}
const modes = {
  slide: { from: 'translateX(0px)', to: 'translateX(160px)' },
  pop: { from: 'scale(.55)', to: 'scale(1)' },
  turn: { from: 'rotate(-90deg)', to: 'rotate(0deg)' },
}
const tracks = [get('spring-tile'), get('reference-tile')]
const canvas = get('curve')
const ctx = canvas.getContext('2d')
const parameters = Object.keys(presets.bounce)
let spring
let preset = 'bounce'
let mode = 'slide'
let progress = 0
let frame = null

function updateExport() {
  const values = [
    ':root {',
    '  --spring-duration: ' + spring.durationMs + 'ms;',
    '  --spring-ease: ' + easingCSS(spring.points) + ';',
    '}',
    '',
    '.spring-target {',
    '  transform: ' + modes[mode].from + ';',
    '  transition: transform var(--spring-duration) var(--spring-ease);',
    '}',
    '',
    '.spring-target.is-active { transform: ' + modes[mode].to + '; }',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  .spring-target { transition: none; }',
    '}',
  ]
  get('css').value = values.join('\n') + '\n'
  get('notice').textContent = spring.settled ? '' : 'Motion is capped at 8 seconds.'
}

function positionTile(tile, value) {
  const lane = tile.parentElement
  const room = Math.max(0, lane.clientWidth - 60)
  const travel = room / Math.max(1.1, 1.06 + spring.overshoot)
  const center = room / 2
  const destination = mode === 'slide' ? travel : center
  lane.querySelector('.target').style.transform = 'translateX(' + destination + 'px)'
  if (mode === 'slide') {
    tile.style.transform = 'translateX(' + travel * value + 'px)'
  } else if (mode === 'pop') {
    tile.style.transform = 'translateX(' + center + 'px) scale(' + (0.55 + value * 0.45) + ')'
  } else {
    tile.style.transform = 'translateX(' + center + 'px) rotate(' + (-90 + 90 * value) + 'deg)'
  }
}

function chartBounds() {
  return { x: 45, y: 15, width: Math.max(1, canvas.clientWidth - 67), height: Math.max(1, canvas.clientHeight - 48) }
}

function drawCurve(position) {
  if (!ctx) return
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const bounds = chartBounds()
  const ceiling = Math.max(1.15, 1.08 + spring.overshoot)
  const x = value => bounds.x + value * bounds.width
  const y = value => bounds.y + (ceiling - value) / (ceiling + 0.04) * bounds.height
  ctx.font = '11px ui-monospace, monospace'
  ctx.lineWidth = 1
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#bcb4ca'
  for (const value of [0, 0.5, 1]) {
    ctx.strokeStyle = value === 1 ? '#766984' : '#362f45'
    ctx.beginPath()
    ctx.moveTo(x(0), y(value))
    ctx.lineTo(x(1), y(value))
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.fillText(100 * value + '%', x(0) - 7, y(value))
  }
  for (let index = 0; index <= 4; index++) {
    const step = index / 4
    ctx.strokeStyle = '#362f45'
    ctx.beginPath()
    ctx.moveTo(x(step), bounds.y)
    ctx.lineTo(x(step), bounds.y + bounds.height)
    ctx.stroke()
    ctx.textAlign = index === 0 ? 'left' : index === 4 ? 'right' : 'center'
    ctx.fillText(Math.round(step * spring.durationMs) + ' ms', x(step), bounds.y + bounds.height + 14)
  }

  ctx.strokeStyle = '#bcb0f7'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  for (let index = 0; index <= 64; index++) {
    const step = index / 64
    if (!index) ctx.moveTo(x(step), y(reference(step)))
    else ctx.lineTo(x(step), y(reference(step)))
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#ffb199'
  for (const [index, point] of spring.points.entries()) {
    const pointX = x(point.percent / 100)
    const pointY = y(point.position)
    if (!index) ctx.moveTo(pointX, pointY)
    else ctx.lineTo(pointX, pointY)
  }
  ctx.stroke()
  ctx.strokeStyle = '#a19aa8'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x(progress), bounds.y)
  ctx.lineTo(x(progress), bounds.y + bounds.height)
  ctx.stroke()
  ctx.fillStyle = '#ffddd1'
  ctx.beginPath()
  ctx.arc(x(progress), y(position), 4, 0, 2 * Math.PI)
  ctx.fill()
}

function seek(value) {
  progress = Math.min(1, Math.max(0, value))
  const position = sampleEasing(spring.points, progress)
  get('scrub').value = Math.round(1000 * progress)
  get('clock').value = Math.round(spring.durationMs * progress) + ' ms'
  get('progress').textContent = (100 * position).toFixed(1) + '% spring'
  positionTile(tracks[0], position)
  positionTile(tracks[1], reference(progress))
  drawCurve(position)
}

function stop() {
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  get('play').textContent = 'Play'
}

function play() {
  if (frame !== null) return stop()
  if (progress >= 1) seek(0)
  get('play').textContent = 'Pause'
  const start = performance.now() - progress * spring.durationMs
  const tick = time => {
    seek((time - start) / spring.durationMs)
    if (progress < 1) frame = requestAnimationFrame(tick)
    else stop()
  }
  frame = requestAnimationFrame(tick)
}

function rebuild() {
  stop()
  const settings = Object.fromEntries(parameters.map(name => {
    const value = Number(get(name).value)
    get(name + '-value').value = value
    return [name, value]
  }))
  for (const button of get('presets').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.preset === preset))
  }
  spring = buildSpring(settings)
  get('duration').textContent = spring.durationMs + ' ms' + (spring.settled ? '' : ' cap')
  get('overshoot').textContent = (100 * spring.overshoot).toFixed(1) + '%'
  get('regime').textContent = spring.regime + ' · ζ ' + spring.ratio.toFixed(2)
  updateExport()
  seek(0)
}

function applyPreset(name) {
  preset = name
  for (const [parameter, value] of Object.entries(presets[name])) get(parameter).value = value
  rebuild()
}

for (const parameter of parameters) {
  get(parameter).addEventListener('input', () => { preset = null; rebuild() })
}
get('presets').addEventListener('click', event => {
  const button = event.target.closest('[data-preset]')
  if (button) applyPreset(button.dataset.preset)
})
get('modes').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]')
  if (!button) return
  mode = button.dataset.mode
  for (const item of get('modes').querySelectorAll('button')) item.setAttribute('aria-pressed', String(item === button))
  updateExport()
  seek(progress)
})
get('play').addEventListener('click', play)
get('restart').addEventListener('click', () => { stop(); seek(0) })
get('scrub').addEventListener('input', event => { stop(); seek(Number(event.target.value) / 1000) })

function seekFromPointer(event) {
  const bounds = chartBounds()
  seek((event.clientX - canvas.getBoundingClientRect().left - bounds.x) / bounds.width)
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  stop()
  canvas.setPointerCapture(event.pointerId)
  seekFromPointer(event)
})
canvas.addEventListener('pointermove', event => {
  if (canvas.hasPointerCapture(event.pointerId)) seekFromPointer(event)
})

get('copy').addEventListener('click', async () => {
  const field = get('css')
  try {
    await navigator.clipboard.writeText(field.value)
    get('notice').textContent = 'CSS copied.'
  } catch {
    field.focus()
    field.select()
    get('notice').textContent = 'CSS selected. Use your browser’s copy shortcut or Download CSS.'
  }
})
get('download').addEventListener('click', () => {
  const blob = new Blob([get('css').value], { type: 'text/css' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'spring-motion.css'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
applyPreset('bounce')
new ResizeObserver(() => seek(progress)).observe(canvas)
