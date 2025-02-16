// Initialize state from vscode storage
let state = vscode.getState() || initialState;

// UI Elements
const historyDropdownButton = document.getElementById('historyDropdownButton');
const historyDropdown = document.getElementById('historyDropdown');
const sessionSelect = document.getElementById('sessionSelect');
const modelSelect = document.getElementById('modelSelect');
const newSessionButton = document.getElementById('newSession');
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendMessage');

// Update the sessions dropdown
function updateSessionsDropdown() {
    sessionSelect.innerHTML = '';
    state.sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'flex items-center justify-between px-4 py-2 hover:bg-lighter-grey cursor-pointer';
        if (session.id === state.currentSessionId) {
            sessionDiv.classList.add('bg-lighter-grey');
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = session.name;
        nameSpan.className = 'flex-1';
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteButton.className = 'ml-2 text-gray-400 hover:text-red-500';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            vscode.postMessage({
                type: 'deleteSession',
                payload: { sessionId: session.id }
            });
        };

        sessionDiv.appendChild(nameSpan);
        sessionDiv.appendChild(deleteButton);
        
        sessionDiv.onclick = () => {
            vscode.postMessage({
                type: 'switchSession',
                payload: { sessionId: session.id }
            });
            historyDropdown.classList.add('hidden');
        };
        
        sessionSelect.appendChild(sessionDiv);
    });
}

// Update the chat messages display
function updateChatMessages() {
    chatMessages.innerHTML = '';
    const currentSession = state.sessions.find(s => s.id === state.currentSessionId);
    
    if (currentSession) {
        currentSession.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-wrapper';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = msg.role === 'user' ? 'message user' : 'message assistant';
            
            const textDiv = document.createElement('div');
            textDiv.className = 'content';
            textDiv.textContent = msg.content;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'timestamp';
            timeDiv.textContent = new Date(msg.timestamp).toLocaleTimeString();
            
            contentDiv.appendChild(textDiv);
            contentDiv.appendChild(timeDiv);
            messageDiv.appendChild(contentDiv);
            chatMessages.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Event Listeners
historyDropdownButton.addEventListener('click', () => {
    historyDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!historyDropdown.contains(e.target) && !historyDropdownButton.contains(e.target)) {
        historyDropdown.classList.add('hidden');
    }
});

newSessionButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'createSession' });
});

sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
});

function sendMessage() {
    const content = userInput.value.trim();
    if (content) {
        // If there's no current session, create one
        if (!state.currentSessionId) {
            vscode.postMessage({ type: 'createSession' });
            // The session will be created and the message will be sent when we receive the sessionCreated event
            return;
        }

        vscode.postMessage({
            type: 'sendMessage',
            payload: { content }
        });
        userInput.value = '';
        userInput.style.height = 'auto';
    }
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'sessionCreated':
            state.sessions.push(message.payload);
            state.currentSessionId = message.payload.id;
            // If we have pending content to send, send it now
            const pendingContent = userInput.value.trim();
            if (pendingContent) {
                vscode.postMessage({
                    type: 'sendMessage',
                    payload: { content: pendingContent }
                });
                userInput.value = '';
                userInput.style.height = 'auto';
            }
            break;
            
        case 'sessionDeleted':
            state.sessions = state.sessions.filter(s => s.id !== message.payload.deletedSessionId);
            state.currentSessionId = message.payload.currentSessionId;
            break;
            
        case 'sessionSwitched':
            state.currentSessionId = message.payload.sessionId;
            break;
            
        case 'messageReceived':
            const session = state.sessions.find(s => s.id === message.payload.sessionId);
            if (session) {
                session.messages = message.payload.messages;
            }
            break;
            
        case 'modelList':
            // TODO: Implement model list handling
            break;

        case 'initialize':
            // Update our state with the saved state from the extension
            state = message.payload;
            break;
    }
    
    // Update the UI
    updateSessionsDropdown();
    updateChatMessages();
    
    // Update the stored state
    vscode.setState(state);
}); 