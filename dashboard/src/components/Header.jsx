import { useEffect, useRef, useState } from 'react'
import { Bell, Wifi, WifiOff, Loader2, Sprout } from 'lucide-react'
import { config } from '../config'
import { TONE_CLASS } from '../lib/status'

function ConnectionPill({ broker, device }) {
  let view
  if (broker === 'connecting') view = { text: 'Menghubungkan…', icon: Loader2, cls: 'bg-line text-muted', spin: true }
  else if (broker === 'disconnected') view = { text: 'Broker terputus', icon: WifiOff, cls: TONE_CLASS.bad }
  else if (device === 'offline') view = { text: 'Perangkat offline', icon: WifiOff, cls: TONE_CLASS.warn }
  else if (device === 'unknown') view = { text: 'Menunggu perangkat', icon: Loader2, cls: 'bg-line text-muted', spin: true }
  else view = { text: 'Terhubung', icon: Wifi, cls: TONE_CLASS.ok }
  const Icon = view.icon

  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${view.cls}`}>
      <Icon className={`size-3.5 ${view.spin ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
      {view.text}
    </span>
  )
}

function Notifications({ alerts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Notifikasi (${alerts.length})`}
        className="relative grid size-9 place-items-center rounded-lg border border-line bg-surface text-ink hover:bg-canvas"
      >
        <Bell className="size-4" aria-hidden />
        {alerts.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-surface" />}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Notifikasi</p>
          {alerts.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">Semua kondisi normal.</p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-canvas">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === 'bad' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-sm">
                    <span className="font-semibold">{a.title}</span>
                    <span className="block text-xs text-muted">{a.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function Header({ broker, device, alerts }) {
  return (
    <header className="border-b border-line bg-surface/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white">
            <Sprout className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{config.greenhouseName}</p>
            <p className="truncate text-xs text-muted">{config.greenhouseLocation}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config.source === 'mock' && (
            <span className="hidden rounded-full border border-dashed border-muted/50 px-2.5 py-1 text-xs text-muted sm:inline">
              Mode simulasi
            </span>
          )}
          <ConnectionPill broker={broker} device={device} />
          <Notifications alerts={alerts} />
        </div>
      </div>
    </header>
  )
}
