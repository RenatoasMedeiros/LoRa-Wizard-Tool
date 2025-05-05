// --- Constants and State ---
const form = document.getElementById('lora-wizard-form');
const resultsSection = document.getElementById('results-section');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');
const submitButton = document.getElementById('submit-button');
const gatewayOptionsSection = document.getElementById('gateway-options-section');
const gatewayApproachSelect = document.getElementById('gateway_approach');
const existingHardwareSection = document.getElementById('existing-hardware-section');
const artifactsContainer = document.getElementById('artifacts-container'); // Added
const artifactTemplate = document.getElementById('artifact-template'); // Added

let currentConfigJson = {}; // For JSON export
let artifactCounter = 0; // For unique IDs if needed

// --- Constantes e Estado para Floor Plan ---
let floorPlanGrid = null; // Será o array 2D representando a grelha
let numRows = 10; // Valor inicial
let numCols = 10; // Valor inicial
let selectedTool = 'empty'; // Ferramenta inicial
let gatewayPosition = null; // {row: r, col: c}
let sensorPositions = []; // Array de {row: r, col: c}

// Elementos do DOM para o Floor Plan (obter dentro de DOMContentLoaded)
let gridContainer = null;
let floorplanGridElement = null;
let gridRowsInput = null;
let gridColsInput = null;
let createGridButton = null;
let clearGridButton = null;
let toolbar = null;
let selectedToolIndicator = null;
let floorplanDataInput = null;

// --- Event Listeners ---
form.addEventListener('submit', handleSubmit);
resultsSection.addEventListener('click', handleResultClicks); // Handles copy, export
artifactsContainer.addEventListener('click', handleResultClicks); // Delegate artifact button clicks
if (gatewayApproachSelect) { gatewayApproachSelect.addEventListener('change', (event) => toggleExistingHardwareSection(event.target.value)); }
document.addEventListener('DOMContentLoaded', initializeForm);

// --- Main Handler ---
async function handleSubmit(event) {
    event.preventDefault(); clearResults(); showLoading(true);
    const formData = new FormData(form);
    const existingHwValues = Array.from(formData.getAll('existing_hw'));
    const ownedModulesValues = Array.from(formData.getAll('owned_modules'));
    const data = Object.fromEntries(formData.entries());
    data.existing_hw = existingHwValues; data.owned_modules = ownedModulesValues;
    if (data.has_gateway === 'yes') { delete data.gateway_approach; delete data.existing_hw; }
    console.log("Sending data:", data);
    try {
        const response = await fetch('/generate_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json(); if (!response.ok) { throw new Error(result.error || `HTTP error! status: ${response.status}`); }
        currentConfigJson = result.recommendations.config_json || {}; // Store for export
        displayResults(result.recommendations); resultsSection.classList.remove('hidden'); resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { console.error('Error fetching recommendations:', error); showError(`Failed to generate recommendations: ${error.message}`); } finally { showLoading(false); }
}

function handleResultClicks(event) {
    const copyButton = event.target.closest('.copy-button');
    if (copyButton) { copyContentToClipboard(copyButton.dataset.target, copyButton); }
    else if (event.target.id === 'export-json-button') { exportConfigAsJson(currentConfigJson, 'lora_standard_config.json'); }
}

// --- UI Update Functions ---
function displayResults(recommendations) {
    console.log("Received recommendations object:", recommendations); // <-- ADICIONA ESTA LINHA
    displayLayout(recommendations.layout);
    displayHardware(recommendations.hardware);
    // Passa tanto os parâmetros como as notas (ou o log) para a função
    displayParameters(recommendations.parameters, recommendations.parameter_notes);
    displayArtifacts(recommendations.artifacts);
}
function displayLayout(layoutTips = []) { const el = document.getElementById('layout-results'); el.innerHTML = ''; layoutTips.forEach(tip => { const li = document.createElement('li'); li.textContent = tip; el.appendChild(li); }); }
function displayHardware(hardwareSections = []) { /* Function unchanged */
     const el = document.getElementById('hardware-results'); el.innerHTML = '';
    hardwareSections.forEach(section => { if (!section?.title) return; const title = document.createElement('strong'); title.className = 'block mt-3 mb-1 text-md font-semibold text-gray-900'; title.textContent = section.title; el.appendChild(title); if (section.items?.length) { section.items.forEach(item => { const p = document.createElement('p'); p.className = 'text-sm ml-3'; if (typeof item === 'string') { p.innerHTML = item.trim().startsWith('- ')||item.trim().startsWith('&bull;') ? item : `&bull; ${item}`; } else if (typeof item === 'object' && item.text) { if (item.is_multiline) { let txt = item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n\s{2}-\s/g, '<br>&nbsp;&nbsp;&bull;&nbsp;'); p.innerHTML = txt; p.classList.add('hardware-multiline'); } else { p.innerHTML = `&bull; `; const content = item.link ? createLink(item) : document.createTextNode(item.text); p.appendChild(content); if (item.note) { const span = document.createElement('span'); span.className = "text-xs text-gray-500 ml-1"; span.textContent = `(${item.note})`; p.appendChild(span); } } } el.appendChild(p); }); } });
}
function createLink(item) { const a = document.createElement('a'); a.href = item.link; a.textContent = item.text; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = "text-blue-600 hover:underline"; return a; }
function displayParameters(parameters = {}) { /* Function unchanged */
     const body = document.getElementById('parameters-results'); const notes = document.getElementById('parameter-notes'); body.innerHTML = ''; notes.innerHTML = '';
    for (const [key, value] of Object.entries(parameters)) { if (key.startsWith('_') || key.endsWith('_reason')) continue; const tr = document.createElement('tr'); tr.className = body.children.length % 2 === 0 ? 'bg-white' : 'bg-gray-50'; const th = document.createElement('td'); const td = document.createElement('td'); th.className = 'px-4 py-2 text-sm font-medium text-gray-600 whitespace-nowrap'; td.className = 'px-4 py-2 text-sm text-gray-800'; th.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); td.textContent = value; tr.appendChild(th); tr.appendChild(td); body.appendChild(tr); const reasonKey = `${key}_reason`; if (parameters[reasonKey]) { const p = document.createElement('p'); p.innerHTML = `<strong class="text-gray-700">${th.textContent}:</strong> ${parameters[reasonKey]}`; notes.appendChild(p); } }
}

