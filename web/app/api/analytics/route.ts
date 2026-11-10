import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Dashboard -> GET /api/analytics?device_id=gh-01&days=7
// Agregasi per jam (view hourly_stats) + ringkasan + jumlah event aktuator
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("device_id");
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 7), 30);
  if (!deviceId) return NextResponse.json({ error: "device_id required" }, { status: 400 });

  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Hitung jumlah event tanpa mengambil semua baris
  const countEvents = (filter: { actuator?: string; state?: boolean; source?: string }) => {
    let q = supabase
      .from("actuator_events")
      .select("*", { count: "exact", head: true })
      .eq("device_id", deviceId)
      .gte("created_at", since);
    if (filter.actuator) q = q.eq("actuator", filter.actuator);
    if (filter.state !== undefined) q = q.eq("state", filter.state);
    if (filter.source) q = q.eq("source", filter.source);
    return q.then((r) => r.count ?? 0);
  };

  const [hourly, pumpOn, fanOn, lightOn, manual] = await Promise.all([
    supabase
      .from("hourly_stats")
      .select("*")
      .eq("device_id", deviceId)
      .gte("hour", since)
      .order("hour", { ascending: true }),
    countEvents({ actuator: "pump", state: true }),
    countEvents({ actuator: "fan", state: true }),
    countEvents({ actuator: "grow_light", state: true }),
    countEvents({ source: "manual" }),
  ]);
  if (hourly.error) return NextResponse.json({ error: hourly.error.message }, { status: 500 });

  const rows = hourly.data;
  const avg = (key: string) => {
    const vals = rows.map((r) => Number(r[key])).filter((v) => Number.isFinite(v));
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };

  return NextResponse.json({
    hourly: rows,
    summary: {
      avg_temp: avg("avg_temp"),
      min_temp: rows.length ? Math.min(...rows.map((r) => Number(r.min_temp))) : null,
      max_temp: rows.length ? Math.max(...rows.map((r) => Number(r.max_temp))) : null,
      avg_humidity: avg("avg_humidity"),
      avg_soil: avg("avg_soil"),
      avg_light: avg("avg_light"),
      pump_on_pct: avg("pump_on_pct"),
      fan_on_pct: avg("fan_on_pct"),
      grow_light_on_pct: avg("grow_light_on_pct"),
      pump_switch_on: pumpOn,
      fan_switch_on: fanOn,
      grow_light_switch_on: lightOn,
      manual_actions: manual,
      samples: rows.reduce((a, r) => a + Number(r.samples), 0),
    },
  });
}