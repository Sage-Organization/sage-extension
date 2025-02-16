export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: number;
    lastModified: number;
}

export interface ChatState {
    sessions: ChatSession[];
    currentSessionId: string | null;
    currentModel: string | null;
}

// Messages between webview and extension
export interface WebviewMessage {
    type: 'createSession' | 'deleteSession' | 'switchSession' | 'sendMessage' | 
          'loadModel' | 'unloadModel' | 'switchModel' | 'getModels';
    payload: any;
}

export interface ExtensionMessage {
    type: 'sessionCreated' | 'sessionDeleted' | 'sessionSwitched' | 'messageReceived' |
          'modelLoaded' | 'modelUnloaded' | 'modelSwitched' | 'modelList' | 'error' |
          'initialize';
    payload: any;
} 