import { getState } from './state.js';

export function setupEventListeners(elements) {
    elements.historyDropdownButton.addEventListener('click', () => {
        elements.historyDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!elements.historyDropdown.contains(e.target) && !elements.historyDropdownButton.contains(e.target)) {
            elements.historyDropdown.classList.add('hidden');
        }
    });

    elements.newSessionButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'createSession' });
    });

    elements.sendButton.addEventListener('click', () => sendMessage(elements));

    elements.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(elements);
        }
    });

    elements.userInput.addEventListener('input', () => {
        elements.userInput.style.height = 'auto';
        elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 200) + 'px';
    });

    // Add a message handler for file info at the top level
    window.addEventListener('message', event => {
        if (event.data.type === 'fileInfo' && event.data.payload) {
            const fileInfo = event.data.payload;
            // Find the most recently added tab and update it
            const lastTab = elements.codePreview.querySelector('.code-tab:last-child');
            const lastCodeBlock = elements.codePreview.querySelector('.code-block:last-child');
            
            if (lastTab && lastCodeBlock) {
                // Update tab text with file info
                lastTab.textContent = `${fileInfo.filename} (${fileInfo.startLine}-${fileInfo.endLine})`;
                
                // Store file info in the code block's dataset
                lastCodeBlock.dataset.filename = fileInfo.filename;
                lastCodeBlock.dataset.startLine = fileInfo.startLine.toString();
                lastCodeBlock.dataset.endLine = fileInfo.endLine.toString();
            }
        }
    });

    elements.userInput.addEventListener('paste', async (e) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');
        const vscodeFormat = clipboardData.getData('vscode-editor-data');
        
        if (vscodeFormat && elements.codePreview) {
            try {
                const metadata = JSON.parse(vscodeFormat);
                if (metadata.mode) {
                    e.preventDefault();
                    
                    // Request file info from extension immediately
                    vscode.postMessage({
                        type: 'getActiveFileInfo',
                        payload: { code: pastedText }
                    });

                    // Initialize containers if they don't exist
                    if (!elements.codePreview.querySelector('.code-tabs')) {
                        const tabsContainer = document.createElement('div');
                        tabsContainer.className = 'code-tabs';
                        elements.codePreview.appendChild(tabsContainer);
                    }

                    if (!elements.codePreview.querySelector('.code-previews')) {
                        const previewsContainer = document.createElement('div');
                        previewsContainer.className = 'code-previews hidden';
                        elements.codePreview.appendChild(previewsContainer);
                    }

                    const tabsContainer = elements.codePreview.querySelector('.code-tabs');
                    const previewsContainer = elements.codePreview.querySelector('.code-previews');

                    // Create new tab (initially with loading state)
                    const tabId = `code-${Date.now()}`;
                    const tab = document.createElement('div');
                    tab.className = 'code-tab';
                    tab.dataset.tabId = tabId;
                    tab.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading file info...`;
                    tabsContainer.appendChild(tab);

                    // Create new code block
                    const codeBlock = document.createElement('div');
                    codeBlock.className = 'code-block hidden';
                    codeBlock.dataset.tabId = tabId;
                    
                    const codeHeader = document.createElement('div');
                    codeHeader.className = 'code-header';
                    codeHeader.innerHTML = `
                        <span class="language">${metadata.mode}</span>
                        <button class="remove-preview" title="Remove code">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    
                    const codeContent = document.createElement('pre');
                    codeContent.className = `language-${metadata.mode}`;
                    codeContent.innerHTML = hljs.highlight(pastedText, { language: metadata.mode }).value;
                    
                    codeBlock.appendChild(codeHeader);
                    codeBlock.appendChild(codeContent);
                    
                    // Store code data
                    codeBlock.dataset.code = pastedText;
                    codeBlock.dataset.language = metadata.mode;
                    
                    previewsContainer.appendChild(codeBlock);
                    elements.codePreview.classList.remove('hidden');

                    // Add click handler for tab
                    tab.addEventListener('click', () => {
                        const previewsContainer = elements.codePreview.querySelector('.code-previews');
                        const isCurrentlyActive = tab.classList.contains('active');

                        // Hide all code blocks and deactivate all tabs
                        document.querySelectorAll('.code-block').forEach(block => 
                            block.classList.add('hidden'));
                        document.querySelectorAll('.code-tab').forEach(t => 
                            t.classList.remove('active'));
                        previewsContainer.classList.add('hidden');

                        if (!isCurrentlyActive) {
                            // Show this code block and activate this tab
                            codeBlock.classList.remove('hidden');
                            tab.classList.add('active');
                            previewsContainer.classList.remove('hidden');
                        }
                    });

                    // Add click handler to hide preview when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!elements.codePreview.contains(e.target)) {
                            previewsContainer.classList.add('hidden');
                            document.querySelectorAll('.code-tab').forEach(t => 
                                t.classList.remove('active'));
                        }
                    });

                    // Add remove handler
                    codeHeader.querySelector('.remove-preview').addEventListener('click', (e) => {
                        e.stopPropagation();
                        tab.remove();
                        codeBlock.remove();
                        
                        if (!tabsContainer.children.length) {
                            elements.codePreview.classList.add('hidden');
                        }
                    });
                }
            } catch (e) {
                console.error('Error processing VS Code paste:', e);
            }
        }
    });

    // Add model dropdown button click handler
    elements.modelDropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.modelSelect.classList.toggle('hidden');
    });

    // Add click outside handler for model dropdown
    document.addEventListener('click', (e) => {
        if (!elements.modelSelect.contains(e.target) && !elements.modelDropdownButton.contains(e.target)) {
            elements.modelSelect.classList.add('hidden');
        }
    });
}

function sendMessage(elements) {
    const content = elements.userInput.value.trim();
    const codeBlocks = Array.from(elements.codePreview.querySelectorAll('.code-block')).map(block => ({
        language: block.dataset.language,
        code: block.dataset.code,
        filename: block.dataset.filename || '',
        start_line: parseInt(block.dataset.startLine) || 0,
        end_line: parseInt(block.dataset.endLine) || 0
    }));

    if (content || codeBlocks.length > 0) {
        const state = getState();
        if (!state.currentSessionId) {
            vscode.postMessage({ type: 'createSession' });
            return;
        }

        vscode.postMessage({
            type: 'sendMessage',
            payload: { 
                content: content,
                code: codeBlocks
            }
        });

        // Clear everything
        elements.userInput.value = '';
        elements.userInput.style.height = 'auto';
        elements.codePreview.innerHTML = '';
        elements.codePreview.classList.add('hidden');
    }
} 