# lora_logic.py
import logging
import math
import os
import json for potential future use, though not strictly needed now
# Import new module details from config
from config import REGION_FREQUENCIES, HARDWARE_SUGGESTIONS, DEFAULT_LORA_PARAMS, LORA_MODULE_DETAILS

# Configure logging
logger = logging.getLogger(__name__)

DEFAULT_ANTENNA_GAIN_DBI = 2.15 # Ganho típico para antenas dipolo/omnidirecionais
REFERENCE_DISTANCE_M = 1.0      # Distância de referência para PL0 (geralmente 1m)
SPEED_OF_LIGHT = 299792458      # m/s

# Perda estimada por tipo de parede (em dB) -> https://wifivitae.com/2021/12/15/wall-attenuation/
WALL_LOSS_DB = {
    'drywall': 1,
    'brick': 6,
    'concrete': 29,
    'empty': 0 # Espaço vazio não adiciona perda
}
# Perda estimada por piso (em dB)
FLOOR_LOSS_DB = 21 # https://ar5iv.labs.arxiv.org/html/1909.03900 isto é para um chão de concreto

# Define the directory to save artifacts relative to this file's location
# Ensures it works correctly regardless of where app.py is run from
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'Artifacts')

def _ensure_artifacts_dir_exists():
    """Creates the Artifacts directory if it doesn't exist."""
    if not os.path.exists(ARTIFACTS_DIR):
        try:
            os.makedirs(ARTIFACTS_DIR)
            logger.info(f"Created artifacts directory: {ARTIFACTS_DIR}")
        except OSError as e:
            logger.error(f"Error creating artifacts directory {ARTIFACTS_DIR}: {e}")
            # Decide how to handle this: maybe return False or raise exception
            return False
    return True

def _save_artifact_to_file(artifact):
    """Saves the content of a generated artifact to a file in the Artifacts directory."""
    if not _ensure_artifacts_dir_exists():
        logger.warning("Artifacts directory doesn't exist or couldn't be created. Skipping file save.")
        return # Don't proceed if directory isn't available

    if not artifact or 'filename' not in artifact or 'content' not in artifact:
        logger.warning("Attempted to save invalid artifact structure.")
        return

    filename = artifact['filename']
    content = artifact['content']
    # Sanitize filename slightly (replace spaces, ensure valid extension)
    # You might want more robust sanitization depending on expected inputs
    filename = filename.replace(" ", "_").lower()
    if artifact.get('type') == 'code' and not filename.endswith(('.ino', '.cpp', '.c', '.h')):
         filename += '.ino' # Default to .ino for C++ code if no extension
    elif artifact.get('type') == 'instructions' and not filename.endswith('.md'):
         filename += '.md'

    filepath = os.path.join(ARTIFACTS_DIR, filename)

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        logger.info(f"Successfully saved artifact to: {filepath}")
    except IOError as e:
        logger.error(f"Error writing artifact file {filepath}: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred while saving artifact {filepath}: {e}")

def get_rx_sensitivity(sf, bw_khz):
    # Valores MUITO aproximados - CONSULTAR DATASHEETS!
    # SNR necessário piora com SF mais baixo
    snr_required = {7: -7.5, 8: -10, 9: -12.5, 10: -15, 11: -17.5, 12: -20}
    # Ruído térmico = -174 + 10*log10(BW_Hz)
    noise_floor_dbm = -174 + 10 * math.log10(bw_khz * 1000)
    # Assumir um Noise Figure (NF) típico para o recetor, ex: 6 dB
    receiver_nf = 6 # Ajustar com base no hardware
    sensitivity = noise_floor_dbm + receiver_nf + snr_required.get(sf, -20) # Usar -20 como fallback
    logger.debug(f"Calculated Rx Sensitivity for SF{sf}, BW{bw_khz}: {sensitivity:.2f} dBm")
    return sensitivity

# Função para calcular distância em linha reta na grelha (assumindo 1m por célula)
def calculate_distance(pos1, pos2):
    if not pos1 or not pos2: return 0
    # Distância Euclidiana (pode ser simplificada para Manhattan se preferir)
    # Multiplica por 1 (assumindo 1m por célula)
    return math.sqrt((pos1['row'] - pos2['row'])**2 + (pos1['col'] - pos2['col'])**2) * 1.0

