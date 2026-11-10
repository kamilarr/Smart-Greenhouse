import { useMemo, useState } from 'react'
import { Clock, Cloud, Sprout, SlidersHorizontal, Sun, Thermometer } from 'lucide-react'
import { useGreenhouse } from './lib/useGreenhouse'
import { formatTime, humStatus, lightStatus, soilStatus, tempStatus } from './lib/status'
import { Header } from './components/Header'
import { SensorCard } from './components/SensorCard'
import { HistoryChart } from './components/HistoryChart'
import { ControlPanel } from './components/ControlPanel'
import { SettingsDialog } from './components/SettingsDialog'

export default function App() {
  const gh = useGreenhouse()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { sensor, thresholds: th } = gh

  const st = {
    temp: tempStatus(sensor?.temp, th),
    hum: humStatus(sensor?.hum, th),
    soil: soilStatus(sensor?.soil, th),
    light: lightStatus(sensor?.light, th),
  }

  const alerts = useMemo(() => {
    const list = []
    if (gh.broker === 'disconnected') list.push({ id: 'broker', tone: 'bad', title: 'Broker MQTT terputus', detail: 'Mencoba menghubungkan ulang…' })
    if (gh.device === 'offline') list.push({ id: 'device', tone: 'bad', title: 'ESP32 offline', detail: 'Perangkat tidak mengirim data.' })
    const names = { temp: 'Suhu udara', hum: 'Kelembapan udara', soil: 'Kelembapan tanah', light: 'Intensitas cahaya' }
    Object.entries(st).forEach(([k, s]) => {
      if (s && s.tone !== 'ok') list.push({ id: k, tone: s.tone, title: `${names[k]}: ${s.text}`, detail: `Nilai sekarang ${sensor[k]}${k === 'temp' ? '°C' : '%'}` })
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh.broker, gh.device, sensor, th])

  const systemActive = gh.broker === 'connected' && gh.device === 'online'

  return (
    <div className="min-h-screen">
      <Header broker={gh.broker} device={gh.device} alerts={alerts} />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${systemActive ? 'text-brand' : 'text-muted'}`}>
              <span className={`size-2 rounded-full ${systemActive ? 'bg-brand' : 'bg-muted'}`} />
              {systemActive ? 'Sistem aktif' : 'Sistem tidak aktif'}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Ringkasan greenhouse</h1>
            <p className="mt-1 text-sm text-muted">Pantau kondisi tanaman dan perangkat Anda.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Clock className="size-4" aria-hidden />
              Diperbarui {formatTime(gh.lastUpdate)}
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-canvas"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Pengaturan
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          <SensorCard
            icon={Thermometer}
            iconClass="bg-temp/10 text-temp"
            color="#e4572e"
            source="DHT11 · Suhu"
            value={sensor?.temp?.toFixed(1)}
            unit="°C"
            percent={sensor ? (sensor.temp / 50) * 100 : 0}
            title="Suhu udara"
            subtitle={`Rentang nyaman 22–${th.tempMax}°C`}
            badge={st.temp}
          />
          <SensorCard
            icon={Cloud}
            iconClass="bg-hum/10 text-hum"
            color="#7b61c9"
            source="DHT11 · Kelembapan"
            value={sensor?.hum}
            unit="%"
            percent={sensor?.hum}
            title="Kelembapan udara"
            subtitle={`Batas atas ${th.humMax}%`}
            badge={st.hum}
          />
          <SensorCard
            icon={Sprout}
            iconClass="bg-soil/10 text-soil"
            color="#1e7a4a"
            source="Soil Moisture"
            value={sensor?.soil}
            unit="%"
            percent={sensor?.soil}
            title="Kelembapan tanah"
            subtitle={`Target kelembapan ${th.soilMin}–70%`}
            badge={st.soil}
          />
          <SensorCard
            icon={Sun}
            iconClass="bg-light/10 text-light"
            color="#1f86c8"
            source="LDR · Cahaya"
            value={sensor?.light}
            unit="%"
            percent={sensor?.light}
            title="Intensitas cahaya"
            subtitle={`Lampu menyala di bawah ${th.lightMin}%`}
            badge={st.light}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
          <HistoryChart history={gh.history} />
          <ControlPanel
            status={gh.status}
            thresholds={th}
            pending={gh.pending}
            canControl={gh.canControl}
            onModeChange={gh.setMode}
            onToggle={gh.setActuator}
          />
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        thresholds={th}
        onSave={gh.saveThresholds}
        disabled={!gh.canControl}
      />
    </div>
  )
}
