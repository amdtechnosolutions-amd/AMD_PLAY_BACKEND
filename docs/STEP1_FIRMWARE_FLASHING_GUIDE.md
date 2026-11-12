# 🛠️ Step 1: SmartElex Firmware Flashing Guide (Arduino IDE)

**Target Audience:** Hardware Engineers, Workshop Technicians, Developers  
**Target Hardware:** SmartElex 6-Channel Industrial ESP32-S3 Relay Board  
**Target Firmware:** [CODE_SMARTELEX_TURF.ino](file:///home/amdtechno/projects/amd_play/backend/CODE_SMARTELEX_TURF/CODE_SMARTELEX_TURF.ino) (Turf) / [MAIN_WIFI_MQTT_DEV2_BADMINTON.ino](file:///home/amdtechno/projects/amd_play/backend/CODE_SMARTELEX/MAIN_WIFI_MQTT_DEV2_BADMINTON.ino) (Badminton)

---

## 📋 Requirements Before Starting

- [x] Computer with **Arduino IDE 2.x** installed.
- [x] **Data-Capable USB Type-C Cable** (do not use a charge-only cable).
- [x] SmartElex 6CH Board.

---

## 1. Arduino IDE Setup (One-Time Setup)

### A. Add ESP32 Board URL
1. Open Arduino IDE.
2. Go to **File** -> **Preferences** (or `Ctrl + ,`).
3. Paste the following URL into **Additional boards manager URLs**:
   ```text
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
4. Click **OK**.

### B. Install ESP32 Board Core
1. Click the **Boards Manager** icon on the left sidebar (or **Tools** -> **Board** -> **Boards Manager...**).
2. Type `esp32` in the search box.
3. Install **`esp32` by Espressif Systems** (version `2.0.11` or higher).

### C. Install Required Libraries
1. Click the **Library Manager** icon on the left sidebar (or **Tools** -> **Manage Libraries...**).
2. Search and install:
   - **`PubSubClient`** by Nick O'Leary
   - **`ArduinoJson`** by Benoît Blanchon (version `6.21.x`)

---

## 2. Open the Firmware Sketch

In Arduino IDE:
1. Go to **File** -> **Open...**
2. Browse to:
   - **Turf Arena (Cricket & Football):**
     `CODE_SMARTELEX_TURF/CODE_SMARTELEX_TURF.ino`
   - **Badminton Arena:**
     `CODE_SMARTELEX/MAIN_WIFI_MQTT_DEV2_BADMINTON.ino`

---

## 3. Configure Board Options in Arduino IDE

Go to the **Tools** menu and select the exact settings below:

| Setting | Selection | Critical Reason |
|:---|:---|:---|
| **Board** | **`ESP32S3 Dev Module`** | Matches board microcontroller |
| **Port** | Select active COM Port (`COM3`, `COM5`, `/dev/ttyACM0`) | USB connection to board |
| **USB CDC On Boot** | **`Enabled`** | **CRITICAL: Must be Enabled** or Serial Monitor will show no logs |
| **Flash Size** | **`4MB (32Mb)`** or **`8MB (64Mb)`** | Standard board flash size |
| **Partition Scheme** | **`Default 4MB with spiffs (1.2MB APP / 1.5MB SPIFFS)`** | Allocates storage for code + NVS settings |
| **Upload Speed** | **`921600`** (or `115200` if connection is unstable) | Flashing baud rate |
| **USB Mode** | **`Hardware CDC and JTAG`** | Native ESP32-S3 USB mode |
| **PSRAM** | `Disabled` or `OPI PSRAM` | Standard |
| **Core Debug Level** | `None` | Keeps serial output clean |

---

## 4. Connect & Upload

1. Plug the USB-C cable into the SmartElex board and your computer.
2. Select the detected port under **Tools** -> **Port**.
3. Click the **Upload** button (`➔` arrow icon in the top toolbar).
4. Wait for compilation and flashing:
   ```text
   Connecting....
   Chip is ESP32-S3 (revision v0.2)
   Writing at 0x00010000... (100 %)
   Hash of data verified.
   Leaving...
   Hard resetting via RTS pin...
   ```

> [!TIP]
> **What to do if upload shows "Connecting........_____....." and fails?**  
> 1. Press and **hold the BOOT button** (GPIO 0) on the SmartElex board.  
> 2. Press and release the **RESET (EN) button** once.  
> 3. Release the **BOOT button**.  
> 4. Click **Upload** again in Arduino IDE.

---

## 5. Verify Successful Flashing

1. Open **Tools** -> **Serial Monitor** (or `Ctrl + Shift + M`).
2. Set baud rate to **`115200 baud`**.
3. Press the **RESET** button on the SmartElex board.
4. You should see the boot log:
   ```text
   ==================================================
     SmartElex 6CH Relay Starting for TURF ARENA...
     Sport: Cricket & Football
   ==================================================
   No Wi-Fi credentials found in flash. Starting amd_wifi_turf portal...
   Access Point broadcast: amd_wifi_turf (SUCCESS)
   Web Portal running at: http://192.168.4.1
   ```
5. On the board:
   - Onboard RGB LED lights up **Cyan/Yellow**.
   - Buzzer emits **2 short beeps**.

**Flashing is complete!** The board is now ready to be deployed on site and configured using the [Hotspot Configuration Guide](file:///home/amdtechno/projects/amd_play/backend/docs/STEP2_HOTSPOT_CONFIG_GUIDE.md).
