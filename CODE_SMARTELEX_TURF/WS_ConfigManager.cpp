#include "WS_ConfigManager.h"

DeviceConfig currentConfig;
bool isPortalActive = false;
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

static unsigned long disconnectStartTime = 0;
static bool wasConnected = false;

extern void Relay_Analysis(uint8_t *buf, uint8_t Mode_Flag);
extern bool Relay_Flag[6];
#define ALL_ON  '7'
#define ALL_OFF '8'
static void setupServerRoutes();

void Config_Load() {
  prefs.begin(NVS_NAMESPACE, false);
  currentConfig.wifi_ssid   = prefs.getString("ssid", "");
  currentConfig.wifi_pass   = prefs.getString("pass", "");
  currentConfig.mqtt_server = prefs.getString("mqtt_srv", MQTT_Server);
  currentConfig.mqtt_port   = prefs.getInt("mqtt_port", MQTT_Port);
  currentConfig.mqtt_id     = prefs.getString("mqtt_id", MQTT_ID);
  currentConfig.mqtt_sub    = prefs.getString("mqtt_sub", MQTT_Sub);
  currentConfig.mqtt_pub    = prefs.getString("mqtt_pub", MQTT_Pub);
  prefs.end();

  printf("\r\n================ CONFIGURATION LOADED (TURF ARENA) ================\r\n");
  printf("Target      : Cricket & Football Turf Arena\r\n");
  printf("Wi-Fi SSID  : %s\r\n", currentConfig.wifi_ssid.c_str());
  printf("MQTT Server : %s:%d\r\n", currentConfig.mqtt_server.c_str(), currentConfig.mqtt_port);
  printf("MQTT Client : %s\r\n", currentConfig.mqtt_id.c_str());
  printf("MQTT Sub    : %s\r\n", currentConfig.mqtt_sub.c_str());
  printf("MQTT Pub    : %s\r\n", currentConfig.mqtt_pub.c_str());
  printf("===================================================================\r\n\r\n");
}

void Config_Save(const DeviceConfig& cfg) {
  prefs.begin(NVS_NAMESPACE, false);
  prefs.putString("ssid", cfg.wifi_ssid);
  prefs.putString("pass", cfg.wifi_pass);
  prefs.putString("mqtt_srv", cfg.mqtt_server);
  prefs.putInt("mqtt_port", cfg.mqtt_port);
  prefs.putString("mqtt_id", cfg.mqtt_id);
  prefs.putString("mqtt_sub", cfg.mqtt_sub);
  prefs.putString("mqtt_pub", cfg.mqtt_pub);
  prefs.end();
  printf("Configuration successfully saved to NVS flash (%s)!\r\n", NVS_NAMESPACE);
}

void Config_Reset() {
  prefs.begin(NVS_NAMESPACE, false);
  prefs.clear();
  prefs.end();
  printf("Configuration reset to factory defaults (%s).\r\n", NVS_NAMESPACE);
}

