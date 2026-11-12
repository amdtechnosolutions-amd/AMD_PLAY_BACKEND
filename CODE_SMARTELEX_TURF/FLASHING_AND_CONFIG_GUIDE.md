# 🛠️ SmartElex 6CH Relay Controller — Flashing & Configuration Guide

**Complete On-Site & Workshop Manual for Field Technicians, Electricians, and Engineers**  
*Applicable Hardware: SmartElex Industrial 6-Channel ESP32-S3 Wi-Fi / MQTT Relay Board*

---

## 📋 Document Overview

This standalone guide provides step-by-step instructions to:
1. **Flash firmware** onto the SmartElex 6CH ESP32-S3 board using the Arduino IDE.
2. **Configure Wi-Fi & MQTT broker settings** using any smartphone or laptop via the on-board **Captive Portal Hotspot** (`amd_wifi_turf` or `amd_wifi`).
3. **Verify operation** with hardware LED indicators, buzzer codes, and the live relay test panel.
4. **Troubleshoot on-site issues** using the 3-second hardware recovery button and the 30-second automatic reconnection watchdog.

---

## 🧰 Required Equipment & Software

| Item | Requirement | Notes |
|:---|:---|:---|
| **Microcontroller Board** | SmartElex Industrial 6-Channel Relay Board | ESP32-S3 chipset onboard |
| **Power Supply** | 12V / 24V DC terminal block or 5V USB-C | Relays require 12V/24V for coils; USB-C powers logic |
| **Programming Cable** | USB Type-C Cable | **Must be a Data-Capable cable** (not a charge-only cable) |
| **Computer** | Windows 10/11, macOS, or Linux | With Arduino IDE 2.x installed |
| **Smartphone / Tablet** | Any Android or iOS device | Used for on-site Wi-Fi & broker configuration |
| **Facility Network** | **2.4 GHz Wi-Fi** network SSID & password | ⚠️ ESP32-S3 does **not** support 5 GHz Wi-Fi |
| **Cloud Broker IP** | Public IP or domain of your Cloud VPS | Default port: `1883` (e.g., `139.59.88.12` or `amdplayapi.amdtechno.in`) |

---

## ⚡ Quick Device Matrix (Turf vs Badminton)

Use the correct firmware directory and credentials based on the arena type:

| Parameter | 🏏 / ⚽ Device 3: Turf Arena (Cricket/Football) | 🏸 Device 2: Badminton Arena |
|:---|:---|:---|
| **Firmware Sketch** | `CODE_SMARTELEX_TURF/CODE_SMARTELEX_TURF.ino` | `CODE_SMARTELEX/MAIN_WIFI_MQTT_DEV2_BADMINTON.ino` |
| **Captive Portal SSID** | **`amd_wifi_turf`** | **`amd_wifi`** |
| **Device Client ID** | `smartelex_relay_turf` | `smartelex_relay_badminton` |
| **Subscribe Topic** | `sports/relays/turf/command` | `sports/relays/badminton/command` |
| **Publish Topic** | `sports/relays/turf/status` | `sports/relays/badminton/status` |
| **NVS Flash Space** | `amd_turf` | `amd_relay` |

> [!WARNING]
> **CRITICAL: NEVER ASSIGN DUPLICATE CLIENT IDs!**  
> If two boards share the same Client ID (e.g. both running as `smartelex_relay_turf`), the MQTT broker will continuously kick one board offline when the other connects, resulting in erratic relay switching.

---

# 🚀 Step 1: Open and Upload Firmware (Workshop Setup)

### 1.1 One-Time Arduino IDE Setup

