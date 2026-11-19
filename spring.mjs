export const reference = progress => 1 - (1 - progress) ** 3

export function oscillator({ stiffness, damping, mass }) {
  if (![stiffness, damping, mass].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Stiffness, damping and mass must be positive numbers.')
  }
  const alpha = damping / (2 * mass)
  const omegaSquared = stiffness / mass
  const discriminant = alpha ** 2 - omegaSquared
  const ratio = alpha / Math.sqrt(omegaSquared)
  const rest = time => Math.exp(-alpha * time)

  if (Math.abs(discriminant) < omegaSquared * 1e-9) {
    return {
      ratio,
      regime: 'Critical',
      overshoot: 0,
      at(time) {
        const decay = rest(time)
        return { position: 1 - decay * (1 + alpha * time), speed: decay * alpha ** 2 * time }
      },
    }
  }

  if (discriminant < 0) {
    const beta = Math.sqrt(-discriminant)
    return {
      ratio,
      regime: 'Underdamped',
      overshoot: Math.exp(-Math.PI * alpha / beta),
      at(time) {
        const decay = rest(time)
        const sine = Math.sin(beta * time)
        return {
          position: 1 - decay * (Math.cos(beta * time) + alpha / beta * sine),
          speed: decay * omegaSquared / beta * sine,
        }
      },
    }
  }

  const fast = -alpha - Math.sqrt(discriminant)
  const slow = omegaSquared / fast
  return {
    ratio,
    regime: 'Overdamped',
    overshoot: 0,
    at(time) {
      const slowPart = Math.exp(slow * time)
      const fastPart = Math.exp(fast * time)
      return {
        position: 1 - (slow * fastPart - fast * slowPart) / (slow - fast),
        speed: slow * fast * (slowPart - fastPart) / (slow - fast),
      }
    },
  }
}

function simplify(values, tolerance) {
  const last = values.length - 1
  const selected = new Set([0, last])
  const segments = [[0, last]]
  while (segments.length) {
    const [left, right] = segments.pop()
    const slope = (values[right] - values[left]) / (right - left)
    let furthest = -1
    let error = tolerance
    for (let index = left + 1; index < right; index++) {
      const between = values[left] + (index - left) * slope
      const distance = Math.abs(values[index] - between)
      if (distance > error) {
        furthest = index
        error = distance
      }
    }
    if (furthest !== -1) {
      selected.add(furthest)
      segments.push([left, furthest], [furthest, right])
    }
  }
  return [...selected].sort((first, second) => first - second)
}

export function buildSpring(settings) {
  const model = oscillator(settings)
  const stepMs = 4
  const horizonMs = 8000
  const samples = []
  let lastMoving = 0
  for (let time = 0; time <= horizonMs; time += stepMs) {
    const { position, speed } = model.at(time / 1000)
    if (Math.abs(position - 1) > 0.0025 || Math.abs(speed) > 0.025) {
      lastMoving = samples.length
    }
    samples.push(position)
  }
  const settled = lastMoving < samples.length - 1
  const end = Math.min(samples.length - 1, Math.max(50, lastMoving + 1))
  const values = samples.slice(0, end + 1)
  values[0] = 0
  values[end] = 1
  const points = simplify(values, 0.002).map(index => ({
    percent: Number((100 * index / end).toFixed(3)),
    position: Number(values[index].toFixed(5)),
  }))
  return {
    durationMs: end * stepMs,
    points,
    ratio: model.ratio,
    regime: model.regime,
    overshoot: model.overshoot,
    settled,
  }
}

export function sampleEasing(points, progress) {
  const percent = Math.min(100, Math.max(0, progress * 100))
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1]
    const after = points[index]
    if (percent <= after.percent) {
      const span = after.percent - before.percent
      return before.position + (after.position - before.position) * (percent - before.percent) / span
    }
  }
  return points.at(-1).position
}

export function easingCSS(points) {
  const stops = points.map(({ position, percent }) => position + ' ' + percent + '%')
  const lines = []
  for (let index = 0; index < stops.length; index += 4) {
    lines.push('    ' + stops.slice(index, index + 4).join(', '))
  }
  return 'linear(\n' + lines.join(',\n') + '\n  )'
}
