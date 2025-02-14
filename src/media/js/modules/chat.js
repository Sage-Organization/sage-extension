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

    // Add a click event listener to close the menu when clicking outside
    const closeContextMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            document.removeEventListener('click', closeContextMenu);
        }
    };
    document.addEventListener('click', closeContextMenu);
}

export function deleteSessionOption(sessionId) {
    // Send delete command to VS Code
    window.vscode.postMessage({ 
        command: 'deleteSession', 
        sessionId: sessionId 
    });
}

export function updateSessionList(sessions) {
    console.log("updateSessionList called with sessions:", sessions);
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = '';
    
    sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.classList.add('px-4', 'py-2', 'hover:bg-gray-700', 'cursor-pointer', 'flex', 'justify-between', 'items-center');

        // Left side: Session info
        const infoDiv = document.createElement('div');
        infoDiv.classList.add('flex-1');
        
        const idDiv = document.createElement('div');
        idDiv.classList.add('text-sm', 'font-medium');
        idDiv.textContent = `Session ${session.session_id.slice(0, 8)}...`;
        
        const timeDiv = document.createElement('div');
        timeDiv.classList.add('text-xs', 'text-gray-400');
        timeDiv.textContent = session.last_message_at || 'No messages';

        infoDiv.appendChild(idDiv);
        infoDiv.appendChild(timeDiv);

        // Right side: Delete button
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> 🗑';
        deleteButton.classList.add(
            'text-gray-400',
            'hover:text-red-400',
            'p-1',
            'rounded',
            'transition-colors',
            'opacity-75',
            'hover:opacity-100',
            'ml-2'
        );
        
        // Stop propagation so clicking delete doesn't trigger session selection
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSessionOption(session.session_id);
        });

        // Add click event for selecting the session to the info div
        infoDiv.addEventListener('click', () => {
            selectSession(session.session_id);
        });

        sessionDiv.appendChild(infoDiv);
        sessionDiv.appendChild(deleteButton);
        sessionList.appendChild(sessionDiv);
    });
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