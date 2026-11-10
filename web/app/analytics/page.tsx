
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

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

const COLORS = {
  temp: "#e0592a",
  humidity: "#3b82c4",
  soil: "#2f7d4f",
  light: "#ca8a04",
  pump: "#2f7d4f",
  fan: "#3b82c4",
  grow: "#ca8a04",
};

const hourLabel = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
  });

export default function Analytics() {
  const [devices, setDevices] = useState<
    { id: string; name: string }[]
  >([]);
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

  const selectClass =
    "rounded-lg border border-[#e2e2da] bg-white px-3 py-2 text-sm text-[#1d2b22] outline-none transition focus:border-[#2f7d4f]";

  const buttonClass =
    "rounded-lg border border-[#e2e2da] bg-white px-3 py-2 text-sm text-[#1d2b22] transition hover:bg-[#f3f3ee]";

  const axisStyle = {
    fontSize: 11,
    fill: "#7a857d",
  };

  const tooltipStyle = {
    borderRadius: 10,
    border: "1px solid #e2e2da",
    backgroundColor: "#ffffff",
    color: "#1d2b22",
    fontSize: 12,
  };

  return (
    <main className="min-h-screen bg-[#f6f6f2] px-4 py-6 text-[#1d2b22] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6e6df] bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2f7d4f]">
              Smart Greenhouse
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-[#7a857d]">
              Ringkasan dan riwayat kondisi greenhouse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className={selectClass}
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.id})
                </option>
              ))}
            </select>

            <select
              className={selectClass}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>24 jam</option>
              <option value={7}>7 hari</option>
              <option value={30}>30 hari</option>
            </select>

            <a
              href={`/api/export?device_id=${deviceId}&days=${days}`}
              className={buttonClass}
            >
              Export CSV
            </a>

            <Link href="/" className={buttonClass}>
              Dashboard
            </Link>
          </div>
        </header>

        {/* Statistik */}
        {summary && (
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Rata-rata suhu" value={summary.avg_temp} unit="°C" />
            <Stat
              label="Suhu min / max"
              value={`${summary.min_temp ?? "-"} / ${summary.max_temp ?? "-"}`}
              unit="°C"
            />
            <Stat
              label="Rata-rata kelembapan"
              value={summary.avg_humidity}
              unit="%"
            />
            <Stat
              label="Rata-rata tanah"
              value={summary.avg_soil}
              unit="%"
            />
            <Stat label="Pompa menyala" value={summary.pump_on_pct} unit="% waktu" />
            <Stat label="Fan menyala" value={summary.fan_on_pct} unit="% waktu" />
            <Stat
              label="Grow light menyala"
              value={summary.grow_light_on_pct}
              unit="% waktu"
            />
            <Stat
              label="Pompa dinyalakan"
              value={summary.pump_switch_on}
              unit="kali"
            />
            <Stat
              label="Grow light dinyalakan"
              value={summary.grow_light_switch_on}
              unit="kali"
            />
            <Stat
              label="Aksi manual"
              value={summary.manual_actions}
              unit="kali"
            />
          </section>
        )}

        {/* Grafik sensor */}
        <section className="rounded-xl border border-[#e6e6df] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 font-semibold">
            Rata-rata per jam
          </h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourly} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid
                  stroke="#e9e9e3"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={hourLabel}
                  minTickGap={40}
                  tick={axisStyle}
                  axisLine={{ stroke: "#d9d9d1" }}
                  tickLine={false}
                />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(v) => hourLabel(String(v))}
                  contentStyle={tooltipStyle}
                />
                <Legend />

                <Line
                  dataKey="avg_temp"
                  name="Suhu (°C)"
                  stroke={COLORS.temp}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="avg_humidity"
                  name="Kelembapan (%)"
                  stroke={COLORS.humidity}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="avg_soil"
                  name="Tanah (%)"
                  stroke={COLORS.soil}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="avg_light"
                  name="Cahaya (%)"
                  stroke={COLORS.light}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Grafik aktuator */}
        <section className="rounded-xl border border-[#e6e6df] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 font-semibold">
            Persentase waktu aktuator menyala per jam
          </h2>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid
                  stroke="#e9e9e3"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={hourLabel}
                  minTickGap={40}
                  tick={axisStyle}
                  axisLine={{ stroke: "#d9d9d1" }}
                  tickLine={false}
                />
                <YAxis
                  unit="%"
                  domain={[0, 100]}
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(v) => hourLabel(String(v))}
                  contentStyle={tooltipStyle}
                />
                <Legend />

                <Bar
                  dataKey="pump_on_pct"
                  name="Pompa"
                  fill={COLORS.pump}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="fan_on_pct"
                  name="Fan"
                  fill={COLORS.fan}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="grow_light_on_pct"
                  name="Grow light"
                  fill={COLORS.grow}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <p className="pb-2 text-center text-xs text-[#9ca59e]">
          Smart Greenhouse Analytics
        </p>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string | null;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-[#e6e6df] bg-white p-4 shadow-sm transition hover:shadow-md">
      <p className="text-sm text-[#7a857d]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[#1d2b22]">
        {value ?? "-"}
        <span className="ml-1 text-sm font-normal text-[#7a857d]">
          {unit}
        </span>
      </p>
    </div>
  );
}