# TODO Função SIMPLES para estimar perda por paredes (conta paredes entre pontos)
# NOTA: Isto é uma GRANDE simplificação. Mas não tá facil fazer isto.
def estimate_wall_loss(grid, pos1, pos2):
    if not grid or not pos1 or not pos2: return 0
    loss = 0
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0
    r1, c1 = pos1['row'], pos1['col']
    r2, c2 = pos2['row'], pos2['col']

    # Simplificação: Contar paredes nas linhas e colunas entre os pontos
    # Contar paredes horizontais atravessadas
    for r in range(min(r1, r2), max(r1, r2) + 1):
         # Verifica a parede na coluna do ponto de partida (aproximação)
         if 0 <= r < rows and 0 <= c1 < cols:
             wall_type = grid[r][c1]
             if wall_type in WALL_LOSS_DB and wall_type != 'empty':
                 loss += WALL_LOSS_DB[wall_type] / 2 # Divide por 2 (heurística grosseira)

    # Contar paredes verticais atravessadas
    for c in range(min(c1, c2), max(c1, c2) + 1):
         # Verifica a parede na linha do ponto de chegada (aproximação)
          if 0 <= r2 < rows and 0 <= c < cols:
             wall_type = grid[r2][c]
             if wall_type in WALL_LOSS_DB and wall_type != 'empty':
                 loss += WALL_LOSS_DB[wall_type] / 2 # Divide por 2

    # Remover a perda da própria célula (se for parede) - já contado acima
    # Esta lógica é muito básica e pode ser melhorada (ex: Bresenham's line algorithm)
    logger.debug(f"Estimated wall loss between {pos1} and {pos2}: {loss:.1f} dB")
    return loss


def estimate_ple(environment_data):
    # Lógica inicial para estimar o Path Loss Exponent (PLE)
    # Refinar esta lógica com base em mais pesquisa ou dados empíricos
    try:
        size_sqm = int(environment_data.get('size_sqm', 100))
        floors = int(environment_data.get('floors', 1))
        walls_internal = int(environment_data.get('walls_internal', 2)) # Número de paredes não é um ótimo indicador por si só
        wall_type = environment_data.get('wall_type', 'drywall')
    except (ValueError, TypeError):
         logger.warning("Invalid environment data for PLE estimation, using defaults.")
         size_sqm, floors, wall_type = 100, 1, 'drywall'

    # Mapeamento muito simplificado - Idealmente usar modelos mais complexos ou lookup tables
    ple = 2.5 # Base para interior com alguma obstrução

    if wall_type == 'concrete':
        ple += 1.0 + (floors - 1) * 0.6 # Aumenta mais com betão e pisos
    elif wall_type == 'brick':
        ple += 0.6 + (floors - 1) * 0.4
    else: # Drywall/Wood
        ple += 0.3 + (floors - 1) * 0.3

    if size_sqm > 150:
        ple += 0.3
    elif size_sqm > 250:
        ple += 0.6

    # Adicionar alguma variação com base no número de paredes (impacto menor que tipo/pisos)
    # ple += walls_internal * 0.05 # Pequeno ajuste

    # Limitar a um intervalo razoável (ex: 2.0 para linha de vista a ~6.0 para obstrução severa)
    estimated_ple = max(2.2, min(ple, 5.5)) # Ajustar limites conforme necessário
    logger.debug(f"Estimated PLE based on {environment_data}: {estimated_ple:.2f}")
    return estimated_ple

