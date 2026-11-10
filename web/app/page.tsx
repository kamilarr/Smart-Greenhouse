"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";

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

const POLL_MS = 2000;
const time = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [events, setEvents] = useState<ActuatorEvent[]>([]);
  const [soilMin, setSoilMin] = useState("");
  const [tempMax, setTempMax] = useState("");
  const [lightMin, setLightMin] = useState("");

  const load = useCallback(async () => {
    const list: Device[] = await fetch("/api/devices").then((r) => r.json());
    if (!Array.isArray(list)) return;
    setDevices(list);
    const id = selected || list[0]?.id;
    if (!id) return;
    if (!selected) setSelected(id);
    const res = await fetch(`/api/readings?device_id=${id}&hours=0.5`).then((r) => r.json());
    setReadings(res.readings ?? []);
    setEvents(res.events ?? []);
  }, [selected]);

  // Ambil data sekarang, lalu ulangi tiap 5 detik
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const device = devices.find((d) => d.id === selected);

  async function control(body: Record<string, unknown>) {
    await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: selected, ...body }),
    });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Smart Greenhouse Monitoring</h1>
        <div className="flex items-center gap-3">
          <select
            className="rounded border px-3 py-2 bg-transparent"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.id})
              </option>
            ))}
          </select>
          <Link href="/analytics" className="rounded border px-3 py-2">
            Analytics
          </Link>
        </div>
      </header>

      {/* Ringkasan semua node */}
      <section className="flex flex-wrap gap-2 text-sm">
        {devices.map((d) => (
          <span key={d.id} className="rounded-full border px-3 py-1">
            <span className={d.online ? "text-green-600" : "text-red-600"}>●</span> {d.id}{" "}
            {d.online ? "online" : "offline"}
          </span>
        ))}
      </section>

      {device && (
        <>
          {/* Kartu sensor */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Suhu" value={device.latest?.temperature} unit="°C" />
            <Card label="Kelembapan udara" value={device.latest?.humidity} unit="%" />
            <Card label="Kelembapan tanah" value={device.latest?.soil_moisture} unit="%" />
            <Card label="Cahaya" value={device.latest?.light} unit="%" />
          </section>
          <p className="text-sm text-gray-500">
            Update terakhir: {device.latest ? new Date(device.latest.created_at).toLocaleString("id-ID") : "-"}
          </p>

          {/* Kontrol */}
          <section className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold">Mode</h2>
              <div className="flex gap-2">
                {(["auto", "manual"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => control({ mode: m })}
                    className={`rounded px-4 py-2 border ${device.mode === m ? "bg-green-600 text-white" : ""}`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">Mode auto: ESP32 mengatur aktuator berdasarkan threshold.</p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold">Aktuator</h2>
              <Toggle
                label="Water pump"
                actual={device.latest?.pump}
                disabled={device.mode !== "manual"}
                onClick={() => control({ pump: !device.pump_cmd })}
                commanded={device.pump_cmd}
              />
              <Toggle
                label="Fan"
                actual={device.latest?.fan}
                disabled={device.mode !== "manual"}
                onClick={() => control({ fan: !device.fan_cmd })}
                commanded={device.fan_cmd}
              />
              <Toggle
                label="Grow light"
                actual={device.latest?.grow_light}
                disabled={device.mode !== "manual"}
                onClick={() => control({ grow_light: !device.light_cmd })}
                commanded={device.light_cmd}
              />
            </div>

            <form
              className="rounded-lg border p-4 space-y-2"
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
              <label className="flex justify-between items-center gap-2 text-sm">
                Pompa ON jika tanah &lt; (%)
                <input
                  type="number"
                  className="w-20 rounded border px-2 py-1 bg-transparent"
                  placeholder={String(device.soil_min)}
                  value={soilMin}
                  onChange={(e) => setSoilMin(e.target.value)}
                />
              </label>
              <label className="flex justify-between items-center gap-2 text-sm">
                Fan ON jika suhu &gt; (°C)
                <input
                  type="number"
                  className="w-20 rounded border px-2 py-1 bg-transparent"
                  placeholder={String(device.temp_max)}
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                />
              </label>
              <label className="flex justify-between items-center gap-2 text-sm">
                Grow light ON jika cahaya &lt; (%)
                <input
                  type="number"
                  className="w-20 rounded border px-2 py-1 bg-transparent"
                  placeholder={String(device.light_min)}
                  value={lightMin}
                  onChange={(e) => setLightMin(e.target.value)}
                />
              </label>
              <button className="rounded border px-3 py-1 text-sm">Simpan</button>
            </form>
          </section>

          {/* Grafik realtime 1 jam terakhir */}
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold mb-3">30 Menit terakhir</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={readings}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="created_at" tickFormatter={time} minTickGap={40} />
                  <YAxis />
                  <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleString("id-ID")} />
                  <Legend />
                  <Line dataKey="temperature" name="Suhu (°C)" stroke="#dc2626" dot={false} />
                  <Line dataKey="humidity" name="Kelembapan (%)" stroke="#2563eb" dot={false} />
                  <Line dataKey="soil_moisture" name="Tanah (%)" stroke="#16a34a" dot={false} />
                  <Line dataKey="light" name="Cahaya (%)" stroke="#ca8a04" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Log aktuator */}
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold mb-3">Log aktuator</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th>Waktu</th>
                  <th>Aktuator</th>
                  <th>State</th>
                  <th>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1">{new Date(e.created_at).toLocaleString("id-ID")}</td>
                    <td>{e.actuator}</td>
                    <td>{e.state ? "ON" : "OFF"}</td>
                    <td>{e.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

function Card({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-semibold">
        {value != null ? Math.round(value * 10) / 10 : "-"}
        <span className="text-base font-normal"> {unit}</span>
      </p>
    </div>
  );
}

function Toggle(props: {
  label: string;
  actual: boolean | undefined;
  commanded: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>
        {props.label}: <b>{props.actual ? "ON" : "OFF"}</b>
      </span>
      <button
        onClick={props.onClick}
        disabled={props.disabled}
        className="rounded border px-3 py-1 text-sm disabled:opacity-40"
      >
        {props.commanded ? "Matikan" : "Nyalakan"}
      </button>
    </div>
  );
}