// Generate the HTML configuration portal page
static String generatePortalHTML() {
  printf("Scanning Wi-Fi networks for captive portal...\r\n");
  int n = WiFi.scanNetworks();
  String options = "";
  if (n == 0) {
    options = "<option value=\"\">No networks found. Re-scan below.</option>";
  } else {
    for (int i = 0; i < n; ++i) {
      String s = WiFi.SSID(i);
      if (s.length() == 0) continue;
      int32_t rssi = WiFi.RSSI(i);
      int q = 2 * (rssi + 100);
      if (q > 100) q = 100;
      if (q < 0) q = 0;
      bool locked = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
      String sel = (s == currentConfig.wifi_ssid) ? " selected" : "";
      options += "<option value=\"" + s + "\"" + sel + ">" + s + " (" + String(q) + "% " + (locked ? "&#128274;" : "&#128275;") + ")</option>";
    }
  }

  String relayBtnHTML = "";
  const char* turfLabels[6] = {
    "CH1: Floodlights 1",
    "CH2: Floodlights 2",
    "CH3: Pitch Wicket",
    "CH4: Nets / Perim",
    "CH5: Dugout / Pav",
    "CH6: Gate / Siren"
  };
  for (int i = 0; i < 6; i++) {
    bool isOn = Relay_Flag[i];
    relayBtnHTML += "<a href='/toggle?ch=" + String(i + 1) + "' class='btn-relay " + (isOn ? "on" : "off") + "'>" + String(turfLabels[i]) + ": " + (isOn ? "ON" : "OFF") + "</a>";
  }

  String html = R"rawliteral(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>amd_wifi_turf - Turf Arena Setup</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #0f172a; color: #f8fafc; padding: 20px 12px; display: flex; justify-content: center; }
  .card { background: #1e293b; border-radius: 16px; padding: 24px; max-width: 440px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #334155; }
  .logo { text-align: center; margin-bottom: 20px; }
  .logo h1 { font-size: 24px; color: #38bdf8; letter-spacing: 0.5px; }
  .logo p { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .badge { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 6px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #cbd5e1; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #334155; }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  select, input { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: #fff; font-size: 14px; outline: none; transition: border-color 0.2s; }
  select:focus, input:focus { border-color: #38bdf8; }
  .hint { font-size: 11px; color: #64748b; margin-top: 4px; }
  .btn-submit { width: 100%; padding: 14px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; margin-top: 18px; box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
  .btn-submit:active { transform: scale(0.98); }
  .btn-scan { display: block; text-align: center; width: 100%; padding: 10px; background: #334155; color: #cbd5e1; border-radius: 8px; font-size: 12px; text-decoration: none; margin-top: 6px; font-weight: 600; }
  .relay-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; }
  .btn-relay { padding: 10px; text-align: center; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; display: block; }
  .btn-relay.on { background: #22c55e; color: #022c22; }
  .btn-relay.off { background: #475569; color: #cbd5e1; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <h1>SmartElex 6CH Controller</h1>
    <span class="badge" style="background:#15803d;">Device 3: Turf Arena (Cricket &amp; Football)</span>
    <p>Wi-Fi &amp; Cloud Gateway Setup (amd_wifi_turf)</p>
  </div>

  <form action="/save" method="POST">
    <div class="section-title">&#128246; 1. Facility Wi-Fi Network</div>
    <div class="form-group">
      <label>Select Detected Wi-Fi</label>
      <select name="ssid_select" id="ssid_select">
)rawliteral" + options + R"rawliteral(
      </select>
      <a href="/scan" class="btn-scan">&#128260; Re-Scan Wi-Fi Networks</a>
    </div>

    <div class="form-group">
      <label>Or Enter Hidden SSID</label>
      <input type="text" name="manual_ssid" placeholder="Only if Wi-Fi is hidden">
    </div>

    <div class="form-group">
      <label>Wi-Fi Password</label>
      <input type="password" name="pass" id="wifi_pass" value=")rawliteral" + currentConfig.wifi_pass + R"rawliteral(" placeholder="Enter Wi-Fi password">
      <p class="hint"><input type="checkbox" onclick="var p=document.getElementById('wifi_pass');p.type=p.type==='password'?'text':'password';" style="width:auto;vertical-align:middle;margin-right:4px;"> Show Password</p>
    </div>

    <div class="section-title">&#9889; 2. Cloud VPS / MQTT Broker Server</div>
    <div class="form-group">
      <label>VPS Server IP or Broker Domain</label>
      <input type="text" name="mqtt_srv" value=")rawliteral" + currentConfig.mqtt_server + R"rawliteral(" placeholder="e.g. 139.59.88.12 or broker.amdplay.com" required>
      <p class="hint">Your Cloud VPS Public IP or MQTT Broker hostname</p>
    </div>

    <div class="form-group">
      <label>MQTT Port</label>
      <input type="number" name="mqtt_port" value=")rawliteral" + String(currentConfig.mqtt_port) + R"rawliteral(" required>
    </div>

    <div class="form-group">
      <label>Device Client ID</label>
      <input type="text" name="mqtt_id" value=")rawliteral" + currentConfig.mqtt_id + R"rawliteral(" required>
    </div>

    <div class="form-group">
      <label>MQTT Subscribe Topic (Commands)</label>
      <input type="text" name="mqtt_sub" value=")rawliteral" + currentConfig.mqtt_sub + R"rawliteral(" required>
    </div>

    <div class="form-group">
      <label>MQTT Publish Topic (Status)</label>
      <input type="text" name="mqtt_pub" value=")rawliteral" + currentConfig.mqtt_pub + R"rawliteral(" required>
    </div>

    <button type="submit" class="btn-submit">&#128190; Save &amp; Connect Device</button>
  </form>

  <div class="section-title">&#128295; 3. Live Hardware Relay Test</div>
  <p class="hint">Test switching relays before leaving amd_wifi:</p>
  <div class="relay-grid">
)rawliteral" + relayBtnHTML + R"rawliteral(
  </div>
</div>
</body>
</html>)rawliteral";

  return html;
}

static void handleRoot() {
  server.send(200, "text/html", generatePortalHTML());
}

static void handleScan() {
  server.send(200, "text/html", "<!DOCTYPE html><html><head><meta http-equiv='refresh' content='2;url=/'><style>body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:50px 20px;}</style></head><body><h2>Scanning Wi-Fi networks...</h2><p>Please wait a moment...</p></body></html>");
}

static void handleAllOff() {
  uint8_t data[1] = { ALL_OFF };
  Relay_Analysis(data, 3);
  if (server.hasArg("json") || server.header("Accept").indexOf("application/json") >= 0) {
    server.send(200, "application/json", "{\"success\":true,\"state\":\"off\",\"all\":true}");
  } else {
    server.sendHeader("Location", "/");
    server.send(303);
  }
}

static void handleAllOn() {
  uint8_t data[1] = { ALL_ON };
  Relay_Analysis(data, 3);
  if (server.hasArg("json") || server.header("Accept").indexOf("application/json") >= 0) {
    server.send(200, "application/json", "{\"success\":true,\"state\":\"on\",\"all\":true}");
  } else {
    server.sendHeader("Location", "/");
    server.send(303);
  }
}

static void handleStatus() {
  String json = "{\"success\":true,\"relays\":[";
  for (int i = 0; i < 6; i++) {
    json += Relay_Flag[i] ? "1" : "0";
    if (i < 5) json += ",";
  }
  json += "],\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  server.send(200, "application/json", json);
}

static void handleToggle() {
  if (server.hasArg("ch")) {
    String chStr = server.arg("ch");
    if (chStr == "all" || chStr == "8" || chStr == "0") {
      String st = server.hasArg("state") ? server.arg("state") : "";
      st.toLowerCase();
      if (st == "on" || chStr == "7") {
        handleAllOn();
      } else {
        handleAllOff();
      }
      return;
    }

    int ch = chStr.toInt();
    if (ch >= 1 && ch <= 6) {
      if (server.hasArg("state")) {
        String st = server.arg("state");
        st.toLowerCase();
        if (st == "off") {
          if (Relay_Flag[ch - 1] == 1) { // Only toggle if currently ON
            uint8_t data[1] = { (uint8_t)(ch + 48) };
            Relay_Analysis(data, 3);
          }
        } else if (st == "on") {
          if (Relay_Flag[ch - 1] == 0) { // Only toggle if currently OFF
            uint8_t data[1] = { (uint8_t)(ch + 48) };
            Relay_Analysis(data, 3);
          }
        }
      } else {
        uint8_t data[1] = { (uint8_t)(ch + 48) };
        Relay_Analysis(data, 3);
      }
    }
  }

  if (server.hasArg("json") || server.header("Accept").indexOf("application/json") >= 0) {
    String json = "{\"success\":true,\"relays\":[";
    for (int i = 0; i < 6; i++) {
      json += Relay_Flag[i] ? "1" : "0";
      if (i < 5) json += ",";
    }
    json += "]}";
    server.send(200, "application/json", json);
  } else {
    server.sendHeader("Location", "/");
    server.send(303);
  }
}

static void handleSave() {
  String ssid = server.arg("ssid_select");
  if (server.hasArg("manual_ssid") && server.arg("manual_ssid").length() > 0) {
    ssid = server.arg("manual_ssid");
  }
  String pass     = server.arg("pass");
  String mqtt_srv = server.arg("mqtt_srv");
  int mqtt_port   = server.arg("mqtt_port").toInt();
  if (mqtt_port <= 0) mqtt_port = 1883;
  String mqtt_id  = server.arg("mqtt_id");
  String mqtt_sub = server.arg("mqtt_sub");
  String mqtt_pub = server.arg("mqtt_pub");

  currentConfig.wifi_ssid   = ssid;
  currentConfig.wifi_pass   = pass;
  currentConfig.mqtt_server = mqtt_srv;
  currentConfig.mqtt_port   = mqtt_port;
  currentConfig.mqtt_id     = mqtt_id;
  currentConfig.mqtt_sub    = mqtt_sub;
  currentConfig.mqtt_pub    = mqtt_pub;

  Config_Save(currentConfig);

  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:40px 16px;}h2{color:#22c55e;}.card{background:#1e293b;border-radius:12px;padding:24px;max-width:380px;margin:0 auto;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head><body><div class='card'><h2>&#10004; Configuration Saved!</h2><p style='margin:14px 0;'>Connecting to <b>" + ssid + "</b>...</p><p style='color:#94a3b8;font-size:13px;'>The <b>amd_wifi</b> hotspot will now turn off and the device will connect to your facility Wi-Fi and MQTT server.</p></div></body></html>";
  server.send(200, "text/html", html);

  Buzzer_PWM(200);
  delay(1500);
  ESP.restart();
}

static void handleCaptiveRedirect() {
  if (isPortalActive) {
    server.sendHeader("Location", "http://192.168.4.1/");
    server.send(302, "text/plain", "");
  } else {
    server.send(404, "application/json", "{\"error\":\"Not Found\"}");
  }
}

void Config_StartPortal() {
  if (isPortalActive) return;
  isPortalActive = true;

  printf("\r\n==================================================\r\n");
  printf("ACTIVATING CONFIGURATION PORTAL (SSID: %s)\r\n", PORTAL_SSID);
  printf("==================================================\r\n");

  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_AP);
  
  IPAddress apIP(192, 168, 4, 1);
  IPAddress netMsk(255, 255, 255, 0);
  WiFi.softAPConfig(apIP, apIP, netMsk);

  // Start open SoftAP without password (channel 1, broadcast SSID, max 4 clients)
  bool apSuccess = WiFi.softAP(PORTAL_SSID, "", 1, 0, 4);
  printf("Access Point broadcast: %s (%s)\r\n", PORTAL_SSID, apSuccess ? "SUCCESS" : "FAILED");
  printf("Web Portal running at: http://192.168.4.1\r\n");

  // Captive portal DNS redirect (redirect all DNS queries to 192.168.4.1)
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", apIP);

  Config_StartWebServer();

  // Indicate AP mode via RGB (Cyan / Yellow) and double beep
  RGB_Light(0, 50, 50);
  Buzzer_PWM(80);
  delay(80);
  Buzzer_PWM(80);
}

void Config_StopPortal() {
  if (!isPortalActive) return;
  isPortalActive = false;
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  printf("Captive portal AP closed. Web server remains accessible on local Wi-Fi.\r\n");
}

static void setupServerRoutes() {
  static bool done = false;
  if (done) return;
  done = true;

  server.on("/", HTTP_GET, handleRoot);
  server.on("/scan", HTTP_GET, handleScan);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/toggle", HTTP_GET, handleToggle);
  server.on("/all_off", HTTP_GET, handleAllOff);
  server.on("/all_on", HTTP_GET, handleAllOn);
  server.on("/status", HTTP_GET, handleStatus);

  // Android & iOS captive portal redirects
  server.on("/generate_204", handleCaptiveRedirect);
  server.on("/gen_204", handleCaptiveRedirect);
  server.on("/hotspot-detect.html", handleCaptiveRedirect);
  server.on("/ncsi.txt", handleCaptiveRedirect);
  server.on("/connecttest.txt", handleCaptiveRedirect);
  server.onNotFound(handleCaptiveRedirect);
}

void Config_StartWebServer() {
  setupServerRoutes();
  server.begin();
  printf("Web server active on port 80\r\n");
}

void Config_Init() {
  Config_Load();

  // If no SSID configured or placeholder, start portal immediately
  if (currentConfig.wifi_ssid.length() == 0 || currentConfig.wifi_ssid == "YOUR_WIFI_SSID") {
    printf("No Wi-Fi credentials found in flash. Starting %s portal...\r\n", PORTAL_SSID);
    Config_StartPortal();
  }
}

void Config_Loop() {
  if (isPortalActive) {
    dnsServer.processNextRequest();
    server.handleClient();
  } else if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
    wasConnected = true;
    disconnectStartTime = 0;
  } else {
    // Wi-Fi lost!
    if (wasConnected) {
      if (disconnectStartTime == 0) {
        disconnectStartTime = millis();
        printf("WARNING: Wi-Fi connection lost. Attempting reconnection...\r\n");
        RGB_Light(50, 0, 0); // Red alert
      } else if (millis() - disconnectStartTime > 30000) { // Disconnected for > 30 seconds
        printf("ERROR: Wi-Fi disconnected for > 30 seconds! Launching %s portal for reconfiguration...\r\n", PORTAL_SSID);
        Config_StartPortal();
      }
    }
  }
}