def _calculate_lora_params(environment_data, floorplan_data, region, frequency):
    """Calculates recommended LoRa parameters based on environment AND floor plan."""
    params = {}
    errors = []
    reasoning = [] # Renomeado para clareza

    try:
        # Dados do Ambiente (ainda podem ser úteis para fallback ou clutter)
        floors = int(environment_data.get('floors', 1))
        # wall_type_overall = environment_data.get('wall_type', 'drywall') # Pode ser usado para clutter

        # Dados da Planta
        grid = floorplan_data.get('grid')
        gateway_pos = floorplan_data.get('gateway')
        sensor_positions = floorplan_data.get('sensors', [])

        if not grid or not gateway_pos:
            errors.append("Floor plan data (grid or gateway position) is missing or invalid. Using basic estimation.")
            # --- Populate FULL default params ---
            params = {
                "spreading_factor": 9, # Default SF
                "signal_bandwidth_khz": DEFAULT_LORA_PARAMS['bandwidth_khz'],
                "coding_rate": f"4/{DEFAULT_LORA_PARAMS['coding_rate_denominator']}",
                "tx_power_dbm": DEFAULT_LORA_PARAMS.get(f"default_tx_power_{region[:2].lower()}", DEFAULT_LORA_PARAMS['default_tx_power_other']), # Use regional default if possible
                "preamble_length": DEFAULT_LORA_PARAMS['preamble_length'],
                "sync_word": hex(DEFAULT_LORA_PARAMS['private_sync_word']),
                "antenna_gain_dbi": DEFAULT_ANTENNA_GAIN_DBI * 2, (Tx + Rx gain)
                "worst_link_margin_db": None, (No margin calculated)
                "error_message": "Fallback due to missing gateway on plan."
            }
            params["_coding_rate_raw"] = DEFAULT_LORA_PARAMS['coding_rate_denominator']
            params["_sync_word_raw"] = DEFAULT_LORA_PARAMS['private_sync_word']
            # --- End FULL default params ---
            reasoning.append("Warning: Floor plan data missing (no gateway placed), using default parameters.")
            return params, errors, reasoning


        if not sensor_positions:
             errors.append("No sensors placed on the floor plan. Cannot calculate specific link margins.")
             # --- Populate FULL default params ---
             params = {
                 "spreading_factor": 7, # Optimistic default if gateway exists but no sensors
                 "signal_bandwidth_khz": DEFAULT_LORA_PARAMS['bandwidth_khz'],
                 "coding_rate": f"4/{DEFAULT_LORA_PARAMS['coding_rate_denominator']}",
                 "tx_power_dbm": DEFAULT_LORA_PARAMS.get(f"default_tx_power_{region[:2].lower()}", DEFAULT_LORA_PARAMS['default_tx_power_other']), # Use regional default
                 "preamble_length": DEFAULT_LORA_PARAMS['preamble_length'],
                 "sync_word": hex(DEFAULT_LORA_PARAMS['private_sync_word']),
                 "antenna_gain_dbi": DEFAULT_ANTENNA_GAIN_DBI * 2,
                 "worst_link_margin_db": None,
                 "warning_message": "No sensors placed, using optimistic defaults (SF7)." # Changed message type
             }
             params["_coding_rate_raw"] = DEFAULT_LORA_PARAMS['coding_rate_denominator']
             params["_sync_word_raw"] = DEFAULT_LORA_PARAMS['private_sync_word']
             # --- End FULL default params ---
             reasoning.append("Warning: No sensors placed, using optimistic parameters (SF7).")
             return params, errors, reasoning


        # Parâmetros Fixos e Potência Tx
        bw_khz = DEFAULT_LORA_PARAMS['bandwidth_khz']
        cr_denominator = DEFAULT_LORA_PARAMS['coding_rate_denominator']
        preamble_length = DEFAULT_LORA_PARAMS['preamble_length']
        sync_word_raw = DEFAULT_LORA_PARAMS['private_sync_word']
        sync_word_hex = hex(sync_word_raw)
        tx_power_dbm = DEFAULT_LORA_PARAMS['default_tx_power_other'] # Obter Tx Power baseado na região
        if region in ["EU868", "RU864", "IN865"]: tx_power_dbm = DEFAULT_LORA_PARAMS['default_tx_power_eu']
        elif region in ["US915", "AU915"]: tx_power_dbm = DEFAULT_LORA_PARAMS['default_tx_power_us_au']
        elif region == "AS923": tx_power_dbm = DEFAULT_LORA_PARAMS['default_tx_power_as']

        gt_dbi = DEFAULT_ANTENNA_GAIN_DBI
        gr_dbi = DEFAULT_ANTENNA_GAIN_DBI
        frequency_mhz = frequency
        frequency_hz = frequency_mhz * 1_000_000

        reasoning.append(f"Initial Params: Region={region}, Freq={frequency_mhz}MHz, BW={bw_khz}kHz, TxPwr={tx_power_dbm}dBm, AntGain={gt_dbi+gr_dbi}dBi")
        reasoning.append(f"Floor Plan: {len(grid)}x{len(grid[0]) if grid else 0} grid, Gateway @ {gateway_pos}, {len(sensor_positions)} Sensor(s)")

        # Calcular PL0 (Path Loss a 1 metro usando Friis)
        pl0_db = 20 * math.log10(REFERENCE_DISTANCE_M) + 20 * math.log10(frequency_mhz) + 32.44
        reasoning.append(f"Reference Path Loss (PL0 @ {REFERENCE_DISTANCE_M}m): {pl0_db:.2f} dB")

        best_sf = None
        worst_margin_overall = 999 # Queremos a *menor* margem positiva
        selected_margin = -999 # Margem correspondente ao best_sf

        # Iterar pelos Spreading Factors possíveis
        for sf_attempt in range(7, 13):
            rx_sensitivity_dbm = get_rx_sensitivity(sf_attempt, bw_khz)
            worst_margin_for_this_sf = 999 # Pior margem para *este* SF
            sensor_with_worst_margin = None

            reasoning.append(f"--- Analyzing SF{sf_attempt} (Sensitivity: {rx_sensitivity_dbm:.1f} dBm) ---")

            # Calcular margem para CADA sensor
            for i, sensor_pos in enumerate(sensor_positions):
                distance_m = calculate_distance(gateway_pos, sensor_pos)
                if distance_m < REFERENCE_DISTANCE_M: distance_m = REFERENCE_DISTANCE_M # Mínimo 1m para cálculo de perda

                # Calcular FSPL (Free Space Path Loss)
                fspl_db = pl0_db + 10 * 2.0 * math.log10(distance_m / REFERENCE_DISTANCE_M) # PLE=2 para FSPL

                # Estimar perda adicional por paredes e pisos
                wall_loss = estimate_wall_loss(grid, gateway_pos, sensor_pos)
                floor_loss = (floors - 1) * FLOOR_LOSS_DB # Simplista: perda por cada piso adicional
                # Poderia adicionar um fator de 'clutter' aqui baseado no environment_data

                total_path_loss_db = fspl_db + wall_loss + floor_loss
                # Alternativa: Usar um modelo Log-distance com PLE > 2 E adicionar wall_loss
                # ple_clutter = 2.5 # Exemplo
                # total_path_loss_db = pl0_db + 10 * ple_clutter * math.log10(distance_m / REFERENCE_DISTANCE_M) + wall_loss + floor_loss


                # Calcular Potência Recebida e Margem
                prx_dbm = tx_power_dbm + gt_dbi + gr_dbi - total_path_loss_db
                link_margin_db = prx_dbm - rx_sensitivity_dbm

                reasoning.append(f"  Sensor {i+1} @ {sensor_pos}: Dist={distance_m:.1f}m, FSPL={fspl_db:.1f}, WallLoss={wall_loss:.1f}, FloorLoss={floor_loss:.1f} -> PL={total_path_loss_db:.1f}dB -> Prx={prx_dbm:.1f}dBm -> Margin={link_margin_db:.1f}dB")

                # Atualizar a pior margem para este SF
                if link_margin_db < worst_margin_for_this_sf:
                    worst_margin_for_this_sf = link_margin_db
                    sensor_with_worst_margin = i + 1

            reasoning.append(f"  Worst margin for SF{sf_attempt}: {worst_margin_for_this_sf:.1f} dB (Sensor {sensor_with_worst_margin})")

            # Lógica de Seleção: Escolher o SF mais baixo que funciona para TODOS os sensores
            # Considerar uma margem mínima (ex: 5 dB)
            MIN_SAFE_MARGIN = 5.0
            if worst_margin_for_this_sf >= MIN_SAFE_MARGIN:
                if best_sf is None: # Encontrou o primeiro SF viável (o mais rápido)
                    best_sf = sf_attempt
                    selected_margin = worst_margin_for_this_sf
                    # Não faz break, continua a verificar SFs maiores para ver se dão margens melhores (acho que não é necessário)
            # Guardar a margem do SF mais alto caso nenhum atinja a margem segura
            if sf_attempt == 12 and best_sf is None:
                 best_sf = 12
                 selected_margin = worst_margin_for_this_sf


        # Finalizar seleção e adicionar notas
        if best_sf is None: # Caso raro, se o loop não correu ou algo falhou
            best_sf = 12
            selected_margin = -999
            reasoning.append(f"Warning: Could not determine a suitable SF. Defaulting to SF{best_sf}. Check sensor placement and walls.")
        elif selected_margin < MIN_SAFE_MARGIN:
             reasoning.append(f"Warning: Selected SF{best_sf} but link margin ({selected_margin:.1f} dB) is below the recommended {MIN_SAFE_MARGIN} dB. Range might be unreliable for the furthest/most obstructed sensor. Consider moving the gateway or using a higher SF if possible.")
        else:
             reasoning.append(f"Selected SF{best_sf} as the lowest SF providing sufficient margin ({selected_margin:.1f} dB >= {MIN_SAFE_MARGIN} dB) for all sensors.")


        # Guardar os parâmetros finais
        params["frequency_mhz"] = frequency_mhz
        params["spreading_factor"] = best_sf
        params["signal_bandwidth_khz"] = bw_khz
        params["coding_rate"] = f"4/{cr_denominator}"
        params["tx_power_dbm"] = tx_power_dbm
        params["preamble_length"] = preamble_length
        params["sync_word"] = sync_word_hex
        # Adicionar parâmetros informativos
        params["worst_link_margin_db"] = round(selected_margin, 1) # Renomeado
        params["antenna_gain_dbi"] = gt_dbi + gr_dbi

        # Adicionar parâmetros 'raw' para geração de código
        params["_coding_rate_raw"] = cr_denominator
        params["_sync_word_raw"] = sync_word_raw

    except json.JSONDecodeError as e:
        logger.error(f"Error decoding floor plan JSON: {e}", exc_info=True)
        errors.append("Invalid floor plan data format received.")
        # Fallback para parâmetros padrão
        params = { "spreading_factor": 9, "signal_bandwidth_khz": 125, "coding_rate": "4/5", "tx_power_dbm": 14, "error_message": "Invalid plan data." }
        params["_coding_rate_raw"] = 5; params["_sync_word_raw"] = 0x12; params["sync_word"] = hex(0x12)
        reasoning.append("Error: Could not parse floor plan data.")
        # It's safer to return here too, although this exception should ideally be caught earlier
        return params, errors, reasoning

    except Exception as e:
         logger.error(f"Error calculating LoRa parameters with floor plan: {e}", exc_info=True)
         errors.append(f"Internal error during parameter calculation: {e}")
         # Fallback para parâmetros padrão
         params = { "spreading_factor": 9, "signal_bandwidth_khz": 125, "coding_rate": "4/5", "tx_power_dbm": 14, "error_message": "Calculation failed." }
         params["_coding_rate_raw"] = 5; params["_sync_word_raw"] = 0x12; params["sync_word"] = hex(0x12)
         reasoning.append(f"Error: Parameter calculation failed - {e}")
         return params, errors, reasoning

    # Devolver parâmetros, erros e o raciocínio detalhado (only if try block completes)
    return params, errors, reasoning


