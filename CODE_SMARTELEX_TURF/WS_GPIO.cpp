#include "WS_GPIO.h"

/*************************************************************  I/O  *************************************************************/

void digitalToggle(int pin)
{
  digitalWrite(pin, !digitalRead(pin));   // Toggle pin state
}

void RGB_Light(uint8_t red_val, uint8_t green_val, uint8_t blue_val)
{
  neopixelWrite(GPIO_PIN_RGB, green_val, red_val, blue_val); // NeoPixel uses GRB
//  neopixelWrite(GPIO_PIN_RGB, g, r, b); // GRB order
}

void RGB_Show(uint8_t r, uint8_t g, uint8_t b)
{
  neopixelWrite(GPIO_PIN_RGB, g, r, b); // GRB
}

void RGB_Update_FromRelay()
{
  if     (Relay_Flag[0]) RGB_Show(255,   0,   0);   // CH1 Red
  else if(Relay_Flag[1]) RGB_Show(  0, 255,   0);   // CH2 Green
  else if(Relay_Flag[2]) RGB_Show(  0,   0, 255);   // CH3 Blue
  else if(Relay_Flag[3]) RGB_Show(255, 255,   0);   // CH4 Yellow
  else if(Relay_Flag[4]) RGB_Show(255,   0, 255);   // CH5 Purple
  else if(Relay_Flag[5]) RGB_Show(  0, 255, 255);   // CH6 Cyan
  else                   RGB_Show(  0,   0,   0);   // All OFF
}


void Buzzer_PWM(uint16_t Time)
{
  ledcWrite(GPIO_PIN_Buzzer, Dutyfactor);  // Start PWM
  delay(Time);
  ledcWrite(GPIO_PIN_Buzzer, 0);           // Stop PWM
}

void GPIO_Init()
{
  /**************** Relay GPIO ****************/
  pinMode(GPIO_PIN_CH1, OUTPUT);
  pinMode(GPIO_PIN_CH2, OUTPUT);
  pinMode(GPIO_PIN_CH3, OUTPUT);
  pinMode(GPIO_PIN_CH4, OUTPUT);
  pinMode(GPIO_PIN_CH5, OUTPUT);
  pinMode(GPIO_PIN_CH6, OUTPUT);

  // Safe default: all relays OFF
  digitalWrite(GPIO_PIN_CH1, LOW);
  digitalWrite(GPIO_PIN_CH2, LOW);
  digitalWrite(GPIO_PIN_CH3, LOW);
  digitalWrite(GPIO_PIN_CH4, LOW);
  digitalWrite(GPIO_PIN_CH5, LOW);
  digitalWrite(GPIO_PIN_CH6, LOW);

  /**************** RGB + Buzzer ****************/
  pinMode(GPIO_PIN_RGB, OUTPUT);
  pinMode(GPIO_PIN_Buzzer, OUTPUT);

  // ✅ New PWM API (Core 3.x)
  ledcAttach(GPIO_PIN_Buzzer, Frequency, Resolution);
}