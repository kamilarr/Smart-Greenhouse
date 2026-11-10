import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Dashboard -> GET /api/readings?device_id=gh-01&hours=1
// Data mentah untuk grafik realtime (maks 1000 titik terbaru) + 20 event aktuator terakhir
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("device_id");
  const hours = Math.min(Number(req.nextUrl.searchParams.get("hours") ?? 1), 24);
  if (!deviceId) return NextResponse.json({ error: "device_id required" }, { status: 400 });

  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const [readings, events] = await Promise.all([
    supabase
      .from("sensor_readings")
      .select("temperature, humidity, soil_moisture, light, pump, fan, grow_light, created_at")
      .eq("device_id", deviceId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000), // batas default Supabase per query
    supabase
      .from("actuator_events")
      .select("actuator, state, source, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (readings.error) return NextResponse.json({ error: readings.error.message }, { status: 500 });

  return NextResponse.json({ readings: readings.data.reverse(), events: events.data ?? [] });
}