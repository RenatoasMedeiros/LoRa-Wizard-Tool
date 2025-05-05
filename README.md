# LoRa Wizard

A web-based wizard to help hobbyists and DIY enthusiasts configure LoRa parameters, get hardware suggestions, and generate starter code for their smart home or personal projects. Features include a standard wizard and an advanced "Pro" (But Free!) version with floor plan analysis and an integrated AI assistant (with Gemini).

## Features

* **Standard Wizard:**
    * Basic recommendations based on region, environment size, and setup goals.
    * Hardware suggestions for nodes and gateways.
    * Basic LoRa parameter calculation.
    * Generates simple Arduino/ESP32 node code and receiver instructions.
* **Pro Wizard (✨ Requires Google Gemini API Key ✨):**
    * **Interactive Floor Plan Editor:** Draw walls (drywall, brick, concrete) and visually place your gateway and sensor nodes.
    * **Advanced Parameter Calculation:** Estimates link margin based on floor plan layout, device placement, and wall types to suggest an optimal Spreading Factor (SF).
    * **Detailed Environment Input:** Allows for more specific environmental details.
    * **AI Assistant (Gemini):**
        * Ask follow-up questions about recommendations, parameters, hardware, or generated code/instructions.
        * Context-aware chat initiated from specific recommendation sections or artifacts.
        * General LoRa Q&A mode.
        * Ability to suggest parameter changes or add new code artifacts during the chat.
        * Confidence level checks for complex tasks.
        * Emoji grid visualization of the floor plan in relevant AI responses.
    * **Save/Load AI Conversations:** Persist and resume chat sessions.
    * **Export Configuration:** Save the complete generated configuration (including floor plan, parameters, etc.) as a JSON file.

## Tech Stack

* **Backend:** Python 3.x, Flask
* **AI:** Gemini API
* **Frontend:** HTML, Tailwind CSS (via CDN), Vanilla JavaScript
* **Libraries:**
    * Python: `Flask`, `google-generativeai`
    * JavaScript (via CDN): `marked.js` (Markdown rendering), `Prism.js` (Syntax highlighting), Font Awesome (Icons)

## Getting Started

### Prerequisites

* Python 3.8+
* `pip` (Python package installer)
* A Google Gemini API Key (for Pro features): Get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/RenatoasMedeiros/LoRa-Wizard-Tool
    cd LoRa-Wizard-Tool
    ```

2.  **Create and activate a virtual environment (Recommended):**
    ```bash
    # Windows
    python -m venv venv
    .\venv\Scripts\activate

    # macOS/Linux
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    Create a file named `requirements.txt` in the root directory with the following content:
    ```txt
    Flask>=2.0
    google-generativeai>=0.5
    ```
    Then run:
    ```bash
    pip install -r requirements.txt
    ```
    *(Alternatively, install manually: `pip install Flask google-generativeai`)*

4.  **API Key:** The Pro Wizard requires a Google Gemini API Key. You will need to enter this key directly into the input field provided in the Pro Wizard web interface (`/pro`). *Note: The key is sent to the backend for AI requests but is not stored persistently by this application.*

### Running the App

1.  **Start the Flask server:**
    ```bash
    python app.py
    ```
    *(For development with auto-reload, you can often run `flask run` after setting `FLASK_APP=app.py` and `FLASK_DEBUG=1` environment variables, but `python app.py` is simpler)*

2.  **Access the Wizards:**
    * **Standard Wizard:** Open your web browser and go to `http://127.0.0.1:5000/` (or `http://localhost:5000/`)
    * **Pro Wizard:** Open your web browser and go to `http://127.0.0.1:5000/pro`

## Usage

1.  Navigate to either the Standard (`/`) or Pro (`/pro`) version in your browser.
2.  **Pro Version:** Enter your Gemini API Key in the designated field.
3.  Fill out the form sections regarding your region, environment, setup goals, and any existing hardware you own.
4.  **Pro Version (Optional):** Use the floor plan editor to draw walls and place your gateway and sensors. Select tools from the toolbar and click/drag on the grid.
5.  Click "Generate Recommendations".
6.  Review the generated layout tips, hardware suggestions, LoRa parameters, and code/instruction artifacts.
7.  **Pro Version:**
    * Use the "Ask AI" buttons next to sections or artifacts to chat with the AI assistant for clarification or further details.
    * Use the "Ask AI (General)" button for broader LoRa questions.
    * Save/Load AI chat conversations using the buttons in the API key section.
    * Export the full configuration as JSON using the button below the parameters table.
8.  Generated code and instruction files will be saved automatically in the `Artifacts` folder within the project directory.

## Configuration

You can modify default values and suggestions by editing `config.py`:

* `REGION_FREQUENCIES`: Add/modify LoRa frequency bands for different regions.
* `HARDWARE_SUGGESTIONS`: Update links, notes, or add/remove suggested hardware items.
* `LORA_MODULE_DETAILS`: Add details for more specific LoRa modules you own or use frequently.
* `DEFAULT_LORA_PARAMS`: Change default parameter values used in calculations.
* `WALL_LOSS_DB`, `FLOOR_LOSS_DB`: Adjust estimated signal loss values (used in Pro floor plan calculation).

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs, feature requests, or improvements.