def _generate_node_code(params, region, frequency):
    """Generates the Arduino/ESP32 C++ code for the sensor node."""
    sf=params['spreading_factor']; bw=params['signal_bandwidth_khz']; cr=params['_coding_rate_raw']; sync_word=params['_sync_word_raw']; tx_power=params['tx_power_dbm']; preamble=params['preamble_length']; sf_reason=params.get('spreading_factor_reason',''); tx_reason=params.get('tx_power_reason',''); sync_reason=params.get('sync_word_reason','')
    code = f"""// --- LoRa Sender Node Code ---
// Library: RadioLib (https://github.com/jgromes/RadioLib)
// Target: Arduino / ESP32 / RP2040 etc. (Check RadioLib support)

#include <RadioLib.h>

// !!! IMPORTANT !!! DEFINE YOUR BOARD'S LORA PIN CONFIGURATION HERE:
// Example: SX1276 radio = new Module(18, 26, 14, 34); // Heltec V2
SX1276 radio = new Module(PIN_LORA_SS, PIN_LORA_DIO0, PIN_LORA_RST, PIN_LORA_DIO1);

// --- Configuration Based on Your Inputs ---
float frequency = {frequency}f;        // Frequency for region: {region}
int spreadingFactor = {sf};           // Spreading Factor ({sf_reason})
float bandwidth = {bw}.0f;      // Signal Bandwidth: {bw}kHz
int codingRate = {cr};            // Coding Rate: 4/{cr}
byte syncWord = {hex(sync_word)};           // Sync Word ({sync_reason})
int txPower = {tx_power};             // TX Power: {tx_power}dBm ({tx_reason})
int preambleLength = {preamble};   // Preamble Length: {preamble}

long packetCounter = 0;

void setup() {{
  Serial.begin(115200);
  Serial.println("LoRa Sender Init...");
  int state = radio.begin(frequency);
  if (state != RADIOLIB_ERR_NONE) {{ Serial.print("Init Failed: "); Serial.println(state); while (true); }}
  Serial.println("Applying parameters...");
  radio.setSpreadingFactor({sf}); radio.setBandwidth({bw}); radio.setCodingRate({cr});
  radio.setSyncWord({hex(sync_word)}); radio.setOutputPower({tx_power}); radio.setPreambleLength({preamble});
  Serial.println("Starting loop.");
}}

void loop() {{
  packetCounter++;
  String message = "Hello LoRa! Cnt:" + String(packetCounter);
  Serial.print("Sending: "); Serial.print(message); Serial.print(" ... ");
  int state = radio.transmit((byte*)message.c_str(), message.length());
  if (state == RADIOLIB_ERR_NONE) Serial.println("Success!");
  else {{ Serial.print("Fail "); Serial.println(state); }}
  delay(10000);
}}
"""
    return code

