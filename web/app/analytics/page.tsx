
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Clock3,
  Droplets,
  Fan,
  Lightbulb,
  RefreshCw,
  Sprout,
  Thermometer,
  Wifi,
  Zap,
} from "lucide-react";

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

// =====================================================
// TYPES
// =====================================================

type Device = {
  id: string;
  name: string;
};

type Hourly = {
  hour: string;
  avg_temp: number;
  avg_humidity: number;
  avg_soil: number;
  avg_light: number;
  pump_on_pct: number;
  fan_on_pct: number;
  grow_light_on_pct: number;
  avg_latency: number | null;
};

type Summary = Record<string, number | null>;

type AnalyticsResponse = {
  hourly?: Hourly[];
  summary?: Summary | null;
  error?: string;
};

// =====================================================
// COLORS
// =====================================================

const COLORS = {
  background: "#F6F6F2",
  green: "#2F7D4F",
  dark: "#1D2B22",
  muted: "#7A857D",
  border: "#E6E6DF",
  temp: "#E0592A",
  humidity: "#3B82C4",
  soil: "#2F7D4F",
  light: "#CA8A04",
  pump: "#2F7D4F",
  fan: "#3B82C4",
  grow: "#CA8A04",
  latency: "#7C5CC4",
};

const axisStyle = {
  fontSize: 11,
  fill: COLORS.muted,
};

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  backgroundColor: "#FFFFFF",
  color: COLORS.dark,
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(29,43,34,0.08)",
};

// =====================================================
// HELPERS
// =====================================================

const hourLabel = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatValue = (
  value: number | string | null | undefined
) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && !Number.isFinite(value)) return "-";
  return value;
};

