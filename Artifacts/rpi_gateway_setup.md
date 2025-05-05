### Raspberry Pi LoRa Gateway Setup Guide

**Refer to docs for your specific LoRa HAT/module & software.**

**1. Hardware:** Connect HAT/Module & Antenna to Pi. Enable SPI if needed (`sudo raspi-config`).

**2. OS & Updates:** Install Raspberry Pi OS, connect to internet, run `sudo apt update && sudo apt upgrade -y`.

**3. Gateway Software (Choose ONE):**
    * **A) ChirpStack Gateway OS:** Flash image, follow ChirpStack docs. (Recommended for LoRaWAN)
    * **B) Manual Packet Forwarder:** Clone repo, compile, configure `global_conf.json` / `local_conf.json` (freq, EUI, server), run service.
    * **C) Manufacturer Software:** Follow vendor instructions (e.g., RAK Pi OS).

**4. Config Reminder:** Ensure gateway uses correct region/freq plan & Network Server details.

**5. Node Parameters:**
* Freq: 868.0MHz (EU868)
* SF: SF11 (Nodes)
* BW: 125kHz
* Sync: 0x12

**6. Testing:** Check gateway logs & Network Server UI for node packets.
