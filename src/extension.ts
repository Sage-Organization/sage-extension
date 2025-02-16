import * as vscode from 'vscode';
import { ChatState, ChatSession, WebviewMessage, ExtensionMessage } from './types';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'sage.chatView';
    private _view?: vscode.WebviewView;
    private _chatState: ChatState;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        // Load saved state
        this._chatState = this._context.globalState.get('chatState') || {
            sessions: [],
            currentSessionId: null,
            currentModel: null
        };
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this._setWebviewMessageListener(webviewView.webview);

        // Send the initial state to the webview
        webviewView.webview.postMessage({
            type: 'initialize',
            payload: this._chatState
        } as ExtensionMessage);

        // Handle view visibility changes
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                // Refresh the state when the view becomes visible
                webviewView.webview.postMessage({
                    type: 'initialize',
                    payload: this._chatState
                } as ExtensionMessage);
            }
        });
    }

    private createChatSession(): ChatSession {
        const session: ChatSession = {
            id: uuidv4(),
            name: `Chat ${this._chatState.sessions.length + 1}`,
            messages: [],
            createdAt: Date.now(),
            lastModified: Date.now()
        };
        this._chatState.sessions.push(session);
        this._chatState.currentSessionId = session.id;
        this.saveState();
        return session;
    }

    private deleteSession(sessionId: string) {
        this._chatState.sessions = this._chatState.sessions.filter(s => s.id !== sessionId);
        if (this._chatState.currentSessionId === sessionId) {
            this._chatState.currentSessionId = this._chatState.sessions.length > 0 ? this._chatState.sessions[0].id : null;
        }
        this.saveState();
    }

    private saveState() {
        this._context.globalState.update('chatState', this._chatState);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                switch (message.type) {
                    case 'createSession':
                        const newSession = this.createChatSession();
                        this._view?.webview.postMessage({
                            type: 'sessionCreated',
                            payload: newSession
                        } as ExtensionMessage);
                        break;

                    case 'deleteSession':
                        this.deleteSession(message.payload.sessionId);
                        this._view?.webview.postMessage({
                            type: 'sessionDeleted',
                            payload: { 
                                deletedSessionId: message.payload.sessionId,
                                currentSessionId: this._chatState.currentSessionId,
                                sessions: this._chatState.sessions
                            }
                        } as ExtensionMessage);
                        break;

                    case 'switchSession':
                        this._chatState.currentSessionId = message.payload.sessionId;
                        this.saveState();
                        this._view?.webview.postMessage({
                            type: 'sessionSwitched',
                            payload: { sessionId: message.payload.sessionId }
                        } as ExtensionMessage);
                        break;

                    case 'sendMessage':
                        const session = this._chatState.sessions.find(s => s.id === this._chatState.currentSessionId);
                        if (session) {
                            session.messages.push({
                                role: 'user',
                                content: message.payload.content,
                                timestamp: Date.now()
                            });
                            session.lastModified = Date.now();
                            this.saveState();
                            
                            // TODO: Implement actual Sage chat functionality here
                            // For now, just echo back a mock response
                            session.messages.push({
                                role: 'assistant',
                                content: `Mock response to: ${message.payload.content}`,
                                timestamp: Date.now()
                            });
                            this.saveState();
                            
                            this._view?.webview.postMessage({
                                type: 'messageReceived',
                                payload: { 
                                    sessionId: session.id,
                                    messages: session.messages
                                }
                            } as ExtensionMessage);
                        }
                        break;
                }
            }
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.html');
        let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

        // Replace template variables
        htmlContent = htmlContent
            .replace(/{{cspSource}}/g, webview.cspSource)
            .replace(/{{scriptUri}}/g, scriptUri.toString())
            .replace(/{{styleUri}}/g, styleUri.toString())
            .replace(/{{initialState}}/g, JSON.stringify(this._chatState));

        return htmlContent;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const chatViewProvider = new ChatViewProvider(context.extensionUri, context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatViewProvider.viewType,
            chatViewProvider
        )
    );
} 