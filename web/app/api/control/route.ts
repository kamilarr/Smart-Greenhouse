import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Dashboard -> POST /api/control
// GH-01: mode, aktuator, dan threshold.
// GH-02: mode dan threshold suhu/cahaya saja (tanpa perintah aktuator).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const deviceId = body?.device_id;

  if (typeof deviceId !== "string" || !deviceId.trim()) {
    return NextResponse.json({ error: "device_id required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const isGreenhouse2 = deviceId === "gh-02";

  if (body.mode === "auto" || body.mode === "manual") {
    update.mode = body.mode;
  }

  // Greenhouse 2 tidak memiliki aktuator dan sensor soil.
  // Karena itu hanya konfigurasi mode, suhu, dan cahaya yang boleh diubah.
  if (isGreenhouse2) {
    if (typeof body.temp_max === "number" && Number.isFinite(body.temp_max)) {
      update.temp_max = body.temp_max;
    }
    if (typeof body.light_min === "number" && Number.isFinite(body.light_min)) {
      update.light_min = body.light_min;
    }
  } else {
    if (typeof body.pump === "boolean") update.pump_cmd = body.pump;
    if (typeof body.fan === "boolean") update.fan_cmd = body.fan;
    if (typeof body.grow_light === "boolean") update.light_cmd = body.grow_light;

    if (typeof body.soil_min === "number" && Number.isFinite(body.soil_min)) {
      update.soil_min = body.soil_min;
    }
    if (typeof body.temp_max === "number" && Number.isFinite(body.temp_max)) {
      update.temp_max = body.temp_max;
    }
    if (typeof body.light_min === "number" && Number.isFinite(body.light_min)) {
      update.light_min = body.light_min;
    }

    // Saat GH-01 pindah ke manual, pertahankan state aktuator saat ini.
    if (
      update.mode === "manual" &&
      update.pump_cmd === undefined &&
      update.fan_cmd === undefined &&
      update.light_cmd === undefined
    ) {
      const { data: latest, error: latestError } = await supabase
        .from("sensor_readings")
        .select("pump, fan, grow_light")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        return NextResponse.json({ error: latestError.message }, { status: 500 });
      }

      if (latest) {
        update.pump_cmd = latest.pump;
        update.fan_cmd = latest.fan;
        update.light_cmd = latest.grow_light;
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("devices")
    .update(update)
    .eq("id", deviceId)
    .select("id, mode, pump_cmd, fan_cmd, light_cmd, soil_min, temp_max, light_min")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
