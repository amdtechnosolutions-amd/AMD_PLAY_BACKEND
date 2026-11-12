# 📘 SmartElex 6CH IoT Relay Integration Guide & Master Blueprint

> **A Complete Engineering Manual & Standard Operating Procedure (SOP)**  
> How to replicate, customize, flash, wire, and register SmartElex 6-Channel ESP32-S3 Relay Controllers for **any new sport, court, turf, arena, or facility zone** across the AMD Play SaaS platform.

---

## 1. System Architecture & How It Works

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                            AMD PLAY CLOUD VPS BACKEND                       │
  │                                                                             │
  │  [Court Booking Created]  ──▶  [IoT Scheduler Service]                      │
  │  (App / Web / Reception)       (Evaluates 15m Grace In / Out Buffer)        │
  │                                           │                                 │
  │                                           ▼                                 │
  │                                [Embedded MQTT Broker]                       │
  │                                (Mosquitto Port 1883)                        │
  └───────────────────────────────────────┬─────────────────────────────────────┘
                                          │
            ┌─────────────────────────────┴─────────────────────────────┐
            │ MQTT Command Topics (Publish JSON Commands)               │
            │                                                           │
            ▼                                                           ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│       DEVICE 2: BADMINTON     │           │         DEVICE 3: TURF        │
│ SmartElex 6CH (ESP32-S3)      │           │ SmartElex 6CH (ESP32-S3)      │
│ Client ID: smartelex_badminton│           │ Client ID: smartelex_turf     │
│ Topic: sports/relays/badminton│           │ Topic: sports/relays/turf     │
│ Hotspot: amd_wifi             │           │ Hotspot: amd_wifi_turf        │
└───────────────┬───────────────┘           └───────────────┬───────────────┘
                │                                           │
  ┌─────────────┴─────────────┐               ┌─────────────┴─────────────┐
  │ CH1: Court 1 Light        │               │ CH1: Floodlights Bank 1   │
  │ CH2: Court 1 Fan          │               │ CH2: Floodlights Bank 2   │
  │ CH3: Court 2 Light        │               │ CH3: Pitch Wicket Light   │
  │ CH4: Court 2 Fan          │               │ CH4: Practice Nets Light  │
  │ CH5: Court 3 Light        │               │ CH5: Pavilion / Dugout    │
  │ CH6: Court 3 Fan          │               │ CH6: Gate Lock / Siren    │
  └───────────────────────────┘               └───────────────────────────┘
```

---

## 2. The 3-Minute Replication Recipe (Summary)

To add another hardware device for **ANY new sport** (e.g. Pickleball, Tennis, Swimming Pool, Basketball, Gym):

1. **Copy the Template Folder**:
   ```bash
   cp -r /home/amdtechno/projects/amd_play/backend/CODE_SMARTELEX_TURF /home/amdtechno/projects/amd_play/backend/CODE_SMARTELEX_<SPORT_NAME>
   ```
2. **Edit the 5 Sacred Variables in `WS_Information.h`**:
   - `MQTT_ID` (unique client id)
   - `MQTT_Sub` (unique command topic)
   - `MQTT_Pub` (unique status topic)
   - `NVS_NAMESPACE` (unique flash namespace)
   - `PORTAL_SSID` (unique captive portal hotspot)
3. **Flash the Board via Arduino IDE**.
4. **Connect to `amd_wifi_<sport_name>` on phone & configure facility Wi-Fi** (`http://192.168.4.1`).
5. **Register Device in Admin Panel & Map Court Resource ID**.

---

## 3. The 5 Sacred Variables (`WS_Information.h`)

Every SmartElex device connects to the **same central MQTT broker**, so **two devices must NEVER share the same Client ID or Command Topic**.

In your new folder, open `WS_Information.h`:

```c
// =========================================================================
// CUSTOMIZE THESE 5 PARAMETERS FOR YOUR NEW SPORT / ARENA
// =========================================================================

// 1. Unique MQTT Client ID (Must be completely unique across the facility!)
#define MQTT_ID       "smartelex_relay_<SPORT_NAME>"

// 2. Unique MQTT Command Topic (Backend publishes commands here)
#define MQTT_Sub      "sports/relays/<SPORT_NAME>/command"

// 3. Unique MQTT Telemetry Topic (Device reports its state here)
#define MQTT_Pub      "sports/relays/<SPORT_NAME>/status"

// 4. Unique NVS Flash Namespace (Max 15 characters, alphanumeric)
#define NVS_NAMESPACE "amd_<SPORT>"

// 5. Unique Captive Portal Hotspot SSID (Broadcast when Wi-Fi is missing)
#define PORTAL_SSID   "amd_wifi_<SPORT>"
```

