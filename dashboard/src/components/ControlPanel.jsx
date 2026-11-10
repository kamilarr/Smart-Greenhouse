import { Activity, Bot, Droplets, Fan, Hand, Lightbulb, Loader2 } from 'lucide-react'

const ACTUATOR_META = [
  {
    key: 'pump',
    label: 'Water pump',
    desc: 'Siram tanaman',
    icon: Droplets,
    rule: (th) => `Menyala saat tanah < ${th.soilMin}%`,
  },
  {
    key: 'lamp',
    label: 'Grow light',
    desc: 'Penerangan tanaman',
    icon: Lightbulb,
    rule: (th) => `Menyala saat cahaya < ${th.lightMin}%`,
  },
  {
    key: 'fan',
    label: 'Mini fan',
    desc: 'Sirkulasi udara',
    icon: Fan,
    rule: (th) => `Menyala saat suhu > ${th.tempMax}°C atau RH > ${th.humMax}%`,
  },
]

function ModeSwitch({ mode, onChange, disabled, pending }) {
  const options = [
    { value: 'auto', label: 'Otomatis' },
    { value: 'manual', label: 'Manual' },
  ]
  return (
    <div role="radiogroup" aria-label="Mode kontrol" className="grid grid-cols-2 gap-1 rounded-xl bg-brand-soft p-1">
      {options.map((o) => {
        const active = mode === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || pending}
            onClick={() => !active && onChange(o.value)}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              active ? 'bg-brand text-white shadow-sm' : 'text-ink hover:bg-white/60'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ControlPanel({ status, thresholds, pending, canControl, onModeChange, onToggle }) {
  const manual = status.mode === 'manual'

  return (
    <section className="border-t border-line pt-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mode kontrol</h2>
          <p className="text-sm text-muted">Pilih cara kerja perangkat</p>
        </div>
        {pending.mode ? (
          <Loader2 className="size-4 text-muted motion-safe:animate-spin" aria-label="Mengirim perintah" />
        ) : (
          <Activity className="size-4 text-muted" aria-hidden />
        )}
      </div>

      <div className="mt-4">
        <ModeSwitch mode={status.mode} onChange={onModeChange} disabled={!canControl} pending={pending.mode} />
      </div>

      <div className="mt-4 flex items-start gap-3 border-b border-line pb-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          {manual ? <Hand className="size-4" aria-hidden /> : <Bot className="size-4" aria-hidden />}
        </span>
        <div>
          <p className="text-sm font-semibold">{manual ? 'Kontrol manual aktif' : 'Kontrol otomatis aktif'}</p>
          <p className="text-xs text-muted">
            {manual
              ? 'Atur perangkat satu per satu sesuai kebutuhan.'
              : 'ESP32 menyalakan perangkat berdasarkan ambang batas sensor.'}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {ACTUATOR_META.map(({ key, label, desc, icon: Icon, rule }) => {
          const on = status[key]
          const busy = pending[key]
          return (
            <li key={key} className="flex items-center gap-3 py-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
                  on ? 'bg-brand text-white' : 'bg-brand-soft text-brand'
                }`}
              >
                <Icon
                  className={`size-4 ${key === 'fan' && on ? 'motion-safe:animate-spin [animation-duration:1.5s]' : ''}`}
                  aria-hidden
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted">{manual ? desc : rule(thresholds)}</p>
              </div>

              {manual ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${label} ${on ? 'aktif' : 'mati'}`}
                  disabled={!canControl || busy}
                  onClick={() => onToggle(key, !on)}
                  className={`inline-flex min-w-20 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    on
                      ? 'border-brand bg-brand-soft text-brand hover:bg-brand/15'
                      : 'border-line bg-surface text-ink hover:bg-canvas'
                  }`}
                >
                  {busy && <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />}
                  {on ? 'Aktif' : 'Mati'}
                </button>
              ) : (
                <span
                  className={`min-w-20 rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                    on ? 'bg-brand-soft text-brand' : 'bg-line/60 text-muted'
                  }`}
                >
                  {on ? 'Aktif' : 'Mati'}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {!canControl && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Kontrol dinonaktifkan karena perangkat atau broker tidak terhubung.
        </p>
      )}
    </section>
  )
}