const formatNumber = (
  value: number | string | null | undefined,
  decimals = 1
) => {
  if (value === null || value === undefined) return "-";

  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: decimals,
  });
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Analytics() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [days, setDays] = useState(7);

  const [hourly, setHourly] = useState<Hourly[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState("");

  // ---------------------------------------------------
  // LOAD DEVICES
  // ---------------------------------------------------

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      try {
        setLoadingDevices(true);

        const response = await fetch("/api/devices");

        if (!response.ok) {
          throw new Error("Gagal mengambil daftar perangkat.");
        }

        const list = await response.json();

        if (!Array.isArray(list)) {
          throw new Error("Format daftar perangkat tidak valid.");
        }

        if (!active) return;

        setDevices(list);

        if (list.length > 0) {
          setDeviceId(list[0].id);
        }
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengambil perangkat."
        );
      } finally {
        if (active) setLoadingDevices(false);
      }
    }

    loadDevices();

    return () => {
      active = false;
    };
  }, []);

  // ---------------------------------------------------
  // LOAD ANALYTICS
  // ---------------------------------------------------

  useEffect(() => {
    if (!deviceId) {
      setHourly([]);
      setSummary(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadAnalytics() {
      try {
        setLoadingAnalytics(true);
        setError("");

        const params = new URLSearchParams({
          device_id: deviceId,
          days: String(days),
        });

        const response = await fetch(
          `/api/analytics?${params.toString()}`,
          { signal: controller.signal }
        );

        const result: AnalyticsResponse = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Gagal mengambil data analytics."
          );
        }

        if (!active) return;

        setHourly(
          Array.isArray(result.hourly)
            ? result.hourly
            : []
        );

        setSummary(result.summary ?? null);
      } catch (err) {
        if (!active) return;

        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengambil analytics."
        );

        setHourly([]);
        setSummary(null);
      } finally {
        if (active) setLoadingAnalytics(false);
      }
    }

    loadAnalytics();

    return () => {
      active = false;
      controller.abort();
    };
  }, [deviceId, days]);

  // ---------------------------------------------------
  // STYLES
  // ---------------------------------------------------

  const selectClass =
    "min-w-0 w-full rounded-xl border border-[#e6e6df] bg-white px-3.5 py-3 text-sm text-[#1d2b22] outline-none transition focus:border-[#2f7d4f] focus:ring-2 focus:ring-[#2f7d4f]/10";

  const buttonClass =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e6e6df] bg-white px-4 py-2.5 text-sm font-medium text-[#1d2b22] transition hover:border-[#2f7d4f]/30 hover:bg-[#f6f6f2] active:scale-[0.98]";

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <main className="min-h-screen bg-[#f6f6f2] px-4 py-5 text-[#1d2b22] sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="overflow-hidden rounded-3xl border border-[#e6e6df] bg-white shadow-sm">

          <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#edf4ee] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#2f7d4f]">
                <Sprout size={14} />
                SMART GREENHOUSE
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Analytics
                </h1>

                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#7a857d] sm:text-base">
                  Pantau riwayat kondisi lingkungan, aktivitas aktuator,
                  dan performa komunikasi greenhouse.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[460px]">

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#7a857d]">
                  <Sprout size={14} />
                  PILIH PERANGKAT
                </label>

                <select
                  className={selectClass}
                  value={deviceId}
                  disabled={loadingDevices || devices.length === 0}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {loadingDevices && (
                    <option value="">Memuat perangkat...</option>
                  )}

                  {!loadingDevices && devices.length === 0 && (
                    <option value="">Tidak ada perangkat</option>
                  )}

                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#7a857d]">
                  <CalendarDays size={14} />
                  PERIODE ANALISIS
                </label>

                <select
                  className={selectClass}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={1}>24 jam terakhir</option>
                  <option value={7}>7 hari terakhir</option>
                  <option value={30}>30 hari terakhir</option>
                </select>
              </div>

              <a
                href={
                  deviceId
                    ? `/api/export?device_id=${encodeURIComponent(deviceId)}&days=${days}`
                    : "#"
                }
                aria-disabled={!deviceId}
                onClick={(e) => {
                  if (!deviceId) e.preventDefault();
                }}
                className={`${buttonClass} justify-center border-[#2f7d4f]/20 bg-[#edf4ee] text-[#2f7d4f] hover:bg-[#e2eee4]`}
              >
                <BarChart3 size={17} />
                Export CSV
              </a>

              <Link
                href="/"
                className={`${buttonClass} justify-center`}
              >
                <ArrowLeft size={17} />
                Dashboard
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6e6df] bg-[#fbfbf8] px-5 py-3 text-xs text-[#7a857d] sm:px-7">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2f7d4f]" />
              Data analytics berdasarkan riwayat perangkat
            </div>

            <div className="flex items-center gap-1.5">
              <Clock3 size={13} />
              Periode {days === 1 ? "24 jam" : `${days} hari`}
            </div>
          </div>
        </header>

        {/* =================================================
            ERROR MESSAGE
        ================================================= */}

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center"
          >
            <div className="flex-1 text-sm text-red-700">
              {error}
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setDays((current) => current);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <RefreshCw size={14} />
              Coba lagi dengan memilih periode
            </button>
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loadingAnalytics && (
          <div className="rounded-2xl border border-[#e6e6df] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#edf4ee] text-[#2f7d4f]">
              <RefreshCw size={19} className="animate-spin" />
            </div>

            <p className="mt-3 text-sm font-semibold text-[#1d2b22]">
              Memuat data analytics
            </p>

            <p className="mt-1 text-xs text-[#7a857d]">
              Mohon tunggu sebentar...
            </p>
          </div>
        )}

        {/* =================================================
            ANALYTICS CONTENT
        ================================================= */}

        {!loadingAnalytics && !error && summary && (
          <>
            {/* SENSOR STATISTICS */}

            <section className="space-y-4">

              <SectionHeading
                eyebrow="ENVIRONMENTAL MONITORING"
                title="Ringkasan Sensor"
                description="Gambaran kondisi lingkungan greenhouse selama periode terpilih."
                icon={<Activity size={19} />}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">

                <StatCard
                  label="Rata-rata suhu"
                  value={formatNumber(summary.avg_temp)}
                  unit="°C"
                  icon={<Thermometer size={19} />}
                  color={COLORS.temp}
                  description="Suhu lingkungan"
                />

                <StatCard
                  label="Suhu min / max"
                  value={`${formatNumber(summary.min_temp)} / ${formatNumber(summary.max_temp)}`}
                  unit="°C"
                  icon={<Activity size={19} />}
                  color={COLORS.temp}
                  description="Rentang suhu"
                  compact
                />

                <StatCard
                  label="Kelembapan udara"
                  value={formatNumber(summary.avg_humidity)}
                  unit="%"
                  icon={<Droplets size={19} />}
                  color={COLORS.humidity}
                  description="Rata-rata kelembapan"
                />

                <StatCard
                  label="Kelembapan tanah"
                  value={formatNumber(summary.avg_soil)}
                  unit="%"
                  icon={<Sprout size={19} />}
                  color={COLORS.soil}
                  description="Rata-rata kelembapan tanah"
                />

                <StatCard
                  label="Intensitas cahaya"
                  value={formatNumber(summary.avg_light)}
                  unit="%"
                  icon={<Lightbulb size={19} />}
                  color={COLORS.light}
                  description="Rata-rata intensitas cahaya"
                />

              </div>
            </section>

            {/* ACTUATOR STATISTICS */}

            <section className="space-y-4">

              <SectionHeading
                eyebrow="ACTUATOR PERFORMANCE"
                title="Aktivitas Aktuator"
                description="Persentase sampel ON dan jumlah penyalaan setiap aktuator."
                icon={<Zap size={19} />}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

                <StatCard
                  label="Pompa menyala"
                  value={formatNumber(summary.pump_on_pct)}
                  unit="%"
                  icon={<Droplets size={19} />}
                  color={COLORS.pump}
                  description={`${formatValue(summary.pump_switch_on)} kali dinyalakan`}
                />

                <StatCard
                  label="Fan menyala"
                  value={formatNumber(summary.fan_on_pct)}
                  unit="%"
                  icon={<Fan size={19} />}
                  color={COLORS.fan}
                  description={`${formatValue(summary.fan_switch_on)} kali dinyalakan`}
                />

                <StatCard
                  label="Grow light menyala"
                  value={formatNumber(summary.grow_light_on_pct)}
                  unit="%"
                  icon={<Lightbulb size={19} />}
                  color={COLORS.grow}
                  description={`${formatValue(summary.grow_light_switch_on)} kali dinyalakan`}
                />

                <StatCard
                  label="Aksi manual"
                  value={formatValue(summary.manual_actions)}
                  unit="kali"
                  icon={<Activity size={19} />}
                  color={COLORS.latency}
                  description="Total event kontrol manual"
                />

              </div>
            </section>

            {/* CONNECTIVITY */}

            <section className="space-y-4">

              <SectionHeading
                eyebrow="SYSTEM CONNECTIVITY"
                title="Performa Koneksi"
                description="Informasi waktu respons komunikasi antara perangkat dan server."
                icon={<Wifi size={19} />}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                <StatCard
                  label="Rata-rata latency"
                  value={formatValue(summary.avg_latency)}
                  unit="ms"
                  icon={<Wifi size={19} />}
                  color={COLORS.latency}
                  description="HTTP round-trip"
                />

                <StatCard
                  label="Latency minimum"
                  value={formatValue(summary.min_latency)}
                  unit="ms"
                  icon={<Zap size={19} />}
                  color={COLORS.green}
                  description="Respons tercepat"
                />

                <StatCard
                  label="Latency maksimum"
                  value={formatValue(summary.max_latency)}
                  unit="ms"
                  icon={<Clock3 size={19} />}
                  color={COLORS.temp}
                  description="Respons terlambat"
                />

              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e6e6df] bg-white px-4 py-3 text-sm">
                <Activity size={16} className="text-[#2f7d4f]" />
                <span className="text-[#7a857d]">
                  Total sampel sensor:
                </span>
                <strong className="text-[#1d2b22]">
                  {formatValue(summary.samples)}
                </strong>
              </div>
            </section>

            {/* SENSOR CHARTS */}

            <section className="space-y-4">

              <SectionHeading
                eyebrow="HISTORICAL DATA"
                title="Tren Sensor"
                description="Perubahan nilai sensor dari waktu ke waktu."
                icon={<Activity size={19} />}
              />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

                <ChartCard
                  title="Suhu lingkungan"
                  subtitle="Rata-rata suhu per jam"
                  color={COLORS.temp}
                  unit="°C"
                  data={hourly}
                  dataKey="avg_temp"
                  name="Suhu"
                  loading={loadingAnalytics}
                />

                <ChartCard
                  title="Kelembapan udara"
                  subtitle="Rata-rata kelembapan udara per jam"
                  color={COLORS.humidity}
                  unit="%"
                  data={hourly}
                  dataKey="avg_humidity"
                  name="Kelembapan"
                  loading={loadingAnalytics}
                />

                <ChartCard
                  title="Kelembapan tanah"
                  subtitle="Rata-rata kelembapan tanah per jam"
                  color={COLORS.soil}
                  unit="%"
                  data={hourly}
                  dataKey="avg_soil"
                  name="Kelembapan tanah"
                  loading={loadingAnalytics}
                />

                <ChartCard
                  title="Intensitas cahaya"
                  subtitle="Rata-rata intensitas cahaya per jam"
                  color={COLORS.light}
                  unit="%"
                  data={hourly}
                  dataKey="avg_light"
                  name="Cahaya"
                  loading={loadingAnalytics}
                />

              </div>
            </section>

            {/* ACTUATOR CHART */}

            <section className="space-y-4">

              <SectionHeading
                eyebrow="ACTUATOR HISTORY"
                title="Grafik Aktivitas Aktuator"
                description="Proporsi sampel ketika aktuator berada dalam kondisi ON setiap jam."
                icon={<Zap size={19} />}
              />

              <div className="rounded-2xl border border-[#e6e6df] bg-white p-4 shadow-sm sm:p-6">

                <div className="mb-5">
                  <h3 className="font-semibold text-[#1d2b22]">
                    Aktivitas pompa, fan, dan grow light
                  </h3>

                  <p className="mt-1 text-xs text-[#7a857d]">
                    Persentase sampel ON per jam
                  </p>
                </div>

                {hourly.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <div className="h-[280px] w-full sm:h-[330px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={hourly}
                        margin={{
                          top: 10,
                          right: 8,
                          left: -15,
                          bottom: 5,
                        }}
                        barGap={4}
                      >
                        <CartesianGrid
                          stroke={COLORS.border}
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="hour"
                          tickFormatter={hourLabel}
                          minTickGap={35}
                          tick={axisStyle}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          domain={[0, 100]}
                          unit="%"
                          tick={axisStyle}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          labelFormatter={(value) =>
                            hourLabel(String(value))
                          }
                          formatter={(value) => [
                            `${formatNumber(Number(value))}%`,
                            "Proporsi sampel ON",
                          ]}
                          contentStyle={tooltipStyle}
                          cursor={{ fill: "#F6F6F2" }}
                        />

                        <Legend
                          wrapperStyle={{
                            fontSize: 12,
                            paddingTop: 16,
                          }}
                        />

                        <Bar
                          dataKey="pump_on_pct"
                          name="Pompa"
                          fill={COLORS.pump}
                          radius={[5, 5, 0, 0]}
                        />

                        <Bar
                          dataKey="fan_on_pct"
                          name="Fan"
                          fill={COLORS.fan}
                          radius={[5, 5, 0, 0]}
                        />

                        <Bar
                          dataKey="grow_light_on_pct"
                          name="Grow light"
                          fill={COLORS.grow}
                          radius={[5, 5, 0, 0]}
                        />

                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            {/* LATENCY CHART */}

            <section className="space-y-4">

              <SectionHeading
                eyebrow="NETWORK PERFORMANCE"
                title="Grafik Latency"
                description="Perubahan waktu respons HTTP dari perangkat ke server."
                icon={<Wifi size={19} />}
              />

              <div className="rounded-2xl border border-[#e6e6df] bg-white p-4 shadow-sm sm:p-6">

                <div className="mb-5">
                  <h3 className="font-semibold text-[#1d2b22]">
                    Rata-rata latency per jam
                  </h3>

                  <p className="mt-1 text-xs text-[#7a857d]">
                    Waktu HTTP round-trip dalam milidetik.
                  </p>
                </div>

                {hourly.filter((r) => r.avg_latency != null).length === 0 ? (
                  <EmptyChart message="Belum ada data latency pada periode ini." />
                ) : (
                  <div className="h-[260px] w-full sm:h-[310px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={hourly}
                        margin={{
                          top: 10,
                          right: 10,
                          left: -5,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid
                          stroke={COLORS.border}
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="hour"
                          tickFormatter={hourLabel}
                          minTickGap={35}
                          tick={axisStyle}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          unit=" ms"
                          tick={axisStyle}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          labelFormatter={(value) =>
                            hourLabel(String(value))
                          }
                          formatter={(value) => [
                            `${formatNumber(Number(value), 0)} ms`,
                            "Latency",
                          ]}
                          contentStyle={tooltipStyle}
                        />

                        <Line
                          type="monotone"
                          dataKey="avg_latency"
                          name="Latency"
                          stroke={COLORS.latency}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{
                            r: 5,
                            fill: COLORS.latency,
                            stroke: "#FFFFFF",
                            strokeWidth: 2,
                          }}
                          connectNulls={false}
                        />

                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            {/* FOOTER */}

            <footer className="border-t border-[#e6e6df] py-5 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#2f7d4f]">
                <Sprout size={16} />
                Smart Greenhouse Analytics
              </div>

              <p className="mt-1 text-xs text-[#9ca59e]">
                Environmental monitoring and system performance
              </p>
            </footer>
          </>
        )}

        {/* EMPTY STATE */}

        {!loadingAnalytics &&
          !error &&
          !summary &&
          deviceId && (
            <div className="rounded-2xl border border-[#e6e6df] bg-white px-5 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4ee] text-[#2f7d4f]">
                <BarChart3 size={25} />
              </div>

              <h2 className="mt-4 text-lg font-semibold text-[#1d2b22]">
                Belum ada data analytics
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#7a857d]">
                Belum tersedia data untuk perangkat dan periode yang dipilih.
                Coba pilih periode lainnya.
              </p>
            </div>
          )}

      </div>
    </main>
  );
}

// =====================================================
// SECTION HEADING
// =====================================================

function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4ee] text-[#2f7d4f]">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#2f7d4f] sm:text-xs">
          {eyebrow}
        </p>

        <h2 className="mt-1 text-lg font-bold tracking-tight text-[#1d2b22] sm:text-xl">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-relaxed text-[#7a857d] sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// STAT CARD
// =====================================================

function StatCard({
  label,
  value,
  unit,
  icon,
  color,
  description,
  compact = false,
}: {
  label: string;
  value: number | string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-[#e6e6df] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#d5e4d8] hover:shadow-md sm:p-5">

      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-relaxed text-[#7a857d] sm:text-sm">
          {label}
        </p>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${color}14`,
            color,
          }}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-1.5">
        <p
          className={`font-bold tracking-tight text-[#1d2b22] ${
            compact ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"
          }`}
        >
          {value}
        </p>

        <span className="text-xs font-medium text-[#7a857d]">
          {unit}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-[#f0f0eb] pt-3">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />

        <p className="text-[11px] leading-relaxed text-[#7a857d]">
          {description}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// CHART CARD
// =====================================================

function ChartCard({
  title,
  subtitle,
  color,
  unit,
  data,
  dataKey,
  name,
}: {
  title: string;
  subtitle: string;
  color: string;
  unit: string;
  data: Hourly[];
  dataKey: keyof Hourly;
  name: string;
  loading: boolean;
}) {
  const validData = data.filter(
    (item) => item[dataKey] != null
  );

  return (
    <div className="rounded-2xl border border-[#e6e6df] bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#1d2b22]">
            {title}
          </h3>

          <p className="mt-1 text-xs text-[#7a857d]">
            {subtitle}
          </p>
        </div>

        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      {validData.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="h-[230px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 8,
                right: 8,
                left: -18,
                bottom: 2,
              }}
            >
              <CartesianGrid
                stroke={COLORS.border}
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="hour"
                tickFormatter={hourLabel}
                minTickGap={35}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                unit={unit}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={48}
              />

              <Tooltip
                labelFormatter={(value) => hourLabel(String(value))}
                formatter={(value) => [
                  `${formatNumber(Number(value))} ${unit}`,
                  name,
                ]}
                contentStyle={tooltipStyle}
              />

              <Line
                type="monotone"
                dataKey={dataKey}
                name={name}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: color,
                  stroke: "#FFFFFF",
                  strokeWidth: 2,
                }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// =====================================================
// EMPTY CHART
// =====================================================

function EmptyChart({
  message = "Belum ada data untuk ditampilkan.",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-[230px] flex-col items-center justify-center text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f6f6f2] text-[#9ca59e]">
        <BarChart3 size={21} />
      </div>

      <p className="mt-3 text-xs text-[#7a857d]">
        {message}
      </p>
    </div>
  );
}
