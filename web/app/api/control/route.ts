import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Dashboard -> POST /api/control
// Body: { device_id, mode?, pump?, fan?, grow_light?, soil_min?, temp_max?, light_min? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.device_id) return NextResponse.json({ error: "device_id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.mode === "auto" || body.mode === "manual") update.mode = body.mode;
  if (typeof body.pump === "boolean") update.pump_cmd = body.pump;
  if (typeof body.fan === "boolean") update.fan_cmd = body.fan;
  if (typeof body.grow_light === "boolean") update.light_cmd = body.grow_light;
  if (typeof body.soil_min === "number") update.soil_min = body.soil_min;
  if (typeof body.temp_max === "number") update.temp_max = body.temp_max;
  if (typeof body.light_min === "number") update.light_min = body.light_min;

  // Saat pindah ke manual, mulai dari state aktuator saat ini agar relay tidak berubah tiba-tiba
  if (update.mode === "manual" && update.pump_cmd === undefined && update.fan_cmd === undefined && update.light_cmd === undefined) {
    const { data: latest } = await supabase
      .from("sensor_readings")
      .select("pump, fan, grow_light")
      .eq("device_id", body.device_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      update.pump_cmd = latest.pump;
      update.fan_cmd = latest.fan;
      update.light_cmd = latest.grow_light;
    }
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("devices")
    .update(update)
    .eq("id", body.device_id)
    .select("id, mode, pump_cmd, fan_cmd, light_cmd, soil_min, temp_max, light_min")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}