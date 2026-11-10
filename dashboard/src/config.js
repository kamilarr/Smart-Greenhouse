const env = import.meta.env

export const config = {
  source: env.VITE_DATA_SOURCE === 'mqtt' ? 'mqtt' : 'mock',
  mqttUrl: env.VITE_MQTT_URL || 'wss://broker.hivemq.com:8884/mqtt',
  mqttUsername: env.VITE_MQTT_USERNAME || undefined,
  mqttPassword: env.VITE_MQTT_PASSWORD || undefined,
  deviceId: env.VITE_DEVICE_ID || 'ugs-greenhouse-1',
  apiUrl: (env.VITE_API_URL || '').replace(/\/$/, ''),
  greenhouseName: env.VITE_GREENHOUSE_NAME || 'Greenhouse Utama',
  greenhouseLocation: env.VITE_GREENHOUSE_LOCATION || 'Surakarta, Indonesia',
}

/**
 * Kontrak topic MQTT antara ESP32 dan dashboard.
 * ESP32 harus memakai topic & format payload yang sama (lihat README).
 */
export function topicsFor(id) {
  const base = `greenhouse/${id}`
  return {
    sensor: `${base}/sensor`, // ESP32 -> web  {"temp":26.4,"hum":70,"soil":42,"light":68}
    status: `${base}/status`, // ESP32 -> web  {"mode":"auto","pump":0,"lamp":1,"fan":0} (retained)
    online: `${base}/online`, // ESP32 -> web  "online" | "offline" (LWT, retained)
    threshold: `${base}/config/threshold`, // web -> ESP32 (retained) {"soilMin":35,...}
    cmdMode: `${base}/cmd/mode`, // web -> ESP32  "auto" | "manual"
    cmd: (actuator) => `${base}/cmd/${actuator}`, // web -> ESP32  "ON" | "OFF"
  }
}

export const DEFAULT_THRESHOLDS = {
  soilMin: 35, // pompa menyala jika kelembapan tanah < soilMin (%)
  lightMin: 40, // grow light menyala jika cahaya < lightMin (%)
  tempMax: 30, // kipas menyala jika suhu > tempMax (°C)
  humMax: 85, // kipas juga menyala jika kelembapan udara > humMax (%)
}

export const ACTUATORS = ['pump', 'lamp', 'fan']
