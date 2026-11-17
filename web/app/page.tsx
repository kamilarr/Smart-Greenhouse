"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, Bell, Bot, ChartColumn, Check, Clock, Fan, Hand, Lightbulb,
  LoaderCircle, Sprout, Sun, Thermometer, Timer, Wifi, WifiOff, X,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Reading = {
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  light: number | null;
  pump: boolean;
  fan: boolean;
  grow_light: boolean;
  latency_ms?: number | null;
  created_at: string;
};
type Device = {
  id: string;
  name: string;
  location: string | null;
  mode: "auto" | "manual";
  pump_cmd: boolean;
  fan_cmd: boolean;
  light_cmd: boolean;
  soil_min: number;
  temp_max: number;
  light_min: number;
  online: boolean;
  latest: Reading | null;
};
type ActuatorEvent = {
  actuator: string;
  state: boolean;
  source: string;
  created_at: string;
};
type ChartPoint = {
  t: string;
  temperature: number | null;
  soil_moisture: number | null;
  light: number | null;
};
type Range = "30m" | "24h" | "7d";
type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  level: "warning" | "danger";
};
type SensorStatus = {
  text: string;
  level: "normal" | "warning" | "danger" | "info";
};

const POLL_MS = 2000;
const COLORS = { temp: "#d97745", soil: "#397653", light: "#6387b7" };
const ACTUATOR_LABEL: Record<string, string> = {
  pump: "Water pump",
  fan: "Mini fan",
  grow_light: "Grow light",
};
const clock = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const round1 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;

function classifyTemperature(value: number | null | undefined, threshold: number): SensorStatus | null {
  if (value == null) return null;
  if (value < threshold * 0.8) return { text: "Dingin", level: "info" };
  if (value < threshold) return { text: "Normal", level: "normal" };
  return { text: "Panas", level: "danger" };
}
function classifySoil(value: number | null | undefined, threshold: number): SensorStatus | null {
  if (value == null) return null;
  if (value < threshold) return { text: "Kering", level: "danger" };
  if (value <= threshold * 1.5) return { text: "Lembap", level: "normal" };
  return { text: "Basah", level: "info" };
}
function classifyLight(value: number | null | undefined, threshold: number): SensorStatus | null {
  if (value == null) return null;
  if (value < threshold) return { text: "Gelap", level: "danger" };
  if (value <= threshold * 1.5) return { text: "Redup", level: "warning" };
  return { text: "Terang", level: "normal" };
}

