import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

type AlertState = {
  notified: boolean;
  lastAttemptAt: number;
};

const alertStates = new Map<string, AlertState>();
const ALERT_RETRY_COOLDOWN_MS = 60_000;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-device-key");
  if (!key) {
    return NextResponse.json({ error: "missing x-device-key" }, { status: 401 });
  }

  // 1. Identifikasi node dari api_key
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select(
      "id, name, mode, pump_cmd, fan_cmd, light_cmd, soil_min, temp_max, light_min",
    )
    .eq("api_key", key)
    .maybeSingle();

  if (deviceError) {
    return NextResponse.json({ error: deviceError.message }, { status: 500 });
  }
  if (!device) {
    return NextResponse.json({ error: "unknown device" }, { status: 401 });
  }

  // 2. Validasi body
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.pump !== "boolean" ||
    typeof body.fan !== "boolean" ||
    typeof body.grow_light !== "boolean"
  ) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const temperature = num(body.temperature);
  const soilMoisture = num(body.soil_moisture);
  const light = num(body.light);

  // 3. Ambil state terakhir untuk mendeteksi perubahan aktuator
  const { data: prev, error: previousError } = await supabase
    .from("sensor_readings")
    .select("pump, fan, grow_light")
    .eq("device_id", device.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    return NextResponse.json({ error: previousError.message }, { status: 500 });
  }

  // 4. Simpan pembacaan sensor + state aktuator
  const { error: readingError } = await supabase.from("sensor_readings").insert({
    device_id: device.id,
    temperature,
    humidity: num(body.humidity),
    soil_moisture: soilMoisture,
    light,
    pump: body.pump,
    fan: body.fan,
    grow_light: body.grow_light,
    latency_ms:
      typeof body.latency_ms === "number" && Number.isFinite(body.latency_ms)
        ? Math.round(body.latency_ms)
        : null,
  });

  if (readingError) {
    return NextResponse.json({ error: readingError.message }, { status: 500 });
  }

  // 5. Catat perubahan pompa/fan/grow light ke actuator_events
  const events = [];
  for (const actuator of ["pump", "fan", "grow_light"] as const) {
    if (!prev || prev[actuator] !== body[actuator]) {
      events.push({
        device_id: device.id,
        actuator,
        state: body[actuator],
        source: device.mode,
      });
    }
  }

  if (events.length) {
    const { error: eventError } = await supabase
      .from("actuator_events")
      .insert(events);

    if (eventError) {
      console.error("Failed to insert actuator events:", eventError.message);
    }
  }

  // 6. Tandai node online
  const { error: lastSeenError } = await supabase
    .from("devices")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", device.id);

  if (lastSeenError) {
    console.error("Failed to update device last_seen:", lastSeenError.message);
  }

  // 7. Deteksi kondisi abnormal dan kirim notifikasi Telegram saat mulai terdeteksi.
  const abnormalConditions = [
    {
      type: "temperature_high",
      abnormal: temperature !== null && temperature > device.temp_max,
      message:
        temperature === null
          ? ""
          : `🌡️ Suhu tinggi: ${temperature}°C (batas ${device.temp_max}°C)`,
    },
    {
      type: "soil_dry",
      abnormal:
        device.id === "gh-01" &&
        soilMoisture !== null &&
        soilMoisture < device.soil_min,
      message:
        soilMoisture === null
          ? ""
          : `🌱 Tanah kering: ${soilMoisture}% (batas minimum ${device.soil_min}%)`,
    },
    {
      type: "light_low",
      abnormal: light !== null && light < device.light_min,
      message:
        light === null
          ? ""
          : `💡 Intensitas cahaya rendah: ${light} (batas minimum ${device.light_min})`,
    },
  ] as const;

  const now = Date.now();
  const newlyDetected: string[] = [];

  for (const condition of abnormalConditions) {
    const stateKey = `${device.id}:${condition.type}`;

    if (!condition.abnormal) {
      alertStates.delete(stateKey);
      continue;
    }

    const currentState = alertStates.get(stateKey);
    if (currentState?.notified) continue;
    if (
      currentState &&
      now - currentState.lastAttemptAt < ALERT_RETRY_COOLDOWN_MS
    ) {
      continue;
    }

    alertStates.set(stateKey, {
      notified: false,
      lastAttemptAt: now,
    });
    newlyDetected.push(condition.message);
  }

  if (newlyDetected.length > 0) {
    const message = [
      `🚨 PERINGATAN SMART GREENHOUSE`,
      `Perangkat: ${device.name} (${device.id})`,
      "",
      ...newlyDetected,
      "",
      `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
    ].join("\n");

    const telegramResult = await sendTelegramMessage(message);

    if (telegramResult.ok) {
      for (const condition of abnormalConditions) {
        const stateKey = `${device.id}:${condition.type}`;
        const state = alertStates.get(stateKey);
        if (condition.abnormal && state && state.lastAttemptAt === now) {
          state.notified = true;
        }
      }
    } else {
      // Simpan waktu percobaan agar kegagalan Telegram tidak memicu request berulang tiap 2 detik.
      console.error("Telegram alert was not delivered:", telegramResult.error);
    }
  }

  // 8. Balas dengan konfigurasi & perintah terbaru (format respons dipertahankan)
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
