"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";

type Hourly = {
  hour: string;
  avg_temp: number;
  avg_humidity: number;
  avg_soil: number;
  avg_light: number;
  pump_on_pct: number;
  fan_on_pct: number;
  grow_light_on_pct: number;
};
type Summary = Record<string, number | null>;

const hourLabel = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit" });

export default function Analytics() {
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [days, setDays] = useState(7);
  const [hourly, setHourly] = useState<Hourly[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/devices")
      .then((r) => r.json())
      .then((list) => {
        if (!Array.isArray(list)) return;
        setDevices(list);
        if (list[0]) setDeviceId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    fetch(`/api/analytics?device_id=${deviceId}&days=${days}`)
      .then((r) => r.json())
      .then((res) => {
        setHourly(res.hourly ?? []);
        setSummary(res.summary ?? null);
      });
  }, [deviceId, days]);

  return (
    <main className="mx-auto w-full max-w-6xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex items-center gap-3">
          <select className="rounded border px-3 py-2 bg-transparent" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.id})
              </option>
            ))}
          </select>
          <select className="rounded border px-3 py-2 bg-transparent" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>24 jam</option>
            <option value={7}>7 hari</option>
            <option value={30}>30 hari</option>
          </select>
          <a href={`/api/export?device_id=${deviceId}&days=${days}`} className="rounded border px-3 py-2">
            Export CSV
          </a>
          <Link href="/" className="rounded border px-3 py-2">
            Dashboard
          </Link>
        </div>
      </header>

      {summary && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Rata-rata suhu" value={summary.avg_temp} unit="°C" />
          <Stat label="Suhu min / max" value={`${summary.min_temp ?? "-"} / ${summary.max_temp ?? "-"}`} unit="°C" />
          <Stat label="Rata-rata kelembapan" value={summary.avg_humidity} unit="%" />
          <Stat label="Rata-rata tanah" value={summary.avg_soil} unit="%" />
          <Stat label="Pompa menyala" value={summary.pump_on_pct} unit="% waktu" />
          <Stat label="Fan menyala" value={summary.fan_on_pct} unit="% waktu" />
          <Stat label="Grow light menyala" value={summary.grow_light_on_pct} unit="% waktu" />
          <Stat label="Pompa dinyalakan" value={summary.pump_switch_on} unit="kali" />
          <Stat label="Grow light dinyalakan" value={summary.grow_light_switch_on} unit="kali" />
          <Stat label="Aksi manual" value={summary.manual_actions} unit="kali" />
        </section>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Rata-rata per jam</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="hour" tickFormatter={hourLabel} minTickGap={40} />
              <YAxis />
              <Tooltip labelFormatter={(v) => hourLabel(String(v))} />
              <Legend />
              <Line dataKey="avg_temp" name="Suhu (°C)" stroke="#dc2626" dot={false} />
              <Line dataKey="avg_humidity" name="Kelembapan (%)" stroke="#2563eb" dot={false} />
              <Line dataKey="avg_soil" name="Tanah (%)" stroke="#16a34a" dot={false} />
              <Line dataKey="avg_light" name="Cahaya (%)" stroke="#ca8a04" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Persentase waktu aktuator menyala per jam</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="hour" tickFormatter={hourLabel} minTickGap={40} />
              <YAxis unit="%" domain={[0, 100]} />
              <Tooltip labelFormatter={(v) => hourLabel(String(v))} />
              <Legend />
              <Bar dataKey="pump_on_pct" name="Pompa" fill="#2563eb" />
              <Bar dataKey="fan_on_pct" name="Fan" fill="#9ca3af" />
              <Bar dataKey="grow_light_on_pct" name="Grow light" fill="#ca8a04" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | string | null; unit: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">
        {value ?? "-"} <span className="text-sm font-normal">{unit}</span>
      </p>
    </div>
  );
}