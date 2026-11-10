import { NextResponse } from "next/server";
import { supabase, ONLINE_WINDOW_MS } from "@/lib/supabase";

// Dashboard -> GET /api/devices
// Daftar semua node + pembacaan terakhir + status online
export async function GET() {
  const { data: devices, error } = await supabase
    .from("devices")
    .select("id, name, location, mode, pump_cmd, fan_cmd, light_cmd, soil_min, temp_max, light_min, last_seen")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = await Promise.all(
    devices.map(async (d) => {
      const { data: latest } = await supabase
        .from("sensor_readings")
        .select("temperature, humidity, soil_moisture, light, pump, fan, grow_light, created_at")
        .eq("device_id", d.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const online = !!d.last_seen && Date.now() - new Date(d.last_seen).getTime() < ONLINE_WINDOW_MS;
      return { ...d, online, latest };
    })
  );

  return NextResponse.json(result);
}