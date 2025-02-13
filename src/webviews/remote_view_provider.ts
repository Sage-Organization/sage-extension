import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const axios = require('axios');
import { BaseViewProvider } from './base_view_provider';
import { loadServerProfiles, saveServerProfiles } from '../utils/server_profiles';
import { MessageManager } from '../utils/message_manager';

export class RemoteViewProvider extends BaseViewProvider {
    protected _view?: vscode.WebviewView;
    private _currentSessionId?: string;
    private _disposables: vscode.Disposable[] = [];
    
    // Static key for storing last session ID
    private static readonly LAST_SESSION_KEY = 'sage.lastSessionId';
    private static readonly STATE_KEY = 'sage.remoteViewState';

    constructor(context: vscode.ExtensionContext) {
        super(context);
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        try {
            this._view = webviewView;
            webviewView.webview.options = this.getWebviewOptions();

            // Set up listeners and load HTML
            this.setupVisibilityListener(webviewView);
            this.setupMessageListener(webviewView);
            this.loadChatInterface(webviewView);

            const backendUrl = this.getBackendUrl();
            this.handleConnectionStatus(false, 'Connecting...');
            await this.initializeState(backendUrl, webviewView);
        } catch (error: any) {
            await this.handleError(error, 'Failed to connect to remote backend');
        }
    }

    // --- UI Setup Methods ---
    private setupVisibilityListener(webviewView: vscode.WebviewView) {
        this._disposables.push(
            webviewView.onDidChangeVisibility(async () => {
                if (webviewView.visible) {
                    const backendUrl = this.getBackendUrl();
                    this.handleConnectionStatus(false, 'Connecting...');
                    await this.initializeState(backendUrl, webviewView);
                }
            })
        );
    }

    private setupMessageListener(webviewView: vscode.WebviewView) {
        webviewView.webview.onDidReceiveMessage(async message => {
            try {
                await this.handleMessage(message, webviewView);
            } catch (error: any) {
                await this.handleError(error, 'Failed to process message');
            }
        });
    }

