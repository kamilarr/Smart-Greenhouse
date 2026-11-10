import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const FIELDS = [
  { key: 'soilMin', label: 'Batas bawah kelembapan tanah', unit: '%', hint: 'Water pump menyala di bawah nilai ini', min: 0, max: 100 },
  { key: 'lightMin', label: 'Batas bawah intensitas cahaya', unit: '%', hint: 'Grow light menyala di bawah nilai ini', min: 0, max: 100 },
  { key: 'tempMax', label: 'Batas atas suhu udara', unit: '°C', hint: 'Mini fan menyala di atas nilai ini', min: 15, max: 45 },
  { key: 'humMax', label: 'Batas atas kelembapan udara', unit: '%', hint: 'Mini fan juga menyala di atas nilai ini', min: 0, max: 100 },
]

export function SettingsDialog({ open, onClose, thresholds, onSave, disabled }) {
  const ref = useRef(null)
  const [form, setForm] = useState(thresholds)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      setForm(thresholds)
      if (!d.open) d.showModal()
    } else if (d.open) d.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function submit(e) {
    e.preventDefault()
    const next = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]))
    if (onSave(next)) onClose()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl"
    >
      <form onSubmit={submit} className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pengaturan ambang batas</h2>
            <p className="text-sm text-muted">Dipakai ESP32 saat mode otomatis.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 hover:bg-canvas">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-semibold">{f.label}</span>
              <div className="mt-1 flex items-center rounded-lg border border-line focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <input
                  type="number"
                  required
                  min={f.min}
                  max={f.max}
                  step="1"
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full rounded-lg bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
                />
                <span className="pr-3 text-sm text-muted">{f.unit}</span>
              </div>
              <span className="mt-1 block text-xs text-muted">{f.hint}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-canvas">
            Batal
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            Simpan & kirim ke ESP32
          </button>
        </div>
      </form>
    </dialog>
  )
}
