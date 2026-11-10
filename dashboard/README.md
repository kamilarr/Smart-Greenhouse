# Smart Greenhouse Dashboard

Dashboard web pengganti Blynk untuk project Smart Greenhouse (ESP32 + DHT11 + Soil Moisture + LDR,
aktuator water pump, grow light, mini fan).

Stack: **React + Vite + Tailwind CSS + Recharts**, komunikasi **MQTT over WebSocket** (`mqtt.js`).

## Menjalankan

```bash
cd dashboard
npm install
cp .env.example .env     # lalu sesuaikan isinya
npm run dev              # buka http://localhost:5173
```

- `VITE_DATA_SOURCE=mock` → ESP32 disimulasikan di browser (tidak perlu hardware/broker). Cocok untuk desain & demo.
- `VITE_DATA_SOURCE=mqtt` → terhubung ke broker asli (`VITE_MQTT_URL`).

Build produksi: `npm run build` → hasil di `dist/` (bisa di-deploy ke Vercel/Netlify).

## Fitur

| Fitur (laporan 2.3) | Di dashboard |
|---|---|
| Monitoring suhu, kelembapan udara, kelembapan tanah, cahaya | 4 kartu sensor real-time + badge status |
| Riwayat kondisi lingkungan | Grafik 1 / 6 / 24 jam, legend bisa di-klik untuk sembunyikan garis |
| Mode otomatis / manual | Saklar mode → dikirim ke ESP32 |
| Kontrol ON/OFF pump, grow light, fan | Tombol per aktuator (hanya aktif di mode manual), menunggu konfirmasi status dari ESP32 |
| Ambang batas (threshold) | Tombol **Pengaturan** → dikirim ke ESP32 (retained) |
| Status koneksi | Indikator broker & perangkat (memakai Last Will ESP32) |
| Notifikasi | Lonceng berisi peringatan (tanah kering, suhu panas, perangkat offline, dll.) |

## Kontrak topic MQTT (wajib diikuti firmware ESP32)

`<id>` = `VITE_DEVICE_ID`, contoh `ugs-greenhouse-1`.

| Topic | Arah | Payload | Catatan |
|---|---|---|---|
| `greenhouse/<id>/sensor` | ESP32 → web | `{"temp":26.4,"hum":70,"soil":42,"light":68}` | tiap 2–5 detik. `light` dalam **persen** (100 = terang) |
| `greenhouse/<id>/status` | ESP32 → web | `{"mode":"auto","pump":0,"lamp":1,"fan":0}` | **retained**, kirim setiap ada perubahan |
| `greenhouse/<id>/online` | ESP32 → web | `online` / `offline` | **retained**; `offline` dipasang sebagai Last Will |
| `greenhouse/<id>/cmd/mode` | web → ESP32 | `auto` / `manual` | |
| `greenhouse/<id>/cmd/pump` · `/lamp` · `/fan` | web → ESP32 | `ON` / `OFF` | diabaikan ESP32 jika mode `auto` |
| `greenhouse/<id>/config/threshold` | web → ESP32 | `{"soilMin":35,"lightMin":40,"tempMax":30,"humMax":85}` | **retained**, ESP32 subscribe saat boot |

Konversi LDR di ESP32 (nilai ADC besar = gelap):
`light = 100 - raw * 100 / 4095`.

Setelah menerima perintah, ESP32 **harus** publish ulang `status`. Dashboard baru mengubah tampilan tombol
setelah status itu datang, jadi yang terlihat selalu kondisi asli perangkat.

## Riwayat dari backend (opsional)

Jika `VITE_API_URL` diisi, dashboard memanggil `GET <VITE_API_URL>/api/history?hours=24` dan mengharapkan:

```json
[{ "t": 1762740000000, "temp": 26.4, "hum": 70, "soil": 42, "light": 68 }]
```

Tanpa backend, grafik hanya berisi data yang masuk selama halaman dibuka.

## Struktur

```
src/
  config.js              konfigurasi .env + kontrak topic + threshold default
  lib/transports.js      koneksi MQTT asli & simulator ESP32 (mock)
  lib/useGreenhouse.js   state & aksi (setMode, setActuator, saveThresholds)
  lib/status.js          klasifikasi nilai sensor → label status
  components/            Header, SensorCard, HistoryChart, ControlPanel, SettingsDialog
```
