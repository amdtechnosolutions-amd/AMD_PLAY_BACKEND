#include "WS_MQTT.h"
#include "WS_ConfigManager.h"

WiFiClient espClient;
PubSubClient client(espClient);

StaticJsonDocument<400> sendJson;
char msg[MSG_BUFFER_SIZE];
bool WIFI_Connection = 0;
char ipStr[16];

// MQTT subscribes to callback functions for processing received messages
void callback(char* topic, byte* payload, unsigned int length) {  
  String inputString;
  for (unsigned int i = 0; i < length; i++) {
    inputString += (char)payload[i];
  }
  printf("MQTT Message Received on [%s]: %s\r\n", topic, inputString.c_str());

  // 1. Try parsing with ArduinoJson
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, inputString);

  if (!error) {
    // Format A: {"data":{"CH1":1}}
    if (doc.containsKey("data")) {
      JsonObject dataObj = doc["data"];
      for (int ch = 1; ch <= 6; ch++) {
        String key = "CH" + String(ch);
        if (dataObj.containsKey(key)) {
          int val = dataObj[key];
          if (val == 1 && Relay_Flag[ch - 1] == 0) {
            uint8_t d[1] = { (uint8_t)(ch + 48) };
            Relay_Analysis(d, MQTT_Mode);
          } else if (val == 0 && Relay_Flag[ch - 1] == 1) {
            uint8_t d[1] = { (uint8_t)(ch + 48) };
            Relay_Analysis(d, MQTT_Mode);
          }
        }
      }
      if (dataObj.containsKey("ALL")) {
        int allVal = dataObj["ALL"];
        uint8_t d[1] = { (uint8_t)(allVal == 1 ? (7 + 48) : (8 + 48)) };
        Relay_Analysis(d, MQTT_Mode);
      }
      return;
    }

    // Format B: {"channel":1, "state":"ON"}
    if (doc.containsKey("channel") && doc.containsKey("state")) {
      int ch = doc["channel"];
      String st = doc["state"].as<String>();
      st.toUpperCase();
      int val = (st == "ON" || st == "1" || st == "TRUE") ? 1 : 0;
      if (ch >= 1 && ch <= 6) {
        if (val == 1 && Relay_Flag[ch - 1] == 0) {
          uint8_t d[1] = { (uint8_t)(ch + 48) };
          Relay_Analysis(d, MQTT_Mode);
        } else if (val == 0 && Relay_Flag[ch - 1] == 1) {
          uint8_t d[1] = { (uint8_t)(ch + 48) };
          Relay_Analysis(d, MQTT_Mode);
        }
      }
      return;
    }
  }

  // Fallback string matching
  int dataBegin = inputString.indexOf("\"data\"");
  if (dataBegin == -1) {
    printf("Non-JSON or unknown MQTT payload received.\r\n");
    return;
  }

  uint8_t CH_Flag = 0;
  int CH_Begin = -1;
  for (int ch = 1; ch <= 6; ch++) {
    String chKey = "\"CH" + String(ch) + "\"";
    if (inputString.indexOf(chKey, dataBegin) != -1) {
      CH_Flag = ch;
      CH_Begin = inputString.indexOf(chKey, dataBegin);
      break;
    }
  }
  if (CH_Flag == 0 && inputString.indexOf("\"ALL\"", dataBegin) != -1) {
    CH_Flag = 7;
    CH_Begin = inputString.indexOf("\"ALL\"", dataBegin);
  }

  if (CH_Flag != 0 && CH_Begin != -1) {
    int valueBegin = inputString.indexOf(':', CH_Begin);
    int valueEnd = inputString.indexOf('}', valueBegin);
    if (valueBegin != -1 && valueEnd != -1) {
      String ValueStr = inputString.substring(valueBegin + 1, valueEnd);
      int Value = ValueStr.toInt();
      if (CH_Flag <= 6) {
        if (Value == 1 && Relay_Flag[CH_Flag - 1] == 0) {
          uint8_t Data[1] = { (uint8_t)(CH_Flag + 48) };
          Relay_Analysis(Data, MQTT_Mode);
        } else if (Value == 0 && Relay_Flag[CH_Flag - 1] == 1) {
          uint8_t Data[1] = { (uint8_t)(CH_Flag + 48) };
          Relay_Analysis(Data, MQTT_Mode);
        }
      } else if (CH_Flag == 7) {
        uint8_t Data[1] = { (uint8_t)(Value == 1 ? (7 + 48) : (8 + 48)) };
        Relay_Analysis(Data, MQTT_Mode);
      }
    }
  }
}

