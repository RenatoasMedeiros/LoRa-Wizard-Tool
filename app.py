# app.py
import json
from flask import Flask, render_template, request, jsonify
import os
import logging
import google.generativeai as genai
import re

from config import REGION_FREQUENCIES
from lora_logic import generate_recommendations

basedir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(basedir, 'frontend')
app = Flask(__name__, template_folder=template_dir)

basedir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(basedir, 'frontend')
static_dir = os.path.join(basedir, 'static') # Define o caminho para a pasta static

# Adiciona static_folder='static' e static_url_path='/static' (opcional, mas explícito)
app = Flask(__name__,
            template_folder=template_dir,
            static_folder=static_dir, # Informa o Flask onde estão os ficheiros estáticos
            static_url_path='/static') # URL base para aceder aos ficheiros estáticos

logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)
app.config['LOGGER_HANDLER_POLICY'] = 'always'


logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)
app.config['LOGGER_HANDLER_POLICY'] = 'always'

# --- Routes ---
@app.route('/')
def index():
    app.logger.info("Serving index page.")
    return render_template('index.html', regions=REGION_FREQUENCIES.keys())

@app.route('/pro')
def pro_index():
    app.logger.info("Serving Pro index page.")
    return render_template('pro_index.html', regions=REGION_FREQUENCIES.keys())

