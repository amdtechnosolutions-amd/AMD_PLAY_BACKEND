# 🏟️ SmartElex 6CH Controller — Turf Arena Firmware (Cricket & Football)

## Overview & Architecture

This directory contains the customized, production-ready firmware for the **Turf Arena SmartElex 6-Channel ESP32-S3 Wi-Fi Relay Controller**.

---

## 1. Differences Between Badminton & Turf Firmware

| Parameter | Device 2 (Badminton Arena) | Device 3 (Turf Arena) | Why It Must Differ |
|:---|:---|:---|:---|
| **Directory** | `CODE_SMARTELEX/` | `CODE_SMARTELEX_TURF/` | Dedicated sketch folder for Arduino IDE |
| **Main Sketch** | `MAIN_WIFI_MQTT_DEV2_BADMINTON.ino` | `CODE_SMARTELEX_TURF.ino` | Custom logging and relay labels for Turf |
| **MQTT Client ID** | `"smartelex_relay_badminton"` | `"smartelex_relay_turf"` | **CRITICAL**: Identical Client IDs cause continuous connection collisions on the broker! |
| **Subscribe Topic** | `sports/relays/badminton/command` | `sports/relays/turf/command` | Commands sent to Badminton must not trigger Turf lights |
| **Publish Topic** | `sports/relays/badminton/status` | `sports/relays/turf/status` | Telemetry & state feedback separated by sport |
| **NVS Flash Space** | `"amd_relay"` | `"amd_turf"` | Prevents configuration overwrite if shared |
| **Captive Portal SSID** | `amd_wifi` | `amd_wifi_turf` | Technicians on-site can immediately tell which device they are configuring |

---

## 2. Recommended Relay Allocation for Turf (Cricket / Football)

Because cricket and football turfs use high-power LED floodlights (150W - 400W per lamp) or heavy metal-halide lamps, **relays should switch the coils of industrial AC contactors** rather than directly handling large inrush lighting loads.

| Relay Channel | Output GPIO | Recommended Turf Load | Electrical Handling |
|:---:|:---:|:---|:---|
| **CH1** | `GPIO 1` | **Turf Floodlights Bank 1** (North / West side high masts) | Drives 230V Contactor Coil (C1) |
| **CH2** | `GPIO 2` | **Turf Floodlights Bank 2** (South / East side high masts) | Drives 230V Contactor Coil (C2) |
| **CH3** | `GPIO 41` | **Pitch / Center Wicket Focus Lights** (Night Cricket) | Direct Relay or Contactor |
| **CH4** | `GPIO 42` | **Batting Practice Nets / Goal Post Perimeter** | Direct Relay / Contactor |
| **CH5** | `GPIO 45` | **Pavilion / Dugout / Player Seating Area Lights & Fans** | Direct Relay (10A max) |
| **CH6** | `GPIO 46` | **Turf Gate Access Lock (12V) or Warning Siren** | 12V DC Relay / NC-NO strike |

---

## 3. Captive Portal (amd_wifi_turf) Setup

1. **First Boot or Factory Reset**:
   - The device automatically detects no Wi-Fi credentials in flash and launches an open Wi-Fi hotspot named:
     `amd_wifi_turf`
   - Connect from your mobile phone or laptop.
   - Open browser at: `http://192.168.4.1` (or click captive portal notification).

2. **Manual Portal Trigger**:
   - At any time, **press and hold the BOOT button on the ESP32-S3 for 3 seconds**.
   - The device will emit two beeps, light up Cyan, and launch `amd_wifi_turf`.

3. **Portal Configuration Fields**:
   - **Facility Wi-Fi**: Select your 2.4 GHz network & enter password.
   - **MQTT Server**: Public IP or domain of your Cloud VPS (e.g. `139.59.88.12`).
   - **MQTT Port**: `1883`
   - **Device Client ID**: `smartelex_relay_turf`
   - **Subscribe Topic**: `sports/relays/turf/command`
   - **Publish Topic**: `sports/relays/turf/status`
   - Tap **"Save & Connect Device"**. The device will save to NVS flash and reboot.

---

## 4. MQTT Control Commands & Formats

The backend publishes commands to `sports/relays/turf/command`. All standard payload formats are supported:

### A. Turn ON Single Relay (e.g. CH1 Floodlights)
- **Topic:** `sports/relays/turf/command`
- **JSON Payload:**
  ```json
  {
    "channel": 1,
    "state": "ON"
  }
  ```
  *(Or Format A: `{"data":{"CH1":1}}`)*

### B. Turn OFF Single Relay (e.g. CH1 Floodlights)
- **JSON Payload:**
  ```json
  {
    "channel": 1,
    "state": "OFF"
  }
  ```

### C. Turn ALL Turf Lights ON (Full Arena Match Mode)
- **JSON Payload:**
  ```json
  {
    "data": {
      "ALL": 1
    }
  }
  ```

### D. Turn ALL Turf Lights OFF (Standby / Blackout)
- **JSON Payload:**
  ```json
  {
    "data": {
      "ALL": 0
    }
  }
  ```

---

## 5. Backend Database Registration

To register this device in AMD Play SaaS:

- **Device Name:** `Turf Arena SmartElex 6CH (Cricket & Football)`
- **Device Code:** `DEV-SMARTELEX-TURF`
- **Device Type:** `relay`
- **Protocol:** `mqtt`
- **MQTT Topic:** `sports/relays/turf/command`
- **Linked Sport IDs:** `cricket` (`6ad6be011ee0aaebb67610aa`), `football` (`6ad6be1428611d721770eac4`)
- **Linked Resource ID:** `TRUF` (`6adfd230b968550380613b78`)
- **Automated Scheduling:** When users book the Turf via the mobile app or web, `iot-scheduler.service.js` automatically turns on CH1 & CH2 15 minutes before the slot starts and turns them off 15 minutes after.
