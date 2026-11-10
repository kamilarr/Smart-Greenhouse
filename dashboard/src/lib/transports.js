import { config, topicsFor, DEFAULT_THRESHOLDS, ACTUATORS } from '../config'

/**
 * Transport = objek { publish(topic, payload, opts), end() }.
 * Dashboard tidak peduli datanya dari broker asli atau simulasi:
 * keduanya memanggil onMessage(topic, payloadString) dengan topic yang sama.
 */

// ---------------------------------------------------------------------------
// MQTT asli (broker via WebSocket)
// ---------------------------------------------------------------------------
export async function createMqttTransport({ deviceId, onConnect, onDisconnect, onMessage }) {
  const { default: mqtt } = await import('mqtt')
  const t = topicsFor(deviceId)

  const client = mqtt.connect(config.mqttUrl, {
    clientId: `web-${deviceId}-${Math.random().toString(16).slice(2, 8)}`,
    username: config.mqttUsername,
    password: config.mqttPassword,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clean: true,
  })

  client.on('connect', () => {
    client.subscribe([t.sensor, t.status, t.online, t.threshold], { qos: 1 })
    onConnect()
  })
  client.on('close', onDisconnect)
  client.on('offline', onDisconnect)
  client.on('error', (err) => console.error('[MQTT]', err.message))
  client.on('message', (topic, buf) => onMessage(topic, buf.toString()))

  return {
    publish: (topic, payload, opts = {}) => client.publish(topic, payload, { qos: 1, ...opts }),
    end: () => client.end(true),
  }
}

// ---------------------------------------------------------------------------
// Simulasi ESP32 (mode mock) — perilaku sama dengan firmware yang direncanakan
// ---------------------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** 0 (malam) .. 1 (siang hari) berdasarkan jam. */
export function daylightAt(date) {
  const h = date.getHours() + date.getMinutes() / 60
  return Math.max(0, Math.sin(((h - 6) / 12) * Math.PI))
}

let lastMockPoint = null

/** Riwayat 24 jam palsu (per 5 menit) agar grafik langsung terisi saat demo. */
export function generateMockHistory(now = Date.now()) {
  const points = []
  const step = 5 * 60 * 1000
  let soil = 55
  for (let t = now - 24 * 3600 * 1000; t <= now; t += step) {
    const d = daylightAt(new Date(t))
    soil -= rand(0.15, 0.35)
    if (soil < DEFAULT_THRESHOLDS.soilMin) soil += 25 // pompa menyiram
    points.push({
      t,
      temp: +(23 + 8 * d + rand(-0.2, 0.2)).toFixed(1),
      hum: Math.round(80 - 18 * d + rand(-0.8, 0.8)),
      soil: Math.round(soil),
      light: Math.round(clamp(8 + 82 * d + rand(-1.5, 1.5), 0, 100)),
    })
  }
  lastMockPoint = points.at(-1)
  return points
}

export function createMockTransport({ deviceId, onConnect, onMessage }) {
  const t = topicsFor(deviceId)
  // Lanjutkan dari titik terakhir riwayat simulasi supaya grafik tidak melompat
  const { temp = 26.5, hum = 68, soil = 44, light = 60 } = lastMockPoint ?? {}
  const s = { temp, hum, soil, light }
  const status = { mode: 'auto', pump: false, lamp: false, fan: false }
  let th = { ...DEFAULT_THRESHOLDS }

  const emit = (topic, payload) =>
    setTimeout(() => onMessage(topic, typeof payload === 'string' ? payload : JSON.stringify(payload)), 0)
  const emitStatus = () =>
    emit(t.status, { mode: status.mode, pump: +status.pump, lamp: +status.lamp, fan: +status.fan })

  // Logika otomatis dengan hysteresis (sama seperti yang akan ditanam di ESP32)
  function applyAuto() {
    const before = JSON.stringify(status)
    if (s.soil < th.soilMin) status.pump = true
    else if (s.soil >= th.soilMin + 10) status.pump = false

    if (s.light < th.lightMin) status.lamp = true
    else if (s.light >= th.lightMin + 5) status.lamp = false

    if (s.temp > th.tempMax || s.hum > th.humMax) status.fan = true
    else if (s.temp <= th.tempMax - 2 && s.hum <= th.humMax - 5) status.fan = false

    if (JSON.stringify(status) !== before) emitStatus()
  }

  function tick() {
    const d = daylightAt(new Date())
    s.light = clamp(s.light + (8 + 82 * d - s.light) * 0.08 + rand(-1.5, 1.5), 0, 100)
    s.temp += (23 + 8 * d - (status.fan ? 2 : 0) - s.temp) * 0.04 + rand(-0.12, 0.12)
    s.hum = clamp(s.hum + (80 - 18 * d - (status.fan ? 6 : 0) - s.hum) * 0.04 + rand(-0.5, 0.5), 0, 100)
    s.soil = clamp(s.soil + (status.pump ? 1.6 : -0.08) + rand(-0.2, 0.2), 0, 100)
    if (status.mode === 'auto') applyAuto()
    emit(t.sensor, {
      temp: +s.temp.toFixed(1),
      hum: Math.round(s.hum),
      soil: Math.round(s.soil),
      light: Math.round(s.light),
    })
  }

  const boot = setTimeout(() => {
    onConnect()
    emit(t.online, 'online')
    emit(t.threshold, th)
    applyAuto()
    emitStatus()
    tick()
  }, 400)
  const timer = setInterval(tick, 2000)

  return {
    publish(topic, payload) {
      // Seolah-olah ESP32 menerima pesan lalu membalas status (latensi ~300 ms)
      setTimeout(() => {
        if (topic === t.cmdMode) {
          status.mode = payload === 'manual' ? 'manual' : 'auto'
          if (status.mode === 'auto') applyAuto()
          emitStatus()
          return
        }
        const actuator = ACTUATORS.find((a) => topic === t.cmd(a))
        if (actuator) {
          if (status.mode === 'manual') status[actuator] = payload === 'ON'
          emitStatus()
          return
        }
        if (topic === t.threshold) {
          th = { ...th, ...JSON.parse(payload) }
          emit(t.threshold, th)
          if (status.mode === 'auto') applyAuto()
        }
      }, 300)
    },
    end() {
      clearTimeout(boot)
      clearInterval(timer)
    },
  }
}
