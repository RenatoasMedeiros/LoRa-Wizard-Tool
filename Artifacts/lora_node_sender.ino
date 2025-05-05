// --- LoRa Sender Node Code ---
// Library: RadioLib (https://github.com/jgromes/RadioLib)
// Target: Arduino / ESP32 / RP2040 etc. (Check RadioLib support)

#include <RadioLib.h>

// !!! IMPORTANT !!! DEFINE YOUR BOARD'S LORA PIN CONFIGURATION HERE:
// Example: SX1276 radio = new Module(18, 26, 14, 34); // Heltec V2
SX1276 radio = new Module(PIN_LORA_SS, PIN_LORA_DIO0, PIN_LORA_RST, PIN_LORA_DIO1);

// --- Configuration Based on Your Inputs ---
float frequency = 868.0f;        // Frequency for region: EU868
int spreadingFactor = 12;           // Spreading Factor ()
float bandwidth = 125.0f;      // Signal Bandwidth: 125kHz
int codingRate = 5;            // Coding Rate: 4/5
byte syncWord = 0x12;           // Sync Word ()
int txPower = 14;             // TX Power: 14dBm ()
int preambleLength = 8;   // Preamble Length: 8

long packetCounter = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("LoRa Sender Init...");
  int state = radio.begin(frequency);
  if (state != RADIOLIB_ERR_NONE) { Serial.print("Init Failed: "); Serial.println(state); while (true); }
  Serial.println("Applying parameters...");
  radio.setSpreadingFactor(12); radio.setBandwidth(125); radio.setCodingRate(5);
  radio.setSyncWord(0x12); radio.setOutputPower(14); radio.setPreambleLength(8);
  Serial.println("Starting loop.");
}

void loop() {
  packetCounter++;
  String message = "Hello LoRa! Cnt:" + String(packetCounter);
  Serial.print("Sending: "); Serial.print(message); Serial.print(" ... ");
  int state = radio.transmit((byte*)message.c_str(), message.length());
  if (state == RADIOLIB_ERR_NONE) Serial.println("Success!");
  else { Serial.print("Fail "); Serial.println(state); }
  delay(10000);
}