### Why These 5 Matter
- **`MQTT_ID` Collision Risk**: In the MQTT standard, if Device B connects with the same Client ID as Device A, the broker **immediately kicks off Device A**. If both boards share an ID, they will enter a violent, permanent disconnect/reconnect loop.
- **`MQTT_Sub` Crosstalk Risk**: If Device B listens to Device A's topic, switching Court 1 lights in Badminton will simultaneously turn on the lights in your Turf or Pickleball court!

---

## 4. Multi-Sport Configuration Reference Matrix

Use this cheat sheet when adding upcoming sports or facility zones:

| Sport / Area | Recommended Folder | `MQTT_ID` | `MQTT_Sub` | `MQTT_Pub` | `NVS_NAMESPACE` | `PORTAL_SSID` |
|:---|:---|:---|:---|:---|:---|:---|
| **Badminton** (Existing) | `CODE_SMARTELEX/` | `smartelex_relay_badminton` | `sports/relays/badminton/command` | `sports/relays/badminton/status` | `amd_relay` | `amd_wifi` |
| **Turf (Cricket / Football)** | `CODE_SMARTELEX_TURF/` | `smartelex_relay_turf` | `sports/relays/turf/command` | `sports/relays/turf/status` | `amd_turf` | `amd_wifi_turf` |
| **Pickleball** | `CODE_SMARTELEX_PICKLEBALL/` | `smartelex_relay_pickleball` | `sports/relays/pickleball/command` | `sports/relays/pickleball/status` | `amd_pickle` | `amd_wifi_pickle` |
| **Tennis** | `CODE_SMARTELEX_TENNIS/` | `smartelex_relay_tennis` | `sports/relays/tennis/command` | `sports/relays/tennis/status` | `amd_tennis` | `amd_wifi_tennis` |
| **Basketball** | `CODE_SMARTELEX_BASKETBALL/` | `smartelex_relay_basketball` | `sports/relays/basketball/command` | `sports/relays/basketball/status` | `amd_basket` | `amd_wifi_basket` |
| **Swimming Pool** | `CODE_SMARTELEX_POOL/` | `smartelex_relay_pool` | `sports/relays/pool/command` | `sports/relays/pool/status` | `amd_pool` | `amd_wifi_pool` |
| **Facility Main Gates / Entry** | `CODE_SMARTELEX_GATES/` | `smartelex_relay_gates` | `sports/relays/gates/command` | `sports/relays/gates/status` | `amd_gates` | `amd_wifi_gates` |

---

## 5. Relay Channel Allocation Strategies

Depending on the sport, choose one of these 3 standard electrical patterns:

### Pattern A: Multi-Court Shared Controller (e.g. Badminton, Pickleball, Squash)
*1 Controller serves 3 separate courts (2 relays per court = Light + Fan).*
- **CH1**: Court 1 Floodlights
- **CH2**: Court 1 Exhaust Fan
- **CH3**: Court 2 Floodlights
- **CH4**: Court 2 Exhaust Fan
- **CH5**: Court 3 Floodlights
- **CH6**: Court 3 Exhaust Fan

### Pattern B: Single Large Arena / Turf Controller (e.g. Cricket, Football, Tennis)
*1 Controller serves 1 large arena split into lighting zones, nets, and gate access.*
- **CH1**: Arena Floodlights Bank 1 (North / West side high-mast LEDs via AC Contactor)
- **CH2**: Arena Floodlights Bank 2 (South / East side high-mast LEDs via AC Contactor)
- **CH3**: Center Pitch / Goal Focus Lighting
- **CH4**: Practice Nets / Perimeter Lighting
- **CH5**: Pavilion / Dugout / Seating Area Lights & Fans
- **CH6**: 12V Electric Gate Strike / Access Siren / Warning Beacon

### Pattern C: Dual Light Banks per Court (e.g. Premium Badminton / Tennis)
*1 Controller serves 2 courts with independent Row 1 and Row 2 lighting.*
- **CH1**: Court 1 Row 1 Lights
- **CH2**: Court 1 Row 2 Lights
- **CH3**: Court 1 Fan
- **CH4**: Court 2 Row 1 Lights
- **CH5**: Court 2 Row 2 Lights
- **CH6**: Court 2 Fan

---

## 6. Electrical Wiring & AC Contactor Safety

> [!CAUTION]
> **HIGH INRUSH CURRENT WARNING**:  
> High-power LED floodlights (150W–400W each) have severe capacitor inrush currents (up to 50A peak for a few milliseconds).  
> **NEVER connect high-power floodlights directly through the PCB onboard 10A relays!**  
> Direct connection will weld the relay contacts shut within a few days.

