import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/export?device_id=gh-01&days=7  -> file CSV data mentah
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("device_id");
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 7), 30);
  if (!deviceId) return NextResponse.json({ error: "device_id required" }, { status: 400 });

  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Ambil per halaman 1000 baris (batas default Supabase per query)
  const data = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase
      .from("sensor_readings")
      .select("created_at, temperature, humidity, soil_moisture, light, pump, fan, grow_light")
      .eq("device_id", deviceId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data.push(...page);
    if (page.length < 1000) break;
  }

  const header = "created_at,temperature,humidity,soil_moisture,light,pump,fan,grow_light";
  const lines = data.map((r) =>
    [r.created_at, r.temperature, r.humidity, r.soil_moisture, r.light, r.pump, r.fan, r.grow_light].join(",")
  );

  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${deviceId}-${days}d.csv"`,
    },
  });
}