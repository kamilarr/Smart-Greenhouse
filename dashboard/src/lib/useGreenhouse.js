import { useCallback, useEffect, useRef, useState } from 'react'
import { config, topicsFor, DEFAULT_THRESHOLDS, ACTUATORS } from '../config'
import { createMockTransport, createMqttTransport, generateMockHistory } from './transports'

const HISTORY_MS = 24 * 3600 * 1000
const BUCKET_MS = 60 * 1000 // simpan maksimal 1 titik per menit
const PENDING_TIMEOUT_MS = 6000

function appendHistory(prev, point) {
  const last = prev[prev.length - 1]
  const next =
    last && point.t - last.t < BUCKET_MS
      ? [...prev.slice(0, -1), { ...point, t: last.t }]
      : [...prev, point]
  const cutoff = point.t - HISTORY_MS
  const firstKept = next.findIndex((p) => p.t >= cutoff)
  return firstKept > 0 ? next.slice(firstKept) : next
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Seluruh state greenhouse + aksi kontrol.
 * broker: 'connecting' | 'connected' | 'disconnected'
 * device: 'unknown' | 'online' | 'offline'
 */
export function useGreenhouse() {
  const [sensor, setSensor] = useState(null)
  const [status, setStatus] = useState({ mode: 'auto', pump: false, lamp: false, fan: false })
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [history, setHistory] = useState(() => (config.source === 'mock' ? generateMockHistory() : []))
  const [broker, setBroker] = useState('connecting')
  const [device, setDevice] = useState('unknown')
  const [lastUpdate, setLastUpdate] = useState(null)
  const [pending, setPending] = useState({})

  const transportRef = useRef(null)
  const pendingTimers = useRef({})
  const t = topicsFor(config.deviceId)

  // Riwayat dari backend (opsional)
  useEffect(() => {
    if (!config.apiUrl) return
    const ctrl = new AbortController()
    fetch(`${config.apiUrl}/api/history?hours=24`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((rows) => {
        if (!Array.isArray(rows)) return
        const parsed = rows
          .map((r) => ({ ...r, t: typeof r.t === 'number' ? r.t : Date.parse(r.t) }))
          .filter((r) => Number.isFinite(r.t))
          .sort((a, b) => a.t - b.t)
        setHistory((live) => [...parsed, ...live.filter((p) => p.t > (parsed.at(-1)?.t ?? 0))])
      })
      .catch((err) => err.name !== 'AbortError' && console.warn('[history]', err.message))
    return () => ctrl.abort()
  }, [])

  // Koneksi MQTT / simulasi
  useEffect(() => {
    let cancelled = false
    let transport = null

    const onMessage = (topic, payload) => {
      if (cancelled) return
      try {
        if (topic === t.sensor) {
          const d = JSON.parse(payload)
          const point = { t: Date.now(), temp: num(d.temp), hum: num(d.hum), soil: num(d.soil), light: num(d.light) }
          setSensor(point)
          setLastUpdate(new Date(point.t))
          setHistory((h) => appendHistory(h, point))
          setDevice('online')
        } else if (topic === t.status) {
          const d = JSON.parse(payload)
          setStatus({
            mode: d.mode === 'manual' ? 'manual' : 'auto',
            pump: Boolean(d.pump),
            lamp: Boolean(d.lamp),
            fan: Boolean(d.fan),
          })
          Object.values(pendingTimers.current).forEach(clearTimeout)
          pendingTimers.current = {}
          setPending({})
        } else if (topic === t.online) {
          setDevice(payload.trim() === 'online' ? 'online' : 'offline')
        } else if (topic === t.threshold) {
          setThresholds((prev) => ({ ...prev, ...JSON.parse(payload) }))
        }
      } catch (err) {
        console.warn('[MQTT] payload tidak valid di', topic, payload, err)
      }
    }

    const create = config.source === 'mqtt' ? createMqttTransport : createMockTransport
    Promise.resolve(
      create({
        deviceId: config.deviceId,
        onConnect: () => !cancelled && setBroker('connected'),
        onDisconnect: () => !cancelled && setBroker('disconnected'),
        onMessage,
      }),
    )
      .then((tr) => {
        if (cancelled) return tr.end()
        transport = tr
        transportRef.current = tr
      })
      .catch((err) => {
        console.error('[MQTT] gagal membuat koneksi', err)
        if (!cancelled) setBroker('disconnected')
      })

    return () => {
      cancelled = true
      transport?.end()
      transportRef.current = null
      Object.values(pendingTimers.current).forEach(clearTimeout)
      pendingTimers.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markPending = useCallback((key) => {
    setPending((p) => ({ ...p, [key]: true }))
    clearTimeout(pendingTimers.current[key])
    pendingTimers.current[key] = setTimeout(() => {
      setPending((p) => ({ ...p, [key]: false }))
    }, PENDING_TIMEOUT_MS)
  }, [])

  const setMode = useCallback(
    (mode) => {
      if (!transportRef.current) return
      transportRef.current.publish(t.cmdMode, mode)
      markPending('mode')
    },
    [t.cmdMode, markPending],
  )

  const setActuator = useCallback(
    (key, on) => {
      if (!transportRef.current || !ACTUATORS.includes(key)) return
      transportRef.current.publish(t.cmd(key), on ? 'ON' : 'OFF')
      markPending(key)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markPending],
  )

  const saveThresholds = useCallback(
    (next) => {
      if (!transportRef.current) return false
      transportRef.current.publish(t.threshold, JSON.stringify(next), { retain: true })
      setThresholds(next)
      return true
    },
    [t.threshold],
  )

  return {
    sensor,
    status,
    thresholds,
    history,
    broker,
    device,
    lastUpdate,
    pending,
    canControl: broker === 'connected' && device !== 'offline',
    setMode,
    setActuator,
    saveThresholds,
  }
}