### Safe Contactor Wiring Diagram:
```
  [SmartElex Board]                  [230V AC Industrial Contactor]             [High-Mast Floodlights]
  COM ──▶ Phase 230V AC                        Coil (A1) ◀── Relay NO
  NO  ───────────────────────────────────────── Coil (A2) ◀── Neutral
                                               Main L1   ──▶ 230V Phase ──▶ [LED Floodlight L]
                                               Main T1   ──▶ To Lamps   ──▶ [LED Floodlight N]
```
- SmartElex Relay only switches the **contactor coil** (draws less than 0.1A).
- The heavy-duty contactor switches the 30A/40A lighting bank.

---

## 7. Flashing with Arduino IDE

### Board Manager & Settings
1. Install **ESP32 by Espressif Systems** in Arduino IDE Board Manager (`v2.0.x` or `v3.x`).
2. Tools Menu Configuration:
   - **Board**: `ESP32S3 Dev Module`
   - **Upload Speed**: `921600`
   - **USB Mode**: `Hardware CDC and JTAG`
   - **USB CDC On Boot**: `Enabled` (Crucial for `Serial.printf` output)
   - **Flash Size**: `4MB (32Mb)` or `8MB (64Mb)`
   - **Partition Scheme**: `Default 4MB with spiffs (1.2MB APP / 1.5MB SPIFFS)`
   - **PSRAM**: `OPI PSRAM` (or Disabled if standard)
3. Required Libraries (Install via Library Manager):
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` (v6.21.x recommended)
4. Open the `.ino` sketch file and hit **Upload**.

---

## 8. On-Site Captive Portal Commissioning (Zero-Tool Setup)

Once flashed and powered on site, **no laptop or programmer is required**:

1. **Automatic Hotspot on First Boot**:
   - Because no Wi-Fi credentials are stored yet, the board starts an open Wi-Fi network:
     `amd_wifi_<sport_name>`
2. **Connect**:
   - Connect to this Wi-Fi on any smartphone or tablet.
   - The phone will prompt *"Sign in to Wi-Fi network"*, or manually browse to:
     **`http://192.168.4.1`**
3. **Configure**:
   - **Facility Wi-Fi**: Select detected 2.4 GHz network & type password.
   - **MQTT Server**: Enter your Cloud VPS public IP (e.g. `139.59.88.12` or `amdplayapi.amdtechno.in`).
   - **MQTT Port**: `1883`
   - Verify `Device Client ID`, `Subscribe Topic`, and `Publish Topic`.
   - Test individual relays using the live buttons on the portal page.
4. **Save**:
   - Click **"Save & Connect Device"**.
   - The ESP32 writes configuration to NVS flash, shuts down the hotspot, and connects to the facility Wi-Fi and MQTT server.

### Hardware Recovery Button:
- If Wi-Fi password changes or router is replaced:  
  **Press and hold the `BOOT` button on the ESP32-S3 for 3 seconds.**  
  The device will beep twice, flash cyan, and re-launch `amd_wifi_<sport_name>` at `192.168.4.1`.

### RGB Status LED Codes (GPIO 38):
- 🟣 **Blinking Purple**: Attempting to connect to facility Wi-Fi router.
- 🟢 **Solid Green (1.5s)**: Wi-Fi & MQTT successfully connected. Ready for commands.
- 🔴 **Solid Red**: Wi-Fi disconnected for > 30 seconds.
- 🔵 **Cyan / Yellow**: Captive Portal (`amd_wifi_*`) is active.

---

## 9. Registering the Device in Backend & Admin Panel

### Step A: Register the New IoT Device in AMD Play
Send a `POST` request to `/api/v1/iot/devices` (or use Admin Panel under **IoT & Hardware Devices**):

- **Method:** `POST`
- **URL:** `https://www.amdplayapi.amdtechno.in/api/v1/iot/devices`
- **Headers:**
  ```http
  Authorization: Bearer <ADMIN_TOKEN>
  Content-Type: application/json
  ```
