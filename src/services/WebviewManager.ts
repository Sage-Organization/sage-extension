import * as vscode from 'vscode';
import { WebviewMessage, ChatMessage, ChatSession } from '../types/messages';

export class WebviewManager {
    private _lastUpdateId: number = 0;

    constructor(private webview: vscode.Webview) {}

    private postMessage(message: WebviewMessage): void {
        // Add an update ID to help prevent duplicate updates
        const messageWithId = {
            ...message,
            updateId: ++this._lastUpdateId
        };
        this.webview.postMessage(messageWithId);
    }

    updateChatHistory(messages: ChatMessage[]): void {
        console.log('WebviewManager: Updating chat history with', messages.length, 'messages');
        this.postMessage({
            command: 'updateChatHistory',
            messages: messages
        } as WebviewMessage);
    }

    updateSessions(sessions: ChatSession[], currentSessionId?: string) {
        console.log('WebviewManager: Updating sessions list with', sessions.length, 'sessions');
        this.postMessage({
            command: 'updateSessions',
            sessions: sessions,
            currentSessionId: currentSessionId
        });
    }

    updateModelInfo(model: string): void {
        this.postMessage({
            command: 'updateModelInfo',
            model
        });
    }

    updateModelList(models: Array<{ name: string }>): void {
        this.postMessage({
            command: 'updateModelList',
            models
        });
    }

    addTemporaryMessage(message: ChatMessage): void {
        console.log('WebviewManager: Adding temporary message:', message.role);
        this.postMessage({
            command: 'addMessage',
            message: message,
            temporary: true
        });
    }

    updateActiveFile(fileName: string, selection: { start: number; end: number }): void {
        this.postMessage({
            command: 'activeFile',
            file: fileName,
            selection
        });
    }

    showError(error: string): void {
        this.postMessage({
            command: 'showError',
            error
        });
    }

    showStatus(status: string): void {
        this.postMessage({
            command: 'showStatus',
            status
        });
    }

    updateStatus(status: { class: string; text: string }): void {
        this.postMessage({
            command: 'updateStatus',
            status
        });
    }

    clearPendingMessages(): void {
        console.log('WebviewManager: Clearing pending messages');
        this.postMessage({
            command: 'clearPendingMessage'
        });
    }

    cleanup(): void {
        this.postMessage({
            command: 'cleanup'
        });
    }
} 