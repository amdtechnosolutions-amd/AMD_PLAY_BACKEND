#ifndef _WS_INFORMATION_H_
#define _WS_INFORMATION_H_

#define Extension_Enable      0                   // 0: Standalone SmartElex 6CH
#define RTC_Enable            0                   // 0: Network time synchronization
#define Bluetooth_Enable      0                   // 0: Dedicated Wi-Fi performance (disables BLE radio conflict)

// =========================================================================
// DEVICE 3: CRICKET & FOOTBALL TURF ARENA
// SmartElex Industrial 6-Channel ESP32-S3 Wi-Fi Relay Controller
// =========================================================================

// 1. Wi-Fi Access Point Details (Must be a 2.4 GHz Wi-Fi network)
#define STASSID       "YOUR_WIFI_SSID"            // <-- Facility 2.4 GHz Wi-Fi SSID
#define STAPSK        "YOUR_WIFI_PASSWORD"        // <-- Facility Wi-Fi password

// 2. Cloud VPS / MQTT Broker Details
#define MQTT_Server   "192.168.1.100"             // <-- Backend Cloud VPS / Broker IP
#define MQTT_Port     1883

// 3. Unique Device 3 Identifiers for Turf Arena
#define MQTT_ID       "smartelex_relay_turf"
#define MQTT_Pub      "sports/relays/turf/status"
#define MQTT_Sub      "sports/relays/turf/command"

#define NVS_NAMESPACE "amd_turf"
#define PORTAL_SSID   "amd_wifi_turf"

// 4. Relay Allocation on Turf Device:
// CH1: Turf Floodlights Bank 1 (North / West High-Mast LEDs via Contactor)
// CH2: Turf Floodlights Bank 2 (South / East High-Mast LEDs via Contactor)
// CH3: Pitch / Center Wicket Focus Lights (Crucial for Night Cricket)
// CH4: Batting Practice Nets / Goal Post Perimeter Lights
// CH5: Pavilion / Dugout / Seating Area Lights & Exhaust Fans
// CH6: Turf Gate Access Electric Lock / Timer Warning Siren

#endif
