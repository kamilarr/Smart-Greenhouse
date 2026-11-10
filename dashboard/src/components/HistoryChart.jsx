import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export const SERIES = [
  { key: 'temp', label: 'Suhu', unit: '°C', color: '#e4572e' },
  { key: 'hum', label: 'Kelembapan udara', unit: '%', color: '#7b61c9' },
  { key: 'soil', label: 'Kelembapan tanah', unit: '%', color: '#1e7a4a' },
  { key: 'light', label: 'Cahaya', unit: '%', color: '#1f86c8' },
]

const RANGES = [
  { value: 1, label: '1 jam' },
  { value: 6, label: '6 jam' },
  { value: 24, label: '24 jam' },
]

const MAX_POINTS = 200
const pad = (n) => String(n).padStart(2, '0')
const hhmm = (t) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{hhmm(label)}</p>
      {payload.map((p) => {
        const s = SERIES.find((x) => x.key === p.dataKey)
        return (
          <p key={p.dataKey} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums">
              {p.value ?? '–'} {s.unit}
            </span>
          </p>
        )
      })}
    </div>
  )
}

export function HistoryChart({ history }) {
  const [hours, setHours] = useState(24)
  const [hidden, setHidden] = useState({})

  const now = history.at(-1)?.t ?? Date.now()
  const start = now - hours * 3600 * 1000

  const data = useMemo(() => {
    const inRange = history.filter((p) => p.t >= start)
    if (inRange.length <= MAX_POINTS) return inRange
    const step = Math.ceil(inRange.length / MAX_POINTS)
    return inRange.filter((_, i) => i % step === 0 || i === inRange.length - 1)
  }, [history, start])

  const ticks = useMemo(
    () => Array.from({ length: 7 }, (_, i) => Math.round(start + (i * (now - start)) / 6)),
    [start, now],
  )

  return (
    <section className="border-t border-line pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Kondisi lingkungan</h2>
          <p className="text-sm text-muted">Ringkasan pembacaan sensor {hours === 24 ? '24 jam' : `${hours} jam`} terakhir</p>
        </div>
        <label className="sr-only" htmlFor="range">Rentang waktu</label>
        <select
          id="range"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 h-72">
        {data.length < 2 ? (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-line text-sm text-muted">
            Menunggu data sensor… grafik terisi otomatis saat data masuk.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#e3e7de" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[start, now]}
                ticks={ticks}
                tickFormatter={hhmm}
                tick={{ fill: '#66756b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => Math.round(v)}
                tick={{ fill: '#66756b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  hide={hidden[s.key]}
                  type="monotone"
                  stroke={s.color}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={!hidden[s.key]}
            onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
            className={`flex items-center gap-1.5 text-sm transition-opacity ${hidden[s.key] ? 'opacity-40' : ''}`}
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
            {s.unit === '°C' && <span className="text-muted">(°C)</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