def _generate_receiver_code(params, region, frequency, type="P2P"):
    """Generates the Arduino/ESP32 C++ code for a P2P Receiver or simple ESP32 Gateway."""
    sf=params['spreading_factor']; bw=params['signal_bandwidth_khz']; cr=params['_coding_rate_raw']; sync_word=params['_sync_word_raw']; preamble=params['preamble_length']; title_comment=f"LoRa {type} Receiver Code"; init_message=f"LoRa {type} Receiver Initializing..."; log_prefix=f"[LoRa {type}]"; forwarding_todo="// TODO: Forward data (MQTT/HTTP)" if type=="ESP32 Gateway" else ""
    code = f"""// --- {title_comment} ---
// Library: RadioLib
#include <RadioLib.h>

// !!! IMPORTANT !!! DEFINE YOUR BOARD'S LORA PINS HERE
// Example: SX1276 radio = new Module(8, 14, 12, 13); // Heltec V3
SX1276 radio = new Module(PIN_LORA_SS, PIN_LORA_DIO0, PIN_LORA_RST, PIN_LORA_DIO1);

// --- Configuration (MUST MATCH SENDER/NODES) ---
float frequency = {frequency}f; int spreadingFactor = {sf}; float bandwidth = {bw}.0f;
int codingRate = {cr}; byte syncWord = {hex(sync_word)}; int preambleLength = {preamble};

void setup() {{
  Serial.begin(115200);
  Serial.println("{init_message}");
  int state = radio.begin(frequency);
  if (state != RADIOLIB_ERR_NONE) {{ Serial.print("Init Failed: "); Serial.println(state); while (true); }}
  radio.setSpreadingFactor({sf}); radio.setBandwidth({bw}); radio.setCodingRate({cr});
  radio.setSyncWord({hex(sync_word)}); radio.setPreambleLength({preamble});
  Serial.println("{log_prefix} Starting receive...");
}}

void loop() {{
  byte byteArr[256]; int state = radio.receive(byteArr, 0); int len = radio.getPacketLength();
  if (state == RADIOLIB_ERR_NONE) {{
    Serial.print("{log_prefix} RX OK! RSSI:"); Serial.print(radio.getRSSI()); Serial.print(" SNR:"); Serial.print(radio.getSNR()); Serial.print(" Len:"); Serial.print(len);\n    Serial.print(" Data:'"); for(int i=0; i<len; i++) Serial.print((char)byteArr[i]); Serial.println("'");
    {forwarding_todo}
  }} else if (state == RADIOLIB_ERR_CRC_MISMATCH) Serial.println("{log_prefix} CRC Error!");
  // else if (state != RADIOLIB_ERR_RX_TIMEOUT) {{ Serial.print("{log_prefix} RX Fail:"); Serial.println(state); }}
}}
"""
    return code

