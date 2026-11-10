"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [soilMin, setSoilMin] = useState("");
  const [tempMax, setTempMax] = useState("");
  const [lightMin, setLightMin] = useState("");

  const load = useCallback(async () => {
    try {
      const list: Device[] = await fetch("/api/devices").then((r) => r.json());
      if (!Array.isArray(list)) return;
      setDevices(list);
      const id = selected || list[0]?.id;
      if (!id) return;
      if (!selected) setSelected(id);

      // 30 menit: data mentah. 24 jam / 7 hari: rata-rata per jam dari view hourly_stats
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
            soil_moisture: Number(h.avg_soil),
            light: Number(h.avg_light),
          }))
        );
      }
      setUpdatedAt(new Date());
    } catch {
      // server sedang restart / jaringan putus: coba lagi di polling berikutnya
    }
  }, [selected, range]);

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

  async function control(body: Record<string, unknown>) {
    await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: selected, ...body }),
    });
    load();
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
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#7a857d]">{device?.location ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 rounded-full border border-[#e2e2da] px-3 py-1 text-xs text-[#4b5a50] hover:bg-[#f3f3ee]"
            >
              <ChartColumn size={14} /> Analytics
            </Link>
            {device && (
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  device.online ? "bg-[#e3f1e6] text-[#1f5135]" : "bg-[#fbe6e2] text-[#a23b2a]"
                }`}
              >
                {device.online ? <Wifi size={14} /> : <WifiOff size={14} />}
                {device.online ? "Terhubung" : "Terputus"}
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
              {device?.online ? "Sistem aktif" : "Node offline"}
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
              hint={`Fan menyala mulai ${device.temp_max}°C`}
              status={
                latest?.temperature == null
                  ? null
                  : latest.temperature >= device.temp_max
                    ? { text: "Panas", warn: true }
                    : { text: "Normal", warn: false }
              }
            />
            <SensorCard
              icon={<Sprout size={16} />}
              tint="#e3f1e6"
              color={COLORS.soil}
              source="Soil Moisture"
              value={round1(latest?.soil_moisture)}
              unit="%"
              percent={latest?.soil_moisture ?? 0}
              title="Kelembapan tanah"
              hint={`Pompa menyala di bawah ${device.soil_min}%`}
              status={
                latest?.soil_moisture == null
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
              hint={`Lampu menyala di bawah ${device.light_min}%`}
              status={
                latest?.light == null
                  ? null
                  : latest.light < device.light_min
                    ? { text: "Kurang cahaya", warn: true }
                    : { text: "Cukup", warn: false }
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
                    <Line dataKey="soil_moisture" name="Kelembapan tanah (%)" stroke={COLORS.soil} strokeWidth={2} dot={false} isAnimationActive={false} />
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
                  <IconBox active={false}>{device.mode === "manual" ? <Hand size={16} /> : <Bot size={16} />}</IconBox>
                  <div>
                    <p className="text-sm font-medium">
                      {device.mode === "manual" ? "Kontrol manual aktif" : "Kontrol otomatis aktif"}
                    </p>
                    <p className="text-xs text-[#7a857d]">
                      {device.mode === "manual"
                        ? "Atur perangkat satu per satu sesuai kebutuhan."
                        : "Perangkat menyala sesuai threshold di bawah."}
                    </p>
                  </div>
                </div>

                <ActuatorRow
                  icon={<Sprout size={16} />}
                  name="Water pump"
                  desc="Siram tanaman"
                  actual={latest?.pump}
                  commanded={device.pump_cmd}
                  manual={device.mode === "manual"}
                  onToggle={() => control({ pump: !device.pump_cmd })}
                />
                <ActuatorRow
                  icon={<Lightbulb size={16} />}
                  name="Grow light"
                  desc="Penerangan tanaman"
                  actual={latest?.grow_light}
                  commanded={device.light_cmd}
                  manual={device.mode === "manual"}
                  onToggle={() => control({ grow_light: !device.light_cmd })}
                />
                <ActuatorRow
                  icon={<Fan size={16} />}
                  name="Mini fan"
                  desc="Sirkulasi udara"
                  actual={latest?.fan}
                  commanded={device.fan_cmd}
                  manual={device.mode === "manual"}
                  onToggle={() => control({ fan: !device.fan_cmd })}
                />
              </section>

              {/* Threshold (mode auto) */}
              <form
                id="threshold"
                className="space-y-3 rounded-xl border border-[#e6e6df] bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  control({
                    ...(soilMin && { soil_min: Number(soilMin) }),
                    ...(tempMax && { temp_max: Number(tempMax) }),
                    ...(lightMin && { light_min: Number(lightMin) }),
                  });
                  setSoilMin("");
                  setTempMax("");
                  setLightMin("");
                }}
              >
                <h2 className="font-semibold">Threshold (mode auto)</h2>
                <ThresholdInput label="Pompa ON jika tanah < (%)" placeholder={device.soil_min} value={soilMin} onChange={setSoilMin} />
                <ThresholdInput label="Fan ON jika suhu ≥ (°C)" placeholder={device.temp_max} value={tempMax} onChange={setTempMax} />
                <ThresholdInput label="Grow light ON jika cahaya < (%)" placeholder={device.light_min} value={lightMin} onChange={setLightMin} />
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
          <p className="text-xs text-[#7a857d]">{props.desc}</p>
        </div>
      </div>
      <button
        onClick={props.onToggle}
        disabled={!props.manual}
        title={props.manual ? "" : "Pindah ke mode Manual untuk mengatur perangkat"}
        className={`min-w-[72px] rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
          on ? "border-[#1f5135] bg-[#e3f1e6] text-[#1f5135]" : "border-[#e2e2da] bg-white text-[#1d2b22]"
        } ${props.manual ? "hover:shadow-sm" : "opacity-70"}`}
      >
        {waiting ? "…" : on ? "Aktif" : "Mati"}
      </button>
    </div>
  );
}

function ThresholdInput(props: { label: string; placeholder: number; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[13px]">
      {props.label}
      <input
        type="number"
        className="w-16 shrink-0 rounded-lg border border-[#e2e2da] px-2 py-1 text-right outline-none focus:border-[#1f5135]"
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