If Arduino IDE is already configured with ESP32-S3 support, skip to [Section 1.2](#12-open-sketch--select-board-settings).

1. **Install Arduino IDE**: Download and install **Arduino IDE 2.x** from [arduino.cc](https://www.arduino.cc/en/software).
2. **Add ESP32 Board URL**:
   - Open Arduino IDE -> **File** -> **Preferences** (or `Ctrl + ,`).
   - In **Additional boards manager URLs**, add:
     ```text
     https://espressif.github.io/arduino-esp32/package_esp32_index.json
     ```
   - Click **OK**.
3. **Install ESP32 Package**:
   - Open **Tools** -> **Board** -> **Boards Manager...** (or click the board icon on the left sidebar).
   - Search for `esp32` by **Espressif Systems**.
   - Click **Install** (version `2.0.11` or higher recommended).
4. **Install Required Libraries**:
   - Open **Tools** -> **Manage Libraries...** (or `Ctrl + Shift + I`).
   - Search for and install:
     - **`PubSubClient`** by Nick O'Leary
     - **`ArduinoJson`** by Benoît Blanchon (version `6.21.x` recommended)

---

### 1.2 Open Sketch & Select Board Settings

1. Open Arduino IDE.
2. Open the appropriate sketch:
   - For Turf Arena: `File` -> `Open...` -> select **`CODE_SMARTELEX_TURF/CODE_SMARTELEX_TURF.ino`**.
   - For Badminton Arena: `File` -> `Open...` -> select **`CODE_SMARTELEX/MAIN_WIFI_MQTT_DEV2_BADMINTON.ino`**.
3. Connect the SmartElex board to your computer using a USB-C data cable.
4. In the **Tools** menu, configure the exact settings listed in the table below:

#### ⚙️ Arduino IDE Tools Configuration Table

| Menu Item | Required Setting | Why It Matters |
|:---|:---|:---|
| **Board** | **`ESP32S3 Dev Module`** | Matches the microcontroller hardware on the SmartElex 6CH board |
| **Port** | Select active COM Port (e.g., `COM3`, `COM5`, or `/dev/ttyACM0`) | Communication channel to the board |
| **USB CDC On Boot** | **`Enabled`** | **CRUCIAL**: Enables USB serial logging (`Serial.printf`). If Disabled, the Serial Monitor will remain blank. |
| **Flash Size** | **`4MB (32Mb)`** or **`8MB (64Mb)`** | Standard SmartElex ESP32-S3 flash size |
| **Partition Scheme** | **`Default 4MB with spiffs (1.2MB APP / 1.5MB SPIFFS)`** | Allocates room for application firmware, SPIFFS, and NVS preferences |
| **Upload Speed** | **`921600`** (or `115200` if cable fails) | Fast flashing speed |
| **USB Mode** | **`Hardware CDC and JTAG`** | Standard ESP32-S3 native USB mode |
| **USB Firmware MSC On Boot**| `Disabled` | Default |
| **USB DFU On Boot** | `Disabled` | Default |
| **PSRAM** | `Disabled` or `OPI PSRAM` | Standard operation |
| **Core Debug Level** | `None` or `Info` | Optional runtime debugging |

---

### 1.3 Upload Firmware to Board

1. Click the **Upload** button (the right arrow `➔` at the top left of Arduino IDE).
2. The IDE will compile the sketch and begin writing to flash memory:
   ```text
   Connecting....
   Chip is ESP32-S3 (revision v0.2)
   Features: WiFi, BLE
   Writing at 0x00010000... (100 %)
   Wrote 945120 bytes (612450 compressed) at 0x00010000 in 11.2 seconds...
   Hash of data verified.
   Leaving...
   Hard resetting via RTS pin...
   ```
3. **Manual Bootloader Recovery (If Upload Fails)**:  
   If the console displays `Connecting........_____.....` and times out:
   - Hold down the **BOOT button** (GPIO 0) on the SmartElex board.
   - Press and release the **RESET / EN button** once.
   - Release the **BOOT button**.
   - Click **Upload** again in Arduino IDE.

---

### 1.4 Verify Flash via Serial Monitor

1. Open **Tools** -> **Serial Monitor** (or `Ctrl + Shift + M`).
2. Set the baud rate to **`115200 baud`**.
3. Press the **RESET** button on the SmartElex board.
4. You should see the boot banner:
   ```text
   ==================================================
     SmartElex 6CH Relay Starting for TURF ARENA...
     Sport: Cricket & Football
   ==================================================
   No Wi-Fi credentials found in flash. Starting amd_wifi_turf portal...
   ==================================================
   ACTIVATING CONFIGURATION PORTAL (SSID: amd_wifi_turf)
   ==================================================
   Access Point broadcast: amd_wifi_turf (SUCCESS)
   Web Portal running at: http://192.168.4.1
   Web server active on port 80
   ```
5. The onboard RGB LED will light up **Cyan/Yellow** and the buzzer will give **2 quick beeps**. The board is now ready for on-site Wi-Fi configuration!

---

# 📱 Step 2: Configure Wi-Fi & Broker via Hotspot (Zero-Tool On-Site Setup)

Once flashed, **no laptop or programmer is needed on site**. The electrician or field technician can complete setup entirely using a smartphone or tablet.

```
+-----------------------------------------------------------------------------------+
|                           STEP 2 FIELD WORKFLOW                                   |
|                                                                                   |
|  [SmartElex Board]                                                                |
|         |                                                                         |
|         v (Broadcasts Wi-Fi)                                                      |
|   (( amd_wifi_turf ))                                                             |
|         ^                                                                         |
|         | (Connect via Phone/Laptop)                                              |
|  [Field Smartphone]                                                               |
|         |                                                                         |
|         v (Open Browser)                                                          |
|   http://192.168.4.1                                                              |
|         |                                                                         |
|         +---> 1. Select Facility 2.4GHz Wi-Fi + Password                          |
|         +---> 2. Verify VPS Broker IP (192.168.1.100 or Cloud VPS IP)             |
|         +---> 3. Verify Client ID: smartelex_relay_turf                           |
|         +---> 4. Verify Topics: sports/relays/turf/{command,status}               |
|         +---> 5. Test Relays with Live Buttons                                    |
|         +---> 6. Click [Save & Connect Device]                                    |
|         |                                                                         |
|         v (Reboots & Connects)                                                    |
|   [Facility Wi-Fi Router] <======> [Cloud MQTT Broker] <======> [AMD Play App]    |
+-----------------------------------------------------------------------------------+
```

---

### 2.1 Connect to the Device Hotspot

1. Power the SmartElex board using the facility 12V/24V power supply or USB-C.
2. On your smartphone or laptop, open **Wi-Fi Settings**.
3. Scan for nearby networks and tap:
   - **`amd_wifi_turf`** *(for Turf Cricket/Football)*, or
   - **`amd_wifi`** *(for Badminton)*
4. This is an open network — **no password is required** to connect.
5. If your phone displays a prompt saying *"Wi-Fi has no internet access. Tap to stay connected"*, tap **Stay Connected** or **Yes**.

---

### 2.2 Open the Web Configuration Portal

1. If your device has a captive portal popup (*"Sign in to network"*), tap it.
2. Otherwise, open Chrome, Safari, or any mobile browser and navigate to:
   ```http
   http://192.168.4.1
   ```
3. The dark-themed **SmartElex 6CH Controller** configuration dashboard will load.

---

### 2.3 Fill Out Configuration Form Fields

Verify and fill out the fields on the web page:

```
+-------------------------------------------------------------+
|               SmartElex 6CH Controller                      |
|      [Device 3: Turf Arena (Cricket & Football)]            |
|          Wi-Fi & Cloud Gateway Setup (amd_wifi_turf)        |
+-------------------------------------------------------------+
| 📶 1. Facility Wi-Fi Network                                |
| Select Detected Wi-Fi: [ Facility_2.4G_WiFi         ▼ ]     |
|                        [ 🔄 Re-Scan Wi-Fi Networks   ]     |
| Or Enter Hidden SSID:  [                             ]     |
| Wi-Fi Password:        [ •••••••••••••               ]     |
|                        [x] Show Password                    |
+-------------------------------------------------------------+
| ⚡ 2. Cloud VPS / MQTT Broker Server                         |
| VPS Server IP:         [ 139.59.88.12                ]     |
| MQTT Port:             [ 1883                        ]     |
| Device Client ID:      [ smartelex_relay_turf        ]     |
| MQTT Subscribe Topic:  [ sports/relays/turf/command  ]     |
| MQTT Publish Topic:    [ sports/relays/turf/status   ]     |
+-------------------------------------------------------------+
|                [ 💾 Save & Connect Device ]                 |
+-------------------------------------------------------------+
| 🔧 3. Live Hardware Relay Test                              |
|   [ CH1: OFF ] [ CH2: OFF ]                                 |
|   [ CH3: OFF ] [ CH4: OFF ]                                 |
|   [ CH5: OFF ] [ CH6: OFF ]                                 |
|   [ ALL ON   ] [ ALL OFF  ]                                 |
+-------------------------------------------------------------+
```

#### Detailed Field Explanation:

| Form Field | Recommended Value | Description |
|:---|:---|:---|
| **Select Detected Wi-Fi** | *Your facility SSID* | Choose the sports academy's **2.4 GHz** Wi-Fi from the dropdown. Tap **Re-Scan** if needed. |
| **Wi-Fi Password** | *Your facility password* | Academy Wi-Fi password. Check **"Show Password"** to avoid typos. |
| **VPS Server IP** | `139.59.88.12` or Public VPS IP | Public IP address or domain name of your backend MQTT broker. (Use `192.168.1.100` only for local offline LAN testing). |
| **MQTT Port** | `1883` | Standard unencrypted MQTT port. |
| **Device Client ID** | `smartelex_relay_turf` | Unique identifier on the MQTT broker. Must match the backend device code. |
| **Subscribe Topic** | `sports/relays/turf/command` | Backend publishes ON/OFF commands here. Board listens to this topic. |
| **Publish Topic** | `sports/relays/turf/status` | Board reports real-time relay state feedback here. |

---

### 2.4 Live Hardware Relay Test (Before Saving)

Before clicking Save, test that your relays, wiring, and contactor coils are functioning:
1. Scroll down to **"3. Live Hardware Relay Test"** on the webpage.
2. Tap **`CH1`**: You should hear a sharp click from Relay 1, the CH1 LED will illuminate, and Bank 1 floodlights should switch ON.
3. Tap **`CH2`**: Relay 2 clicks, Bank 2 floodlights switch ON.
4. Tap **`ALL ON`** / **`ALL OFF`** to verify full arena lighting control.
5. If relays switch reliably, your physical wiring and contactor coils are confirmed good!

---

### 2.5 Save & Reboot

1. Tap **`Save & Connect Device`**.
2. A green confirmation screen will appear:
   ```text
   ✔ Configuration Saved!
   Connecting to [Facility_2.4G_WiFi]...
   The amd_wifi hotspot will now turn off and the device will connect to your facility Wi-Fi and MQTT server.
   ```
3. The board will sound a confirmation beep, write the settings to non-volatile flash memory (NVS), and automatically reboot.
4. The hotspot `amd_wifi_turf` will shut down.
5. The board connects to your facility Wi-Fi and bridges to the Cloud VPS MQTT broker.

---

# 💡 Step 3: Hardware Diagnostics & Status Indicators

The technician can verify operational health immediately by observing the **RGB Status LED (GPIO 38)** and listening to the **on-board buzzer**:

### 3.1 RGB Status LED Reference Table

| LED Color & Behavior | Operating State | What It Means | Required Action |
|:---|:---|:---|:---|
| 🟣 **Blinking Purple** | Wi-Fi Connecting | Device is actively attempting to authenticate with the facility Wi-Fi router. | Wait 5–10 seconds. |
| 🟢 **Solid Green (1.5s)** | **Online & Operational** | **Wi-Fi is connected AND MQTT broker is connected.** Device is ready to receive commands from AMD Play! | None. Normal operational state. |
| 🔵 **Cyan / Yellow** | **Captive Portal Active** | Board is broadcasting `amd_wifi_*` hotspot waiting for technician setup. | Connect phone to hotspot at `http://192.168.4.1`. |
| 🔴 **Solid Red** | **Wi-Fi Disconnected** | Facility router is offline, out of range, or credentials were entered incorrectly. | Check router power. If down for >30s, portal relaunches automatically. |
| ⚪ **White Flash** | Command Processed | A valid MQTT packet was received and executed. | Normal operational feedback. |

---

### 3.2 Buzzer Audio Feedback

| Beep Pattern | Trigger Event | Meaning |
|:---|:---|:---|
| **1 Short Beep (100ms)** | Relay Toggle | Single channel switched ON or OFF |
| **2 Short Beeps (80ms each)** | Portal Launched | Device entered Captive Portal Mode (`amd_wifi_*`) |
| **1 Long Beep (300ms)** | All ON Executed | Full arena match lighting turned ON |
| **2 Double Beeps** | All OFF Executed | Full arena blackout turned OFF |
| **1 Mid Beep (200ms)** | Configuration Saved | Settings saved to NVS flash; rebooting |

---

# 🔄 Step 4: Maintenance & Field Recovery Procedures

### 4.1 Force Reconfigure (Wi-Fi Password Changed / Router Replaced)

If the sports facility changes its Wi-Fi router or password:
1. Locate the **BOOT button** on the SmartElex ESP32-S3 board (next to the USB-C port, connected to GPIO 0).
2. **Press and hold the BOOT button for 3 seconds**.
3. The board will emit **2 short beeps** and the LED will turn **Cyan**.
4. The board immediately opens the `amd_wifi_turf` hotspot at `http://192.168.4.1`.
5. Connect your phone and enter the new Wi-Fi credentials. Existing MQTT server details remain saved!

---

### 4.2 30-Second Automatic Watchdog Fallback

The SmartElex firmware has built-in connection resilience:
- If the facility Wi-Fi drops or the router is turned off, the board attempts reconnection and shows a **Red LED**.
- If the router does not return within **30 seconds**, the board **automatically re-launches the Captive Portal Hotspot** (`amd_wifi_turf`).
- This allows a technician to reconfigure a displaced device on-site **without touching the hardware button**.

---

### 4.3 Testing via MQTT Client (CLI / Backend Test)

You can verify end-to-end operation from your terminal or Cloud VPS using `mosquitto_pub` and `mosquitto_sub`:

#### 1. Subscribe to Status Topic (Listen for feedback):
```bash
mosquitto_sub -h 139.59.88.12 -p 1883 -t "sports/relays/turf/status" -v
```

#### 2. Turn ON Floodlights Bank 1 (CH1):
```bash
mosquitto_pub -h 139.59.88.12 -p 1883 -t "sports/relays/turf/command" -m '{"channel":1,"state":"ON"}'
```

#### 3. Turn ALL Turf Relays ON (Match Mode):
```bash
mosquitto_pub -h 139.59.88.12 -p 1883 -t "sports/relays/turf/command" -m '{"data":{"ALL":1}}'
```

#### 4. Turn ALL Turf Relays OFF (Blackout Mode):
```bash
mosquitto_pub -h 139.59.88.12 -p 1883 -t "sports/relays/turf/command" -m '{"data":{"ALL":0}}'
```

---

# ❓ Common Troubleshooting & FAQ

### Q1: The Arduino IDE Serial Monitor is completely empty after upload.
- **Cause**: `USB CDC On Boot` was set to `Disabled`.
- **Fix**: In Arduino IDE, go to **Tools** -> **USB CDC On Boot** -> select **`Enabled`**. Re-upload the sketch.

### Q2: Arduino IDE upload fails with "Timed out waiting for packet header".
- **Cause**: The ESP32-S3 USB bootloader didn't auto-reset.
- **Fix**: Hold the **BOOT** button, press and release **RESET (EN)**, release **BOOT**, then hit Upload again. Also verify your USB-C cable supports data transfer.

### Q3: My phone connected to `amd_wifi_turf`, but `http://192.168.4.1` won't open.
- **Cause**: Mobile data is interfering, or the phone switched away because there was no internet.
- **Fix**:
  1. Temporarily turn OFF **Mobile Data (4G/5G)** on your smartphone.
  2. Disconnect and reconnect to `amd_wifi_turf`.
  3. Manually type `http://192.168.4.1` into Chrome or Safari URL bar (include the `http://`).

### Q4: The board LED stays solid Red after saving Wi-Fi credentials.
- **Cause**:
  1. Entered wrong Wi-Fi password.
  2. Attempted to connect to a 5 GHz-only Wi-Fi band (ESP32-S3 supports **2.4 GHz only**).
  3. Facility router has MAC address filtering or client isolation enabled.
- **Fix**: Hold **BOOT** button for 3 seconds to re-open the portal and verify the Wi-Fi credentials.

### Q5: Can I wire 400W stadium floodlights directly to the relays?
- **NO! NEVER do this!** High-power LED floodlights draw massive inrush current (up to 50A peak) which will weld the onboard 10A relay contacts shut.
- Always wire the SmartElex relay to switch the coil of an **industrial AC contactor** (230V coil, rated 25A–40A), and run the floodlights through the contactor's main power poles.

---

## 📌 Summary Reference Sheet for On-Site Technicians

Print or screenshot this table for quick field reference:

```
+-----------------------------------------------------------------------------------------+
|                    SMARTELEX 6CH FIELD COMMISSIONING CHEAT SHEET                       |
+--------------------------+--------------------------------------------------------------+
| Hotspot SSID (Turf)      | amd_wifi_turf                                                |
| Hotspot SSID (Badminton) | amd_wifi                                                     |
| Portal URL               | http://192.168.4.1                                           |
| Supported Wi-Fi Band     | 2.4 GHz ONLY (802.11 b/g/n)                                  |
| Default MQTT Port        | 1883                                                         |
| Force Portal Reset       | Hold BOOT button for 3 seconds (2 beeps, Cyan LED)           |
| Auto Portal Fallback     | Disconnected from Wi-Fi for > 30 seconds                     |
| Normal Healthy LED       | Solid Green (1.5s) on boot, unlit during regular standby     |
| Fault LED                | Red = Router Disconnected; Cyan = Hotspot Active             |
+--------------------------+--------------------------------------------------------------+
```