    private loadChatInterface(webviewView: vscode.WebviewView) {
        const filePath = path.join(this.context.extensionPath, 'src', 'media', 'remote_sage.html');
        let htmlContent = fs.readFileSync(filePath, 'utf8');
        const mediaPath = vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'media'));
        const mediaUri = webviewView.webview.asWebviewUri(mediaPath);
        htmlContent = htmlContent.replace(/src="\.\/media\//g, `src="${mediaUri}/`);
        webviewView.webview.html = htmlContent;
    }

    private getBackendUrl(): string {
        const config = vscode.workspace.getConfiguration('sage');
        return config.get('currentRemoteBackendUrl') as string;
    }
    
    private async initializeState(backendUrl: string, webviewView: vscode.WebviewView) {
        // Break down into steps for clarity.
        await this.testConnection(backendUrl, webviewView);
        const profile = await this.ensureUserProfile(backendUrl);
        await this.updateModelInfoInView(backendUrl, webviewView);
        await this.restoreLastChatSession(backendUrl, webviewView, profile);
        await this.saveState(backendUrl, profile.userId);
    }

    private async testConnection(backendUrl: string, webviewView: vscode.WebviewView) {
        await axios.get(`${backendUrl}/health`);
        this.handleConnectionStatus(true, 'Connected');
    }

    private async ensureUserProfile(backendUrl: string): Promise<{ userId: string }> {
        const serverProfiles = await loadServerProfiles(this.context);
        let profile = serverProfiles[backendUrl] || { userId: '' };

        if (profile.userId) {
            try {
                await axios.get(`${backendUrl}/api/user/validate/${profile.userId}`);
            } catch (error) {
                delete serverProfiles[backendUrl];
                await saveServerProfiles(this.context, serverProfiles);
                profile = { userId: '' };
            }
        }

        if (!profile.userId) {
            const userResponse = await axios.post(`${backendUrl}/api/user/users`);
            profile.userId = userResponse.data.id;
            serverProfiles[backendUrl] = profile;
            await saveServerProfiles(this.context, serverProfiles);
        }
        return profile;
    }

    private async updateModelInfoInView(backendUrl: string, webviewView: vscode.WebviewView) {
        try {
            const modelResponse = await axios.get(`${backendUrl}/api/llm/current`);
            webviewView.webview.postMessage({ 
                command: 'updateModelInfo', 
                model: modelResponse.data 
            });
        } catch (error) {
            console.error('Error fetching model info', error);
        }
    }

    private async restoreLastChatSession(
        backendUrl: string,
        webviewView: vscode.WebviewView,
        profile: { userId: string }
    ) {
        const sessions = await this.fetchChatSessions(backendUrl);
        if (sessions) {
            webviewView.webview.postMessage({
                command: 'updateSessions',
                sessions: sessions
            });

            const lastSessionId = this.context.globalState.get(RemoteViewProvider.LAST_SESSION_KEY);
            if (lastSessionId) {
                try {
                    const sessionResponse = await axios.get(
                        `${backendUrl}/api/chat/sessions/${lastSessionId}`,
                        { headers: { 'x-user-id': profile.userId } }
                    );
                    this._currentSessionId = lastSessionId as string;
                    webviewView.webview.postMessage({
                        command: 'updateChatHistory',
                        messages: sessionResponse.data.messages
                    });
                } catch (error) {
                    // If restoration fails, clear the last active session
                    await this.context.globalState.update(RemoteViewProvider.LAST_SESSION_KEY, undefined);
                }
            }
        }
    }

    private async saveState(backendUrl: string, userId: string) {
        await this.context.globalState.update(RemoteViewProvider.STATE_KEY, {
            backendUrl,
            userId,
            sessionId: this._currentSessionId
        });
    }

    // --- Message Handling Logic ---
    private async handleMessage(message: any, webviewView: vscode.WebviewView) {
        switch (message.command) {
            case 'tokenize':
                webviewView.webview.postMessage({
                    command: 'tokenized',
                    originalCode: message.code,
                    tokenizedCode: this.escapeHtml(message.code)
                });
                break;
            case 'sendMessage':
                await this.handleSendMessage(message, webviewView);
                break;
            case 'selectSession':
                await this.handleSelectSession(message, webviewView);
                break;
            case 'newChatSession':
                this._currentSessionId = undefined;
                await this.context.globalState.update(RemoteViewProvider.LAST_SESSION_KEY, undefined);
                webviewView.webview.postMessage({
                    command: 'updateChatHistory',
                    messages: []
                });
                break;
            case 'deleteSession':
                await this.handleDeleteSession(message, webviewView);
                break;
            case 'reconfigure':
                await this.handleReconfigure(webviewView);
                break;
            case 'getModelInfo':
                await this.handleGetModelInfo(webviewView);
                break;
            case 'getActiveFile': {
                const editor = vscode.window.activeTextEditor;
                if (editor && this._view) {
                    this._view.webview.postMessage({
                        command: 'activeFile',
                        file: editor.document.fileName,
                        selection: {
                            start: editor.selection.start.line + 1,
                            end: editor.selection.end.line + 1
                        }
                    });
                }
                break;
            }
            default:
                console.warn('Unknown command received:', message.command);
                break;
        }
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private async handleSendMessage(message: any, webviewView: vscode.WebviewView) {
        const backendUrl = this.getBackendUrl();
        if (!message.text) return;
    
        const serverProfiles = await loadServerProfiles(this.context);
        const profile = serverProfiles[backendUrl];
        if (!profile || !profile.userId) {
            MessageManager.showError("User ID not configured. Please reconfigure your connection.");
            return;
        }
    
        if (!this._currentSessionId) {
            const sessionResponse = await axios.post(
                `${backendUrl}/api/chat/sessions`,
                null,
                { headers: { 'x-user-id': profile.userId } }
            );
            this._currentSessionId = sessionResponse.data.session_id;
        }
    
        webviewView.webview.postMessage({
            command: 'addMessage',
            message: { role: 'user', content: message.text }
        });
    
        const response = await axios.post(
            `${backendUrl}/api/chat/sessions/${this._currentSessionId}/messages`,
            { content: message.text },
            { headers: { 'x-user-id': profile.userId } }
        );
    
        if (response.data.message) {
            webviewView.webview.postMessage({
                command: 'addMessage',
                message: response.data.message
            });
        }
    
        // Refresh sessions list
        const sessions = await this.fetchChatSessions(backendUrl);
        if (sessions) {
            webviewView.webview.postMessage({
                command: 'updateSessions',
                sessions: sessions
            });
        }
    }

    private async handleSelectSession(message: any, webviewView: vscode.WebviewView) {
        const backendUrl = this.getBackendUrl();
        if (message.sessionId) {
            const serverProfiles = await loadServerProfiles(this.context);
            const profile = serverProfiles[backendUrl];
    
            try {
                const sessionResponse = await axios.get(
                    `${backendUrl}/api/chat/sessions/${message.sessionId}`,
                    { headers: { 'x-user-id': profile.userId } }
                );
                this._currentSessionId = message.sessionId;
                await this.context.globalState.update(RemoteViewProvider.LAST_SESSION_KEY, message.sessionId);
    
                webviewView.webview.postMessage({
                    command: 'updateChatHistory',
                    messages: sessionResponse.data.messages
                });
            } catch (error: any) {
                console.error('Error fetching session:', error);
                MessageManager.showError(`Failed to open session: ${error.message}`);
            }
        }
    }

    private async handleDeleteSession(message: any, webviewView: vscode.WebviewView) {
        const backendUrl = this.getBackendUrl();
        if (message.sessionId) {
            const serverProfiles = await loadServerProfiles(this.context);
            const profile = serverProfiles[backendUrl];
    
            try {
                await axios.delete(
                    `${backendUrl}/api/chat/sessions/${message.sessionId}`,
                    { headers: { 'x-user-id': profile.userId } }
                );
                MessageManager.showInfo("Chat session deleted successfully.");
    
                if (this._currentSessionId === message.sessionId) {
                    this._currentSessionId = undefined;
                    await this.context.globalState.update(RemoteViewProvider.LAST_SESSION_KEY, undefined);
                    webviewView.webview.postMessage({
                        command: 'updateChatHistory',
                        messages: []
                    });
                }
    
                const sessions = await this.fetchChatSessions(backendUrl);
                if (sessions) {
                    webviewView.webview.postMessage({
                        command: 'updateSessions',
                        sessions: sessions
                    });
                }
            } catch (error: any) {
                console.error('Error deleting session:', error);
                MessageManager.showError(`Failed to delete session: ${error.message}`);
            }
        }
    }

    private async handleReconfigure(webviewView: vscode.WebviewView) {
        try {
            MessageManager.showInfo('Reconfiguring Sage...');
            await vscode.workspace.getConfiguration().update('sage.isConfigured', false, true);
            await vscode.workspace.getConfiguration().update('sage.currentRemoteBackendUrl', '', true);
            
            // Reset state and switch view
            this._currentSessionId = undefined;
            await this.context.globalState.update(RemoteViewProvider.LAST_SESSION_KEY, undefined);
            await this.context.globalState.update(RemoteViewProvider.STATE_KEY, undefined);
            await vscode.commands.executeCommand('sage.switchView');
            
            MessageManager.showInfo('Reconfiguration complete');
        } catch (error: any) {
            console.error('Reconfiguration error:', error);
            MessageManager.showError(`Failed to reconfigure: ${error.message}`);
            if (this._view) {
                this._view.webview.html = this.getConnectionErrorHtml();
            }
        }
    }

    private async fetchChatSessions(backendUrl: string) {
        try {
            const serverProfiles = await loadServerProfiles(this.context);
            const profile = serverProfiles[backendUrl];
            if (!profile?.userId) {
                console.error('No user ID found for this backend');
                return null;
            }
            const response = await axios.get(
                `${backendUrl}/api/chat/sessions`,
                { headers: { 'x-user-id': profile.userId } }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching chat sessions:', error);
            return null;
        }
    }

    private handleConnectionStatus(connected: boolean, statusText?: string) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateStatus',
                status: {
                    text: statusText || (connected ? 'Connected' : 'Disconnected'),
                    class: connected ? 'text-green-500' : 'text-red-500'
                }
            });
        }
    }

    private async handleGetModelInfo(webviewView: vscode.WebviewView) {
        try {
            const backendUrl = this.getBackendUrl();
            const response = await axios.get(`${backendUrl}/api/llm/current`);
            webviewView.webview.postMessage({ 
                command: 'updateModelInfo', 
                model: response.data 
            });
        } catch (error) {
            console.error('Failed to fetch model info:', error);
        }
    }

    private getConnectionErrorHtml(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 20px;
                        color: #cccccc;
                        background-color: #1e1e1e;
                        font-family: sans-serif;
                    }
                </style>
            </head>
            <body>
                <h3>Connection Error</h3>
                <p>Unable to connect to the remote backend. Please check your connection settings.</p>
                <button onclick="vscode.postMessage({command: 'reconfigure'})">
                    Configure Backend
                </button>
                <script>
                    const vscode = acquireVsCodeApi();
                </script>
            </body>
            </html>
        `;
    }

    
} 