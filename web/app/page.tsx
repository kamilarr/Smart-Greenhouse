"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  Activity,
  Bot,
  ChartColumn,
  Clock,
  Fan,
  Hand,
  Lightbulb,
  Sprout,
  Sun,
  Thermometer,
  Wifi,
  WifiOff,
  Bell,
  X,
} from "lucide-react";

type Reading = {
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  light: number | null;
  pump: boolean;
  fan: boolean;
  grow_light: boolean;
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
type ActuatorEvent = { actuator: string; state: boolean; source: string; created_at: string };
type ChartPoint = { t: string; temperature: number | null; soil_moisture: number | null; light: number | null };
type Range = "30m" | "24h" | "7d";
type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  level: "warning" | "danger";
};

const POLL_MS = 2000;

// Warna garis grafik & aksen kartu
const COLORS = { temp: "#e0592a", soil: "#2f7d4f", light: "#3b82c4" };

const ACTUATOR_LABEL: Record<string, string> = { pump: "Water pump", fan: "Mini fan", grow_light: "Grow light" };

const clock = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const round1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState("");
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [range, setRange] = useState<Range>("30m");
  const [events, setEvents] = useState<ActuatorEvent[]>([]);
  const [demoActuators, setDemoActuators] = useState({ pump: false, fan: false, grow_light: false });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [soilMin, setSoilMin] = useState("");
  const [tempMax, setTempMax] = useState("");
  const [lightMin, setLightMin] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  // Mencegah notifikasi yang sama muncul berulang kali
  const activeAlerts = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const list: Device[] = await fetch("/api/devices").then((r) => r.json());
      if (!Array.isArray(list)) return;
      const id = selected || list.find((item) => item.id === "gh-01")?.id || list[0]?.id;
      if (!id) return;
      if (!selected) setSelected(id);

      // Greenhouse 2 menggunakan data simulasi lokal; tidak memerlukan ESP32 aktif.
      if (id === "gh-02") {
        const now = Date.now();
        const demoReading: Reading = {
          temperature: 26.4,
          humidity: 68,
          soil_moisture: null,
          light: 72,
          pump: demoActuators.pump,
          fan: demoActuators.fan,
          grow_light: demoActuators.grow_light,
          created_at: new Date(now).toISOString(),
        };
        const demoDevice = list.find((item) => item.id === "gh-02");
        if (demoDevice) {
          setDevices(list.map((item) => item.id === "gh-02"
            ? { ...item, online: true, latest: demoReading }
            : item));
        } else {
          setDevices(list);
        }
        setEvents([]);
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
        return;
      }

      setDevices(list);
      // Greenhouse 1 mengambil data asli dari API/Supabase.
      const readings = await fetch(`/api/readings?device_id=${id}&hours=0.5`).then((r) => r.json());
      setEvents(readings.events ?? []);
      if (range === "30m") {
        setChart(
          (readings.readings ?? []).map((r: Reading) => ({
            t: r.created_at,
            temperature: r.temperature,
            soil_moisture: r.soil_moisture,
            light: r.light,
          }))
        );
      } else {
        const days = range === "24h" ? 1 : 7;
        const res = await fetch(`/api/analytics?device_id=${id}&days=${days}`).then((r) => r.json());
        setChart(
          (res.hourly ?? []).map((h: { hour: string; avg_temp: number; avg_soil: number; avg_light: number }) => ({
            t: h.hour,
            temperature: Number(h.avg_temp),
            soil_moisture: h.avg_soil == null ? null : Number(h.avg_soil),
            light: Number(h.avg_light),
          }))
        );
      }
      setUpdatedAt(new Date());
    } catch {
      // server sedang restart / jaringan putus: coba lagi di polling berikutnya
    }
  }, [selected, range, demoActuators]);

  // Ambil data sekarang, lalu ulangi tiap 2 detik
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const device = devices.find((d) => d.id === selected);
  const latest = device?.latest;
  // GH-01 memiliki soil moisture dan aktuator; GH-02 hanya DHT11 dan LDR.
  const hasSoilAndActuators = selected === "gh-01";
  const isDemoGreenhouse = selected === "gh-02";

  function toggleDemoActuator(key: "pump" | "fan" | "grow_light") {
    setDemoActuators((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  // Memeriksa izin notifikasi browser
useEffect(() => {
  if ("Notification" in window) {
    setPermission(Notification.permission);
  }
}, []);

// Memeriksa kondisi greenhouse dan membuat peringatan
useEffect(() => {
  if (!device) return;

  const alerts: {
    key: string;
    title: string;
    message: string;
    level: "warning" | "danger";
  }[] = [];

  // Perangkat offline
  if (!device.online && device.id !== "gh-02") {
    alerts.push({
      key: `${device.id}-offline`,
      title: "Perangkat offline",
      message: `${device.name} tidak mengirimkan data. Periksa koneksi ESP32.`,
      level: "danger",
    });
  }

  // Suhu terlalu tinggi
  if (
    latest?.temperature != null &&
    latest.temperature >= device.temp_max
  ) {
    alerts.push({
      key: `${device.id}-temperature`,
      title: "Suhu terlalu tinggi",
      message: `${device.name}: suhu mencapai ${latest.temperature}°C.`,
      level: "warning",
    });
  }

  // Kelembapan tanah terlalu rendah
  if (
    selected === "gh-01" &&
    latest?.soil_moisture != null &&
    latest.soil_moisture < device.soil_min
  ) {
    alerts.push({
      key: `${device.id}-soil`,
      title: "Tanah terlalu kering",
      message: `${device.name}: kelembapan tanah ${latest.soil_moisture}%, di bawah threshold ${device.soil_min}%.`,
      level: "warning",
    });
  }

  // Intensitas cahaya terlalu rendah
  if (
    latest?.light != null &&
    latest.light < device.light_min
  ) {
    alerts.push({
      key: `${device.id}-light`,
      title: "Cahaya kurang",
      message: `${device.name}: intensitas cahaya ${latest.light}%, di bawah threshold ${device.light_min}%.`,
      level: "warning",
    });
  }

  const currentKeys = new Set(alerts.map((alert) => alert.key));

  // Hanya membuat notifikasi saat kondisi baru mulai terjadi
  alerts.forEach((alert) => {
    if (activeAlerts.current.has(alert.key)) return;

    const notification: AppNotification = {
      id: `${alert.key}-${Date.now()}`,
      title: alert.title,
      message: alert.message,
      createdAt: new Date().toISOString(),
      level: alert.level,
    };

    setNotifications((previous) =>
      [notification, ...previous].slice(0, 30)
    );

    // Notifikasi sistem laptop/HP jika izin sudah diberikan
    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(`Smart Greenhouse - ${alert.title}`, {
        body: alert.message,
        tag: alert.key,
      });
    }
  });

  activeAlerts.current = currentKeys;
}, [device, latest]);

// Meminta izin notifikasi browser
async function enableBrowserNotifications() {
  if (!("Notification" in window)) {
    alert("Browser ini belum mendukung notifikasi.");
    return;
  }

  const result = await Notification.requestPermission();
  setPermission(result);
}

  async function control(body: Record<string, unknown>) {
    const response = await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: selected, ...body }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.error ?? "Pengaturan greenhouse gagal disimpan.");
      return;
    }

    await load();
  }

  const tickLabel = (iso: string) =>
    range === "7d"
      ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
      : new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-[#f6f6f2] text-[#1d2b22]">
      {/* ===== Header ===== */}
      <header className="border-b border-[#e6e6df] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1f5135] text-white">
              <Sprout size={18} />
            </div>
            <div>
              <select
                className="-ml-1 bg-transparent text-sm font-semibold outline-none"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {devices.filter((d) => d.id === "gh-01" || d.id === "gh-02").map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#7a857d]">{device?.location ?? "-"}</p>
            </div>
          </div>
          
            <div className="flex items-center gap-2">
              {/* Tombol notifikasi */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationOpen((open) => !open)}
                  className="relative flex items-center gap-1.5 rounded-full border border-[#e2e2da] px-3 py-1.5 text-xs text-[#4b5a50] hover:bg-[#f3f3ee]"
                >
                  <Bell size={14} />
                  Notifikasi

                  {notifications.length > 0 && (
                    <span className="rounded-full bg-[#e0592a] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {/* Panel notifikasi */}
                {notificationOpen && (
                  <div className="absolute right-0 top-10 z-50 w-[min(90vw,360px)] rounded-xl border border-[#e6e6df] bg-white p-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[#1d2b22]">
                        Notifikasi
                      </h3>

                      <button
                        type="button"
                        onClick={() => setNotificationOpen(false)}
                        className="rounded p-1 text-[#7a857d] hover:bg-[#f3f3ee]"
                        aria-label="Tutup notifikasi"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    {/* Izin notifikasi browser */}
                    <button
                      type="button"
                      onClick={enableBrowserNotifications}
                      disabled={permission === "granted"}
                      className="mt-3 w-full rounded-lg bg-[#1f5135] px-3 py-2 text-xs font-medium text-white hover:bg-[#184129] disabled:bg-[#e3f1e6] disabled:text-[#1f5135]"
                    >
                      {permission === "granted"
                        ? "Notifikasi browser aktif"
                        : permission === "denied"
                          ? "Izin ditolak - periksa pengaturan browser"
                          : "Aktifkan notifikasi laptop / HP"}
                    </button>

                    <p className="mt-2 text-[11px] text-[#7a857d]">
                      Izinkan notifikasi browser agar peringatan dapat muncul
                      di luar halaman website saat browser masih berjalan.
                    </p>

                    {/* Daftar peringatan */}
                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="py-6 text-center text-xs text-[#7a857d]">
                          Belum ada peringatan.
                        </p>
                      ) : (
                        notifications.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-3 ${
                              item.level === "danger"
                                ? "border-red-200 bg-red-50"
                                : "border-amber-200 bg-amber-50"
                            }`}
                          >
                            <p className="text-sm font-semibold text-[#1d2b22]">
                              {item.title}
                            </p>

                            <p className="mt-1 text-xs text-[#4b5a50]">
                              {item.message}
                            </p>

                            <p className="mt-2 text-[10px] text-[#7a857d]">
                              {new Date(item.createdAt).toLocaleString("id-ID")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNotifications([])}
                        className="mt-3 text-xs font-medium text-[#1f5135] hover:underline"
                      >
                        Hapus semua notifikasi
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Link Analytics */}
              <Link
                href="/analytics"
               className="flex items-center gap-1.5 rounded-full border border-[#e2e2da] px-3 py-1 text-xs text-[#4b5a50] hover:bg-[#f3f3ee]"
              >
                <ChartColumn size={14} />
                Analytics
              </Link>

              {/* Status perangkat */}
              {device && ( 
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    device.online
                      ? "bg-[#e3f1e6] text-[#1f5135]"
                      : "bg-[#fbe6e2] text-[#a23b2a]"
                  }`}
                >
                  {device.online ? <Wifi size={14} /> : <WifiOff size={14} />}
                  {isDemoGreenhouse ? "Simulasi" : device.online ? "Terhubung" : "Terputus"}
                </span>
              )}
            </div>

        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ===== Judul ===== */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                device?.online ? "text-[#1f5135]" : "text-[#a23b2a]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${device?.online ? "bg-[#1f5135]" : "bg-[#a23b2a]"}`} />
              {isDemoGreenhouse ? "MODE SIMULASI" : device?.online ? "SISTEM AKTIF" : "NODE OFFLINE"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ringkasan greenhouse</h1>
            <p className="text-sm text-[#7a857d]">Pantau kondisi tanaman dan perangkat Anda.</p>
          </div>
            <div className="flex items-center gap-2 text-xs text-[#7a857d]">
              <Clock size={14} />
              Diperbarui {latest ? clock(new Date(latest.created_at)) : "-"}
            </div>  
        </div>

        {/* ===== Kartu sensor ===== */}
        {device && (
          <section className="mt-6 grid gap-6 border-t border-[#e6e6df] pt-5 md:grid-cols-3">
            <SensorCard
              icon={<Thermometer size={16} />}
              tint="#fbe9e2"
              color={COLORS.temp}
              source="DHT11 · Suhu"
              value={round1(latest?.temperature)}
              unit="°C"
              percent={latest?.temperature != null ? (latest.temperature / 50) * 100 : 0}
              title="Suhu udara"
              hint={hasSoilAndActuators ? `Fan menyala mulai ${device.temp_max}°C` : "Pembacaan suhu dari sensor DHT11"}
              status={
                latest?.temperature == null
                  ? null
                  : hasSoilAndActuators && latest.temperature >= device.temp_max
                    ? { text: "Panas", warn: true }
                    : { text: "Normal", warn: false }
              }
            />
            <SensorCard
              icon={<Sprout size={16} />}
              tint="#e3f1e6"
              color={COLORS.soil}
              source="Soil Moisture"
              value={hasSoilAndActuators ? round1(latest?.soil_moisture) : 0}
              unit="%"
              percent={hasSoilAndActuators ? (latest?.soil_moisture ?? 0) : 0}
              title="Kelembapan tanah"
              hint={hasSoilAndActuators ? `Pompa menyala di bawah ${device.soil_min}%` : "Sensor tidak tersedia pada greenhouse ini"}
              status={
                !hasSoilAndActuators
                  ? { text: "Tidak tersedia", warn: false }
                  : latest?.soil_moisture == null
                    ? null
                    : latest.soil_moisture < device.soil_min
                      ? { text: "Kering", warn: true }
                      : { text: "Cukup lembap", warn: false }
              }
            />
            <SensorCard
              icon={<Sun size={16} />}
              tint="#e3eef9"
              color={COLORS.light}
              source="LDR · Cahaya"
              value={round1(latest?.light)}
              unit="%"
              percent={latest?.light ?? 0}
              title="Intensitas cahaya"
              hint={hasSoilAndActuators ? `Lampu menyala di bawah ${device.light_min}%` : "Pembacaan intensitas cahaya dari sensor LDR"}
              status={
                latest?.light == null
                  ? null
                  : hasSoilAndActuators && latest.light < device.light_min
                    ? { text: "Kurang cahaya", warn: true }
                    : { text: "Terbaca", warn: false }
              }
            />
          </section>
        )}

        {device && (
          <div className="mt-8 grid gap-8 border-t border-[#e6e6df] pt-6 lg:grid-cols-[1fr_340px]">
            {/* ===== Grafik ===== */}
            <section>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Kondisi lingkungan</h2>
                  <p className="text-xs text-[#7a857d]">
                    {range === "30m" ? "Pembacaan sensor 30 menit terakhir" : "Rata-rata per jam"}
                  </p>
                </div>
                <select
                  className="rounded-lg border border-[#e2e2da] bg-white px-3 py-1.5 text-sm outline-none"
                  value={range}
                  onChange={(e) => setRange(e.target.value as Range)}
                >
                  <option value="30m">30 menit</option>
                  <option value="24h">24 jam</option>
                  <option value="7d">7 hari</option>
                </select>
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e9e9e3" />
                    <XAxis
                      dataKey="t"
                      tickFormatter={tickLabel}
                      minTickGap={50}
                      tick={{ fontSize: 11, fill: "#7a857d" }}
                      axisLine={{ stroke: "#d9d9d1" }}
                      tickLine={false}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#7a857d" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      labelFormatter={(v) => new Date(String(v)).toLocaleString("id-ID")}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e2da", fontSize: 12 }}
                    />
                    <Line dataKey="temperature" name="Suhu (°C)" stroke={COLORS.temp} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line dataKey="soil_moisture" name="Kelembapan tanah (%)" stroke={COLORS.soil} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                    <Line dataKey="light" name="Cahaya (%)" stroke={COLORS.light} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 border-t border-[#e6e6df] pt-3 text-xs text-[#4b5a50]">
                <LegendDot color={COLORS.temp} label="Suhu (°C)" />
                <LegendDot color={COLORS.soil} label="Kelembapan tanah" />
                <LegendDot color={COLORS.light} label="Cahaya" />
              </div>

              {/* ===== Log aktuator ===== */}
              <h2 className="mt-8 text-lg font-semibold">Log aktuator</h2>
              <p className="text-xs text-[#7a857d]">20 perubahan status terakhir</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-[#e6e6df] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-[#fafaf7] text-left text-xs text-[#7a857d]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Waktu</th>
                      <th className="px-4 py-2 font-medium">Perangkat</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Sumber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-xs text-[#7a857d]">
                          Belum ada perubahan status
                        </td>
                      </tr>
                    )}
                    {events.map((e, i) => (
                      <tr key={i} className="border-t border-[#efefe9]">
                        <td className="px-4 py-2 text-[#4b5a50]">{new Date(e.created_at).toLocaleString("id-ID")}</td>
                        <td className="px-4 py-2">{ACTUATOR_LABEL[e.actuator] ?? e.actuator}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              e.state ? "bg-[#e3f1e6] text-[#1f5135]" : "bg-[#efefe9] text-[#6b746d]"
                            }`}
                          >
                            {e.state ? "Aktif" : "Mati"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[#4b5a50]">{e.source === "auto" ? "Otomatis" : "Manual"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ===== Panel kanan ===== */}
            <aside className="space-y-8">
              {/* Mode kontrol */}
              <section>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Mode kontrol</h2>
                    <p className="text-xs text-[#7a857d]">Pilih cara kerja perangkat</p>
                  </div>
                  <Activity size={16} className="text-[#7a857d]" />
                </div>
                <div className="mt-3 grid grid-cols-2 rounded-xl bg-[#e9efe8] p-1 text-sm">
                  {(["auto", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => control({ mode: m })}
                      className={`rounded-lg py-2 font-medium transition ${
                        device.mode === m ? "bg-[#1f5135] text-white shadow-sm" : "text-[#1d2b22] hover:bg-white/60"
                      }`}
                    >
                      {m === "auto" ? "Otomatis" : "Manual"}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-start gap-3 border-b border-[#e6e6df] pb-4">
                  <IconBox active>{device.mode === "manual" ? <Hand size={16} /> : <Bot size={16} />}</IconBox>
                  <div>
                    <p className="text-sm font-medium">
                      {device.mode === "manual" ? "Kontrol manual aktif" : "Kontrol otomatis aktif"}
                    </p>
                    <p className="text-xs text-[#7a857d]">
                      {device.mode === "manual"
                        ? hasSoilAndActuators
                          ? "Atur perangkat satu per satu sesuai kebutuhan."
                          : "Mode manual aktif. Tidak ada aktuator fisik pada greenhouse ini."
                        : hasSoilAndActuators
                          ? "Perangkat menyala sesuai threshold di bawah."
                          : "Mode otomatis aktif. Threshold tersimpan sebagai konfigurasi."}
                    </p>
                  </div>
                </div>

                <ActuatorRow
                  icon={<Sprout size={16} />}
                  name="Water pump"
                  desc="Siram tanaman"
                  actual={isDemoGreenhouse ? demoActuators.pump : latest?.pump}
                  commanded={isDemoGreenhouse ? demoActuators.pump : device.pump_cmd}
                  manual={device.mode === "manual"}
                  available={true}
                  simulated={isDemoGreenhouse}
                  onToggle={() => isDemoGreenhouse ? toggleDemoActuator("pump") : control({ pump: !device.pump_cmd })}
                />
                <ActuatorRow
                  icon={<Lightbulb size={16} />}
                  name="Grow light"
                  desc="Penerangan tanaman"
                  actual={isDemoGreenhouse ? demoActuators.grow_light : latest?.grow_light}
                  commanded={isDemoGreenhouse ? demoActuators.grow_light : device.light_cmd}
                  manual={device.mode === "manual"}
                  available={true}
                  simulated={isDemoGreenhouse}
                  onToggle={() => isDemoGreenhouse ? toggleDemoActuator("grow_light") : control({ grow_light: !device.light_cmd })}
                />
                <ActuatorRow
                  icon={<Fan size={16} />}
                  name="Mini fan"
                  desc="Sirkulasi udara"
                  actual={isDemoGreenhouse ? demoActuators.fan : latest?.fan}
                  commanded={isDemoGreenhouse ? demoActuators.fan : device.fan_cmd}
                  manual={device.mode === "manual"}
                  available={true}
                  simulated={isDemoGreenhouse}
                  onToggle={() => isDemoGreenhouse ? toggleDemoActuator("fan") : control({ fan: !device.fan_cmd })}
                />
              </section>

              {/* Threshold (mode auto) */}
              <form
                id="threshold"
                className="space-y-3 rounded-xl border border-[#e6e6df] bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  control({
                    ...(hasSoilAndActuators && soilMin && { soil_min: Number(soilMin) }),
                    ...(tempMax && { temp_max: Number(tempMax) }),
                    ...(lightMin && { light_min: Number(lightMin) }),
                  });
                  setSoilMin("");
                  setTempMax("");
                  setLightMin("");
                }}
              >
                <h2 className="font-semibold">Threshold (mode auto)</h2>
                <ThresholdInput disabled={!hasSoilAndActuators} label="Pompa ON jika tanah < (%)" placeholder={device.soil_min} value={soilMin} onChange={setSoilMin} />
                <ThresholdInput label={hasSoilAndActuators ? "Fan ON jika suhu ≥ (°C)" : "Batas peringatan suhu ≥ (°C)"} placeholder={device.temp_max} value={tempMax} onChange={setTempMax} />
                <ThresholdInput label={hasSoilAndActuators ? "Grow light ON jika cahaya < (%)" : "Batas peringatan cahaya < (%)"} placeholder={device.light_min} value={lightMin} onChange={setLightMin} />
                <button className="w-full rounded-lg bg-[#1f5135] py-2 text-sm font-medium text-white hover:bg-[#184129]">
                  Simpan
                </button>
              </form>
            </aside>
          </div>
        )}

        {updatedAt && <p className="mt-8 text-center text-[11px] text-[#a3aba5]">Halaman disegarkan {clock(updatedAt)}</p>}
      </main>
    </div>
  );
}

function SensorCard(props: {
  icon: React.ReactNode;
  tint: string;
  color: string;
  source: string;
  value: number | null;
  unit: string;
  percent: number;
  title: string;
  hint: string;
  status: { text: string; warn: boolean } | null;
}) {
  const pct = Math.max(0, Math.min(100, props.percent));
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-[#7a857d]">
        <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: props.tint, color: props.color }}>
          {props.icon}
        </span>
        {props.source}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {props.value ?? "-"}
        <span className="ml-1 text-sm font-normal text-[#7a857d]">{props.unit}</span>
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-[#e9e9e3]">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: props.color }} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{props.title}</p>
          <p className="text-xs text-[#7a857d]">{props.hint}</p>
        </div>
        {props.status && (
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${
              props.status.warn ? "bg-[#fdf1cf] text-[#8a6410]" : "bg-[#e3f1e6] text-[#1f5135]"
            }`}
          >
            {props.status.text}
          </span>
        )}
      </div>
    </div>
  );
}

function IconBox({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        active ? "bg-[#1f5135] text-white" : "bg-[#eef3ec] text-[#1f5135]"
      }`}
    >
      {children}
    </span>
  );
}

function ActuatorRow(props: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  actual: boolean | undefined;
  commanded: boolean;
  manual: boolean;
  available: boolean;
  simulated?: boolean;
  onToggle: () => void;
}) {
  const on = !!props.actual;
  // Di mode manual, perintah baru sampai ke ESP32 pada pengiriman data berikutnya (±2 detik)
  const waiting = props.manual && props.commanded !== on;
  return (
    <div className="flex items-center justify-between border-b border-[#e6e6df] py-3">
      <div className="flex items-center gap-3">
        <IconBox active={on}>{props.icon}</IconBox>
        <div>
          <p className="text-sm font-medium">{props.name}</p>
          <p className="text-xs text-[#7a857d]">{props.simulated ? `${props.desc} · Simulasi` : props.desc}</p>
        </div>
      </div>
      <button
        onClick={props.onToggle}
        disabled={!props.available || !props.manual}
        title={!props.available ? "Aktuator tidak tersedia pada greenhouse ini" : props.manual ? "" : "Pindah ke mode Manual untuk mengatur perangkat"}
        className={`min-w-[100px] rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
          on ? "border-[#1f5135] bg-[#e3f1e6] text-[#1f5135]" : "border-[#e2e2da] bg-white text-[#1d2b22]"
        } ${props.manual ? "hover:shadow-sm" : "opacity-70"}`}
      >
        {!props.available ? "Tidak tersedia" : waiting ? "…" : on ? "Aktif" : "Mati"}
      </button>
    </div>
  );
}

function ThresholdInput(props: { label: string; placeholder: number; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[13px]">
      {props.label}
      <input
        type="number"
        disabled={props.disabled}
        className="w-16 shrink-0 rounded-lg border border-[#e2e2da] px-2 py-1 text-right outline-none focus:border-[#1f5135] disabled:cursor-not-allowed disabled:bg-[#f0f0ec]"
        placeholder={String(props.placeholder)}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
