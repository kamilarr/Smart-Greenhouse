import { TONE_CLASS } from '../lib/status'

export function SensorCard({ icon: Icon, iconClass, color, source, value, unit, percent, title, subtitle, badge }) {
  const width = Math.max(0, Math.min(100, percent ?? 0))

  return (
    <section className="border-t border-line pt-4" aria-label={title}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-lg ${iconClass}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-sm text-muted">{source}</span>
      </div>

      <p className="mt-5 text-4xl font-semibold tracking-tight tabular-nums">
        {value ?? '–'}
        <span className="ml-1 text-base font-normal text-muted">{unit}</span>
      </p>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label={`${title}: ${value ?? '-'} ${unit}`}
      >
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${width}%`, background: color }} />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        {badge && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[badge.tone]}`}>
            {badge.text}
          </span>
        )}
      </div>
    </section>
  )
}
