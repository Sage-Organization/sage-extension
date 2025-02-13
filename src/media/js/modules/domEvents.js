import { handlePaste } from './codePreview.js';
import { updateModelInfo as updateModelInfoChat } from './chat.js';

export function initDomEvents() {
    document.addEventListener('DOMContentLoaded', () => {
        // Configure marked with our highlight callback
        marked.setOptions({
            headerIds: false,
            mangle: false,
            highlight: function (code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            }
        });
    
        updateModelInfoChat();
    });
    
    // Once the DOM is ready, add the paste listener to the message input
    document.addEventListener('DOMContentLoaded', () => {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('paste', handlePaste);
        }
    });
    
    // Hide the context menu if a click happens outside it
    document.addEventListener('click', function () {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu && contextMenu.style.display === 'block') {
            contextMenu.style.display = 'none';
        }
    });
} 