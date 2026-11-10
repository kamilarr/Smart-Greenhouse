// Klasifikasi nilai sensor menjadi label status (badge di kartu & notifikasi).
// tone: 'ok' | 'warn' | 'bad'

export function tempStatus(v, th) {
  if (v == null) return null
  if (v > th.tempMax) return { text: 'Panas', tone: 'bad' }
  if (v < 22) return { text: 'Dingin', tone: 'warn' }
  return { text: 'Ideal', tone: 'ok' }
}

export function humStatus(v, th) {
  if (v == null) return null
  if (v > th.humMax) return { text: 'Terlalu lembap', tone: 'warn' }
  if (v < 40) return { text: 'Kering', tone: 'warn' }
  return { text: 'Normal', tone: 'ok' }
}

export function soilStatus(v, th) {
  if (v == null) return null
  if (v < th.soilMin) return { text: 'Kering', tone: 'bad' }
  if (v > 70) return { text: 'Basah', tone: 'warn' }
  return { text: 'Cukup lembap', tone: 'ok' }
}

export function lightStatus(v, th) {
  if (v == null) return null
  if (v < th.lightMin) return { text: 'Kurang cahaya', tone: 'warn' }
  if (v > 66) return { text: 'Terang', tone: 'ok' }
  return { text: 'Cahaya cukup', tone: 'ok' }
}

export const TONE_CLASS = {
  ok: 'bg-brand-soft text-brand',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-700',
}

export function formatTime(date) {
  return date
    ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '–'
}
