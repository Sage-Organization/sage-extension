export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface WebviewMessage {
    command: 'addMessage' | 'updateChatHistory' | 'updateSessions' | 'showStatus' | 
             'showError' | 'updateStatus' | 'tokenized' | 'updateModelInfo' | 
             'activeFile' | 'updateModelList' | 'clearPendingMessage' | 'setModel' |
             'sendMessage' | 'selectSession' | 'newChatSession' | 'deleteSession' |
             'getModelInfo' | 'getActiveFile' | 'cleanup' | 'ready';
    message?: ChatMessage;
    messages?: ChatMessage[];
    temporary?: boolean;
    models?: Array<{ name: string }>;
    sessions?: ChatSession[];
    status?: {
        class: string;
        text: string;
    } | string;
    file?: string;
    selection?: {
        start: number;
        end: number;
    };
    model?: string;
    text?: string;
    sessionId?: string;
    error?: string;
    originalCode?: string;
    tokenizedCode?: string;
    currentSessionId?: string;
}

export interface ChatSession {
    session_id: string;
    messages: ChatMessage[];
    last_message_at?: string;
}

export interface ModelInfo {
    name: string;
}

export interface OllamaError extends Error {
    message: string;
} 