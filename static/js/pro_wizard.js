document.addEventListener('DOMContentLoaded', () => {

    // --- Elementos do DOM ---
    // Obtém todos os elementos necessários aqui, uma vez.
    const form = document.getElementById('lora-wizard-form');
    const resultsSection = document.getElementById('results-section');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const submitButton = document.getElementById('submit-button');
    const gatewayOptionsSection = document.getElementById('gateway-options-section');
    const gatewayApproachSelect = document.getElementById('gateway_approach');
    const hasGatewayRadios = document.querySelectorAll('input[name="has_gateway"]');

    const existingHardwareSection = document.getElementById('existing-hardware-section');
    const artifactsContainer = document.getElementById('artifacts-container');
    const artifactTemplate = document.getElementById('artifact-template'); // Fetched here

    if (!artifactTemplate) {
        console.error("CRITICAL ERROR: Template element (id='artifact-template') NOT FOUND immediately on DOMContentLoaded!");
        // return;
    } else {
        console.log("OK: Template element (id='artifact-template') FOUND immediately on DOMContentLoaded.");
    }

    // Floor Plan Elements
    const gridContainer = document.getElementById('floorplan-grid-container');
    const floorplanGridElement = document.getElementById('floorplan-grid');
    const gridRowsInput = document.getElementById('grid_rows');
    const gridColsInput = document.getElementById('grid_cols');
    const createGridButton = document.getElementById('create-grid-button');
    const clearGridButton = document.getElementById('clear-grid-button');
    const toolbar = document.getElementById('toolbar'); // Usa ID
    const selectedToolIndicator = document.getElementById('selected-tool-indicator');
    const floorplanDataInput = document.getElementById('floorplan_data');
    const jsonOutputElement = document.getElementById('json-output');
    // AI Chat Modal Elements
    const aiResponseModal = document.getElementById('ai-response-modal');
    const aiChatHistory = document.getElementById('ai-chat-history');
    const aiChatForm = document.getElementById('ai-chat-form');
    const aiChatInput = document.getElementById('ai-chat-input');
    const aiSendButton = document.getElementById('ai-send-button');
    const closeAiModalButton = document.getElementById('close-ai-modal');
    const closeAiModalFooterButton = document.getElementById('close-ai-modal-footer');
    const aiConfidenceButtonsContainer = document.getElementById('ai-confidence-buttons');
    // Load/Start Chat Elements
    const loadConversationButton = document.getElementById('load-conversation-button');
    const conversationFileInput = document.getElementById('conversation-file-input');
    const loadStatus = document.getElementById('load-status');
    const loadStatusMd = document.getElementById('load-status-md');
    const startGeneralChatButton = document.getElementById('start-general-chat-button');
    

     // Variáveis de estado globais
     let currentConfigJson = {};
     let currentRecommendations = {};
     let currentChatHistory = [];
     let currentAIContext = {};
     let artifactCounter = 0;
     let pendingConfidenceTopic = null;
     // Estado do Floor Plan
     let floorPlanGrid = null;
     let numRows = 10;
     let numCols = 10;
     let selectedTool = 'empty';
     let gatewayPosition = null;
     let sensorPositions = [];
     let isMouseDown = false;


    // --- Event Listeners ---
    // Verifica a existência de cada elemento antes de adicionar o listener

    if (form) {
        form.addEventListener('submit', handleSubmit);
    } else { console.error("Form not found"); }

    // Delegação de eventos para cliques gerais (Ask AI, Copy, Export, Toggle Details)
    // Anexado a um container que engloba a secção de resultados
    const resultsContainerParent = document.getElementById('results-section')?.parentNode; // Ou um ID mais específico se necessário
    if (resultsContainerParent) {
         resultsContainerParent.addEventListener('click', handleGeneralClicks);
    } else { console.warn("Parent container for results section not found for general click delegation."); }

    if (gatewayApproachSelect) {
        gatewayApproachSelect.addEventListener('change', (event) => toggleExistingHardwareSection(event.target.value));
    }

    if (hasGatewayRadios.length > 0) {
        hasGatewayRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                // Call toggleGatewayOptions based on the value ('yes' or 'no')
                const showOptions = event.target.value === 'no';
                toggleGatewayOptions(showOptions);
            });
        });
        // Call once initially based on the default checked state
        const initiallyChecked = document.querySelector('input[name="has_gateway"]:checked');
        if (initiallyChecked) {
             toggleGatewayOptions(initiallyChecked.value === 'no');
        }

    } else { console.error("Has Gateway radio buttons not found"); }

    // Listener específico para a Toolbar (para seleção de ferramentas)
    if (toolbar) {
        console.log("Attaching click listener to toolbar:", toolbar);
        toolbar.addEventListener('click', handleToolSelection); // Chama o handler correto
    } else {
        console.error("Toolbar element (id='toolbar') not found, cannot attach tool selection listener.");
    }

    // Listeners do Floor Plan Grid
    if (floorplanGridElement) {
        floorplanGridElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { isMouseDown = true; handleGridInteraction(e); }
        });
        floorplanGridElement.addEventListener('mouseover', handleGridInteraction);
        floorplanGridElement.addEventListener('mouseleave', () => { isMouseDown = false; });
        floorplanGridElement.addEventListener('dragstart', (e) => e.preventDefault());
    } else { console.error("Floorplan grid element not found."); }

    // Listeners dos Botões de Controlo da Grelha
    if (createGridButton && gridRowsInput && gridColsInput) {
        createGridButton.addEventListener('click', () => {
            const rows = parseInt(gridRowsInput.value, 10);
            const cols = parseInt(gridColsInput.value, 10);
            createFloorPlanGrid(rows, cols);
        });
    } else { console.error("Grid control elements (button or inputs) not found."); }

    if (clearGridButton) {
         clearGridButton.addEventListener('click', clearFloorPlan);
    } else { console.error("Clear grid button not found."); }

    // Listener global para mouseup
    document.body.addEventListener('mouseup', (e) => {
         if (e.button === 0) { isMouseDown = false; }
    });

    // Listeners do Chat AI
    if (aiChatForm) aiChatForm.addEventListener('submit', handleSendChatMessage); else console.error("AI Chat Form not found");
    if (closeAiModalButton) closeAiModalButton.addEventListener('click', closeChatModal); else console.error("Close AI Modal button not found");
    if (closeAiModalFooterButton) closeAiModalFooterButton.addEventListener('click', closeChatModal); else console.error("Close AI Modal Footer button not found");
    if (loadConversationButton) loadConversationButton.addEventListener('click', () => { if(conversationFileInput) conversationFileInput.click(); }); else console.error("Load Chat button not found");
    if (conversationFileInput) conversationFileInput.addEventListener('change', handleFileLoad); else console.error("Conversation file input not found");
    if (startGeneralChatButton) startGeneralChatButton.addEventListener('click', handleGeneralAIChat); else console.error("Start General Chat button not found");

    // Delegação de eventos para o modal AI (para botões de confiança)
    if (aiResponseModal) {
        aiResponseModal.addEventListener('click', (event) => {
            if (event.target.classList.contains('confidence-button')) {
                handleConfidenceButtonClick(event);
            }
        });
    } else { console.error("AI Response Modal not found"); }


    // --- Definições de Funções ---

    // --- Main Handler ---
    async function handleSubmit(event) {
        event.preventDefault();
        const currentResultsSection = document.getElementById('results-section');
        if (!currentResultsSection || !form) { console.error("Form or results section not found."); showError("Internal error: UI components missing."); return; }
        clearResults();
        showLoading(true);
        const apiKeyInput = document.getElementById('api_key');
        if (!apiKeyInput || !apiKeyInput.value) { showError("API Key is required for Pro features."); showLoading(false); apiKeyInput?.focus(); return; }

        updateHiddenInput();

        const formData = new FormData(form);
        const existingHwValues = Array.from(formData.getAll('existing_hw'));
        const ownedModulesValues = Array.from(formData.getAll('owned_modules'));
        const data = {};
        formData.forEach((value, key) => { if (key !== 'existing_hw' && key !== 'owned_modules') { data[key] = value; } });
        data.existing_hw = existingHwValues; data.owned_modules = ownedModulesValues;
        data.environment = { size_sqm: data.size_sqm, floors: data.floors, walls_internal: data.walls_internal, wall_type: data.wall_type, details: data.environment_details };
        delete data.grid_rows; delete data.grid_cols;
        if (data.has_gateway === 'yes') { delete data.gateway_approach; delete data.existing_hw; }

        console.log("Sending data (API Key omitted):", {...data, api_key: '***'});

        try {
            const response = await fetch('/generate_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || `HTTP error! status: ${response.status}`); }

            const finalResultsSection = document.getElementById('results-section');
            if (!finalResultsSection) throw new Error("Results section became unavailable after fetch.");

            currentRecommendations = result.recommendations || {};
            currentConfigJson = currentRecommendations.config_json || {};
            if (floorplanDataInput && floorplanDataInput.value && !currentConfigJson.floorplan) {
                 try { currentConfigJson.floorplan = JSON.parse(floorplanDataInput.value); } catch(e) { console.error("Could not parse floorplan data for config export"); }
            }

            displayResults(currentRecommendations);
            finalResultsSection.classList.remove('hidden');
            finalResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error('Error fetching/displaying recommendations:', error);
            showError(`Failed to generate recommendations: ${error.message}`);
        } finally { showLoading(false); }
    }

    // --- Handle Clicks (Delegated from mainContainer) ---
    function handleGeneralClicks(event) {
        // Ignora cliques dentro da toolbar e da grelha
        if (event.target.closest('#toolbar') || event.target.closest('#floorplan-grid')) {
             return;
        }

        // Tenta encontrar os botões alvo
        const askAiButton = event.target.closest('.ask-ai-button');
        const copyButton = event.target.closest('.copy-button');
        const exportButton = event.target.closest('#export-json-button');
        const toggleDetailsButton = event.target.closest('#toggle-details-button');

        // Log para depuração
        console.log("handleGeneralClicks - Click target:", event.target);
        console.log("Found buttons:", { askAiButton, copyButton, exportButton, toggleDetailsButton });

        // Executa a ação correspondente
        if (copyButton) {
            console.log("Copy button clicked");
            copyContentToClipboard(copyButton.dataset.target, copyButton);
        } else if (exportButton) {
            console.log("Export button clicked");
            exportConfigAsJson(currentConfigJson, 'lora_pro_config.json');
        } else if (toggleDetailsButton) {
            console.log("Toggle details button clicked");
             const notesContainer = document.getElementById('parameter-notes');
             if (notesContainer) {
                 const isHidden = notesContainer.classList.toggle('hidden');
                 toggleDetailsButton.textContent = isHidden ? 'Show Calculation Details »' : 'Hide Calculation Details «';
             } else { console.error("Parameter notes container not found for toggle."); }
        } else if (askAiButton) {
            console.log("Ask AI button clicked, context:", askAiButton.dataset.context); // Log específico para Ask AI
            const context = askAiButton.dataset.context;
            const artifactCard = askAiButton.closest('.artifact-card');
            const artifactKey = artifactCard ? artifactCard.dataset.artifactKey : null;
            if (!askAiButton.disabled) {
                 handleAskAIInitiation(context, askAiButton, artifactKey);
            } else {
                 console.log("Ask AI button is disabled, ignoring click.");
            }
        }
    }

    // --- Ask AI Implementation ---
    async function handleAskAIInitiation(context, buttonElement, artifactKey = null) {
        console.log(`Ask AI initiation for context: ${context}` + (artifactKey ? ` (artifact: ${artifactKey})` : ''));
        const originalButtonContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Starting...`;
        buttonElement.disabled = true;

        // Limpa histórico e contexto ANTES de preencher
        currentChatHistory = [];
        if (aiChatHistory) aiChatHistory.innerHTML = ''; else console.error("AI Chat history element not found for clearing");
        
        // Obter a planta ATUALIZADA do input escondido
        let floorplanContext = {};
        try {
             floorplanContext = floorplanDataInput ? JSON.parse(floorplanDataInput.value) : {};
             console.log("Floorplan data for AI context:", floorplanContext); // Log para depuração
        } catch(e) { console.error("Could not parse floorplan data for AI context"); }


        currentAIContext = { context: context, data: null, user_inputs: currentConfigJson || {} }; // Reinicia contexto

        try {
            // Obter dados de contexto
            if (context === 'layout') currentAIContext.data = currentRecommendations.layout || [];
            else if (context === 'hardware') currentAIContext.data = currentRecommendations.hardware || [];
            else if (context === 'parameters') currentAIContext.data = currentRecommendations.parameters || {};
            else if (artifactKey && currentRecommendations.artifacts?.[artifactKey]) {
                currentAIContext.data = currentRecommendations.artifacts[artifactKey];
                context = artifactKey; // Atualiza contexto para a chave do artefacto
            } else if (context === 'floorplan') { // Contexto específico para a planta
                currentAIContext.data = floorplanContext; // Define data como a própria planta
           }
           else { throw new Error(`Unknown or missing AI context/artifact: ${context}/${artifactKey}`); }


            // Verificar se os dados estão vazios
            if (!currentAIContext.data || (Array.isArray(currentAIContext.data) && currentAIContext.data.length === 0) || (typeof currentAIContext.data === 'object' && Object.keys(currentAIContext.data).length === 0) ) {
                console.warn(`Context data for '${context}' is empty.`);
                currentAIContext.data = `(No specific data available for ${context})`;
            }

            // Construir pergunta inicial
            let initialQuestion = `Explain the recommendations provided for ${context}. Focus on LoRa for smart homes/DIY.`;
            if (context === 'floorplan') {
                initialQuestion = "Analyze this floor plan data. Based on the walls and device placements, suggest improvements for LoRa coverage. Where are potential dead spots? Is the gateway placement good? Are repeaters needed?";
            } else if (artifactKey) {
                const artifactType = currentAIContext.data.type || 'item';
                initialQuestion = `Explain this ${artifactType} (${currentAIContext.data.title || 'untitled'}). What does it do? How can I improve it or use it differently?`;
                if (currentAIContext.data.type === 'code') { initialQuestion += ` If you provide code examples, ensure they are well-commented.`; }
            }

            // Adicionar ao histórico e mostrar
            const firstUserMessage = `Initial Context: ${JSON.stringify(currentAIContext)} \n First Question: ${initialQuestion}`;
            currentChatHistory.push({ role: 'user', parts: [{ text: firstUserMessage }] });
            displayChatMessage('user', `Asking about ${context}...`); // Mostra mensagem simples

            // Abrir modal e chamar backend
            if (aiResponseModal) aiResponseModal.classList.remove('hidden'); else console.error("AI Response Modal not found");
            await askAIBackend();

        } catch (err) {
            showError(`Error starting AI chat: ${err.message}`);
            console.error("Error preparing context:", err);
        } finally {
            // Restaurar botão
            buttonElement.innerHTML = originalButtonContent;
            buttonElement.disabled = false;
        }
    }

    function handleGeneralAIChat() {
        console.log("Starting general AI chat.");
        if (aiChatHistory) aiChatHistory.innerHTML = ''; else console.error("AI Chat history element not found for clearing");

        if (currentChatHistory && currentChatHistory.length > 0) {
            console.log("Using loaded chat history.");
            currentChatHistory.forEach(msg => {
                if (msg.parts?.[0]?.text) { displayChatMessage(msg.role, msg.parts[0].text); }
            });
            displayChatMessage('model', "Loaded conversation continued. Ask your next question.");
        } else {
            console.log("Starting fresh chat.");
            currentChatHistory = []; // Garante que está vazio
            displayChatMessage('model', "Ask me anything about LoRa for smart homes or DIY projects!");
        }
        currentAIContext = {}; // Limpa contexto específico
        if (aiResponseModal) aiResponseModal.classList.remove('hidden'); else console.error("AI Response Modal not found");
        if (aiChatInput) aiChatInput.focus(); else console.error("AI Chat input not found");
        setChatInputEnabled(true);
    }

    async function handleSendChatMessage(event) {
        event.preventDefault();
        if (!aiChatInput) { console.error("AI Chat input not found"); return; }
        const userMessage = aiChatInput.value.trim();
        if (!userMessage) return;

        displayChatMessage('user', userMessage);
        currentChatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
        aiChatInput.value = '';
        await askAIBackend();
    }

    async function handleConfidenceButtonClick(event) {
        // A lógica aqui permanece a mesma, assume que o event delegation funciona
        const level = event.target.dataset.level;
        const topic = pendingConfidenceTopic || "this topic";

        if (aiConfidenceButtonsContainer) {
            aiConfidenceButtonsContainer.innerHTML = '';
            aiConfidenceButtonsContainer.classList.add('hidden');
        } else { console.error("Confidence buttons container not found"); }
        setChatInputEnabled(true);

        const userConfidenceMessage = `My confidence with ${topic} is: ${level}`;
        displayChatMessage('user', userConfidenceMessage);
        currentChatHistory.push({ role: 'user', parts: [{ text: userConfidenceMessage }] });

        await askAIBackend();
    }

    async function askAIBackend() {
        const apiKeyInput = document.getElementById('api_key'); // Re-get just in case
        const apiKey = apiKeyInput ? apiKeyInput.value : null;
        if (!apiKey) { displayChatMessage('model', 'Error: API Key is missing.'); return; }

        setChatInputEnabled(false);
        const thinkingMsg = displayChatMessage('model', '<i class="fas fa-spinner fa-spin mr-2"></i>Thinking...', false);
        pendingConfidenceTopic = null;

        try {
            const payload = { api_key: apiKey, chat_history: currentChatHistory };
            console.log("Sending to /ask_ai:", { api_key_present: !!apiKey, chat_history_length: payload.chat_history.length });
            const response = await fetch('/ask_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (thinkingMsg) thinkingMsg.remove(); // Remove "Thinking..." message

            if (!response.ok) { throw new Error(result.error || result.answer || `HTTP error! Status: ${response.status}`); }

            const aiResponseText = result.answer || "Sorry, I didn't get a response.";
            displayChatMessage('model', aiResponseText);
            currentChatHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });

            // Handle Confidence Check
            if (result.requires_confidence_input) {
                pendingConfidenceTopic = result.confidence_topic || "this task";
                displayConfidenceButtons(pendingConfidenceTopic);
                setChatInputEnabled(false); // Keep disabled
            } else {
                setChatInputEnabled(true); // Enable if no confidence needed
            }

            // Handle Parameter Updates
            if (result.updated_parameters && typeof result.updated_parameters === 'object') {
                console.log("Received parameter updates:", result.updated_parameters);
                let paramsUpdated = false;
                for (const key in result.updated_parameters) {
                    if (currentRecommendations.parameters?.hasOwnProperty(key)) {
                        currentRecommendations.parameters[key] = result.updated_parameters[key];
                        paramsUpdated = true;
                        if (currentConfigJson.parameters?.hasOwnProperty(key)) {
                            currentConfigJson.parameters[key] = result.updated_parameters[key];
                        }
                    }
                }
                if (paramsUpdated) {
                    // Chama displayParameters com as notas existentes (ou atualizadas se a IA as fornecer)
                    displayParameters(currentRecommendations.parameters, currentRecommendations.parameter_notes);
                }
            }

            // Handle New Artifact
            if (result.new_artifact && typeof result.new_artifact === 'object') {
                console.log("Received new artifact:", result.new_artifact);
                const newArtifactKey = `ai_added_${artifactCounter++}`;
                currentRecommendations.artifacts = currentRecommendations.artifacts || {};
                currentRecommendations.artifacts[newArtifactKey] = result.new_artifact;
                currentConfigJson.artifacts = currentConfigJson.artifacts || {};
                currentConfigJson.artifacts[newArtifactKey] = { type: result.new_artifact.type, language: result.new_artifact.language, filename: result.new_artifact.filename, title: result.new_artifact.title, notes: result.new_artifact.notes || "" };
                addArtifactCard(newArtifactKey, result.new_artifact); // Adiciona ao DOM
                // Highlight após adicionar
                setTimeout(() => {
                    const currentArtifactsContainer = document.getElementById('artifacts-container'); // Re-get container
                    const newCard = currentArtifactsContainer?.querySelector(`[data-artifact-key="${newArtifactKey}"]`);
                    const codeBlock = newCard?.querySelector('.code-container:not(.hidden) code');
                    if (codeBlock) {
                        try {
                             Prism.highlightElement(codeBlock); // Highlight específico
                             console.log("Highlighted new artifact:", newArtifactKey);
                        } catch(e) { console.error("Error highlighting new artifact code:", e); }
                    } else { console.warn("Could not find code block to highlight for new artifact:", newArtifactKey); }
                 }, 50);
            }

        } catch (error) {
            console.error("Ask AI fetch error:", error);
            if (thinkingMsg) thinkingMsg.remove();
            displayChatMessage('model', `Error: ${error.message}`);
            setChatInputEnabled(true); // Re-enable on error
        }

        // Re-enable input if no confidence check is pending
        if (!pendingConfidenceTopic) {
            setChatInputEnabled(true);
            if (aiChatInput) aiChatInput.focus();
        }
    }

    // --- Chat Display & Confidence Buttons ---
    function displayChatMessage(role, content, isHidden = false) {
        if (!aiChatHistory) { console.error("AI Chat history element not found."); return null; } // Verifica se existe
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', role);
        if (isHidden) { messageDiv.classList.add('hidden'); }

        const roleSpan = document.createElement('strong');
        roleSpan.textContent = role === 'user' ? 'You' : 'AI Assistant';
        messageDiv.appendChild(roleSpan);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('markdown-content');
        // Use try-catch for marked.parse as it might fail with invalid input
        try {
            contentDiv.innerHTML = marked.parse(content || "");
        } catch(e) {
            console.error("Error parsing markdown:", e);
            contentDiv.textContent = content || ""; // Fallback to plain text
        }
        messageDiv.appendChild(contentDiv);

        aiChatHistory.appendChild(messageDiv);
        aiChatHistory.scrollTop = aiChatHistory.scrollHeight; // Scroll to bottom
        return messageDiv; // Retorna o elemento criado
    }

    function displayConfidenceButtons(topic) {
        if (!aiConfidenceButtonsContainer) { console.error("Confidence buttons container not found"); return; }
        aiConfidenceButtonsContainer.innerHTML = '';
        aiConfidenceButtonsContainer.classList.remove('hidden');

        const prompt = document.createElement('p');
        prompt.textContent = `Regarding ${topic}, how confident do you feel?`;
        prompt.className = "text-sm text-center text-gray-600 mb-2";
        aiConfidenceButtonsContainer.appendChild(prompt);

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = "flex justify-center gap-4";

        ['Beginner', 'Confident'].forEach(level => {
            const button = document.createElement('button');
            button.textContent = level;
            button.dataset.level = level;
            button.classList.add('confidence-button');
            if (level === 'Beginner') button.classList.add('beginner');
            if (level === 'Confident') button.classList.add('confident');
            buttonWrapper.appendChild(button);
        });

        aiConfidenceButtonsContainer.appendChild(buttonWrapper);
        if (aiChatHistory) aiChatHistory.scrollTop = aiChatHistory.scrollHeight; // Scroll
    }

    function setChatInputEnabled(enabled) {
        if (aiChatInput) aiChatInput.disabled = !enabled; else console.error("AI Chat Input not found for enabling/disabling");
        if (aiSendButton) aiSendButton.disabled = !enabled; else console.error("AI Send Button not found for enabling/disabling");
        if (aiChatForm) aiChatForm.classList.toggle('opacity-50', !enabled); else console.error("AI Chat Form not found for opacity toggle");
    }

    // --- Save/Load Chat ---
    function closeChatModal() {
        if (currentChatHistory?.length > 0) {
            const nonHiddenMessages = currentChatHistory.filter(msg => !(msg.role === 'user' && msg.parts[0]?.text.startsWith('Initial Context:'))).length;
            if (nonHiddenMessages > 0 && confirm("Save chat?")) {
                saveConversationToFile(currentChatHistory);
            }
        }
        if (aiResponseModal) aiResponseModal.classList.add('hidden'); else console.error("AI Response Modal not found for closing");
        if (aiConfidenceButtonsContainer) aiConfidenceButtonsContainer.classList.add('hidden'); else console.error("Confidence buttons container not found");
        setChatInputEnabled(true); // Ensure input is enabled when closing
    }

    function saveConversationToFile(history) {
        try {
            const historyToSave = history.filter(msg => !(msg.role === 'user' && msg.parts[0]?.text.startsWith('Initial Context:')));
            const filename = `lora_ai_chat_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
            const jsonString = JSON.stringify(historyToSave, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log("Conversation saved.");
        } catch (err) {
            console.error("Failed to save conversation:", err);
            alert("Error saving conversation.");
        }
    }

    function handleFileLoad(event) {
        const file = event.target.files[0];
        const statusEl = window.innerWidth >= 768 ? loadStatusMd : loadStatus;
        if (statusEl) statusEl.textContent = ''; // Clear status only if found
        else console.error("Load status element not found");

        if (!file) return;
        if (file.type !== 'application/json') {
            if (statusEl) statusEl.textContent = 'Error: JSON file required.';
            if (conversationFileInput) conversationFileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedHistory = JSON.parse(e.target.result);
                if (Array.isArray(loadedHistory) && loadedHistory.every(msg => msg.role && msg.parts)) {
                    currentChatHistory = loadedHistory;
                    if (statusEl) statusEl.textContent = `Loaded: ${file.name}`;
                    console.log("Loaded chat history:", currentChatHistory);
                    alert(`Chat '${file.name}' loaded. Click 'Ask AI (General)' to continue.`);
                } else {
                    throw new Error("Invalid chat format.");
                }
            } catch (err) {
                console.error("Error loading file:", err);
                if (statusEl) statusEl.textContent = `Error: ${err.message}`;
                currentChatHistory = []; // Reset history on error
            } finally {
                if (conversationFileInput) conversationFileInput.value = ''; // Clear input value
            }
        };
        reader.onerror = (e) => {
            console.error("FileReader error:", e);
            if (statusEl) statusEl.textContent = 'Error reading file.';
            if (conversationFileInput) conversationFileInput.value = '';
        };
        reader.readAsText(file);
    }

    // --- Funções do Floor Plan Editor ---
    function createFloorPlanGrid(rows, cols) { 
        if (!floorplanGridElement) { console.error("Grid element not found."); return; }
        console.log(`Creating grid: ${rows}x${cols}`);
        numRows = Math.max(3, Math.min(rows, 50)); numCols = Math.max(3, Math.min(cols, 50));
        if (gridRowsInput) gridRowsInput.value = numRows; if (gridColsInput) gridColsInput.value = numCols;
        floorPlanGrid = Array(numRows).fill(null).map(() => Array(numCols).fill('empty'));
        gatewayPosition = null; sensorPositions = [];
        floorplanGridElement.innerHTML = '';
        floorplanGridElement.style.gridTemplateRows = `repeat(${numRows}, 25px)`;
        floorplanGridElement.style.gridTemplateColumns = `repeat(${numCols}, 25px)`;
        for (let r = 0; r < numRows; r++) { for (let c = 0; c < numCols; c++) { const cell = document.createElement('div'); cell.classList.add('grid-cell'); cell.dataset.row = r; cell.dataset.col = c; floorplanGridElement.appendChild(cell); } }
        updateHiddenInput();
    }

    // ** FUNÇÃO CORRIGIDA E COM LOGS **
    function handleToolSelection(event) {
        console.log("handleToolSelection called. Click target:", event.target); // Log 1
        const button = event.target.closest('.tool-button');
        console.log("Found button:", button); // Log 2

        if (!button || !toolbar) {
            console.error("Tool button or toolbar not found in handleToolSelection.");
            return;
        }

        selectedTool = button.dataset.tool;
        console.log("Selected tool:", selectedTool); // Log 3

        if (selectedToolIndicator) {
            selectedToolIndicator.textContent = `Selecionado: ${button.textContent.trim()}`;
        } else { console.error("Selected tool indicator not found."); }

        try {
            const toolButtons = toolbar.querySelectorAll('.tool-button');
            if (toolButtons.length > 0) {
                 toolButtons.forEach(btn => { btn.classList.remove('active'); });
                 button.classList.add('active');
                 console.log("Active class updated on buttons."); // Log 4
            } else { console.error("No tool buttons found inside toolbar to update active state."); }
        } catch (e) { console.error("Error updating button active states:", e); }
    }


    function handleGridInteraction(event) { 
        if (event.type === 'mouseover' && !isMouseDown) { return; }
        const cell = event.target.closest('.grid-cell'); if (!cell) return;
        const row = parseInt(cell.dataset.row, 10); const col = parseInt(cell.dataset.col, 10);
        if (isNaN(row) || isNaN(col)) return;
        applyTool(cell, row, col);
    }

    // Função applyTool CORRIGIDA
    function applyTool(cellElement, row, col) { /* ... (igual à versão anterior corrigida) ... */
        if (!floorPlanGrid || row < 0 || row >= numRows || col < 0 || col >= numCols) { console.error("Invalid coordinates or grid not initialized in applyTool"); return; }
        const currentCellType = floorPlanGrid[row][col]; let newType = selectedTool;
        if (newType !== 'empty') { if ((currentCellType === 'gateway' || currentCellType === 'sensor') && ['drywall', 'brick', 'concrete'].includes(newType)) { console.warn("Cannot place wall over device."); return; } if (['drywall', 'brick', 'concrete'].includes(currentCellType) && ['gateway', 'sensor'].includes(newType)) { console.warn("Cannot place device over wall."); return; } }
        if (currentCellType === 'gateway' && newType !== 'gateway') { gatewayPosition = null; cellElement.innerHTML = ''; } else if (currentCellType === 'sensor' && newType !== 'sensor') { sensorPositions = sensorPositions.filter(p => !(p.row === row && p.col === col)); cellElement.innerHTML = ''; }
        if (newType === 'gateway') { if (currentCellType === 'gateway') return; if (gatewayPosition && (gatewayPosition.row !== row || gatewayPosition.col !== col)) { const oldCell = floorplanGridElement?.querySelector(`[data-row="${gatewayPosition.row}"][data-col="${gatewayPosition.col}"]`); if (oldCell) { oldCell.classList.remove('device-gateway'); oldCell.innerHTML = ''; updateGridState(gatewayPosition.row, gatewayPosition.col, 'empty'); } } gatewayPosition = { row, col }; cellElement.innerHTML = '<i class="fas fa-wifi"></i>'; }
        else if (newType === 'sensor') { const sensorExists = sensorPositions.some(p => p.row === row && p.col === col); if (sensorExists) return; sensorPositions.push({ row, col }); cellElement.innerHTML = '<i class="fas fa-broadcast-tower"></i>'; }
        else if (newType === 'empty') { cellElement.innerHTML = ''; }
        if (currentCellType !== newType) { updateGridState(row, col, newType); console.log(`[${row},${col}] Changing visual from "${currentCellType}" to "${newType}". Initial classes:`, cellElement.className); cellElement.classList.remove( 'wall-drywall', 'wall-brick', 'wall-concrete', 'device-gateway', 'device-sensor' ); console.log(`[${row},${col}] After removing classes. Current classes:`, cellElement.className); let classAdded = 'none'; if (newType === 'drywall') { cellElement.classList.add('wall-drywall'); classAdded = 'wall-drywall'; } else if (newType === 'brick') { cellElement.classList.add('wall-brick'); classAdded = 'wall-brick'; } else if (newType === 'concrete') { cellElement.classList.add('wall-concrete'); classAdded = 'wall-concrete'; } else if (newType === 'gateway') { cellElement.classList.add('device-gateway'); classAdded = 'device-gateway'; } else if (newType === 'sensor') { cellElement.classList.add('device-sensor'); classAdded = 'device-sensor'; } console.log(`[${row},${col}] Added class: "${classAdded}". Final classes:`, cellElement.className); if (newType !== 'gateway' && newType !== 'sensor') { if (cellElement.innerHTML !== '') { console.log(`[${row},${col}] Clearing innerHTML because type is "${newType}"`); cellElement.innerHTML = ''; } } else { let expectedIconClass = (newType === 'gateway') ? 'fa-wifi' : 'fa-broadcast-tower'; if (!cellElement.querySelector(`i.fas.${expectedIconClass}`)) { console.log(`[${row},${col}] Re-adding icon for "${newType}"`); cellElement.innerHTML = (newType === 'gateway') ? '<i class="fas fa-wifi"></i>' : '<i class="fas fa-broadcast-tower"></i>'; } } }
        else { console.log(`[${row},${col}] No change needed (already "${currentCellType}")`); }
    }


    function updateGridState(row, col, type) { /* ... (igual, com logs) ... */
        if (floorPlanGrid && row >= 0 && row < numRows && col >= 0 && col < numCols) { floorPlanGrid[row][col] = type; console.clear(); console.log(`Grid state updated at [${row}, ${col}] to "${type}"`); console.log("Current floorPlanGrid:"); floorPlanGrid.forEach((gridRow, index) => console.log(`Row ${index}:`, gridRow)); updateHiddenInput(); } else { console.error(`Invalid coordinates or grid not initialized: (${row}, ${col})`); }
    }

    function clearFloorPlan() { 
         if (confirm("Tem a certeza que quer limpar toda a planta?")) { const rows = parseInt(gridRowsInput?.value, 10) || numRows; const cols = parseInt(gridColsInput?.value, 10) || numCols; createFloorPlanGrid(rows, cols); }
    }

    function serializeGridData() { 
        const data = { rows: numRows, cols: numCols, grid: floorPlanGrid, gateway: gatewayPosition, sensors: sensorPositions }; return JSON.stringify(data, null, 2);
    }

    function updateHiddenInput() { /* ... (inalterado, mas verifica jsonOutputElement) ... */
        const jsonData = serializeGridData();
        if (floorplanDataInput) { floorplanDataInput.value = jsonData; }
        const jsonOutputElement = document.getElementById('json-output'); // Re-get for safety
        if (jsonOutputElement) { jsonOutputElement.textContent = jsonData; }
        else { console.warn("JSON output element for debugging not found."); } // Silenciar se não existir
    }


    // --- UI Update Functions ---
    function displayResults(recommendations) { 
         console.log("Pro version received recommendations object:", recommendations);
         const currentResultsSection = document.getElementById('results-section'); if (!currentResultsSection) { console.error("Cannot display results, results section not found."); showError("Internal Error: Cannot display results."); return; }
         displayLayout(recommendations.layout);
         displayHardware(recommendations.hardware);
         displayParameters(recommendations.parameters, recommendations.parameter_notes);
         displayArtifacts(recommendations.artifacts);
    }
    function displayLayout(layoutTips = []) { 
        const el = document.getElementById('layout-results'); if (!el) { console.error("Element with ID 'layout-results' not found."); return; } el.innerHTML = ''; layoutTips.forEach(tip => { const li = document.createElement('li'); li.textContent = tip; el.appendChild(li); });
    }
    function displayHardware(hardwareSections = []) { 
         const el = document.getElementById('hardware-results'); if (!el) { console.error("Element with ID 'hardware-results' not found."); return; } el.innerHTML = ''; hardwareSections.forEach(section => { if (!section?.title) return; const title = document.createElement('strong'); title.className = 'block mt-3 mb-1 text-md font-semibold text-gray-900'; title.textContent = section.title; el.appendChild(title); if (section.items?.length) { section.items.forEach(item => { const p = document.createElement('p'); p.className = 'text-sm ml-3'; if (typeof item === 'string') { p.innerHTML = item.trim().startsWith('- ')||item.trim().startsWith('&bull;') ? item : `&bull; ${item}`; } else if (typeof item === 'object' && item.text) { if (item.is_multiline) { let txt = item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n\s{2}-\s/g, '<br>&nbsp;&nbsp;&bull;&nbsp;'); p.innerHTML = txt; p.classList.add('hardware-multiline'); } else { p.innerHTML = `&bull; `; const content = item.link ? createLink(item) : document.createTextNode(item.text); p.appendChild(content); if (item.note) { const span = document.createElement('span'); span.className = "text-xs text-gray-500 ml-1"; span.textContent = `(${item.note})`; p.appendChild(span); } } } el.appendChild(p); }); } });
    }
    function createLink(item) { 
         const a = document.createElement('a'); a.href = item.link; a.textContent = item.text; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = "text-blue-600 hover:underline"; return a;
    }
    function displayParameters(parameters = {}, reasoningNotes = []) { /* ... (inalterado - já estava correto) ... */
         const body = document.getElementById('parameters-results'); const notesContainer = document.getElementById('parameter-notes'); const summaryContainer = document.getElementById('parameter-summary'); const toggleButton = document.getElementById('toggle-details-button');
         if (!body) { console.error("Element with ID 'parameters-results' not found."); return; } if (!notesContainer) { console.error("Element with ID 'parameter-notes' not found."); } if (!summaryContainer) { console.error("Element with ID 'parameter-summary' not found."); }
         body.innerHTML = ''; if (notesContainer) notesContainer.innerHTML = ''; if (summaryContainer) summaryContainer.innerHTML = ''; if (notesContainer) notesContainer.classList.add('hidden'); if (toggleButton) toggleButton.textContent = 'Show Calculation Details »';
         const paramOrder = [ 'frequency_mhz', 'spreading_factor', 'signal_bandwidth_khz', 'coding_rate', 'tx_power_dbm', 'preamble_length', 'sync_word', 'antenna_gain_dbi', 'estimated_ple', 'estimated_distance_m', 'estimated_link_margin_db', 'calculation_status' ];
         paramOrder.forEach(key => { if (parameters.hasOwnProperty(key)) { const value = parameters[key]; const tr = document.createElement('tr'); tr.className = body.children.length % 2 === 0 ? 'bg-white' : 'bg-gray-50'; const th = document.createElement('td'); const td = document.createElement('td'); th.className = 'px-4 py-2 text-sm font-medium text-gray-600 whitespace-nowrap'; td.className = 'px-4 py-2 text-sm text-gray-800'; let keyDisplay = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); if (key === 'estimated_ple') keyDisplay = 'Est. Path Loss Exp. (n)'; else if (key === 'estimated_link_margin_db') keyDisplay = 'Est. Link Margin'; else if (key === 'estimated_distance_m') keyDisplay = 'Est. Distance'; else if (key === 'antenna_gain_dbi') keyDisplay = 'Total Antenna Gain'; else if (key === 'calculation_status') keyDisplay = 'Status'; th.textContent = keyDisplay; let valueDisplay = value; if (key === 'estimated_link_margin_db' || key === 'tx_power_dbm' || key === 'antenna_gain_dbi') valueDisplay = `${value} dB`; else if (key === 'estimated_distance_m') valueDisplay = `${value} m`; else if (key === 'frequency_mhz') valueDisplay = `${value} MHz`; else if (key === 'signal_bandwidth_khz') valueDisplay = `${value} kHz`; td.textContent = valueDisplay; tr.appendChild(th); tr.appendChild(td); body.appendChild(tr); } });
         let summaryReason = "Reasoning: Default parameters selected.";
         if (summaryContainer && notesContainer) { if (reasoningNotes && Array.isArray(reasoningNotes) && reasoningNotes.length > 0) { const finalReason = reasoningNotes.find(note => note.toLowerCase().startsWith("selected sf") || note.toLowerCase().startsWith("warning: no sf provided")); if (finalReason) { summaryReason = `Reasoning: ${finalReason}`; } else if (reasoningNotes.length > 0) { summaryReason = `Reasoning: ${reasoningNotes[reasoningNotes.length - 1]}`; } const notesTitle = document.createElement('h4'); notesTitle.textContent = "Calculation Steps:"; notesTitle.className = "text-sm font-semibold mb-1 text-gray-700"; notesContainer.appendChild(notesTitle); const logList = document.createElement('ul'); logList.className = 'list-disc list-inside space-y-1'; reasoningNotes.forEach(note => { const listItem = document.createElement('li'); listItem.textContent = note; if (note.toLowerCase().includes('warning:')) { listItem.className = "text-orange-600"; } else if (note.toLowerCase().startsWith('selected sf')) { listItem.className = "font-medium text-green-700"; } else { listItem.className = "text-gray-600"; } logList.appendChild(listItem); }); notesContainer.appendChild(logList); } else if (parameters.calculation_status) { summaryReason = `Status: ${parameters.calculation_status}`; const p = document.createElement('p'); p.textContent = summaryReason; p.className = "text-xs text-red-600 font-semibold"; if (notesContainer) notesContainer.appendChild(p.cloneNode(true)); } const summaryP = document.createElement('p'); summaryP.textContent = summaryReason; if (summaryReason.toLowerCase().includes('warning:')) { summaryP.className = "font-medium text-orange-700"; } else if (summaryReason.toLowerCase().startsWith('reasoning: selected sf')) { summaryP.className = "font-medium text-green-800"; } else if (summaryReason.toLowerCase().startsWith('status:')) { summaryP.className = "text-red-600 font-semibold"; } summaryContainer.appendChild(summaryP); }
         // Não precisa de re-anexar o listener do toggle aqui, pois handleResultClicks trata disso
    }

    function displayArtifacts(artifacts = {}) {
        const containerId = 'artifacts-container';
        const templateId = 'artifact-template'; // Store ID for consistency

        let currentArtifactsContainer = document.getElementById(containerId); // Find container initially

        if (!currentArtifactsContainer) {
            console.error(`[displayArtifacts] Container element (id='${containerId}') NOT FOUND before clearing.`);
            return; // Cannot proceed
        } else {
            console.log(`[displayArtifacts] Container (id='${containerId}') FOUND before clearing.`);
            // Check if template exists *before* clearing cards
            let templateExistsBefore = currentArtifactsContainer.querySelector(`#${templateId}`) || document.getElementById(templateId);
            console.log(`[displayArtifacts] Template (id='${templateId}') exists *before* clearing cards?`, !!templateExistsBefore);
        }

        const existingCards = currentArtifactsContainer.querySelectorAll('.artifact-card');
        console.log(`[displayArtifacts] Found ${existingCards.length} existing artifact cards to remove.`);
        existingCards.forEach(card => card.remove());
        console.log(`[displayArtifacts] Finished removing existing cards.`);

        // --- CHECK AGAIN AFTER CLEARING ---
        currentArtifactsContainer = document.getElementById(containerId); // Re-find container just in case remove() affected it
        if (!currentArtifactsContainer) {
            console.error(`[displayArtifacts] Container element (id='${containerId}') MISSING *after* clearing cards!`);
            return; // Cannot proceed
        } else {
            console.log(`[displayArtifacts] Container (id='${containerId}') still exists *after* clearing cards.`);
            // Check if template exists *after* clearing cards but *before* loop
            let templateExistsAfter = currentArtifactsContainer.querySelector(`#${templateId}`) || document.getElementById(templateId);
            console.log(`[displayArtifacts] Template (id='${templateId}') exists *after* clearing cards / before loop?`, !!templateExistsAfter);
        }


        artifactCounter = 0;

        if (!artifacts || Object.keys(artifacts).length === 0) {
            console.log("[displayArtifacts] No artifacts to display.");
            return;
        }

        console.log("[displayArtifacts] Starting loop to add artifact cards:", artifacts);
        for (const key in artifacts) {
            if (artifacts.hasOwnProperty(key)) {
                addArtifactCard(key, artifacts[key]); // Calls addArtifactCard
            }
        }
        console.log("[displayArtifacts] Finished loop to add artifact cards.");


        // Highlight SÓ DEPOIS de todos os cartões serem adicionados
        setTimeout(() => {
            try {
                const finalArtifactsContainer = document.getElementById(containerId); // Use ID variable
                if (finalArtifactsContainer) {
                    Prism.highlightAllUnder(finalArtifactsContainer);
                    console.log("[displayArtifacts] Prism highlighting attempted.");
                } else {
                    console.warn("[displayArtifacts] Artifacts container disappeared before highlighting.");
                }
            } catch (e) { console.error("[displayArtifacts] Error during Prism highlighting:", e); }
        }, 50);
    }


    function addArtifactCard(artifactKey, artifactData) {
        const containerId = 'artifacts-container';
        const templateId = 'artifact-template'; // Store ID for consistency

        console.log(`[addArtifactCard] Called for key: ${artifactKey}.`);

        // 1. Check if container exists NOW
        const artifactsContainerElement = document.getElementById(containerId);
        if (!artifactsContainerElement) {
            console.error(`[addArtifactCard] FAILED: Container (id='${containerId}') not found when adding card for key: ${artifactKey}`);
            return;
        } else {
            console.log(`[addArtifactCard] OK: Container (id='${containerId}') found for key: ${artifactKey}`);
        }

        // 2. Try finding template using getElementById (Global)
        let templateElementById = document.getElementById(templateId);
        if (!templateElementById) {
            console.warn(`[addArtifactCard] WARN: document.getElementById('${templateId}') FAILED for key: ${artifactKey}`);
        } else {
            console.log(`[addArtifactCard] OK: document.getElementById('${templateId}') found template for key: ${artifactKey}`);
        }

        // 3. Try finding template using querySelector *within the container*
        let templateElementQuery = artifactsContainerElement.querySelector(`#${templateId}`);
        if (!templateElementQuery) {
            console.warn(`[addArtifactCard] WARN: container.querySelector('#${templateId}') FAILED for key: ${artifactKey}`);
            // Let's see if ANY template tag exists inside
            let anyTemplate = artifactsContainerElement.querySelector('template');
            console.log(`[addArtifactCard] Does *any* template tag exist inside container?`, !!anyTemplate, anyTemplate);
        } else {
            console.log(`[addArtifactCard] OK: container.querySelector('#${templateId}') found template for key: ${artifactKey}`);
        }

        // 4. Decide which template reference to use (prefer querySelector result if available)
        const templateElement = templateElementQuery || templateElementById;

        // 5. Final check if we have a valid template element
        if (!templateElement || templateElement.nodeName !== 'TEMPLATE') {
            console.error(`[addArtifactCard] FAILED: Could not find a valid TEMPLATE element with id='${templateId}' for key: ${artifactKey}. Final check failed.`);
            // debugger; // Pause here if needed
            return; // Stop
        }

        console.log(`[addArtifactCard] Proceeding to clone template for key ${artifactKey}. Type: ${templateElement.nodeName}, ID: ${templateElement.id}`);

        // Now try to clone the content
        try {
            // --- Rest of the function remains the same ---
            const templateContent = templateElement.content.cloneNode(true);
            const newCard = templateContent.querySelector('.artifact-card');
            if (!newCard) {
                console.error("[addArtifactCard] Could not find .artifact-card within the cloned template content for key:", artifactKey);
                return;
            }

            newCard.dataset.artifactKey = artifactKey;
            const titleEl = newCard.querySelector('.artifact-title');
            const contentEl = newCard.querySelector('.artifact-content');
            // ... (rest of the assignments for title, notes, buttons etc.) ...
            const notesEl = newCard.querySelector('.artifact-notes');
            const askAiButton = newCard.querySelector('.ask-ai-button');
            const copyButton = newCard.querySelector('.copy-button');
            const contentId = `artifact-content-${artifactKey}`;

            if (contentEl) contentEl.id = contentId; else console.error("Artifact content element (.artifact-content) not found in card template.");
            if (titleEl) titleEl.textContent = artifactData.title || "Untitled Artifact";
            if (notesEl) notesEl.textContent = artifactData.notes || "";
            if (askAiButton) askAiButton.dataset.context = artifactKey; else console.warn("Ask AI button not found in artifact template");
            if (copyButton) copyButton.dataset.target = `#${contentId}`; else console.warn("Copy button not found in artifact template");


            renderArtifactContent(contentEl, artifactData); // Calls render

            artifactsContainerElement.appendChild(newCard); // Add to container
            console.log(`[addArtifactCard] Successfully added artifact card: ${artifactKey}`);

        } catch (cloneError) {
            console.error(`[addArtifactCard] Error cloning or processing template content for key ${artifactKey}:`, cloneError);
            console.error("[addArtifactCard] Current state of templateElement:", templateElement);
        }
    }

    function renderArtifactContent(contentEl, artifact) { 
        if (!contentEl) { console.error("renderArtifactContent called with null contentEl"); return; } const codeContainer = contentEl.querySelector('.code-container'); const codePre = codeContainer?.querySelector('pre'); const codeBlock = codePre?.querySelector('code'); const mdContainer = contentEl.querySelector('.markdown-content'); const copyButton = contentEl.closest('.artifact-card')?.querySelector('.copy-button'); if (!codeContainer || !codeBlock || !mdContainer) { console.error(`Missing structure within artifact content element`); return; } codeBlock.textContent = ''; mdContainer.innerHTML = ''; codeContainer.classList.add('hidden'); mdContainer.classList.add('hidden'); if (copyButton) copyButton.classList.add('hidden'); if (artifact.type === 'code') { codeBlock.textContent = artifact.content || "//"; codeBlock.className = `language-${artifact.language || 'clike'}`; codeContainer.classList.remove('hidden'); if (copyButton) copyButton.classList.remove('hidden'); setTimeout(() => Prism.highlightElement(codeBlock), 0); } else if (artifact.type === 'instructions') { try { mdContainer.innerHTML = marked.parse(artifact.content || ""); } catch(e) { console.error("Error parsing markdown:", e); mdContainer.textContent = artifact.content || ""; } mdContainer.classList.remove('hidden'); } else { codeBlock.textContent = JSON.stringify(artifact.content, null, 2); codeBlock.className = 'language-json'; codeContainer.classList.remove('hidden'); if (copyButton) copyButton.classList.remove('hidden'); setTimeout(() => Prism.highlightElement(codeBlock), 0); }
    }


    // --- Form State and Utils ---
    function initializeForm() { 
         const hasGwNo = document.querySelector('input[name="has_gateway"][value="no"]'); const initialApproach = gatewayApproachSelect ? gatewayApproachSelect.value : null; toggleGatewayOptions(hasGwNo?.checked); if (initialApproach) toggleExistingHardwareSection(initialApproach);
    }
    function toggleGatewayOptions(show) { 
         if (!gatewayOptionsSection) return; const req = show; gatewayOptionsSection.classList.toggle('hidden', !show); if (gatewayApproachSelect) gatewayApproachSelect.required = req; if (show) { const currentApproach = gatewayApproachSelect ? gatewayApproachSelect.value : null; if (currentApproach) toggleExistingHardwareSection(currentApproach); } else { if (existingHardwareSection) { existingHardwareSection.classList.add('hidden'); existingHardwareSection.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false); } }
    }
    function toggleExistingHardwareSection(approach) { 
         if (!existingHardwareSection) return; const show = approach?.startsWith('build_'); existingHardwareSection.classList.toggle('hidden', !show); if (!show) { existingHardwareSection.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false); }
    }
    function showLoading(isLoading) { 
         if (loadingIndicator) loadingIndicator.classList.toggle('hidden', !isLoading); else console.error("Loading indicator not found"); if (submitButton) { submitButton.disabled = isLoading; submitButton.classList.toggle('opacity-50', isLoading); submitButton.classList.toggle('cursor-not-allowed', isLoading); } else { console.error("Submit button not found"); } if (isLoading && errorMessage) errorMessage.classList.add('hidden');
    }
    function showError(message) { 
         if (errorMessage) { errorMessage.textContent = message; errorMessage.classList.remove('hidden'); } else { console.error("Error message element not found. Error:", message); alert(`Error: ${message}`); }
    }
    function clearResults() {
        const resultsSection = document.getElementById('results-section');
        const layoutList = document.getElementById('layout-results');
        const hardwareDiv = document.getElementById('hardware-results');
        const paramsTableBody = document.getElementById('parameters-results');
        const paramNotesDiv = document.getElementById('parameter-notes');
        const paramSummaryDiv = document.getElementById('parameter-summary');
        const toggleButton = document.getElementById('toggle-details-button');
        const artifactsContainer = document.getElementById('artifacts-container'); // Get container
        const errorMessage = document.getElementById('error-message');
        const aiChatHistory = document.getElementById('ai-chat-history');
        const aiConfidenceButtonsContainer = document.getElementById('ai-confidence-buttons');
    
        if (resultsSection) resultsSection.classList.add('hidden');
        if (layoutList) layoutList.innerHTML = '';
        if (hardwareDiv) hardwareDiv.innerHTML = '';
        if (paramsTableBody) paramsTableBody.innerHTML = '';
        if (paramNotesDiv) { paramNotesDiv.innerHTML = ''; paramNotesDiv.classList.add('hidden'); }
        if (paramSummaryDiv) { paramSummaryDiv.innerHTML = ''; }
        if (toggleButton) { toggleButton.textContent = 'Show Calculation Details »'; }
    
        if (artifactsContainer) {
            const existingCards = artifactsContainer.querySelectorAll('.artifact-card');
            existingCards.forEach(card => card.remove());
            // DO NOT clear innerHTML here
        }
    
        if (errorMessage) errorMessage.classList.add('hidden');
    
        // Reset state variables
        currentConfigJson = {};
        currentRecommendations = {};
        artifactCounter = 0;
        // Reset chat history if needed, or keep it
        // currentChatHistory = [];
        // if (aiChatHistory) aiChatHistory.innerHTML = '';
        // if (aiConfidenceButtonsContainer) aiConfidenceButtonsContainer.classList.add('hidden');
    }
    function copyContentToClipboard(elementId, buttonElement) {
        const contentContainer = document.getElementById(elementId);
        if (!contentContainer) { console.error(`Copy target element not found: ${elementId}`); return; }
        let textToCopy = '';
        const codeContainer = contentContainer.querySelector('.code-container:not(.hidden)');
        const mdContainer = contentContainer.querySelector('.markdown-content:not(.hidden)');

        if (codeContainer) {
            const codeBlock = codeContainer.querySelector('code');
            textToCopy = codeBlock ? codeBlock.textContent : '';
        } else if (mdContainer) {
            // Try to get text content more reliably from markdown
            textToCopy = mdContainer.innerText || mdContainer.textContent;
        }

        if (navigator.clipboard && textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = buttonElement.textContent;
                buttonElement.textContent = 'Copied!';
                buttonElement.classList.add('bg-green-500');
                buttonElement.classList.remove('bg-gray-600', 'hover:bg-gray-500', 'bg-red-500'); // Remove red too
                setTimeout(() => {
                    buttonElement.textContent = 'Copy';
                    buttonElement.classList.remove('bg-green-500');
                    buttonElement.classList.add('bg-gray-600', 'hover:bg-gray-500');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                buttonElement.textContent = 'Error';
                buttonElement.classList.add('bg-red-500');
                buttonElement.classList.remove('bg-gray-600', 'hover:bg-gray-500', 'bg-green-500');
                setTimeout(() => {
                    buttonElement.textContent = 'Copy';
                     buttonElement.classList.remove('bg-red-500');
                     buttonElement.classList.add('bg-gray-600', 'hover:bg-gray-500');
                }, 2000);
            });
        } else {
            console.error('Clipboard API not available, element not found, or no text to copy.');
            buttonElement.textContent = 'Error';
            buttonElement.classList.add('bg-red-500');
            buttonElement.classList.remove('bg-gray-600', 'hover:bg-gray-500', 'bg-green-500');
             setTimeout(() => {
                    buttonElement.textContent = 'Copy';
                     buttonElement.classList.remove('bg-red-500');
                     buttonElement.classList.add('bg-gray-600', 'hover:bg-gray-500');
                }, 2000);
        }
    }
    function exportConfigAsJson(configData, filename) {
        if (!configData || Object.keys(configData).length === 0) {
           showError("No configuration generated yet to export.");
           // Esconder a mensagem de erro após algum tempo
           setTimeout(() => {
               if(errorMessage) errorMessage.classList.add('hidden');
           }, 3000);
           return;
        }
        const exportData = configData; // Já é o objeto config_json
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
   }

}); // --- FIM do Listener DOMContentLoaded ---
