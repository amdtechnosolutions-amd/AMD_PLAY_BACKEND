#ifndef _WS_MQTT_H_
#define _WS_MQTT_H_

#include <ArduinoJson.h>
#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "WS_GPIO.h"
#include "WS_Information.h"


#define MSG_BUFFER_SIZE (50)
#define MQTT_Mode            3

extern bool Relay_Flag[6];       // Relay current status flag
extern void Relay_Analysis(uint8_t *buf,uint8_t Mode_Flag);


void callback(char* topic, byte* payload, unsigned int length);   // MQTT subscribes to callback functions for processing received messages
void setup_wifi();
void reconnect();                                                 // Reconnect to the MQTT server
void sendJsonData();                                              // Send data in JSON format to MQTT server
void MQTT_Init();
void MQTT_Loop();

#endif