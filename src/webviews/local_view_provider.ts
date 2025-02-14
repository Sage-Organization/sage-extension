import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseViewProvider } from './base_view_provider';
import { MessageManager } from '../utils/message_manager';
import { Ollama } from 'ollama';
import * as crypto from 'crypto';
import { exec } from 'child_process';

interface ChatSession {
    session_id: string;
    messages: any[];
    last_message_at?: string;
}

export class LocalViewProvider extends BaseViewProvider {
    protected _view?: vscode.WebviewView;
    private _currentSessionId?: string;
    private _disposables: vscode.Disposable[] = [];
    private _ollamaClient?: Ollama;
    
    private static readonly LAST_SESSION_KEY = 'sage.local.lastSessionId';
    private static readonly SESSIONS_KEY = 'sage.local.sessions';
    private static readonly CURRENT_MODEL_KEY = 'sage.local.currentModel';

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
    
            this._ollamaClient = new Ollama({ host: 'http://127.0.0.1:11434' });
    
            this.setupMessageListener(webviewView);
            this.setupVisibilityListener(webviewView);
            this.loadChatInterface(webviewView);
            
            // Wait for all async operations to complete
            await Promise.all([
                this.initializeState(webviewView),
                this.updateAvailableModels(webviewView)
            ]);
        } catch (error) {
            console.error('Failed to resolve webview:', error);
            MessageManager.showError('Failed to initialize chat interface');
        }
    }

    private async updateAvailableModels(webviewView: vscode.WebviewView) {
        try {
            if (!this._ollamaClient) return;

            const response = await this._ollamaClient.list();
            const models = response.models.map(model => ({
                name: model.name
            }));
            console.log(models);

            webviewView.webview.postMessage({
                command: 'updateModelList',
                models: models
            });

        } catch (error: any) {
            console.error('Failed to fetch models:', error);
            MessageManager.showError('Failed to fetch available models');
        }
    }

    private async stopModel() {
        const currentModel = await this.getCurrentModel();
        if (currentModel) {
            try {
                await new Promise((resolve, reject) => {
                    exec(`ollama stop ${currentModel}`, (error) => {
                        if (error) reject(error);
                        else resolve(null);
                    });
                });
            } catch (error) {
                console.error('Failed to stop model:', error);
            }
        }
    }

    private setupVisibilityListener(webviewView: vscode.WebviewView) {
        this._disposables.push(
            webviewView.onDidChangeVisibility(async () => {
                if (!webviewView.visible) {
                    await this.stopModel();
                    this._ollamaClient = undefined;
                } else if (!this._ollamaClient) {
                    this._ollamaClient = new Ollama({ host: 'http://127.0.0.1:11434' });
                    await this.updateAvailableModels(webviewView);
                    await this.initializeState(webviewView);
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
        const filePath = path.join(this.context.extensionPath, 'src', 'media', 'sage.html');
        let htmlContent = fs.readFileSync(filePath, 'utf8');
        const mediaPath = vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'media'));
        const mediaUri = webviewView.webview.asWebviewUri(mediaPath);
        htmlContent = htmlContent.replace(/src="\.\/media\//g, `src="${mediaUri}/`);
        webviewView.webview.html = htmlContent;
    }

    private async initializeState(webviewView: vscode.WebviewView) {
        const sessions = await this.getSessions();
        webviewView.webview.postMessage({
            command: 'updateSessions',
            sessions
        });

        const currentModel = await this.getCurrentModel();
        webviewView.webview.postMessage({
            command: 'updateModelInfo',
            model: currentModel
        });

        const lastSessionId = this.context.globalState.get<string>(LocalViewProvider.LAST_SESSION_KEY);
        if (lastSessionId) {
            const session = sessions.find(s => s.session_id === lastSessionId);
            if (session) {
                this._currentSessionId = lastSessionId;
                webviewView.webview.postMessage({
                    command: 'updateChatHistory',
                    messages: session.messages
                });
            }
        }
    }

    private async handleMessage(message: any, webviewView: vscode.WebviewView) {
        switch (message.command) {
            case 'sendMessage':
                await this.handleSendMessage(message, webviewView);
                break;
            case 'selectSession':
                await this.handleSelectSession(message, webviewView);
                break;
            case 'newChatSession':
                await this.handleNewSession(webviewView);
                break;
            case 'deleteSession':
                await this.handleDeleteSession(message, webviewView);
                break;
            case 'getModelInfo':
                await this.handleGetModelInfo(webviewView);
                break;
            case 'setModel':
                await this.handleSetModel(message.model, webviewView);
                break;
            case 'getActiveFile':
                this.handleGetActiveFile();
                break;
        }
    }

    private async handleSendMessage(message: any, webviewView: vscode.WebviewView) {
        if (!message.text || !this._ollamaClient) return;

        const currentModel = await this.getCurrentModel();
        if (!currentModel) {
            MessageManager.showError('No models available. Please pull a model using Ollama first.');
            return;
        }

        if (!this._currentSessionId) {
            await this.handleNewSession(webviewView);
        }

        const userMessage = { role: 'user', content: message.text };
        webviewView.webview.postMessage({
            command: 'addMessage',
            message: userMessage
        });

        try {
            const session = await this.getCurrentSession();
            
            // Convert message history to a string format
            const messageHistory = (session?.messages || [])
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n\n');

            const response = await this._ollamaClient.generate({
                model: currentModel,
                system: `You are Sage, an intelligent and helpful coding assistant. Your responses should be:
                        - Clear and concise
                        - Well-structured using markdown
                        - Code-focused, using proper syntax highlighting
                        - If asked for or providing an explanation, use markdown, and make it as concise as possible.
                        - Do not show usage examples of the code unless explicitly asked for it, otherwise just generate the code.
                        
                        When writing code, always wrap it in triple backticks with the appropriate language identifier:
                        \`\`\`language
                        code here
                        \`\`\``,
                prompt: messageHistory + '\n\nuser: ' + message.text,
                options: {
                    num_ctx: 4096,
                    top_k: 40,
                    top_p: 0.9,
                    temperature: 0.7
                }
            });

            const assistantMessage = { role: 'assistant', content: response.response };
            
            webviewView.webview.postMessage({
                command: 'addMessage',
                message: assistantMessage
            });

            await this.updateSessionMessages(userMessage, assistantMessage);
        } catch (error: any) {
            MessageManager.showError(`Failed to get response: ${error.message}`);
        }
    }

    private async handleSelectSession(message: any, webviewView: vscode.WebviewView) {
        const sessions = await this.getSessions();
        const session = sessions.find(s => s.session_id === message.sessionId);
        if (session) {
            this._currentSessionId = message.sessionId;
            await this.context.globalState.update(LocalViewProvider.LAST_SESSION_KEY, message.sessionId);
            webviewView.webview.postMessage({
                command: 'updateChatHistory',
                messages: session.messages
            });
        }
    }

    private async handleNewSession(webviewView: vscode.WebviewView) {
        // Define the initial system message for the session

        const sessionId = crypto.randomUUID();
        const sessions = await this.getSessions();
        sessions.push({
            session_id: sessionId,
            messages: [],  // Append the system message as the first message
            last_message_at: new Date().toISOString()
        });
        await this.context.globalState.update(LocalViewProvider.SESSIONS_KEY, sessions);
        this._currentSessionId = sessionId;
        await this.context.globalState.update(LocalViewProvider.LAST_SESSION_KEY, sessionId);
        
        webviewView.webview.postMessage({
            command: 'updateSessions',
            sessions: sessions
        });
        webviewView.webview.postMessage({
            command: 'updateChatHistory',
            messages: []
        });
    }

    private async handleDeleteSession(message: any, webviewView: vscode.WebviewView) {
        // Retrieve existing chat sessions from global state
        let sessions = await this.getSessions();

        // Filter out the session being deleted (message.sessionId comes from the context menu)
        sessions = sessions.filter(s => s.session_id !== message.sessionId);

        // Update the sessions in global state
        await this.context.globalState.update(LocalViewProvider.SESSIONS_KEY, sessions);

        // If the deleted session was the current session, reset it and clear chat history
        if (this._currentSessionId === message.sessionId) {
            this._currentSessionId = undefined;
            await this.context.globalState.update(LocalViewProvider.LAST_SESSION_KEY, undefined);
            webviewView.webview.postMessage({
                command: 'updateChatHistory',
                messages: []
            });
        }

        // Post the updated sessions list back to the webview
        webviewView.webview.postMessage({
            command: 'updateSessions',
            sessions
        });
    }

    private async handleGetModelInfo(webviewView: vscode.WebviewView) {
        const currentModel = await this.getCurrentModel();
        webviewView.webview.postMessage({
            command: 'updateModelInfo',
            model: currentModel
        });
    }

    private async handleSetModel(model: string, webviewView: vscode.WebviewView) {
        await this.context.globalState.update(LocalViewProvider.CURRENT_MODEL_KEY, model);
        webviewView.webview.postMessage({
            command: 'updateModelInfo',
            model
        });
    }

    private handleGetActiveFile() {
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
    }

    private async getSessions(): Promise<ChatSession[]> {
        return this.context.globalState.get<ChatSession[]>(LocalViewProvider.SESSIONS_KEY) || [];
    }

    private async getCurrentSession(): Promise<ChatSession | undefined> {
        const sessions = await this.getSessions();
        return sessions.find(s => s.session_id === this._currentSessionId);
    }

    private async getCurrentModel(): Promise<string> {
        const savedModel = await this.context.globalState.get<string>(LocalViewProvider.CURRENT_MODEL_KEY);
        if (savedModel) return savedModel;
        
        // Try to get the first available model instead of defaulting to llama2
        try {
            if (this._ollamaClient) {
                const response = await this._ollamaClient.list();
                if (response.models && response.models.length > 0) {
                    const firstModel = response.models[0].name;
                    await this.context.globalState.update(LocalViewProvider.CURRENT_MODEL_KEY, firstModel);
                    return firstModel;
                }
            }
        } catch (error) {
            console.error('Failed to get default model:', error);
        }
        
        return ''; // Return empty string if no models are available
    }

    private async updateSessionMessages(userMessage: any, assistantMessage: any) {
        const sessions = await this.getSessions();
        const session = sessions.find(s => s.session_id === this._currentSessionId);
        if (session) {
            session.messages.push(userMessage, assistantMessage);
            session.last_message_at = new Date().toISOString();
            await this.context.globalState.update(LocalViewProvider.SESSIONS_KEY, sessions);
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'updateSessions',
                    sessions
                });
            }
        }
    }

    dispose() {
        this.stopModel().catch(console.error);
        this._ollamaClient = undefined;
        this._disposables.forEach(d => d.dispose());
    }
}