def _generate_rpi_instructions(params, region, frequency):
    """Generates Markdown instructions for setting up a Raspberry Pi gateway."""
    param_summary=f"* Freq: {frequency}MHz ({region})\n* SF: SF{params['spreading_factor']} (Nodes)\n* BW: {params['signal_bandwidth_khz']}kHz\n* Sync: {params['sync_word']}"
    instructions = f"""### Raspberry Pi LoRa Gateway Setup Guide

**Refer to docs for your specific LoRa HAT/module & software.**

**1. Hardware:** Connect HAT/Module & Antenna to Pi. Enable SPI if needed (`sudo raspi-config`).

**2. OS & Updates:** Install Raspberry Pi OS, connect to internet, run `sudo apt update && sudo apt upgrade -y`.

**3. Gateway Software (Choose ONE):**
    * **A) ChirpStack Gateway OS:** Flash image, follow ChirpStack docs. (Recommended for LoRaWAN)
    * **B) Manual Packet Forwarder:** Clone repo, compile, configure `global_conf.json` / `local_conf.json` (freq, EUI, server), run service.
    * **C) Manufacturer Software:** Follow vendor instructions (e.g., RAK Pi OS).

**4. Config Reminder:** Ensure gateway uses correct region/freq plan & Network Server details.

**5. Node Parameters:**
{param_summary}

**6. Testing:** Check gateway logs & Network Server UI for node packets.
"""
    return instructions

