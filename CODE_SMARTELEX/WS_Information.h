#ifndef _WS_INFORMATION_H_
#define _WS_INFORMATION_H_

#define Extension_Enable      0                   // 0: Standalone SmartElex 6CH
#define RTC_Enable            0                   // 0: Network time synchronization
#define Bluetooth_Enable      0                   // 0: Dedicated Wi-Fi performance (disables BLE radio conflict)

// =========================================================================
// DEVICE 2: BADMINTON ARENA (3 COURTS x 2 RELAYS = 6 RELAYS TOTAL)
// =========================================================================

// 1. Wi-Fi Access Point Details (Must be a 2.4 GHz Wi-Fi network)
#define STASSID       "YOUR_WIFI_SSID"            // <-- Put your 2.4 GHz Wi-Fi name here
#define STAPSK        "YOUR_WIFI_PASSWORD"        // <-- Put your Wi-Fi password here

// 2. MQTT Broker Details
#define MQTT_Server   "103.99.36.60"              // <-- Production Cloud VPS Broker IP (or amdplayapi.amdtechno.in)
#define MQTT_Port     1883

// 3. Unique Device 2 Identifiers for Badminton
#define MQTT_ID       "smartelex_relay_badminton"
#define MQTT_Pub      "sports/relays/badminton/status"
#define MQTT_Sub      "sports/relays/badminton/command"

// Relay Allocation on Device 2:
// CH1: Badminton Court 1 Floodlights
// CH2: Badminton Court 1 Exhaust Fan
// CH3: Badminton Court 2 Floodlights
// CH4: Badminton Court 2 Exhaust Fan
// CH5: Badminton Court 3 Floodlights
// CH6: Badminton Court 3 Exhaust Fan

#endif
