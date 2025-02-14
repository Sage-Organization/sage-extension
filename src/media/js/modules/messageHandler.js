import { formatMessageContent, applySyntaxHighlighting } from './utils.js';

export default function setupMessageHandler() {
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'clearPendingMessage':
                // Implement any pending message clearing if needed.
                break;
            case 'addMessage': {
                const chatHistory = document.getElementById('chatHistory');
                if (message.message.role === 'user') {
                    chatHistory.innerHTML += `
                        <div class="flex justify-start mb-4">
                            <div class="bg-gray-800 text-white rounded-lg py-2 px-4 w-[95%]">
                                <div class="markdown-content">${message.message.content}</div>
                            </div>
                        </div>
                    `;
                } else {
                    chatHistory.innerHTML += `
                        <div class="flex justify-start mb-4">
                            <div class="max-w-[95%]">
                                <div class="markdown-content">${formatMessageContent(message.message.content)}</div>
                            </div>
                        </div>
                    `;
                }
                chatHistory.scrollTop = chatHistory.scrollHeight;
                // Manually apply syntax highlighting to any code blocks that were just added
                applySyntaxHighlighting();
                break;
            }
            case 'updateChatHistory': {
                const chatHistory = document.getElementById('chatHistory');
                chatHistory.innerHTML = '';
                message.messages.forEach((msg) => {
                    if (msg.role === 'user') {
                        chatHistory.innerHTML += `
                            <div class="flex justify-start mb-4">
                                <div class="bg-gray-800 text-white rounded-lg py-2 px-4 w-[95%]">
                                    <div class="markdown-content">${msg.content}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        chatHistory.innerHTML += `
                            <div class="flex justify-start mb-4">
                                <div class="max-w-[95%]">
                                    <div class="markdown-content">${formatMessageContent(msg.content)}</div>
                                </div>
                            </div>
                        `;
                    }
                });
                chatHistory.scrollTop = chatHistory.scrollHeight;
                // Manually apply syntax highlighting after updating the chat history
                applySyntaxHighlighting();
                break;
            }
            case 'updateSessions': {
                if (message.sessions) {
                    updateSessionList(message.sessions);
                }
                break;
            }
            case 'showStatus': {
                // Optionally handle status updates.
                break;
            }
            case 'showError': {
                // Optionally display error messages on the UI.
                break;
            }
            case 'updateStatus': {
                const statusElement = document.querySelector('.text-sm span');
                if (statusElement) {
                    statusElement.className = message.status.class;
                    statusElement.innerHTML = `<i class="fas fa-circle mr-1"></i>${message.status.text}`;
                }
                break;
            }
            case 'tokenized': {
                // Find the corresponding code block and update its content
                const codeBlocks = document.querySelectorAll('code');
                codeBlocks.forEach(block => {
                    if (block.textContent === message.originalCode) {
                        block.innerHTML = message.tokenizedCode;
                    }
                });
                break;
            }
            case 'updateModelInfo': {
                document.getElementById('modelInfo').innerHTML =
                    `${message.model}`;
                break;
            }
            case 'activeFile': {
                const filenameElement = document.getElementById('codePreviewFilename');
                if (filenameElement && message.file) {
                    // Get just the filename from the path
                    const filename = message.file.split(/[\/\\]/).pop();
                    const lineRange = message.selection.start === message.selection.end 
                        ? `line ${message.selection.start}`
                        : `lines ${message.selection.start}-${message.selection.end}`;
                    
                    // Calculate available space (adjust the numbers based on your UI)
                    const maxFilenameLength = 20; // Adjust this value as needed
                    let displayName = filename;
                    
                    if (filename.length > maxFilenameLength) {
                        // Keep the file extension and abbreviate the middle
                        const ext = filename.split('.').pop();
                        const name = filename.slice(0, filename.length - ext.length - 1);
                        displayName = `${name.slice(0, maxFilenameLength - ext.length - 4)}...${ext}`;
                    }
                    
                    filenameElement.textContent = `${displayName} ${lineRange}`;
                }
                break;
            }
            case 'updateModelList': {
                const modelSelect = document.getElementById('modelSelect');
                modelSelect.innerHTML = message.models
                    .map(model => `<option value="${model.name}">${model.name}</option>`)
                    .join('');
                break;
            }
        }
    });
}