void setup_wifi() {
  if (currentConfig.wifi_ssid.length() == 0) {
    printf("No Wi-Fi credentials saved. Launching %s portal...\r\n", PORTAL_SSID);
    Config_StartPortal();
    return;
  }

  uint8_t count = 0;
  printf("Connecting to Wi-Fi SSID: %s\r\n", currentConfig.wifi_ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(currentConfig.wifi_ssid.c_str(), currentConfig.wifi_pass.c_str());

  while (WiFi.status() != WL_CONNECTED) {
    count++;
    delay(500);
    printf(".");

    if (count % 2 == 0 && count != 0) {
      RGB_Light(40, 0, 40); // Purple blink while connecting
      delay(200);
      RGB_Light(0, 0, 0);
    }

    if (count > 25) { // Failed after ~13 seconds
      printf("\r\nERROR: Wi-Fi connection failed! Launching %s portal for reconfiguration...\r\n", PORTAL_SSID);
      WIFI_Connection = 0;
      Config_StartPortal();
      return;
    }
  }

  WIFI_Connection = 1;
  IPAddress myIP = WiFi.localIP();
  sprintf(ipStr, "%d.%d.%d.%d", myIP[0], myIP[1], myIP[2], myIP[3]);
  printf("\r\n==================================================\r\n");
  printf("Wi-Fi Connected! Local IP: %s\r\n", ipStr);
  printf("Open Web Settings in Browser at: http://%s\r\n", ipStr);
  printf("==================================================\r\n");

  Config_StartWebServer();

  // Solid green LED for 1.5 seconds
  RGB_Light(0, 60, 0);
  delay(1500);
  RGB_Update_FromRelay();
}

static unsigned long lastMqttAttempt = 0;

void reconnect() {
  if (isPortalActive || WiFi.status() != WL_CONNECTED) return;
  if (client.connected()) return;

  unsigned long now = millis();
  if (now - lastMqttAttempt < 4000) return; // Non-blocking check every 4 seconds
  lastMqttAttempt = now;

  printf("Connecting to MQTT Broker [%s:%d] with Client ID [%s]...\r\n", 
         currentConfig.mqtt_server.c_str(), currentConfig.mqtt_port, currentConfig.mqtt_id.c_str());

  if (client.connect(currentConfig.mqtt_id.c_str())) {
    printf("MQTT Broker connection SUCCESSFUL!\r\n");
    client.subscribe(currentConfig.mqtt_sub.c_str());
    printf("Subscribed to command topic: %s\r\n", currentConfig.mqtt_sub.c_str());
    RGB_Light(0, 60, 0); // Solid green
    delay(500);
    RGB_Update_FromRelay();
  } else {
    printf("MQTT connection failed, rc=%d. Retrying in 4 seconds...\r\n", client.state());
    RGB_Light(60, 0, 60); // Purple flash
    delay(80);
    RGB_Light(0, 0, 0);
  }
}

void sendJsonData() {
  if (!client.connected()) return;
  sendJson["ID"] = currentConfig.mqtt_id;
  for (int i = 0; i < 6; i++) {
    sendJson["CH" + String(i + 1)] = Relay_Flag[i] ? 1 : 0;
  }
  String pubres;
  serializeJson(sendJson, pubres);
  client.publish(currentConfig.mqtt_pub.c_str(), pubres.c_str());
}

void MQTT_Init() {
  setup_wifi();
  if (WIFI_Connection == 1) {
    client.setServer(currentConfig.mqtt_server.c_str(), currentConfig.mqtt_port);
    client.setCallback(callback);
  }
}

void MQTT_Loop() {
  if (isPortalActive) return; // Do not run MQTT while captive portal is active

  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      reconnect();
    }
    client.loop();
  }
}
