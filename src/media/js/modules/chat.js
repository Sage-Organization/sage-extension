import { clearCodePreview } from './codePreview.js';

export function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    const codePreview = document.getElementById('codePreview');
    const codePreviewContent = document.getElementById('codePreviewContent');
    const filenameElement = document.getElementById('codePreviewFilename');
    
    if (text || !codePreview.classList.contains('hidden')) {
        let messageContent = '';
        
        if (!codePreview.classList.contains('hidden')) {
            const codeBlock = codePreviewContent.querySelector('pre code');
            if (codeBlock) {
                const codeContent = codeBlock.textContent;
                messageContent = `${codeContent}\n\n${text}`;
                window.vscode.postMessage({ 
                    command: 'addMessage', 
                    message: {
                        role: 'user',
                        content: `<div class="p-1.5 mb-2 inline-block bg-gray-700 rounded-md text-gray-300 text-xs">${filenameElement.textContent}</div>\n${text}`
                    }
                });
            }
        } else {
            messageContent = text;
            window.vscode.postMessage({ 
                command: 'addMessage', 
                message: { 
                    role: 'user', 
                    content: text 
                }
            });
        }
        
        window.vscode.postMessage({ command: 'sendMessage', text: messageContent });
        
        input.value = '';
        input.style.height = 'auto';
        
        clearCodePreview();
    }
}

export function newChatSession() {
    window.vscode.postMessage({ command: 'newChatSession' });
}

export function selectSession(sessionId) {
    window.vscode.postMessage({ command: 'selectSession', sessionId });
}

export function handleSessionRightClick(event, sessionId) {
    event.preventDefault();
    event.stopPropagation();
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.top = event.clientY + 'px';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.setAttribute('data-session-id', sessionId);
}

export function deleteSessionOption() {
    const contextMenu = document.getElementById('contextMenu');
    const sessionId = contextMenu.getAttribute('data-session-id');
    window.vscode.postMessage({ command: 'deleteSession', sessionId: sessionId });
    contextMenu.style.display = 'none';
}

export function reconfigure() {
    window.vscode.postMessage({ command: 'reconfigure' });
}

export function updateSessionList(sessions) {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = sessions.map(session => `
        <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer" 
             onclick="selectSession('${session.session_id}')">
            <div class="text-sm font-medium">Session ${session.session_id.slice(0, 8)}...</div>
            <div class="text-xs text-gray-400">${session.last_message_at || 'No messages'}</div>
        </div>
    `).join('');
}

export function updateModelInfo() {
    window.vscode.postMessage({ command: 'getModelInfo' });
}

export function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

export function toggleHistoryDropdown() {
    const dropdown = document.getElementById('historyDropdown');
    dropdown.classList.toggle('hidden');

    if (!dropdown.classList.contains('hidden')) {
        document.addEventListener('click', closeDropdownOnClickOutside);
    } else {
        document.removeEventListener('click', closeDropdownOnClickOutside);
    }
}

export function closeDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('historyDropdown');
    const button = document.getElementById('historyDropdownButton');
    if (!dropdown.contains(event.target) && !button.contains(event.target)) {
        dropdown.classList.add('hidden');
        document.removeEventListener('click', closeDropdownOnClickOutside);
    }
} 