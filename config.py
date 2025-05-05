# config.py

# Mapping regions to standard LoRa frequencies (MHz)
REGION_FREQUENCIES = {
    "EU868": 868.0, # Europe
    "US915": 915.0, # North America
    "AS923": 923.0, # Asia
    "AU915": 915.0, # Australia
    "KR920": 920.0, # Korea
    "IN865": 865.0, # India
    "RU864": 864.0, # Russia
    # Add more regions as needed
}

# Enhanced Hardware Suggestions with Categories and Links (Examples)
# Using a more structured approach for easier processing
HARDWARE_SUGGESTIONS = {
    "node": {
        "title": "For Sensor Nodes:",
        "items": [
            {"text": "ESP32-LoRa Board (Heltec, TTGO)", "link": "https://www.google.com/search?q=esp32+lora+board", "note": "Integrated MCU & LoRa"},
            {"text": "Arduino (Uno/Nano/etc) + RFM95/SX1276 Module", "link": "https://www.google.com/search?q=arduino+rfm95+module", "note": "Requires wiring"},
            {"text": "M5Stack Core + LoRa Module", "link": "https://shop.m5stack.com/collections/m5-modules?filter.p.m.my_fields.module_type=LoRa+%26+LoRaWAN", "note": "Modular system"},
            {"text": "Raspberry Pi Pico + RFM95/SX1276 Module", "link": "https://www.google.com/search?q=raspberry+pi+pico+lora", "note": "MicroPython/C++"},
        ]
    },
    "gateway_easy": {
        "title": "Easy Plug-and-Play Gateways:",
         "items": [
            {"text": "The Things Indoor Gateway (TTIG)", "link": "https://www.thethingsindustries.com/devices/the-things-indoor-gateway/", "note": "WiFi backhaul, TTN focused"},
            # Add other easy options if known
        ]
    },
    "gateway_configurable": {
         "title": "Configurable Gateways:",
         "items": [
            {"text": "RAK Wireless WisGate Series", "link": "https://store.rakwireless.com/collections/wisgate", "note": "Various models (Edge, Developer)"},
            {"text": "Dragino Gateways (LPS8, LG308, etc.)", "link": "https://www.dragino.com/products/lora-lorawan-gateway.html", "note": "Popular DIY/Semi-pro choice"},
            {"text": "MikroTik LoRaWAN Gateways", "link": "https://mikrotik.com/products/lora", "note": "Integrates with RouterOS"},
        ]
    },
    "gateway_build_rpi": {
        "title": "Build Gateway with Raspberry Pi:",
        "items": [
            {"text": "Raspberry Pi (3B+, 4, Zero 2 W recommended)", "link": "https://www.raspberrypi.com/products/"},
            {"text": "+ LoRa HAT/Module (e.g., RAK2245/2287 SPI/USB, Seeed WM1302)", "link": "https://store.rakwireless.com/collections/wislink-lora", "note": "Connects via SPI or USB"},
            {"text": "+ Power Supply & SD Card"},
            {"text": "Software: ChirpStack Gateway OS, Balena basicstation, RAK Pi OS etc.", "link": "https://www.chirpstack.io/gateway-os/"}
        ]
    },
     "gateway_build_esp32": {
         "title": "Build Simple Gateway with ESP32:",
         "items": [
            {"text": "ESP32-LoRa Board (Heltec, TTGO)", "link": "https://www.google.com/search?q=esp32+lora+board", "note": "Acts as simple packet forwarder"},
            {"text": "Software: ESP-LoRa-Gateway code or custom receiver", "link": "https://github.com/things4u/ESP-1ch-Gateway-v5.0", "note": "Often single-channel, less robust than multi-channel"},
        ]
    },
    "gateway_build_other": {
        "title": "Build Gateway with Other SBC/Computer:",
        "items": [
            {"text": "SBC (OrangePi, BeagleBone, etc.) or PC (Linux recommended)", "note": "Requires more setup"},
            {"text": "+ LoRa Module (USB or SPI based, e.g., RAK2245/2287 USB)", "link": "https://store.rakwireless.com/collections/wislink-lora"},
            {"text": "Software: ChirpStack Gateway Bridge + Packet Forwarder", "link": "https://www.chirpstack.io/gateway-bridge/"}
        ]
    },
    "existing_hw_notes": {
        "title": "Notes on your existing hardware:",
        "notes": {
            "rpi": "Great! You can use your Pi for the 'Build with Raspberry Pi' option.",
            "esp32": "Good! You can use your ESP32 board for the 'Build with ESP32' option (check if it has LoRa integrated or needs a module).",
            "lora_module": "Excellent! You'll need a host like a Pi, ESP32, or PC to connect this module to for a gateway.",
            "other_sbc": "Okay! You can likely use this for the 'Build with Other SBC' option, check compatibility with LoRa modules/software."
        }
    }
}