- **Payload:**
  ```json
  {
    "branchId": "6ad6bd7fd33a91a36c41ff46",
    "name": "Turf Arena SmartElex 6CH (Cricket / Football)",
    "code": "DEV-SMARTELEX-TURF",
    "type": "relay",
    "protocol": "mqtt",
    "sportIds": [
      "6ad6be011ee0aaebb67610aa",
      "6ad6be1428611d721770eac4"
    ],
    "resourceId": "6adfd230b968550380613b78",
    "mqttTopic": "sports/relays/turf/command",
    "ipAddress": "192.168.1.50",
    "port": 80,
    "relayChannels": [
      { "channelNumber": 1, "target": "light", "state": "off", "label": "Turf Floodlights Bank 1" },
      { "channelNumber": 2, "target": "light", "state": "off", "label": "Turf Floodlights Bank 2" },
      { "channelNumber": 3, "target": "light", "state": "off", "label": "Center Pitch Lights" },
      { "channelNumber": 4, "target": "light", "state": "off", "label": "Practice Nets Lights" },
      { "channelNumber": 5, "target": "light", "state": "off", "label": "Pavilion / Dugout" },
      { "channelNumber": 6, "target": "lock",  "state": "off", "label": "Turf Gate Access Lock" }
    ]
  }
  ```

---

### Step B: Link the Court / Resource to the Device (`iotMapping`)
Link the Court/Turf resource document to the newly created device ID:

- **Method:** `PATCH`
- **URL:** `https://www.amdplayapi.amdtechno.in/api/v1/resources/:resourceId`
- **Payload:**
  ```json
  {
    "iotMapping": {
      "deviceId": "DEVICE_ID_FROM_STEP_A",
      "lightRelayChannel": 1,
      "lightRelayChannel2": 2,
      "dualLights": true,
      "lightRelayChannels": [1, 2],
      "fanRelayChannel": 5
    }
  }
  ```

### How the Automated Scheduler Uses This:
When a customer books this court/turf:
1. **15 Minutes Before Start Time**: `iot-scheduler.service.js` automatically queries `resource.iotMapping` and publishes:
   - `{"channel": 1, "state": "ON"}`
   - `{"channel": 2, "state": "ON"}`
   to `sports/relays/turf/command`.
2. **15 Minutes After Slot End**: It automatically publishes `{"channel": 1, "state": "OFF"}` and `{"channel": 2, "state": "OFF"}`.
3. **Manual Overrides**: Front desk staff can override anytime via the Admin Panel switch or manual API.

---

## 10. Manual Testing & MQTT Command Verification

You can test any SmartElex relay directly from the command line using `mosquitto_pub` or curl:

### Test Single Channel ON:
```bash
mosquitto_pub -h localhost -p 1883 -t "sports/relays/turf/command" -m '{"channel":1,"state":"ON"}'
```

### Test Single Channel OFF:
```bash
mosquitto_pub -h localhost -p 1883 -t "sports/relays/turf/command" -m '{"channel":1,"state":"OFF"}'
```

### Test Turn ALL Relays ON:
```bash
mosquitto_pub -h localhost -p 1883 -t "sports/relays/turf/command" -m '{"data":{"ALL":1}}'
```

### Test Turn ALL Relays OFF:
```bash
mosquitto_pub -h localhost -p 1883 -t "sports/relays/turf/command" -m '{"data":{"ALL":0}}'
```

### Monitor Live Device State Feedback:
```bash
mosquitto_sub -h localhost -p 1883 -t "sports/relays/turf/status" -v
```
*(The device will output: `{"ID":"smartelex_relay_turf","CH1":1,"CH2":0,"CH3":0,"CH4":0,"CH5":0,"CH6":0}`)*

---

## 11. Troubleshooting Checklist

| Issue | Root Cause | Solution |
|:---|:---|:---|
| Device keeps disconnecting & reconnecting every 5 seconds | Duplicate `MQTT_ID` on broker | Change `MQTT_ID` in `WS_Information.h` or via `http://192.168.4.1` to a unique name. |
| Relay clicks, but floodlights don't turn on | AC Contactor wiring or missing 230V coil supply | Verify 230V phase reaches SmartElex `COM` and contactor coil `A1` is wired to SmartElex `NO`. Check contactor breaker. |
| Board does not show `amd_wifi_*` hotspot | Wi-Fi credentials already saved in NVS | Press and hold the `BOOT` button for 3 seconds to force-launch the hotspot. |
| Phone disconnects from `amd_wifi_*` | Phone operating system drops Wi-Fi without internet | Disable mobile data on your phone while configuring, or select *"Stay connected without internet"*. |
| Lights don't turn on automatically on booking | `resource.iotMapping.deviceId` is missing or wrong channel | Check `PATCH /api/v1/resources/:id` and ensure `deviceId` points to the registered device. |
| Relay turns ON for wrong court | Topic subscription mismatch | Verify backend `device.mqttTopic` matches `MQTT_Sub` defined in firmware. |

---

*Authored for AMD Sports SaaS Platform — Hardware & IoT Engineering Standard*