// ** UPDATED displayArtifacts for Standard Version **
function displayArtifacts(artifacts = {}) {
    artifactsContainer.innerHTML = ''; // Clear existing artifacts
    artifactCounter = 0; // Reset counter

    if (!artifacts || Object.keys(artifacts).length === 0) {
         artifactsContainer.innerHTML = '<p class="text-gray-500 text-sm italic">No specific code artifacts generated for this configuration.</p>';
         return;
    }

    // Iterate through the artifacts object and render each one
    for (const key in artifacts) {
        if (artifacts.hasOwnProperty(key)) {
            addArtifactCard(key, artifacts[key]);
        }
    }
     // Highlight all code blocks after rendering everything
     setTimeout(() => Prism.highlightAll(), 0);
}

// ** NEW: Function to add a single artifact card (Standard Version - No Ask AI button) **
function addArtifactCard(artifactKey, artifactData) {
     if (!artifactTemplate || !artifactsContainer) return;
     const templateContent = artifactTemplate.content.cloneNode(true);
     const newCard = templateContent.querySelector('.artifact-card');
     if (!newCard) return;
     newCard.dataset.artifactKey = artifactKey;

     const titleEl = newCard.querySelector('.artifact-title');
     const contentEl = newCard.querySelector('.artifact-content');
     const notesEl = newCard.querySelector('.artifact-notes');
     // Ask AI button is removed from template for standard version
     const copyButton = newCard.querySelector('.copy-button');
     const contentId = `artifact-content-${artifactKey}`; // Unique ID

     contentEl.id = contentId;
     if(titleEl) titleEl.textContent = artifactData.title || "Untitled Artifact";
     if(notesEl) notesEl.textContent = artifactData.notes || "";
     // No Ask AI button context needed
     if(copyButton) copyButton.dataset.target = contentId;

     renderArtifactContent(contentEl, artifactData); // Render content
     artifactsContainer.appendChild(newCard);
}

