# 🏟️ How to Add a New SmartElex IoT Device for Any Sport / Arena

**Target Audience:** System Architects, Developers, Operations Engineers  
**Purpose:** Replicating the SmartElex 6CH Relay firmware and backend configuration for any new sport (e.g. Tennis, Swimming Pool, Basketball, Squash, Court 2/3, etc.).

---

## 📋 The 3-Layer Device Architecture

Every IoT relay controller in the AMD Play platform requires three unique parameters:
1. **Unique MQTT Client ID** (e.g., `smartelex_relay_<sport>`)
2. **Unique Command & Status Topics** (e.g., `sports/relays/<sport>/command`)
3. **Unique Hotspot SSID & NVS Namespace** (e.g., `amd_wifi_<sport>`, `amd_<sport>`)

---

## Step 1: Duplicate the Firmware Directory

In your terminal or workspace:

```bash
# Example: Adding a Tennis Court Controller
cp -r CODE_SMARTELEX CODE_SMARTELEX_TENNIS
cd CODE_SMARTELEX_TENNIS
mv MAIN_WIFI_MQTT_DEV2_BADMINTON.ino CODE_SMARTELEX_TENNIS.ino
```

---

## Step 2: Update `WS_Information.h` (5 Lines Only!)

Open `CODE_SMARTELEX_<SPORT>/WS_Information.h` and edit lines 17–28:

```cpp
// =========================================================================
// DEVICE: TENNIS COURT ARENA (Example)
// =========================================================================

// 1. Unique Device Identifiers for New Sport
#define MQTT_ID       "smartelex_relay_tennis"           // Must be unique!
#define MQTT_Pub      "sports/relays/tennis/status"      // Status topic
#define MQTT_Sub      "sports/relays/tennis/command"     // Command topic

// 2. Hotspot & Flash Namespace
#define NVS_NAMESPACE "amd_tennis"                      // Max 15 chars
#define PORTAL_SSID   "amd_wifi_tennis"                 // Hotspot Wi-Fi name
```

---

## Step 3: Register Device in AMD Play Backend

Open MongoDB / Backend Admin Panel and insert the device record in the `devices` collection:

```json
{
  "name": "Tennis Arena SmartElex 6CH Relay",
  "code": "DEV-SMARTELEX-TENNIS",
  "type": "relay",
  "protocol": "mqtt",
  "status": "online",
  "mqttTopic": "sports/relays/tennis/command",
  "statusTopic": "sports/relays/tennis/status",
  "channels": [
    { "channel": 1, "name": "Court 1 Floodlights", "gpio": 1 },
    { "channel": 2, "name": "Court 2 Floodlights", "gpio": 2 },
    { "channel": 3, "name": "Clubhouse Lights", "gpio": 41 },
    { "channel": 4, "name": "Court Sprinklers", "gpio": 42 },
    { "channel": 5, "name": "Exhaust Fans", "gpio": 45 },
    { "channel": 6, "name": "Access Turnstile", "gpio": 46 }
  ],
  "sports": ["tennis"],
  "branchId": "6ae101a9185e913f71898111"
}
```

---

## Step 4: Flash & Commission

1. Follow [Step 1: Firmware Flashing Guide](file:///home/amdtechno/projects/amd_play/backend/docs/STEP1_FIRMWARE_FLASHING_GUIDE.md) to flash the new sketch to the board.
2. Follow [Step 2: Hotspot Configuration Guide](file:///home/amdtechno/projects/amd_play/backend/docs/STEP2_HOTSPOT_CONFIG_GUIDE.md) on site using your smartphone.