@app.route('/generate_config', methods=['POST'])
def generate_config_route():
    # Unchanged from previous version
    app.logger.info("Received request for /generate_config")
    try:
        user_data = request.get_json()
        if not user_data: return jsonify({"error": "No data received"}), 400
        log_data = user_data.copy(); log_data.pop('api_key', None)
        app.logger.debug(f"Processing request data (key omitted): {log_data}")
        recommendations, errors = generate_recommendations(user_data)
        if errors: return jsonify({"error": "; ".join(errors), "recommendations": recommendations}), 400
        app.logger.info("Successfully generated recommendations.")
        return jsonify({"recommendations": recommendations})
    except Exception as e:
        app.logger.error(f"Exception in /generate_config: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@app.route('/ask_ai', methods=['POST'])
def ask_ai_route():
    """Handles AI chat, including confidence checks and parameter/artifact updates."""
    app.logger.info("Received request for /ask_ai")
    ai_text_response = "Sorry, I couldn't process that request."
    updated_parameters = None
    new_artifact_data = None
    requires_confidence_input = False # Flag for frontend
    confidence_topic = None         # Topic for confidence question
    status_code = 500

    try:
        request_data = request.get_json()
        if not request_data: return jsonify({"error": "No data received"}), 400

        api_key = request_data.get('api_key')
        chat_history = request_data.get('chat_history', [])

        if not api_key: return jsonify({"error": "API Key is missing"}), 400
        if not isinstance(chat_history, list) or not chat_history:
             return jsonify({"error": "Invalid or empty chat_history provided"}), 400

        try:
            # Tentar extrair a planta do ÚLTIMO input do utilizador no histórico (se existir)
            # O frontend deve garantir que user_inputs (incluindo floorplan) está no contexto inicial
            floorplan_context = {}
            last_user_message_data = {}
            if chat_history and chat_history[-1]['role'] == 'user':
                # Tenta fazer parse do JSON dentro da mensagem do user (se o frontend o colocar lá)
                # Ou, mais robusto: o frontend envia a planta como um campo separado no request_data
                # Vamos assumir que está no contexto inicial da conversa
                if chat_history[0]['role'] == 'user' and 'Initial Context:' in chat_history[0]['parts'][0]['text']:
                    try:
                        context_str = chat_history[0]['parts'][0]['text'].split('Initial Context:')[1].split('\nFirst Question:')[0].strip()
                        initial_context = json.loads(context_str)
                        floorplan_context = initial_context.get('user_inputs', {}).get('floorplan', {})
                        if floorplan_context:
                            app.logger.info("Extracted floor plan data from initial context for AI.")
                    except Exception as parse_err:
                        app.logger.warning(f"Could not extract/parse floor plan from initial context: {parse_err}")

                genai.configure(api_key=api_key)

                # --- System Instruction Including Confidence Check ---
                system_instruction = (
                "You are an expert assistant focused *only* on LoRa technology, LoRaWAN, and related hardware/software "
                "specifically for smart home, DIY, and hobbyist applications. Do not answer questions outside this scope. "
                "Provide clear, practical advice suitable for beginners and intermediate users.\n"
                "## Floor Plan Analysis (If Provided):\n"
                "The user might provide floor plan data in the 'user_inputs.floorplan' part of the initial context. It has this structure:\n"
                "{ 'rows': R, 'cols': C, 'grid': [['type', ...], ...], 'gateway': {'row': r, 'col': c} or null, 'sensors': [{'row': r, 'col': c}, ...] }\n"
                "Where 'grid' is a 2D array (R rows, C columns), 'type' can be 'empty', 'drywall', 'brick', 'concrete', 'gateway', 'sensor'.\n"
                "**If floor plan data is present and relevant to the question:**\n"
                "- Use it to give specific advice on gateway/sensor placement (e.g., 'Move gateway near (row, col) to improve signal to sensor at (row, col)').\n"
                "- Identify potential signal dead spots caused by walls (especially 'concrete' or multiple 'brick').\n"
                "- Suggest adding repeaters (more gateways/nodes) if coverage seems challenging based on the plan.\n"
                "- Relate parameter choices (like SF) to the specific layout challenges.\n"
                "**Emoji Grid Representation:**\n"
                "When your response **directly discusses specific device placements (gateway, sensors), analyzes signal paths based on walls, or suggests moving devices according to the provided floor plan grid**, you **MUST include a visual representation of the grid using emojis**. \n"
                "Use the following emojis:\n"
                "- `empty`: ⚪️\n"
                "- `drywall`: 🟫\n"
                "- `brick`: 🧱\n"
                "- `concrete`: ⬛️\n"
                "- `gateway`: 📡\n"
                "- `sensor`: 🟩\n"
                "**Format the grid within a Markdown code block (```)** for proper alignment. Each row of the grid should be on a new line. Do not include spaces between emojis within a row.\n"
                "Example for a 3x4 grid:\n"
                "```\n"
                "⚪️⚪️🧱⚪️\n"
                "⚪️📡⚪️🟩\n"
                "⚪️⬛️⬛️⚪️\n"
                "```\n"
                "**Only include this emoji grid when your explanation actively refers to the spatial layout or positions from the `user_inputs.floorplan.grid` data.** Do not include it otherwise.\n\n"
                "## Confidence Level Check:\n"
                 "## Confidence Level Check:\n"
                 "If your explanation involves practical skills (like soldering, wiring, complex software configuration, flashing firmware) "
                 "where user experience matters significantly, **ask the user about their confidence level first**. "
                 "Phrase your question clearly and include a marker EXACTLY like this: `<<<ASK_CONFIDENCE: [Brief Topic e.g., Soldering/Wiring/Linux Config]>>>` "
                 "Example: 'This involves soldering. <<<ASK_CONFIDENCE: Soldering>>> How confident are you with soldering?' "
                 "**Stop your response there.** Wait for the user's next message, which will start with 'My confidence with [Topic] is: [Level e.g., Beginner/Confident]'. "
                 "Then, tailor the *detail level* of your *next* response accordingly (more detail for Beginner, standard for Confident). "
                 "Do NOT ask about confidence for simple explanations or parameter choices.\n"
                 "## Parameter Updates:\n"
                 "If parameters should change, include: ```json\n<<<UPDATE_PARAMS>>>{\"param\": value}<<<END_UPDATE>>>\n``` Explain why.\n"
                 "## Code Generation/Explanation:\n"
                 "Explain code clearly. Provide complete, well-commented code snippets with links if possible.\n"
                 "## Adding New Artifacts:\n"
                 "If adding a new code example/instructions, include: ```json\n<<<ADD_ARTIFACT>>>{\"title\": \"...\", \"type\": \"...\", ...}<<<END_ADD>>>\n``` Explain it."
            )
            # --- End System Instruction ---

            model = genai.GenerativeModel(
                'gemini-2.0-flash',
                 system_instruction=system_instruction
            )

            app.logger.debug(f"Starting chat with history (length {len(chat_history)})")
            chat = model.start_chat(history=chat_history[:-1])
            last_user_message = chat_history[-1]['parts'][0]['text']
            app.logger.debug(f"Sending last message to Gemini: {last_user_message[:200]}...")
            response = chat.send_message(last_user_message)
            app.logger.debug(f"Received response from Gemini.")

            if response.parts:
                 raw_text_response = response.text
                 status_code = 200
                 ai_text_response = raw_text_response

                 # --- Check for Confidence Question ---
                 confidence_match = re.search(r'<<<ASK_CONFIDENCE:\s*(.*?)\s*>>>', ai_text_response, re.IGNORECASE)
                 if confidence_match:
                     requires_confidence_input = True
                     confidence_topic = confidence_match.group(1).strip()
                     # Remove the marker from the response shown to the user
                     ai_text_response = ai_text_response.replace(confidence_match.group(0), "").strip()
                     app.logger.info(f"AI is asking for confidence level on topic: {confidence_topic}")
                 # --- End Confidence Check ---

                 # --- Parse for Parameter Updates (Only if not asking for confidence) ---
                 if not requires_confidence_input:
                     update_match = re.search(r'<<<UPDATE_PARAMS>>>(.*?)<<<END_UPDATE>>>', ai_text_response, re.DOTALL | re.IGNORECASE)
                     if update_match:
                         # (Parsing logic remains the same as previous version)
                         json_str = update_match.group(1).strip(); json_str = re.sub(r'^```json\s*|\s*```$', '', json_str, flags=re.MULTILINE)
                         app.logger.info(f"Found potential parameter update JSON: {json_str}")
                         try:
                             parsed_update = json.loads(json_str)
                             if isinstance(parsed_update, dict):
                                 valid_update = {}; allowed_keys = ["spreading_factor", "tx_power_dbm", "signal_bandwidth_khz", "coding_rate", "preamble_length", "sync_word"]
                                 for key, value in parsed_update.items():
                                     if key in allowed_keys: valid_update[key] = value
                                     else: app.logger.warning(f"Ignoring unknown parameter key: {key}")
                                 if valid_update:
                                     updated_parameters = valid_update; app.logger.info(f"Parsed valid parameter updates: {updated_parameters}")
                                     ai_text_response = ai_text_response.replace(update_match.group(0), "").strip()
                                     ai_text_response += "\n\n*(Note: Parameters updated based on discussion.)*"
                                 else: app.logger.warning("Parsed JSON for param update empty/invalid.")
                             else: app.logger.warning("Parsed param JSON not a dict.")
                         except json.JSONDecodeError as json_err: app.logger.error(f"Failed to decode param JSON: {json_err}")
                 # --- End Parameter Parsing ---

                 # --- Parse for New Artifact Addition (Only if not asking for confidence) ---
                 if not requires_confidence_input:
                     add_artifact_match = re.search(r'<<<ADD_ARTIFACT>>>(.*?)<<<END_ADD>>>', ai_text_response, re.DOTALL | re.IGNORECASE)
                     if add_artifact_match:
                         # (Parsing logic remains the same as previous version)
                         json_str = add_artifact_match.group(1).strip(); json_str = re.sub(r'^```json\s*|\s*```$', '', json_str, flags=re.MULTILINE)
                         app.logger.info(f"Found potential new artifact JSON: {json_str}")
                         try:
                             parsed_artifact = json.loads(json_str)
                             required_keys = ["title", "type", "language", "filename", "content"]
                             if isinstance(parsed_artifact, dict) and all(key in parsed_artifact for key in required_keys):
                                 new_artifact_data = parsed_artifact; app.logger.info(f"Parsed valid new artifact: {new_artifact_data.get('title')}")
                                 ai_text_response = ai_text_response.replace(add_artifact_match.group(0), "").strip()
                                 ai_text_response += f"\n\n*(Note: Added new artifact '{new_artifact_data.get('title')}'.)*"
                             else: app.logger.warning("Parsed JSON for new artifact missing keys or not a dict.")
                         except json.JSONDecodeError as json_err: app.logger.error(f"Failed to decode new artifact JSON: {json_err}")
                 # --- End New Artifact Parsing ---


            elif response.prompt_feedback.block_reason:
                 ai_text_response = f"Request blocked due to: {response.prompt_feedback.block_reason}."
                 status_code = 400
                 app.logger.warning(f"Gemini request blocked: {response.prompt_feedback.block_reason}")
            else:
                 ai_text_response = "The AI model did not provide a text response."
                 status_code = 500
                 app.logger.warning("Gemini response missing text parts.")

        except Exception as e:
            app.logger.error(f"Error calling Gemini API: {e}", exc_info=True)
            ai_text_response = f"Error communicating with the AI service: {e}. Check API key/quota."
            status_code = 401 if "API key not valid" in str(e) else 500

        # Return text answer, updates, and confidence flag
        response_payload = {"answer": ai_text_response}
        if updated_parameters:
            response_payload["updated_parameters"] = updated_parameters
        if new_artifact_data:
            response_payload["new_artifact"] = new_artifact_data
        if requires_confidence_input:
            response_payload["requires_confidence_input"] = True
            response_payload["confidence_topic"] = confidence_topic

        return jsonify(response_payload), status_code

    except Exception as e:
        app.logger.error(f"Exception occurred processing /ask_ai request: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred processing your AI request."}), 500

# --- Other routes (/health) remain the same ---
@app.route('/health')
def health_check():
    app.logger.debug("Health check endpoint called.")
    return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    app.logger.info("Starting Flask development server.")
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)

