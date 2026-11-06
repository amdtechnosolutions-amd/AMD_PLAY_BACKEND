#include <HardwareSerial.h>     // Reference the ESP32 built-in serial port library
#include "WS_ConfigManager.h"
#include "WS_MQTT.h"
#include "WS_Bluetooth.h"
#include "WS_GPIO.h"
#include "WS_Serial.h"
#include "WS_RTC.h"

// =========================================================================
// DEVICE 2: BADMINTON ARENA (3 COURTS x 2 RELAYS = 6 RELAYS TOTAL)
// SmartElex Industrial 6-Channel ESP32-S3 Wi-Fi Relay Module
// With Captive Portal (SSID: amd_wifi) & Automatic Disconnect Fallback
// =========================================================================

#define CH1 '1'                 // CH1 Instruction
#define CH2 '2'                 // CH2 Instruction
#define CH3 '3'                 // CH3 Instruction
#define CH4 '4'                 // CH4 Instruction
#define CH5 '5'                 // CH5 Instruction
#define CH6 '6'                 // CH6 Instruction
#define ALL_ON  '7'             // Start all channel instructions
#define ALL_OFF '8'             // Disable all channel instructions

#define RS485_Mode        1     // Used to distinguish data sources
#define Bluetooth_Mode    2
#define MQTT_Mode         3

#define PIN_BOOT_BUTTON   0     // ESP32-S3 BOOT button GPIO

extern char ipStr[16];
extern bool WIFI_Connection;

bool Relay_Flag[6] = {0};       // Relay current status flag
uint32_t Simulated_time = 0;    // Analog time counting
static unsigned long bootButtonPressTime = 0;

/********************************************************  Data Analysis  ********************************************************/
void Relay_Analysis(uint8_t *buf, uint8_t Mode_Flag)
{
  if (Mode_Flag == Bluetooth_Mode)
    printf("Bluetooth Data : ");
  else if (Mode_Flag == MQTT_Mode)
    printf("MQTT Data : ");
  else
    printf("RS485 Data : ");  

  switch (buf[0])
  {
    case CH1: 
      digitalToggle(GPIO_PIN_CH1);  // Toggle GPIO 1 (Relay 1 - Court 1 Light)
      Relay_Flag[0] = !Relay_Flag[0];
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      printf(Relay_Flag[0] ? "|***  Relay CH1 ON (Court 1 Light)  ***|\r\n" : "|***  Relay CH1 OFF ***|\r\n");
      break;

    case CH2: 
      digitalToggle(GPIO_PIN_CH2);  // Toggle GPIO 2 (Relay 2 - Court 1 Fan)
      Relay_Flag[1] = !Relay_Flag[1];
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      printf(Relay_Flag[1] ? "|***  Relay CH2 ON (Court 1 Fan)    ***|\r\n" : "|***  Relay CH2 OFF ***|\r\n");
      break;

    case CH3: 
      digitalToggle(GPIO_PIN_CH3);  // Toggle GPIO 41 (Relay 3 - Court 2 Light)
      Relay_Flag[2] = !Relay_Flag[2];
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      printf(Relay_Flag[2] ? "|***  Relay CH3 ON (Court 2 Light)  ***|\r\n" : "|***  Relay CH3 OFF ***|\r\n");
      break;

    case CH4: 
      digitalToggle(GPIO_PIN_CH4);  // Toggle GPIO 42 (Relay 4 - Court 2 Fan)
      Relay_Flag[3] = !Relay_Flag[3];
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      printf(Relay_Flag[3] ? "|***  Relay CH4 ON (Court 2 Fan)    ***|\r\n" : "|***  Relay CH4 OFF ***|\r\n");
      break;

    case CH5: 
      digitalToggle(GPIO_PIN_CH5);  // Toggle GPIO 45 (Relay 5 - Court 3 Light)
      Relay_Flag[4] = !Relay_Flag[4];
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      printf(Relay_Flag[4] ? "|***  Relay CH5 ON (Court 3 Light)  ***|\r\n" : "|***  Relay CH5 OFF ***|\r\n");
      break;

    case CH6: 
      digitalToggle(GPIO_PIN_CH6);  // Toggle GPIO 46 (Relay 6 - Court 3 Fan)
      Relay_Flag[5] = !Relay_Flag[5];
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      printf(Relay_Flag[5] ? "|***  Relay CH6 ON (Court 3 Fan)    ***|\r\n" : "|***  Relay CH6 OFF ***|\r\n");
      break;

    case ALL_ON:
      digitalWrite(GPIO_PIN_CH1, HIGH);
      digitalWrite(GPIO_PIN_CH2, HIGH);
      digitalWrite(GPIO_PIN_CH3, HIGH);
      digitalWrite(GPIO_PIN_CH4, HIGH);
      digitalWrite(GPIO_PIN_CH5, HIGH);
      digitalWrite(GPIO_PIN_CH6, HIGH);
      memset(Relay_Flag, 1, sizeof(Relay_Flag));
      printf("|***  Relay ALL ON  ***|\r\n");
      Buzzer_PWM(300);
      RGB_Update_FromRelay();
      break;

    case ALL_OFF:
      digitalWrite(GPIO_PIN_CH1, LOW);
      digitalWrite(GPIO_PIN_CH2, LOW);
      digitalWrite(GPIO_PIN_CH3, LOW);
      digitalWrite(GPIO_PIN_CH4, LOW);
      digitalWrite(GPIO_PIN_CH5, LOW);
      digitalWrite(GPIO_PIN_CH6, LOW);
      memset(Relay_Flag, 0, sizeof(Relay_Flag));
      printf("|***  Relay ALL OFF ***|\r\n");
      Buzzer_PWM(100);
      delay(100);
      Buzzer_PWM(100);
      RGB_Update_FromRelay();
      break;

    default:
      printf("Note : Non-instruction data was received !\r\n");
  }
}

