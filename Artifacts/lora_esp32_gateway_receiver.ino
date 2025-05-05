// --- LoRa ESP32 Gateway Receiver Code ---
// Library: RadioLib
#include <RadioLib.h>

// !!! IMPORTANT !!! DEFINE YOUR BOARD'S LORA PINS HERE
// Example: SX1276 radio = new Module(8, 14, 12, 13); // Heltec V3
SX1276 radio = new Module(PIN_LORA_SS, PIN_LORA_DIO0, PIN_LORA_RST, PIN_LORA_DIO1);

// --- Configuration (MUST MATCH SENDER/NODES) ---
float frequency = 868.0f; int spreadingFactor = 12; float bandwidth = 125.0f;
int codingRate = 5; byte syncWord = 0x12; int preambleLength = 8;

void setup() {
  Serial.begin(115200);
  Serial.println("LoRa ESP32 Gateway Receiver Initializing...");
  int state = radio.begin(frequency);
  if (state != RADIOLIB_ERR_NONE) { Serial.print("Init Failed: "); Serial.println(state); while (true); }
  radio.setSpreadingFactor(12); radio.setBandwidth(125); radio.setCodingRate(5);
  radio.setSyncWord(0x12); radio.setPreambleLength(8);
  Serial.println("[LoRa ESP32 Gateway] Starting receive...");
}

void loop() {
  byte byteArr[256]; int state = radio.receive(byteArr, 0); int len = radio.getPacketLength();
  if (state == RADIOLIB_ERR_NONE) {
    Serial.print("[LoRa ESP32 Gateway] RX OK! RSSI:"); Serial.print(radio.getRSSI()); Serial.print(" SNR:"); Serial.print(radio.getSNR()); Serial.print(" Len:"); Serial.print(len);
    Serial.print(" Data:'"); for(int i=0; i<len; i++) Serial.print((char)byteArr[i]); Serial.println("'");
    // TODO: Forward data (MQTT/HTTP)
  } else if (state == RADIOLIB_ERR_CRC_MISMATCH) Serial.println("[LoRa ESP32 Gateway] CRC Error!");
  // else if (state != RADIOLIB_ERR_RX_TIMEOUT) { Serial.print("[LoRa ESP32 Gateway] RX Fail:"); Serial.println(state); }
}
