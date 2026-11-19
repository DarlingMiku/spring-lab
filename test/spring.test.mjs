import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { buildSpring, easingCSS, oscillator, sampleEasing } from '../spring.mjs'

test('under-, critically, and overdamped systems have the expected motion', () => {
  const base = { stiffness: 100, mass: 1 }
  const under = oscillator({ ...base, damping: 10 })
  assert.equal(under.regime, 'Underdamped')
  const peak = under.at(Math.PI / Math.sqrt(75))
  assert.ok(Math.abs(peak.position - 1 - under.overshoot) < 1e-10)
  assert.ok(Math.abs(peak.speed) < 1e-10)

  const critical = oscillator({ ...base, damping: 20 })
  assert.equal(critical.regime, 'Critical')
  assert.ok(Math.abs(critical.at(0.1).position - (1 - 2 / Math.E)) < 1e-10)

  const over = oscillator({ ...base, damping: 40 })
  assert.equal(over.regime, 'Overdamped')
  assert.equal(over.overshoot, 0)
  let previous = -1
  for (let time = 0; time <= 6; time += 0.1) {
    const value = over.at(time).position
    assert.ok(value >= previous && value <= 1)
    previous = value
  }
  assert.throws(() => oscillator({ ...base, damping: 0 }), /positive/)
})

test('the controls produce finite, strictly ordered CSS stops and settle within the time limit', () => {
  for (const stiffness of [80, 200, 600]) {
    for (const damping of [6, 22, 60]) {
      for (const mass of [0.6, 1, 2.2]) {
        const spring = buildSpring({ stiffness, damping, mass })
        assert.equal(spring.settled, true)
        assert.deepEqual(spring.points[0], { percent: 0, position: 0 })
        assert.deepEqual(spring.points.at(-1), { percent: 100, position: 1 })
        assert.ok(spring.points.every((point, i) => Number.isFinite(point.position) && (
          i === 0 || point.percent > spring.points[i - 1].percent
        )))
      }
    }
  }
})

test('compressed easing tracks the sampled spring and exports CSS stops', () => {
  const settings = { stiffness: 180, damping: 12, mass: 1 }
  const model = oscillator(settings)
  const curve = buildSpring(settings)
  for (let ms = 0; ms <= curve.durationMs; ms += 4) {
    const raw = model.at(ms / 1000).position
    assert.ok(Math.abs(sampleEasing(curve.points, ms / curve.durationMs) - raw) < 0.004)
  }
  assert.ok(curve.points.length < curve.durationMs / 4)
  assert.match(easingCSS(curve.points), /^linear\(\n[\s\S]*1 100%\n {2}\)$/)
})