LORA_MODULE_DETAILS = {
    "rfm95w": {
        "name": "HopeRF RFM95W / Adafruit RFM95W",
        "type": "Module (Requires MCU)",
        "chipset": "SX1276",
        "interface": "SPI",
        "typical_use": "Sensor Nodes, simple P2P",
        "notes": "Very common, requires soldering/breakout board and an external microcontroller (Arduino, ESP32, Pico, RPi). Available for various frequencies.",
        "placement_advice": "Excellent for sensor nodes due to low power potential. Place nodes strategically based on range needs (SF settings) and obstructions. Less common for building robust multi-channel gateways."
    },
    "heltec_wifi_lora_v2": {
        "name": "Heltec WiFi LoRa 32 (V2)",
        "type": "Integrated Board",
        "chipset": "ESP32 + SX1276",
        "interface": "USB (for programming), WiFi, Bluetooth",
        "typical_use": "Sensor Nodes, Simple Gateway/Receiver, P2P",
        "notes": "Popular all-in-one board with ESP32, LoRa, and OLED display. Check pinouts carefully (V1/V2/V3 differ).",
        "placement_advice": "Versatile. Good for sensor nodes needing WiFi/BT. Can act as a simple single-channel gateway/receiver (place centrally). As a node, consider battery power options."
    },
     "heltec_wifi_lora_v3": {
        "name": "Heltec WiFi LoRa 32 (V3)",
        "type": "Integrated Board",
        "chipset": "ESP32-S3 + SX1262",
        "interface": "USB-C, WiFi, Bluetooth",
        "typical_use": "Sensor Nodes, Simple Gateway/Receiver, P2P",
        "notes": "Newer version with ESP32-S3 and more power-efficient SX1262 chip. Different pinout than V2.",
        "placement_advice": "Similar to V2 but potentially better range/power efficiency due to SX1262. Good choice for nodes or simple ESP32-based gateways."
    },
    "ttgo_lora32_v2": {
        "name": "TTGO LoRa32 V2.x (e.g., V2.1_1.6)",
        "type": "Integrated Board",
        "chipset": "ESP32 + SX1276/SX1278",
        "interface": "USB, WiFi, Bluetooth, SD Card slot (often)",
        "typical_use": "Sensor Nodes, Simple Gateway/Receiver, P2P",
        "notes": "Another popular ESP32+LoRa board family. Several versions exist with slightly different features/pinouts.",
        "placement_advice": "Very similar use cases to Heltec boards. Suitable for nodes or simple gateways. Check specific version for features like battery management."
    },
    "m5stack_lora": {
        "name": "M5Stack LoRa Module",
        "type": "Module (M5Stack Ecosystem)",
        "chipset": "SX1276/SX1278 or SX1262 (check version)",
        "interface": "M-BUS (connects to M5Stack Core)",
        "typical_use": "Sensor Nodes (with M5Stack Core)",
        "notes": "Part of the M5Stack modular system. Requires an M5Stack Core (ESP32) base unit.",
        "placement_advice": "Used primarily as a sensor node when attached to an M5Stack Core. The Core provides display, buttons, power, etc. Place the complete unit as needed for sensor readings."
    },
    "dragino_lora_shield": {
        "name": "Dragino LoRa Shield",
        "type": "Shield (for Arduino/RPi)",
        "chipset": "SX1276/SX1278",
        "interface": "Pins for Arduino Uno/Mega, SPI for RPi",
        "typical_use": "Sensor Nodes (with Arduino), Simple Gateway (with RPi)",
        "notes": "Adds LoRa capability to existing Arduino or Raspberry Pi boards. Ensure compatibility with your board voltage (3.3V/5V).",
        "placement_advice": "Turns an Arduino into a capable sensor node. Can be used with a Raspberry Pi to build a simple gateway (often single-channel), though dedicated RPi HATs are more common for multi-channel gateways."
    },
     "rak4631": {
        "name": "RAK4631 WisBlock Core",
        "type": "Integrated Module (WisBlock System)",
        "chipset": "nRF52840 + SX1262",
        "interface": "WisBlock Base Board connectors, BLE",
        "typical_use": "Low-Power Sensor Nodes",
        "notes": "Part of RAK's modular WisBlock system. Very power efficient (nRF52 + SX1262). Requires a WisBlock Base board.",
        "placement_advice": "Excellent choice for battery-powered, low-power sensor nodes due to its efficiency. Requires other WisBlock components (base, sensors)."
    },
    "rak3172": {
        "name": "RAK3172 Module / RAK3272 Breakout",
        "type": "Module (Requires MCU) / Breakout Board",
        "chipset": "STM32WLE5 (MCU + LoRa integrated)",
        "interface": "UART (AT Commands or RUI3 API)",
        "typical_use": "Sensor Nodes",
        "notes": "Features LoRaWAN stack built-in, controlled via AT commands or RAK's RUI3 API. Simplifies LoRaWAN development.",
        "placement_advice": "Ideal for sensor nodes, especially if targeting LoRaWAN. Needs a host MCU only if complex local processing is required beyond AT commands/RUI3."
    },
    "seeed_lora_e5": {
        "name": "Seeed Studio LoRa-E5 Module / Grove LoRa-E5",
        "type": "Module (Requires MCU) / Grove Module",
        "chipset": "STM32WLE5 (MCU + LoRa integrated)",
        "interface": "UART (AT Commands)",
        "typical_use": "Sensor Nodes (especially LoRaWAN)",
        "notes": "Similar to RAK3172, based on STM32WLE5 with built-in LoRaWAN stack accessible via AT commands. Grove version is easy to connect.",
        "placement_advice": "Good for sensor nodes using the Grove ecosystem or connecting via UART. Well-suited for LoRaWAN applications."
    },
     # Add 1-2 more if desired, e.g., Adafruit Feather LoRa boards
     "adafruit_feather_lora": {
        "name": "Adafruit Feather LoRa Boards (e.g., 32u4 RFM95, M0 RFM95, ESP32)",
        "type": "Integrated Board",
        "chipset": "Varies (Atmega32u4/SAMD21/ESP32) + SX127x",
        "interface": "USB, Feather Pinout, often LiPo charging",
        "typical_use": "Sensor Nodes, P2P",
        "notes": "Part of Adafruit's Feather ecosystem. Many variants with different MCUs. Check specific board.",
        "placement_advice": "Great for portable sensor nodes, especially with battery support. Choose MCU based on processing/power needs. Place nodes as required."
    },

}

# Default LoRa parameter values
DEFAULT_LORA_PARAMS = {
    "bandwidth_khz": 125,
    "coding_rate_denominator": 5, # Represents 4/5
    "preamble_length": 8,
    "private_sync_word": 0x12,
    "public_sync_word": 0x34,
    "default_tx_power_eu": 14,
    "default_tx_power_us_au": 20,
    "default_tx_power_as": 16,
    "default_tx_power_other": 14,
}
