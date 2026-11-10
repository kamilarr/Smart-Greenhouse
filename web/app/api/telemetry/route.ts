import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ESP32 -> POST /api/telemetry
// Header : x-device-key: <api_key>
// Body   : { temperature, humidity, soil_moisture, light, pump, fan, grow_light }
// Balasan: { mode, pump, fan, grow_light, soil_min, temp_max, light_min }
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-device-key");
  if (!key) return NextResponse.json({ error: "missing x-device-key" }, { status: 401 });

  // 1. Identifikasi node dari api_key
  const { data: device } = await supabase
    .from("devices")
    .select("id, mode, pump_cmd, fan_cmd, light_cmd, soil_min, temp_max, light_min")
    .eq("api_key", key)
    .maybeSingle();
  if (!device) return NextResponse.json({ error: "unknown device" }, { status: 401 });

  // 2. Validasi body
  const body = await req.json().catch(() => null);
  if (!body || typeof body.pump !== "boolean" || typeof body.fan !== "boolean" || typeof body.grow_light !== "boolean") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  // 3. Ambil state terakhir untuk mendeteksi perubahan aktuator
  const { data: prev } = await supabase
    .from("sensor_readings")
    .select("pump, fan, grow_light")
    .eq("device_id", device.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Simpan pembacaan sensor + state aktuator
  const { error } = await supabase.from("sensor_readings").insert({
    device_id: device.id,
    temperature: num(body.temperature),
    humidity: num(body.humidity),
    soil_moisture: num(body.soil_moisture),
    light: num(body.light),
    pump: body.pump,
    fan: body.fan,
    grow_light: body.grow_light,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 5. Catat perubahan pompa/fan/grow light ke actuator_events
  const events = [];
  for (const actuator of ["pump", "fan", "grow_light"] as const) {
    if (!prev || prev[actuator] !== body[actuator])
      events.push({ device_id: device.id, actuator, state: body[actuator], source: device.mode });
  }
  if (events.length) await supabase.from("actuator_events").insert(events);

  // 6. Tandai node online
  await supabase.from("devices").update({ last_seen: new Date().toISOString() }).eq("id", device.id);

  // 7. Balas dengan konfigurasi & perintah terbaru
  return NextResponse.json({
    mode: device.mode,
    pump: device.pump_cmd,
    fan: device.fan_cmd,
    grow_light: device.light_cmd,
    soil_min: device.soil_min,
    temp_max: device.temp_max,
    light_min: device.light_min,
  });
}