// ** NEW: renderArtifactContent (Standard Version - No Ask AI button) **
function renderArtifactContent(contentEl, artifact) {
    if (!contentEl) return;
    const codeContainer = contentEl.querySelector('.code-container');
    const codePre = codeContainer?.querySelector('pre');
    const codeBlock = codePre?.querySelector('code');
    const mdContainer = contentEl.querySelector('.markdown-content');
    const copyButton = contentEl.closest('.artifact-card')?.querySelector('.copy-button');

    if (!codeContainer || !codeBlock || !mdContainer) { console.error(`Missing structure within artifact content`); return; }

    codeBlock.textContent = ''; mdContainer.innerHTML = '';
    codeContainer.classList.add('hidden'); mdContainer.classList.add('hidden');
    if (copyButton) copyButton.classList.add('hidden'); // Hide copy initially

    if (artifact.type === 'code') {
        codeBlock.textContent = artifact.content || "//";
        codeBlock.className = `language-${artifact.language || 'clike'}`;
        codeContainer.classList.remove('hidden');
        if (copyButton) copyButton.classList.remove('hidden'); // Show copy for code
        setTimeout(() => Prism.highlightElement(codeBlock), 0);
    } else if (artifact.type === 'instructions') {
        mdContainer.innerHTML = marked.parse(artifact.content || "");
        mdContainer.classList.remove('hidden');
        // Keep copy button hidden for instructions
    } else { // Fallback
        codeBlock.textContent = JSON.stringify(artifact.content, null, 2);
        codeBlock.className = 'language-json';
        codeContainer.classList.remove('hidden');
        if (copyButton) copyButton.classList.remove('hidden');
        setTimeout(() => Prism.highlightElement(codeBlock), 0);
    }
}

