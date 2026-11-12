# 📱 Step 2: On-Site Hotspot Wi-Fi & Broker Configuration Guide

**Target Audience:** Field Technicians, Electricians, Arena Operations Staff  
**Tools Required:** Any Smartphone or Tablet (No computer or programming tools required!)  
**Target Device:** SmartElex 6-Channel ESP32-S3 Wi-Fi Relay Controller

---

## 📋 Overview

Once the board is powered on at the facility, it broadcasts its own setup Wi-Fi network (`amd_wifi_turf` or `amd_wifi`). You connect with your mobile phone, open your browser, enter the facility Wi-Fi password and broker details, test the lights with live buttons, and save.

```
 +------------------+           +----------------------+           +------------------+
 |  SmartElex Board |           |  Technician Phone    |           |  Facility Wi-Fi  |
 |                  |           |                      |           |      Router      |
 |  Broadcasts:     | ◀───────  |  Connects to:        |           |                  |
 |  amd_wifi_turf   |  Wi-Fi    |  amd_wifi_turf       |           |                  |
 |  (192.168.4.1)   |           |  Opens Browser       |           |                  |
 |                  |           |                      |           |                  |
 |  Relays Switch   | ◀───────  |  Tests CH1-CH6       |           |                  |
 |                  |           |                      |           |                  |
 |  Saves to Flash  | ◀───────  |  Clicks [Save]       | ────────▶ |  Connects to     |
 |  & Reboots       |           |                      |           |  Facility Wi-Fi  |
 +------------------+           +----------------------+           +------------------+
```

---

## 1. Power On the Board

- Connect the board to the facility **12V / 24V DC power supply** (via terminal block) or **5V USB-C**.
- On first boot (or after reset), the board's RGB LED will light up **Cyan/Yellow** and the buzzer will give **2 short beeps**.
- This indicates the configuration hotspot is active.

---

## 2. Connect Your Phone to the Hotspot

1. On your smartphone, open **Wi-Fi Settings**.
2. Scan for Wi-Fi networks and select:
   - For Turf (Cricket & Football): **`amd_wifi_turf`**
   - For Badminton: **`amd_wifi`**
3. **No password is required** (it is an open setup network).
4. *Phone Alert Note:* If your phone displays `"Wi-Fi has no internet access. Tap to stay connected"`, tap **Keep Connection** or **Stay Connected**.

---

## 3. Open the Setup Dashboard in Your Browser

1. If your phone opens a captive portal prompt (*"Sign in to network"*), tap it.
2. If not, open **Google Chrome** or **Safari** and type:
   ```http
   http://192.168.4.1
   ```
3. The dark-themed **SmartElex 6CH Controller** setup page will appear.

---

## 4. Fill in Facility & Broker Details

Review and fill out the fields on the form:

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

### Field Guide:

| Section | Field | What to Enter / Verify |
|:---|:---|:---|
| **1. Facility Wi-Fi** | **Select Detected Wi-Fi** | Choose the sports facility's **2.4 GHz Wi-Fi** from the dropdown list. *(If the router just booted, tap "Re-Scan Wi-Fi Networks"). Note: 5 GHz is not supported.* |
| | **Wi-Fi Password** | Type the facility Wi-Fi password. Check the **Show Password** box to avoid typos. |
| **2. Cloud Server** | **VPS Server IP** | Enter your backend server's public IP (e.g. `139.59.88.12`) or domain. *(Use `192.168.1.100` only for local testing).* |
| | **MQTT Port** | `1883` |
| | **Device Client ID** | Verify pre-filled: `smartelex_relay_turf` *(Turf)* or `smartelex_relay_badminton` *(Badminton)*. |
| | **Subscribe Topic** | Verify pre-filled: `sports/relays/turf/command` |
| | **Publish Topic** | Verify pre-filled: `sports/relays/turf/status` |

---

## 5. Live Relay Test (Before Leaving the Page)

Before saving, test that your physical relays and stadium contactors operate:
1. Scroll down to **"3. Live Hardware Relay Test"**.
2. Tap **`CH1`**: You should hear Relay 1 click on the board, its LED will light up, and the **Bank 1 Floodlights** will turn ON.
3. Tap **`CH2`**: Relay 2 clicks, and **Bank 2 Floodlights** turn ON.
4. Tap **`ALL ON`** and **`ALL OFF`** to verify full arena lighting.

---

## 6. Save & Reboot

1. Tap the blue button: **`💾 Save & Connect Device`**.
2. The browser displays:
   ```text
   ✔ Configuration Saved!
   Connecting to [Facility_2.4G_WiFi]...
   The amd_wifi hotspot will now turn off and the device will connect to your facility Wi-Fi and MQTT server.
   ```
3. The board will emit a **long confirmation beep** and reboot automatically.
4. The hotspot `amd_wifi_turf` will shut down.
5. Within 5–10 seconds, the board will connect to the facility Wi-Fi router and MQTT broker.

---

## 7. How to Verify It Is Working

Look at the **RGB LED (GPIO 38)** on the SmartElex board:
- 🟣 **Blinking Purple (5-10s):** Connecting to facility Wi-Fi.
- 🟢 **Solid Green (1.5 seconds):** **SUCCESS! Connected to Wi-Fi and MQTT Broker.** The board is fully operational and awaiting commands from the AMD Play mobile app and scheduler.
- 🔴 **Solid Red:** Failed to connect to Wi-Fi (wrong password or router out of range).

---

## 🔄 Emergency Reset & Recovery (On-Site)

### How to Re-Open the Hotspot if Wi-Fi Changes:
If the arena changes its Wi-Fi router or password later:
1. Locate the **BOOT button** on the SmartElex board (GPIO 0, next to the USB-C port).
2. **Press and hold the BOOT button for 3 seconds**.
3. The board will beep twice, light up Cyan, and immediately re-broadcast `amd_wifi_turf` at `http://192.168.4.1`.
4. Connect your phone and update the password.

### 30-Second Automatic Watchdog:
If the facility router loses power for **more than 30 seconds**, the board will automatically re-open `amd_wifi_turf` so you can reconfigure it without opening the electrical box!