const statusClass: Record<SensorStatus["level"], string> = {
  normal: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
};

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState("");
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [avgLatency, setAvgLatency] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("30m");
  const [events, setEvents] = useState<ActuatorEvent[]>([]);
  const [demoActuators, setDemoActuators] = useState({ pump: false, fan: false, grow_light: false });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [soilMin, setSoilMin] = useState("");
  const [tempMax, setTempMax] = useState("");
  const [lightMin, setLightMin] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [pending, setPending] = useState(false);
  const [thresholdPending, setThresholdPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const activeAlerts = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/devices");
      if (!response.ok) throw new Error("Gagal mengambil daftar perangkat");
      const list: Device[] = await response.json();
      if (!Array.isArray(list)) return;
      const id = selected || list.find((item) => item.id === "gh-01")?.id || list[0]?.id;
      if (!id) return;
      if (!selected) setSelected(id);

      if (id === "gh-02") {
        const now = Date.now();
        const demoReading: Reading = {
          temperature: 26.4, humidity: 68, soil_moisture: null,
          light: 72, pump: demoActuators.pump, fan: demoActuators.fan,
          grow_light: demoActuators.grow_light, created_at: new Date(now).toISOString(),
        };
        const demoDevice = list.find((item) => item.id === "gh-02");
        setDevices(demoDevice
          ? list.map((item) => item.id === "gh-02" ? { ...item, online: true, latest: demoReading } : item)
          : list);
        setEvents([]);
        setAvgLatency(null);
        const pointCount = range === "30m" ? 16 : range === "24h" ? 24 : 7;
        const interval = range === "30m" ? 2 * 60_000 : range === "24h" ? 60 * 60_000 : 24 * 60 * 60_000;
        setChart(Array.from({ length: pointCount }, (_, index) => {
          const time = now - (pointCount - 1 - index) * interval;
          return {
            t: new Date(time).toISOString(),
            temperature: Number((26.1 + Math.sin(index / 2.8) * 0.7).toFixed(1)),
            soil_moisture: null,
            light: Number((71 + Math.cos(index / 3) * 3).toFixed(1)),
          };
        }));
        setUpdatedAt(new Date());
        setLoadError(false);
        return;
      }

      setDevices(list);
      const readingsResponse = await fetch(`/api/readings?device_id=${id}&hours=0.5`);
      if (!readingsResponse.ok) throw new Error("Gagal mengambil data sensor");
      const readings = await readingsResponse.json();
      setEvents(readings.events ?? []);
      const latencies = (readings.readings ?? [])
        .map((r: Reading) => r.latency_ms)
        .filter((v: number | null | undefined): v is number => v != null && Number.isFinite(v));
      setAvgLatency(latencies.length
        ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
        : null);

      if (range === "30m") {
        setChart((readings.readings ?? []).map((r: Reading) => ({
          t: r.created_at, temperature: r.temperature,
          soil_moisture: r.soil_moisture, light: r.light,
        })));
      } else {
        const days = range === "24h" ? 1 : 7;
        const analyticsResponse = await fetch(`/api/analytics?device_id=${id}&days=${days}`);
        if (!analyticsResponse.ok) throw new Error("Gagal mengambil data analytics");
        const result = await analyticsResponse.json();
        setChart((result.hourly ?? []).map((h: {
          hour: string; avg_temp: number | null; avg_soil: number | null; avg_light: number | null;
        }) => ({
          t: h.hour,
          temperature: h.avg_temp == null ? null : Number(h.avg_temp),
          soil_moisture: h.avg_soil == null ? null : Number(h.avg_soil),
          light: h.avg_light == null ? null : Number(h.avg_light),
        })));
      }
      setUpdatedAt(new Date());
      setLoadError(false);
    } catch {
      // Polling berikutnya akan mencoba mengambil data kembali.
      setLoadError(true);
    }
  }, [selected, range, demoActuators]);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, POLL_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  const device = devices.find((d) => d.id === selected);
  const latest = device?.latest;
  const hasSoilAndActuators = selected === "gh-01";
  const isDemoGreenhouse = selected === "gh-02";

  function toggleDemoActuator(key: "pump" | "fan" | "grow_light") {
    setDemoActuators((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!device) return;
    const alerts: { key: string; title: string; message: string; level: "warning" | "danger" }[] = [];
    if (!device.online && device.id !== "gh-02") {
      alerts.push({ key: `${device.id}-offline`, title: "Perangkat offline",
        message: `${device.name} tidak mengirimkan data. Periksa koneksi ESP32.`, level: "danger" });
    }
    if (latest?.temperature != null && latest.temperature >= device.temp_max) {
      alerts.push({ key: `${device.id}-temperature`, title: "Suhu terlalu tinggi",
        message: `${device.name}: suhu mencapai ${latest.temperature}°C.`, level: "warning" });
    }
    if (selected === "gh-01" && latest?.soil_moisture != null && latest.soil_moisture < device.soil_min) {
      alerts.push({ key: `${device.id}-soil`, title: "Tanah terlalu kering",
        message: `${device.name}: kelembapan tanah ${latest.soil_moisture}%, di bawah threshold ${device.soil_min}%.`, level: "warning" });
    }
    if (latest?.light != null && latest.light < device.light_min) {
      alerts.push({ key: `${device.id}-light`, title: "Cahaya kurang",
        message: `${device.name}: intensitas cahaya ${latest.light}%, di bawah threshold ${device.light_min}%.`, level: "warning" });
    }
    const currentKeys = new Set(alerts.map((alert) => alert.key));
    alerts.forEach((alert) => {
      if (activeAlerts.current.has(alert.key)) return;
      const item: AppNotification = {
        id: `${alert.key}-${Date.now()}`, title: alert.title, message: alert.message,
        createdAt: new Date().toISOString(), level: alert.level,
      };
      setNotifications((previous) => [item, ...previous].slice(0, 30));
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Smart Greenhouse - ${alert.title}`, { body: alert.message, tag: alert.key });
      }
    });
    activeAlerts.current = currentKeys;
  }, [device, latest, selected]);

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) {
      setFeedback({ type: "error", message: "Browser ini belum mendukung notifikasi." });
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  async function control(body: Record<string, unknown>): Promise<boolean> {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: selected, ...body }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Perintah gagal dikirim.");
      }
      await load();
      setFeedback({ type: "success", message: "Perintah berhasil dikirim." });
      return true;
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Terjadi kesalahan." });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function saveThresholds(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = [
      { label: "Threshold kelembapan tanah", value: soilMin, setter: setSoilMin },
      { label: "Threshold suhu", value: tempMax, setter: setTempMax },
      { label: "Threshold cahaya", value: lightMin, setter: setLightMin },
    ];
    const activeValues = values.filter((item) => item.value.trim() !== "");
    if (!activeValues.length) {
      setFeedback({ type: "error", message: "Masukkan setidaknya satu nilai threshold." });
      return;
    }
    if (activeValues.some((item) => !Number.isFinite(Number(item.value)) || Number(item.value) < 0)) {
      setFeedback({ type: "error", message: "Threshold harus berupa angka yang valid dan tidak negatif." });
      return;
    }
    setThresholdPending(true);
    setFeedback(null);
    try {
      const saved = await control({
        ...(hasSoilAndActuators && soilMin.trim() !== "" && { soil_min: Number(soilMin) }),
        ...(tempMax.trim() !== "" && { temp_max: Number(tempMax) }),
        ...(lightMin.trim() !== "" && { light_min: Number(lightMin) }),
      });
      // Input hanya dibersihkan jika pengiriman berhasil.
      if (saved) { setSoilMin(""); setTempMax(""); setLightMin(""); }
    } finally {
      setThresholdPending(false);
    }
  }

  const tickLabel = (iso: string) => range === "7d"
    ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
    : new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const onlineLabel = isDemoGreenhouse ? "Mode simulasi" : device?.online ? "Terhubung" : "Terputus";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f6f1] text-[#1c3025]">
      <style jsx global>{`
        @keyframes rise-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .rise-in { animation: rise-in .55s ease-out both; }
        .stagger-1 { animation-delay: .06s; } .stagger-2 { animation-delay: .12s; } .stagger-3 { animation-delay: .18s; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <header className="sticky top-0 z-30 border-b border-[#e4e9e1] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#204d35] text-white shadow-sm">
              <Sprout size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#78907e]">Smart Greenhouse</p>
              <select aria-label="Pilih greenhouse" className="max-w-[190px] truncate bg-transparent text-sm font-bold text-[#1c3025] outline-none sm:max-w-none"
                value={selected} onChange={(e) => { setSelected(e.target.value); setFeedback(null); }}>
                {devices.filter((d) => d.id === "gh-01" || d.id === "gh-02").map((d) =>
                  <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <p className="truncate text-xs text-[#849187]">{device?.location ?? "Memuat lokasi..."}</p>
            </div>
          </div>

          <nav aria-label="Navigasi dashboard" className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setNotificationOpen((open) => !open)}
                aria-expanded={notificationOpen} aria-label={`Notifikasi, ${notifications.length} pemberitahuan`}
                className="relative inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e4e9e1] bg-white px-3 text-sm font-medium text-[#526457] transition hover:border-[#b8c9ba] hover:bg-[#f5f8f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397653]">
                <Bell size={17} /><span className="hidden sm:inline">Notifikasi</span>
                {notifications.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c65b3e] px-1 text-[10px] font-bold text-white">{notifications.length}</span>}
              </button>
              {notificationOpen && (
                <div role="dialog" aria-label="Panel notifikasi"
                  className="fixed inset-x-3 top-[9rem] z-[60] mx-auto max-h-[calc(100dvh-10rem)] w-auto max-w-[390px] overflow-y-auto rounded-2xl border border-[#e4e9e1] bg-white p-4 shadow-[0_18px_60px_-20px_rgba(25,50,32,.3)] rise-in sm:inset-x-auto sm:right-6 sm:top-20 sm:mx-0 sm:max-h-[calc(100dvh-6rem)] sm:w-[390px]">
                  <div className="flex items-center justify-between">
                    <div><h3 className="font-bold">Notifikasi</h3><p className="text-xs text-[#849187]">Peringatan kondisi greenhouse</p></div>
                    <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Tutup notifikasi" className="rounded-lg p-2 text-[#718174] hover:bg-[#f1f5ef]"><X size={18} /></button>
                  </div>
                  <button type="button" onClick={enableBrowserNotifications} disabled={permission === "granted"}
                    className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#204d35] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#173c29] disabled:bg-[#e7f0e8] disabled:text-[#397653]">
                    {permission === "granted" ? <Check size={15} /> : <Bell size={15} />}
                    {permission === "granted" ? "Notifikasi browser aktif" : permission === "denied" ? "Izin ditolak — periksa pengaturan browser" : "Aktifkan notifikasi browser"}
                  </button>
                  <div className="mt-3 max-h-[min(42dvh,320px)] space-y-2 overflow-y-auto sm:max-h-[min(55vh,360px)]">
                    {notifications.length === 0 ? <p className="py-8 text-center text-sm text-[#849187]">Belum ada peringatan.</p> :
                      notifications.map((item) => <div key={item.id} className={`rounded-xl border p-3 ${item.level === "danger" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                        <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.level === "danger" ? "bg-rose-500" : "bg-amber-500"}`} /><p className="text-sm font-semibold">{item.title}</p></div>
                        <p className="mt-1 text-xs leading-relaxed text-[#58665b]">{item.message}</p>
                        <p className="mt-2 text-[10px] text-[#849187]">{new Date(item.createdAt).toLocaleString("id-ID")}</p>
                      </div>)}
                  </div>
                  {notifications.length > 0 && <button type="button" onClick={() => setNotifications([])} className="mt-3 text-xs font-semibold text-[#397653] hover:underline">Hapus semua notifikasi</button>}
                </div>
              )}
            </div>
            <Link href="/analytics" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e4e9e1] bg-white px-3 text-sm font-medium text-[#526457] transition hover:border-[#b8c9ba] hover:bg-[#f5f8f3]">
              <ChartColumn size={17} /><span className="hidden sm:inline">Analytics</span>
            </Link>
            {device && <span className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${isDemoGreenhouse ? "bg-sky-50 text-sky-700" : device.online ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {isDemoGreenhouse ? <Activity size={15} /> : device.online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span className="hidden sm:inline">{onlineLabel}</span><span className="sm:hidden">{isDemoGreenhouse ? "Demo" : device.online ? "Online" : "Offline"}</span>
            </span>}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="rise-in flex flex-col justify-between gap-5 rounded-[28px] bg-[#204d35] px-5 py-6 text-white shadow-[0_18px_50px_-30px_rgba(24,60,39,.7)] sm:px-8 sm:py-8 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.13em] text-[#d8e8d8]">
              <span className={`h-2 w-2 rounded-full ${isDemoGreenhouse ? "bg-sky-300" : device?.online ? "bg-emerald-300" : "bg-rose-300"}`} />
              {isDemoGreenhouse ? "Lingkungan simulasi" : device?.online ? "Sistem terhubung" : "Node offline"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard greenhouse</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#d4e1d5]">Pantau kondisi lingkungan dan kelola perangkat greenhouse dalam satu tampilan.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[330px]">
            <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4">
              <div className="flex items-center gap-2 text-xs text-[#d4e1d5]"><Clock size={14} /> Pembaruan data</div>
              <p className="mt-2 text-lg font-semibold tabular-nums">{latest ? clock(new Date(latest.created_at)) : "--:--:--"}</p>
              <p className="mt-1 text-[10px] text-[#b8cbbb]">Waktu pembacaan terakhir</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4">
              <div className="flex items-center gap-2 text-xs text-[#d4e1d5]"><Timer size={14} /> Latency</div>
              <p className="mt-2 text-lg font-semibold tabular-nums">{isDemoGreenhouse ? "Simulasi" : latest?.latency_ms != null ? `${latest.latency_ms} ms` : "—"}</p>
              <p className="mt-1 text-[10px] text-[#b8cbbb]">{avgLatency != null ? `Rata-rata ${avgLatency} ms · 30 menit` : "Belum ada pengukuran"}</p>
            </div>
          </div>
        </section>

        {loadError && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><WifiOff size={16} /> Data belum berhasil diperbarui. Sistem akan mencoba kembali secara otomatis.</div>}
        {feedback && <div role="status" className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}><span className="font-semibold">{feedback.type === "success" ? "Berhasil:" : "Perhatian:"}</span>{feedback.message}</div>}

        {device && <>
          <section aria-label="Monitoring sensor" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SensorCard className="rise-in stagger-1" icon={<Thermometer size={19} />} color={COLORS.temp} tint="bg-orange-50 text-orange-700" source="DHT11 · SUHU" title="Suhu udara" value={round1(latest?.temperature)} unit="°C" percent={latest?.temperature == null ? null : latest.temperature / 50 * 100} status={classifyTemperature(latest?.temperature, device.temp_max)} hint={`Batas suhu ${device.temp_max}°C`} />
            <SensorCard className="rise-in stagger-2" icon={<Sprout size={19} />} color={COLORS.soil} tint="bg-emerald-50 text-emerald-700" source="SOIL MOISTURE" title="Kelembapan tanah" value={hasSoilAndActuators ? round1(latest?.soil_moisture) : null} unit="%" percent={hasSoilAndActuators ? latest?.soil_moisture ?? null : null} status={hasSoilAndActuators ? classifySoil(latest?.soil_moisture, device.soil_min) : { text: "Tidak tersedia", level: "info" }} hint={hasSoilAndActuators ? `Pompa aktif di bawah ${device.soil_min}%` : "Sensor tidak tersedia pada GH-02"} />
            <SensorCard className="rise-in stagger-3 sm:col-span-2 xl:col-span-1" icon={<Sun size={19} />} color={COLORS.light} tint="bg-sky-50 text-sky-700" source="LDR · CAHAYA" title="Intensitas cahaya" value={round1(latest?.light)} unit="%" percent={latest?.light ?? null} status={classifyLight(latest?.light, device.light_min)} hint={`Batas cahaya ${device.light_min}%`} />
          </section>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-6">
              <section className="min-w-0 w-full rounded-[24px] border border-[#e4e9e1] bg-white p-4 shadow-[0_8px_30px_-24px_rgba(25,50,32,.25)] sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907e]">Sensor analytics</p><h2 className="mt-1 text-lg font-bold">Tren kondisi lingkungan</h2><p className="mt-1 text-xs text-[#849187]">{range === "30m" ? "Pembacaan sensor 30 menit terakhir" : "Agregasi rata-rata per jam"}</p></div>
                  <select aria-label="Rentang waktu grafik" value={range} onChange={(e) => setRange(e.target.value as Range)} className="min-h-10 rounded-xl border border-[#e4e9e1] bg-[#fbfcfa] px-3 text-sm font-medium text-[#526457] outline-none focus:border-[#397653] focus:ring-2 focus:ring-[#397653]/15">
                    <option value="30m">30 menit</option><option value="24h">24 jam</option><option value="7d">7 hari</option>
                  </select>
                </div>
                <div className="mt-5 rounded-2xl border border-[#edf0eb] bg-[#fcfdfb] p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-[#526457]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.temp }} />
                      Suhu udara (°C)
                    </span>
                    {hasSoilAndActuators && <span className="inline-flex items-center gap-2 text-xs font-medium text-[#526457]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.soil }} />
                      Kelembapan tanah (%)
                    </span>}
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-[#526457]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.light }} />
                      Intensitas cahaya (%)
                    </span>
                  </div>
                  <div className="h-[280px] w-full min-w-0 sm:h-[340px]">
                    {chart.some((item) => item.temperature != null || item.soil_moisture != null || item.light != null) ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={chart} margin={{ top: 8, right: 10, left: 12, bottom: 4 }}>
                          <CartesianGrid stroke="#e9eee7" strokeDasharray="3 5" vertical={false} />
                          <XAxis dataKey="t" tickFormatter={tickLabel} minTickGap={28}
                            tick={{ fontSize: 10, fill: "#8b988d" }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="temperature" orientation="left" domain={[0, 50]}
                            tick={{ fontSize: 10, fill: COLORS.temp }} axisLine={false} tickLine={false} width={42} />
                          <YAxis yAxisId="percentage" orientation="right" domain={[0, 100]}
                            tick={{ fontSize: 10, fill: COLORS.soil }} axisLine={false} tickLine={false} width={36} />
                          <Tooltip
                            labelFormatter={(value) => new Date(String(value)).toLocaleString("id-ID")}
                            formatter={(value, name) => [
                              value == null ? "Tidak tersedia" : `${value} ${name === "Suhu udara" ? "°C" : "%"}`,
                              name,
                            ]}
                            contentStyle={{ borderRadius: 12, border: "1px solid #e4e9e1", fontSize: 11,
                              boxShadow: "0 8px 24px rgba(25,50,32,.08)" }}
                          />
                          <Line yAxisId="temperature" type="monotone" dataKey="temperature"
                            name="Suhu udara" stroke={COLORS.temp} strokeWidth={2.5} dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false}
                            isAnimationActive animationDuration={650} />
                          {hasSoilAndActuators && <Line yAxisId="percentage" type="monotone"
                            dataKey="soil_moisture" name="Kelembapan tanah" stroke={COLORS.soil}
                            strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
                            connectNulls={false} isAnimationActive animationDuration={750} />}
                          <Line yAxisId="percentage" type="monotone" dataKey="light"
                            name="Intensitas cahaya" stroke={COLORS.light} strokeWidth={2.5}
                            dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false}
                            isAnimationActive animationDuration={850} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl bg-[#f6f8f4] text-xs text-[#9aa59b]">
                        Belum ada data sensor
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[#9aa59b]">
                    Sumbu kiri menunjukkan suhu (°C), sedangkan sumbu kanan menunjukkan persentase kelembapan tanah dan cahaya (%).
                  </p>
                </div>
              </section>

              <section className="rounded-[24px] border border-[#e4e9e1] bg-white p-4 shadow-[0_8px_30px_-24px_rgba(25,50,32,.25)] sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907e]">Riwayat perangkat</p><h2 className="mt-1 text-lg font-bold">Log aktuator</h2><p className="mt-1 text-xs text-[#849187]">Perubahan status yang tercatat dari backend</p></div><span className="rounded-full bg-[#f1f5ef] px-3 py-1 text-[11px] font-semibold text-[#526457]">{events.length} catatan</span></div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-[#edf0eb]">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-[#f7f9f5] text-[11px] font-semibold uppercase tracking-wide text-[#849187]"><tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Aktuator</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Sumber</th></tr></thead>
                    <tbody>{events.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-[#849187]">Belum ada perubahan status.</td></tr> : events.map((event, index) => <tr key={`${event.created_at}-${event.actuator}-${index}`} className="border-t border-[#edf0eb] transition hover:bg-[#fbfcfa]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#718174]">{new Date(event.created_at).toLocaleString("id-ID")}</td><td className="px-4 py-3 font-medium">{ACTUATOR_LABEL[event.actuator] ?? event.actuator}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${event.state ? "bg-emerald-50 text-emerald-700" : "bg-[#f0f2ee] text-[#68756a]"}`}>{event.state ? "Aktif" : "Mati"}</span></td>
                      <td className="px-4 py-3"><span className="rounded-full bg-[#f1f5ef] px-2.5 py-1 text-[11px] font-medium text-[#526457]">{event.source === "auto" ? "Otomatis" : "Manual"}</span></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-[#9aa59b]">Pada layar kecil, geser tabel ke samping untuk melihat seluruh kolom.</p>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-[24px] border border-[#e4e9e1] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(25,50,32,.25)]">
                <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907e]">Pengendalian</p><h2 className="mt-1 text-lg font-bold">Mode kontrol</h2><p className="mt-1 text-xs text-[#849187]">Pilih cara kerja perangkat</p></div><div className="rounded-xl bg-[#edf4ec] p-2 text-[#397653]"><Activity size={19} /></div></div>
                <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#f0f4ee] p-1">
                  {(["auto", "manual"] as const).map((mode) => <button key={mode} type="button" disabled={pending} onClick={() => control({ mode })} aria-pressed={device.mode === mode}
                    className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition-all duration-200 disabled:opacity-60 ${device.mode === mode ? "bg-[#204d35] text-white shadow-sm" : "text-[#66766a] hover:bg-white"}`}>
                    {mode === "auto" ? <><Bot size={15} className="mr-1 inline" />Otomatis</> : <><Hand size={15} className="mr-1 inline" />Manual</>}
                  </button>)}
                </div>
                <div className="mt-4 rounded-xl bg-[#f7f9f5] p-3"><p className="text-sm font-semibold">{device.mode === "manual" ? "Kontrol manual aktif" : "Kontrol otomatis aktif"}</p><p className="mt-1 text-xs leading-relaxed text-[#849187]">{device.mode === "manual" ? hasSoilAndActuators ? "Atur aktuator satu per satu menggunakan switch di bawah." : "Mode manual aktif. Kontrol aktuator GH-02 bersifat simulasi." : "Perangkat mengikuti aturan otomatisasi dan threshold yang tersimpan."}</p></div>
                <div className="mt-3 divide-y divide-[#edf0eb]">
                  <ActuatorRow icon={<Sprout size={18} />} name="Water pump" desc="Sistem penyiraman" actual={isDemoGreenhouse ? demoActuators.pump : latest?.pump} commanded={isDemoGreenhouse ? demoActuators.pump : device.pump_cmd} manual={device.mode === "manual"} simulated={isDemoGreenhouse} disabled={pending} onToggle={() => isDemoGreenhouse ? toggleDemoActuator("pump") : control({ pump: !device.pump_cmd })} />
                  <ActuatorRow icon={<Lightbulb size={18} />} name="Grow light" desc="Penerangan tanaman" actual={isDemoGreenhouse ? demoActuators.grow_light : latest?.grow_light} commanded={isDemoGreenhouse ? demoActuators.grow_light : device.light_cmd} manual={device.mode === "manual"} simulated={isDemoGreenhouse} disabled={pending} onToggle={() => isDemoGreenhouse ? toggleDemoActuator("grow_light") : control({ grow_light: !device.light_cmd })} />
                  <ActuatorRow icon={<Fan size={18} />} name="Mini fan" desc="Sirkulasi udara" actual={isDemoGreenhouse ? demoActuators.fan : latest?.fan} commanded={isDemoGreenhouse ? demoActuators.fan : device.fan_cmd} manual={device.mode === "manual"} simulated={isDemoGreenhouse} disabled={pending} onToggle={() => isDemoGreenhouse ? toggleDemoActuator("fan") : control({ fan: !device.fan_cmd })} />
                </div>
                {pending && <p className="mt-3 flex items-center gap-2 text-xs text-[#718174]"><LoaderCircle size={14} className="animate-spin" />Mengirim perintah...</p>}
                <p className="mt-3 text-[10px] leading-relaxed text-[#9aa59b]">Status aktual berasal dari telemetry perangkat; status perintah berasal dari konfigurasi command.</p>
              </section>

              <form onSubmit={saveThresholds} className="rounded-[24px] border border-[#e4e9e1] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(25,50,32,.25)]">
                <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907e]">Konfigurasi</p><h2 className="mt-1 text-lg font-bold">Threshold sensor</h2><p className="mt-1 text-xs text-[#849187]">Kosongkan nilai yang tidak ingin diubah.</p></div>
                <div className="mt-4 space-y-4">
                  <ThresholdInput label="Batas suhu maksimum" unit="°C" current={device.temp_max} value={tempMax} onChange={setTempMax} />
                  <ThresholdInput label="Batas kelembapan tanah" unit="%" current={device.soil_min} value={soilMin} onChange={setSoilMin} disabled={!hasSoilAndActuators} />
                  <ThresholdInput label="Batas intensitas cahaya" unit="%" current={device.light_min} value={lightMin} onChange={setLightMin} />
                </div>
                {!hasSoilAndActuators && <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-700">Threshold tanah tidak dapat diubah karena sensor tersebut tidak tersedia pada GH-02.</p>}
                <button type="submit" disabled={thresholdPending || pending} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#204d35] px-4 text-sm font-semibold text-white transition hover:bg-[#173c29] disabled:cursor-not-allowed disabled:opacity-60">
                  {thresholdPending ? <><LoaderCircle size={16} className="animate-spin" />Menyimpan...</> : <><Check size={16} />Simpan perubahan</>}
                </button>
              </form>
            </aside>
          </div>
        </>}
        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[#e4e9e1] pt-5 text-[11px] text-[#9aa59b] sm:flex-row">
          <span>Smart Greenhouse · Environmental Monitoring</span>
          <span>{updatedAt ? `Halaman diperbarui ${clock(updatedAt)}` : "Menunggu data perangkat..."}</span>
        </footer>
      </main>
    </div>
  );
}

function SensorCard(props: {
  icon: React.ReactNode; color: string; tint: string; source: string; title: string;
  value: number | null; unit: string; percent: number | null; status: SensorStatus | null;
  hint: string; className?: string;
}) {
  const pct = props.percent == null ? 0 : Math.max(0, Math.min(100, props.percent));
  return <article className={`rounded-[22px] border border-[#e4e9e1] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(25,50,32,.25)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_-25px_rgba(25,50,32,.35)] ${props.className ?? ""}`}>
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${props.tint}`}>{props.icon}</span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#849187]">{props.source}</p><h3 className="mt-0.5 text-sm font-semibold text-[#405346]">{props.title}</h3></div></div>
      {props.status && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusClass[props.status.level]}`}>{props.status.text}</span>}
    </div>
    <div className="mt-5 flex items-end gap-1.5"><span className="text-4xl font-bold tracking-tight tabular-nums text-[#1c3025]">{props.value == null ? "—" : props.value}</span><span className="pb-1 text-sm font-medium text-[#849187]">{props.value == null ? "" : props.unit}</span></div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1eb]"><div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: props.color }} /></div>
    <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-[#849187]">{props.hint}</p>{props.value == null && <span className="text-[10px] text-[#9aa59b]">Tidak tersedia</span>}</div>
  </article>;
}


function ActuatorRow(props: {
  icon: React.ReactNode; name: string; desc: string; actual: boolean | undefined;
  commanded: boolean; manual: boolean; simulated: boolean; disabled: boolean;
  onToggle: () => void;
}) {
  const actualKnown = props.actual !== undefined;
  const actual = props.actual === true;
  const waiting = props.manual && actualKnown && props.commanded !== actual;
  return <div className="flex items-center justify-between gap-3 py-3.5">
    <div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${actual ? "bg-[#e7f2e8] text-[#397653]" : "bg-[#f1f4ef] text-[#879488]"}`}>{props.icon}</span>
      <div className="min-w-0"><p className="text-sm font-semibold">{props.name}</p><p className="text-[11px] text-[#849187]">{props.desc}{props.simulated ? " · Simulasi" : ""}</p>
        <p className="mt-1 text-[10px] text-[#849187]">Aktual: {actualKnown ? actual ? "Aktif" : "Mati" : "Menunggu data"} · Perintah: {props.commanded ? "Aktif" : "Mati"}</p>
        {waiting && <p className="mt-0.5 text-[10px] font-medium text-amber-700">Menunggu sinkronisasi</p>}
      </div>
    </div>
    <button type="button" role="switch" aria-checked={props.commanded} aria-label={`${props.name}, ${props.commanded ? "aktif" : "mati"}`} disabled={!props.manual || props.disabled}
      onClick={props.onToggle} title={props.manual ? "Ubah status aktuator" : "Aktifkan mode Manual untuk mengubah aktuator"}
      className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397653] disabled:cursor-not-allowed disabled:opacity-45 ${props.commanded ? "bg-[#397653]" : "bg-[#cbd4ca]"}`}>
      <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${props.commanded ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  </div>;
}

function ThresholdInput(props: {
  label: string; unit: string; current: number; value: string;
  onChange: (value: string) => void; disabled?: boolean;
}) {
  return <label className={`block ${props.disabled ? "opacity-50" : ""}`}>
    <span className="flex items-center justify-between gap-2 text-xs font-semibold text-[#526457]"><span>{props.label}</span><span className="font-normal text-[#9aa59b]">Saat ini: {props.current} {props.unit}</span></span>
    <span className="mt-2 flex items-center rounded-xl border border-[#e4e9e1] bg-[#fbfcfa] pr-3 transition focus-within:border-[#397653] focus-within:ring-2 focus-within:ring-[#397653]/10">
      <input type="number" min="0" step="any" disabled={props.disabled} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={String(props.current)}
        className="min-h-11 w-full min-w-0 bg-transparent px-3 text-sm font-semibold text-[#1c3025] outline-none placeholder:text-[#b1bbb2] disabled:cursor-not-allowed" />
      <span className="text-xs font-medium text-[#849187]">{props.unit}</span>
    </span>
  </label>;
}