# --- Main Function ---
def generate_recommendations(data):
    """
    Processes user input and generates LoRa recommendations, code, or instructions.
    Saves generated artifacts to the 'Artifacts' directory.
    Adds details about user's selected modules.
    """
    recommendations = {
        "layout": ["Place gateway centrally, ideally on a middle floor.", "Avoid metal obstructions near gateway/nodes."],
        "hardware": [], # Will be populated
        "parameters": {},
        "artifacts": {},
        "config_json": {}
    }
    all_errors = []
    logger.debug(f"Received data for recommendations: {data}")

    # --- Frequency (Step 1) ---
    region = data.get('region', 'EU868')
    frequency = REGION_FREQUENCIES.get(region, 868.0)
    if region not in REGION_FREQUENCIES: all_errors.append(f"Invalid region: {region}")
    recommendations["config_json"]["region"] = region
    recommendations["config_json"]["frequency_mhz"] = frequency

    # --- Environment Data (Step 2 related) ---
    environment_input_data = {
        'size_sqm': data.get('size_sqm'),
        'floors': data.get('floors'),
        'walls_internal': data.get('walls_internal'),
        'wall_type': data.get('wall_type')
    }

    # --- Parse Floor Plan Data --- << MOVED THIS BLOCK UP
    floorplan_data = {} # Initialize with an empty dict
    floorplan_json_string = data.get('floorplan_data')
    if floorplan_json_string:
        try:
            floorplan_data = json.loads(floorplan_json_string)
            logger.info("Successfully parsed floor plan data.")
        except json.JSONDecodeError:
            logger.error("Failed to parse floor plan JSON string.")
            all_errors.append("Invalid floor plan data format.")
            # floorplan_data remains empty, _calculate_lora_params should handle this

    # --- Calculate Parameters (using Environment and Floor Plan) --- << NOW floorplan_data is defined
    params, param_errors, param_reasoning = _calculate_lora_params(
        environment_input_data, # Passa dados do ambiente
        floorplan_data,         # Passa dados da planta parseados (or {} if parsing failed)
        region,
        frequency
    )
    all_errors.extend(param_errors)

    # Remover parâmetros internos antes de enviar para o frontend
    frontend_params = {k: v for k, v in params.items() if not k.startswith('_') and k not in ['error_message', 'warning_message']}
    if 'error_message' in params: frontend_params['calculation_status'] = params['error_message']
    if 'warning_message' in params: frontend_params['calculation_status'] = params.get('calculation_status','') + " " + params['warning_message'] # Concatena avisos

    recommendations["parameters"] = frontend_params
    recommendations["parameter_notes"] = param_reasoning # Envia o log detalhado

    # Manter os parâmetros 'raw' necessários para a geração de código no config_json
    recommendations["config_json"]["parameters"] = params.copy() # Guardar tudo internamente
    recommendations["config_json"]["floorplan"] = floorplan_data # Guardar planta parseada

    # --- Layout Advice (Step 2 related) ---
    sf = params.get('spreading_factor', 7)
    size_sqm = int(data.get('size_sqm', 100))
    floors = int(data.get('floors', 1))
    wall_type = data.get('wall_type', 'drywall')
    if sf >= 11 or size_sqm > 200 or floors > 2 or wall_type == 'concrete':
         recommendations["layout"].append(f"Your environment (Size:{size_sqm}m², Floors:{floors}, Walls:{wall_type}, resulting SF:{sf}) suggests potential range challenges. Optimize gateway placement (high, central). A LoRa repeater might be needed if devices struggle.")
    network_type = data.get('network_type', 'multi_node')
    if network_type == 'p2p':
         recommendations["layout"].append("For P2P, minimize obstructions between nodes for best signal.")
    recommendations["config_json"]["layout_tips"] = recommendations["layout"]
    recommendations["config_json"]["network_type"] = network_type

    # --- Hardware Suggestions (Step 3 & 4) ---
    # Start with general node suggestions
    recommendations["hardware"].append(HARDWARE_SUGGESTIONS["node"])

    # Add info about owned modules (Step 4)
    owned_modules_keys = data.get('owned_modules', [])
    recommendations["config_json"]["owned_modules"] = owned_modules_keys # Store selection
    if owned_modules_keys:
        owned_module_details_section = {"title": "Info on Your Selected Modules:", "items": []}
        for module_key in owned_modules_keys:
            details = LORA_MODULE_DETAILS.get(module_key)
            if details:
                # Format the details for display using markdown-like syntax for JS processing
                item_text = (
                    f"**{details['name']} ({details['type']})**:\n"
                    f"  - **Use:** {details['typical_use']}\n"
                    f"  - **Chipset:** {details['chipset']} | **Interface:** {details['interface']}\n"
                    f"  - **Notes:** {details['notes']}\n"
                    f"  - **Placement Tip:** {details['placement_advice']}"
                )
                owned_module_details_section["items"].append({"text": item_text, "is_multiline": True})
            else:
                logger.warning(f"Details not found for owned module key: {module_key}")
        if owned_module_details_section["items"]:
             # Insert this section right after the general node suggestions
             recommendations["hardware"].insert(1, owned_module_details_section)

    # Process gateway choice (Step 3)
    has_gateway = data.get('has_gateway') == 'yes'
    gateway_approach = data.get('gateway_approach')
    existing_hw = data.get('existing_hw', [])
    recommendations["config_json"]["gateway_setup"] = {
        "has_gateway": has_gateway,
        "approach": gateway_approach if not has_gateway else None,
        "existing_hw": existing_hw if not has_gateway and gateway_approach and gateway_approach.startswith('build_') else []
    }

    if has_gateway:
        recommendations["hardware"].append({"title": "Gateway Setup:", "items": ["- User indicated they already have a gateway."]})
    elif gateway_approach:
        suggestion_key = f"gateway_{gateway_approach}"
        if suggestion_key in HARDWARE_SUGGESTIONS:
            recommendations["hardware"].append(HARDWARE_SUGGESTIONS[suggestion_key])
        else:
             recommendations["hardware"].append(HARDWARE_SUGGESTIONS["gateway_easy"]) # Fallback
        if existing_hw and gateway_approach.startswith('build_'):
             notes_section = {"title": HARDWARE_SUGGESTIONS["existing_hw_notes"]["title"], "items": []}
             for hw_item in existing_hw:
                 note = HARDWARE_SUGGESTIONS["existing_hw_notes"]["notes"].get(hw_item)
                 if note: notes_section["items"].append(f"- {note}")
             if notes_section["items"]: recommendations["hardware"].append(notes_section)
    else:
         # This case should ideally not be reached if 'has_gateway' is 'no' due to form logic
         recommendations["hardware"].append({"title": "Gateway Setup:", "items": ["- Gateway setup approach not specified."]})
         recommendations["hardware"].append(HARDWARE_SUGGESTIONS["gateway_easy"]) # Default fallback

    recommendations["config_json"]["hardware_suggestions"] = recommendations["hardware"] # Store structured suggestions

    # --- Generate & Save Artifacts (Step 5) ---
    node_artifact = {
        "type": "code", "language": "cpp", "filename": "lora_node_sender.ino",
        "content": _generate_node_code(params, region, frequency),
        "title": "Sensor Node Code (Arduino/ESP32 - RadioLib)"
    }
    recommendations["artifacts"]["code_arduino_node"] = node_artifact
    _save_artifact_to_file(node_artifact) # Save the node code

    gateway_artifact = None # Initialize
    if network_type == 'p2p':
        gateway_artifact = {
            "type": "code", "language": "cpp", "filename": "lora_p2p_receiver.ino",
            "content": _generate_receiver_code(params, region, frequency, type="P2P"),
            "title": "P2P Receiver Code (Arduino/ESP32 - RadioLib)",
            "notes": "Ensure parameters match the sender exactly."
        }
    elif not has_gateway and gateway_approach == 'build_esp32':
        gateway_artifact = {
            "type": "code", "language": "cpp", "filename": "lora_esp32_gateway_receiver.ino",
            "content": _generate_receiver_code(params, region, frequency, type="ESP32 Gateway"),
            "title": "Simple ESP32 Gateway/Receiver Code (RadioLib)",
            "notes": "Basic receiver. Add forwarding logic (MQTT/HTTP). Less robust than dedicated/RPi gateways."
        }
    elif not has_gateway and gateway_approach == 'build_rpi':
         gateway_artifact = {
            "type": "instructions", "language": "markdown", "filename": "rpi_gateway_setup.md",
            "content": _generate_rpi_instructions(params, region, frequency),
            "title": "Raspberry Pi Gateway Setup Instructions",
            "notes": "High-level guide. Refer to specific hardware/software docs."
        }
    elif network_type == 'multi_node' and (has_gateway or (gateway_approach and not gateway_approach.startswith('build_'))):
        gateway_artifact = {
            "type": "instructions", "language": "markdown", "filename": "dedicated_gateway_setup.md",
            "content": f"No specific code is generated for pre-built/dedicated gateways.\n\n1.  **Follow Manufacturer Instructions:** Set up your gateway according to the documentation provided by the vendor.\n2.  **Configure LoRa Parameters:** Ensure the gateway is configured for your region ({region}) and frequency ({frequency} MHz).\n3.  **Network Server Connection:** Connect the gateway to your chosen LoRaWAN Network Server (e.g., The Things Network, ChirpStack) following their guides.\n4.  **Match Node Parameters:** Ensure the Network Server knows device parameters (like Sync Word: {params['sync_word']}) if needed.",
            "title": "Dedicated Gateway Setup Notes",
            "notes": "Configuration happens via the gateway's interface or the Network Server."
        }
    elif network_type == 'multi_node' and gateway_approach and gateway_approach.startswith('build_') and gateway_approach not in ['build_rpi', 'build_esp32']:
         gateway_artifact = {
            "type": "instructions", "language": "markdown", "filename": "sbc_pc_gateway_setup.md",
            "content": f"Setting up a gateway on a generic SBC or PC involves installing a packet forwarder and connecting it to a LoRaWAN Network Server.\n\n1.  **Install OS:** Use a suitable Linux distribution.\n2.  **Connect LoRa Module:** Connect your SPI or USB LoRa module.\n3.  **Install Packet Forwarder:** Choose compatible software (e.g., Semtech UDP Packet Forwarder, ChirpStack Gateway Bridge).\n4.  **Configure:** Set region ({region}), frequency ({frequency} MHz), server address, gateway EUI.\n5.  **Run Service:** Start the packet forwarder.\n\nRefer to documentation for your specific LoRa module and chosen packet forwarder software.",
            "title": "SBC/PC Gateway Setup Notes",
            "notes": "Requires manual installation and configuration of packet forwarding software."
        }

    if gateway_artifact:
        recommendations["artifacts"]["gateway_receiver"] = gateway_artifact
        _save_artifact_to_file(gateway_artifact) # Save the gateway/receiver artifact

    # Update config_json with artifact metadata (not full content)
    recommendations["config_json"]["artifacts"] = {
        k: {"type": v["type"], "language": v["language"], "filename": v["filename"], "title": v["title"], "notes": v.get("notes","")}
        for k, v in recommendations["artifacts"].items()
    }

    logger.info("Finished generating recommendations and saving artifacts.")
    return recommendations, all_errors
