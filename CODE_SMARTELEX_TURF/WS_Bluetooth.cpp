#include "WS_Bluetooth.h"

BLEServer* pServer;
BLECharacteristic* pTxCharacteristic;
BLECharacteristic* pRxCharacteristic;

/**********************************************************  Bluetooth   *********************************************************/

class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        Serial.println("Device connected");
    }

    void onDisconnect(BLEServer* pServer) {
        Serial.println("Device disconnected");

        BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
        pAdvertising->addServiceUUID(SERVICE_UUID);
        pAdvertising->setScanResponse(true);
        pAdvertising->setMinPreferred(0x06);
        pAdvertising->setMinPreferred(0x12);
        BLEDevice::startAdvertising();
        pAdvertising->start();
    }
};

class MyRXCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {

        // ✅ Core 3.x uses Arduino String
        String rxValue = pCharacteristic->getValue();

        if (rxValue.length() > 0) {

            Serial.println(rxValue);

            uint8_t* valueBytes = (uint8_t*)rxValue.c_str();

            if (rxValue.length() == 1) {
                Relay_Analysis(valueBytes, Bluetooth_Mode);
            }
            else if (rxValue.length() == 2) {

                if (Extension_Enable) {

                    if (valueBytes[0] == 0x06)
                        RS485_Analysis(valueBytes);
                    else
                        Serial.println("Note : Non-instruction data was received - Bluetooth !");
                }
                else {
                    Serial.println("Note : Non-instruction data was received - Bluetooth !");
                }
            }
            else {
                Serial.println("Note : Non-instruction data was received - Bluetooth !");
            }

            pRxCharacteristic->setValue("");
        }
    }
};

void Bluetooth_SendData(char* Data) {

    if (Data != nullptr && strlen(Data) > 0) {

        if (pServer->getConnectedCount() > 0) {

            // ✅ Use Arduino String
            String SendValue = String(Data);

            pTxCharacteristic->setValue(SendValue);
            pTxCharacteristic->notify();
        }
    }
}

void Bluetooth_Init()
{
    BLEDevice::init("ESP32 S3 Relay 6CH");

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService* pService = pServer->createService(SERVICE_UUID);

    pTxCharacteristic = pService->createCharacteristic(
                            TX_CHARACTERISTIC_UUID,
                            BLECharacteristic::PROPERTY_READ
                        );

    pRxCharacteristic = pService->createCharacteristic(
                            RX_CHARACTERISTIC_UUID,
                            BLECharacteristic::PROPERTY_WRITE
                        );

    pRxCharacteristic->setCallbacks(new MyRXCallback());

    pRxCharacteristic->setValue("Successfully Connect To ESP32-S3-Relay-6CH");

    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);

    BLEDevice::startAdvertising();
    pAdvertising->start();

    RGB_Light(0, 0, 60);
    delay(1000);
    RGB_Light(0, 0, 0);

    Serial.println("Now you can read it in your phone!");
}