// --- Form State and Utils (Unchanged) ---
function initializeForm() { const hasGwNo = document.querySelector('input[name="has_gateway"][value="no"]'); toggleGatewayOptions(hasGwNo?.checked); toggleExistingHardwareSection(gatewayApproachSelect?.value); }
function toggleGatewayOptions(show) { if (!gatewayOptionsSection) return; const req = show; gatewayOptionsSection.classList.toggle('hidden', !show); if(gatewayApproachSelect) gatewayApproachSelect.required = req; if (show) { toggleExistingHardwareSection(gatewayApproachSelect?.value); } else { if(existingHardwareSection) existingHardwareSection.classList.add('hidden'); existingHardwareSection?.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false); } }
function toggleExistingHardwareSection(approach) { if (!existingHardwareSection) return; const show = approach?.startsWith('build_'); existingHardwareSection.classList.toggle('hidden', !show); if (!show) { existingHardwareSection.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false); } }
function showLoading(isLoading) { loadingIndicator.classList.toggle('hidden', !isLoading); submitButton.disabled = isLoading; submitButton.classList.toggle('opacity-50', isLoading); submitButton.classList.toggle('cursor-not-allowed', isLoading); if (isLoading) errorMessage.classList.add('hidden'); }
function showError(message) { errorMessage.textContent = message; errorMessage.classList.remove('hidden'); }
function clearResults() { resultsSection.classList.add('hidden'); const layoutList=document.getElementById('layout-results'); const hardwareDiv=document.getElementById('hardware-results'); const paramsTableBody=document.getElementById('parameters-results'); const paramNotesDiv=document.getElementById('parameter-notes'); if(layoutList)layoutList.innerHTML=''; if(hardwareDiv)hardwareDiv.innerHTML=''; if(paramsTableBody)paramsTableBody.innerHTML=''; if(paramNotesDiv)paramNotesDiv.innerHTML=''; if(artifactsContainer) artifactsContainer.innerHTML = ''; errorMessage.classList.add('hidden'); currentConfigJson={}; artifactCounter = 0; }
function copyContentToClipboard(elementId, buttonElement) { const contentContainer = document.getElementById(elementId); if (!contentContainer) { console.error(`Copy target element not found: ${elementId}`); return; } let textToCopy = ''; const codeContainer = contentContainer.querySelector('.code-container:not(.hidden)'); const mdContainer = contentContainer.querySelector('.markdown-content:not(.hidden)'); if (codeContainer) { const codeBlock = codeContainer.querySelector('code'); textToCopy = codeBlock ? codeBlock.textContent : ''; } else if (mdContainer) { textToCopy = mdContainer.innerText || mdContainer.textContent; } if (navigator.clipboard && textToCopy) { navigator.clipboard.writeText(textToCopy).then(() => { const originalText = buttonElement.textContent; buttonElement.textContent = 'Copied!'; buttonElement.classList.add('bg-green-500'); buttonElement.classList.remove('bg-gray-600', 'hover:bg-gray-500'); setTimeout(() => { buttonElement.textContent = 'Copy'; buttonElement.classList.remove('bg-green-500'); buttonElement.classList.add('bg-gray-600', 'hover:bg-gray-500'); }, 2000); }).catch(err => { console.error('Failed to copy: ', err); buttonElement.textContent = 'Error'; buttonElement.classList.add('bg-red-500'); buttonElement.classList.remove('bg-gray-600', 'hover:bg-gray-500'); setTimeout(() => { buttonElement.textContent = 'Copy'; buttonElement.classList.remove('bg-red-500'); buttonElement.classList.add('bg-gray-600', 'hover:bg-gray-500');}, 2000); }); } else { buttonElement.textContent = 'Error'; buttonElement.classList.add('bg-red-500'); buttonElement.classList.remove('bg-gray-600', 'hover:bg-gray-500'); setTimeout(() => { buttonElement.textContent = 'Copy'; buttonElement.classList.remove('bg-red-500'); buttonElement.classList.add('bg-gray-600', 'hover:bg-gray-500');}, 2000); console.error('Clipboard API not available, element not found, or no text to copy.'); } }
function exportConfigAsJson(configData, filename) { if (!configData || Object.keys(configData).length === 0) { showError("No configuration generated yet to export."); setTimeout(() => errorMessage.classList.add('hidden'), 3000); return; } const exportData = configData; const jsonString = JSON.stringify(exportData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
function displayParameters(parameters = {}, reasoningNotes = []) {
    const body = document.getElementById('parameters-results');
    const notesContainer = document.getElementById('parameter-notes');
    const summaryContainer = document.getElementById('parameter-summary'); // Obter a nova div de resumo
    const toggleButton = document.getElementById('toggle-details-button'); // Obter o botão de toggle

    // Limpar conteúdo anterior
    body.innerHTML = '';
    notesContainer.innerHTML = '';
    summaryContainer.innerHTML = '';
    notesContainer.classList.add('hidden'); // Garantir que os detalhes estão escondidos inicialmente
    if (toggleButton) toggleButton.textContent = 'Show Calculation Details »'; // Resetar texto do botão


    // --- Preencher Tabela de Parâmetros (lógica existente) ---
    const paramOrder = [ // Ordem de exibição sugerida
        'frequency_mhz', 'spreading_factor', 'signal_bandwidth_khz',
        'coding_rate', 'tx_power_dbm', 'preamble_length', 'sync_word',
        'antenna_gain_dbi', 'estimated_ple', 'estimated_distance_m',
        'estimated_link_margin_db', 'calculation_status'
    ];
    paramOrder.forEach(key => {
        if (parameters.hasOwnProperty(key)) {
            const value = parameters[key];
            const tr = document.createElement('tr');
            tr.className = body.children.length % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            const th = document.createElement('td');
            const td = document.createElement('td');
            th.className = 'px-4 py-2 text-sm font-medium text-gray-600 whitespace-nowrap';
            td.className = 'px-4 py-2 text-sm text-gray-800';
            let keyDisplay = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (key === 'estimated_ple') keyDisplay = 'Est. Path Loss Exp. (n)';
            else if (key === 'estimated_link_margin_db') keyDisplay = 'Est. Link Margin';
            else if (key === 'estimated_distance_m') keyDisplay = 'Est. Distance';
            else if (key === 'antenna_gain_dbi') keyDisplay = 'Total Antenna Gain';
            else if (key === 'calculation_status') keyDisplay = 'Status';
            th.textContent = keyDisplay;
            let valueDisplay = value;
            if (key === 'estimated_link_margin_db' || key === 'tx_power_dbm' || key === 'antenna_gain_dbi') valueDisplay = `${value} dB`;
            else if (key === 'estimated_distance_m') valueDisplay = `${value} m`;
            else if (key === 'frequency_mhz') valueDisplay = `${value} MHz`;
            else if (key === 'signal_bandwidth_khz') valueDisplay = `${value} kHz`;
            td.textContent = valueDisplay;
            tr.appendChild(th); tr.appendChild(td); body.appendChild(tr);
        }
    });

    // --- Fim Tabela de Parâmetros ---


    // --- Preencher Resumo e Notas Detalhadas ---
    let summaryReason = "Reasoning: Default parameters selected."; // Resumo por defeito
    if (reasoningNotes && Array.isArray(reasoningNotes) && reasoningNotes.length > 0) {
        // Encontrar a linha de resumo chave (normalmente a última que explica a escolha)
        const finalReason = reasoningNotes.find(note => note.toLowerCase().startsWith("selected sf") || note.toLowerCase().startsWith("warning: no sf provided"));
        if (finalReason) {
            summaryReason = `Reasoning: ${finalReason}`;
        } else if (reasoningNotes.length > 0) {
             // Fallback: usar a última linha se palavras-chave específicas não forem encontradas
             summaryReason = `Reasoning: ${reasoningNotes[reasoningNotes.length - 1]}`;
        }

        // Preencher o container de notas detalhadas (escondido inicialmente)
        const notesTitle = document.createElement('h4');
        notesTitle.textContent = "Calculation Steps:";
        notesTitle.className = "text-sm font-semibold mb-1 text-gray-700"; // Estilizar título
        notesContainer.appendChild(notesTitle);
        const logList = document.createElement('ul'); // Usar uma lista para melhor legibilidade
        logList.className = 'list-disc list-inside space-y-1';
        reasoningNotes.forEach(note => {
            const listItem = document.createElement('li');
            listItem.textContent = note;
            if (note.toLowerCase().includes('warning:')) {
                listItem.className = "text-orange-600";
            } else if (note.toLowerCase().startsWith('selected sf')) {
                 listItem.className = "font-medium text-green-700"; // Destacar seleção
            }
             else {
                listItem.className = "text-gray-600";
            }
            logList.appendChild(listItem);
        });
        notesContainer.appendChild(logList);

    } else if (parameters.calculation_status) {
        // Lidar com status de fallback/erro
        summaryReason = `Status: ${parameters.calculation_status}`;
        const p = document.createElement('p');
        p.textContent = summaryReason;
        p.className = "text-xs text-red-600 font-semibold";
        notesContainer.appendChild(p); // Também adicionar às notas escondidas por consistência
    }

    // Preencher o container de resumo
    const summaryP = document.createElement('p');
    summaryP.textContent = summaryReason;
    // Aplicar estilo ao resumo com base no conteúdo
    if (summaryReason.toLowerCase().includes('warning:')) {
        summaryP.className = "font-medium text-orange-700";
    } else if (summaryReason.toLowerCase().startsWith('reasoning: selected sf')) {
         summaryP.className = "font-medium text-green-800";
    }
    summaryContainer.appendChild(summaryP);

    // Adicionar listener de evento ao botão de toggle (se existir)
    if (toggleButton) {
         // Remover listeners antigos primeiro para prevenir duplicados se regenerar
         toggleButton.replaceWith(toggleButton.cloneNode(true));
         const newToggleButton = document.getElementById('toggle-details-button'); // Resselecionar após clonar

         newToggleButton.addEventListener('click', () => {
            const isHidden = notesContainer.classList.toggle('hidden');
            newToggleButton.textContent = isHidden ? 'Show Calculation Details »' : 'Hide Calculation Details «';
         });
    }
}

function clearResults() {
    resultsSection.classList.add('hidden');
    const layoutList = document.getElementById('layout-results');
    const hardwareDiv = document.getElementById('hardware-results');
    const paramsTableBody = document.getElementById('parameters-results');
    const paramNotesDiv = document.getElementById('parameter-notes');
    const paramSummaryDiv = document.getElementById('parameter-summary'); // Obter div de resumo
    const toggleButton = document.getElementById('toggle-details-button'); // Obter botão

    if (layoutList) layoutList.innerHTML = '';
    if (hardwareDiv) hardwareDiv.innerHTML = '';
    if (paramsTableBody) paramsTableBody.innerHTML = '';
    if (paramNotesDiv) {
        paramNotesDiv.innerHTML = '';
        paramNotesDiv.classList.add('hidden'); // Garantir que está escondido ao limpar
    }
    if (paramSummaryDiv) paramSummaryDiv.innerHTML = ''; // Limpar resumo
     if (toggleButton) toggleButton.textContent = 'Show Calculation Details »'; // Resetar texto do botão

    errorMessage.classList.add('hidden');
    currentConfigJson = {};
    // currentRecommendations = {}; // Se usar estado da versão Pro
    artifactCounter = 0;
}