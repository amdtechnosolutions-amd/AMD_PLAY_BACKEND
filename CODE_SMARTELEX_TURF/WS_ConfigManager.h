#ifndef _WS_CONFIG_MANAGER_H_
#define _WS_CONFIG_MANAGER_H_

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include "WS_GPIO.h"
#include "WS_Information.h"

// Configuration storage container
struct DeviceConfig {
  String wifi_ssid;
  String wifi_pass;
  String mqtt_server;
  int mqtt_port;
  String mqtt_id;
  String mqtt_sub;
  String mqtt_pub;
};

extern DeviceConfig currentConfig;
extern bool isPortalActive;
extern WebServer server;
extern DNSServer dnsServer;

// Core functions
void Config_Init();
void Config_Loop();
void Config_StartPortal();
void Config_StopPortal();
void Config_StartWebServer();
void Config_Save(const DeviceConfig& cfg);
void Config_Load();
void Config_Reset();

#endif