/********************************************************  Initializing  ********************************************************/
void setup() {
  Serial.begin(115200); // Initialize USB Serial Monitor
  delay(500);
  printf("\r\n\r\n==================================================\r\n");
  printf("  SmartElex 6CH Relay Starting...\r\n");
  printf("==================================================\r\n");

  Serial_Init();        // RS485 initialization
  GPIO_Init();          // Relay, RGB, Buzzer initialization
  
  pinMode(PIN_BOOT_BUTTON, INPUT_PULLUP); // BOOT button for manual portal trigger

  if (RTC_Enable) {
    RTC_Init();
  }

  if (Bluetooth_Enable) {
    Bluetooth_Init();     // BLE debug support
  }

  Config_Init();        // Loads preferences or launches amd_wifi portal if empty

  // If Wi-Fi credentials are ready, connect to network & MQTT
  if (!isPortalActive && currentConfig.wifi_ssid.length() > 0) {
    MQTT_Init();
  }

  if (WIFI_Connection == 1 && RTC_Enable == 1) {
    Acquisition_time();
  }
}

/**********************************************************  Loop  **********************************************************/
void loop() {
  // 1. Process Captive Portal & Wi-Fi Watchdog
  Config_Loop();

  // 2. RS485 loop
  Serial_Loop();

  // 3. MQTT loop (only active when connected to facility Wi-Fi)
  MQTT_Loop();

  // 4. Manual BOOT Button Portal Trigger: Hold BOOT for 3s to force-launch amd_wifi
  if (digitalRead(PIN_BOOT_BUTTON) == LOW) {
    if (bootButtonPressTime == 0) {
      bootButtonPressTime = millis();
    } else if (millis() - bootButtonPressTime > 3000) { // Held for 3 seconds
      printf("BOOT button held for 3 seconds! Manually launching amd_wifi portal...\r\n");
      Config_StartPortal();
      bootButtonPressTime = 0;
    }
  } else {
    bootButtonPressTime = 0;
  }

  // 5. Periodic tick
  Simulated_time++;
  if (Simulated_time == 1000) {
    Simulated_time = 0;
    if (RTC_Enable)
      RTC_Loop();
  }
}
