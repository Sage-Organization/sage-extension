import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const axios = require('axios');
import { BaseViewProvider } from './base_view_provider';
const { ServerManager } = require('../utils/server_manager');
import { MessageManager } from '../utils/message_manager';

export class StandaloneViewProvider extends BaseViewProvider {
    private _currentSessionId?: string;
    private _serverManager: any;

    constructor(context: vscode.ExtensionContext) {
        super(context);
        this._serverManager = new ServerManager(context);
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        try {
            this._view = webviewView;
            webviewView.webview.options = this.getWebviewOptions();

            // Start the server
            await this._serverManager.startServer();

            // Load the standalone chat interface
            const filePath = path.join(this.context.extensionPath, 'src', 'media', 'standalone_sage.html');
            let htmlContent = fs.readFileSync(filePath, 'utf8');
            const mediaPath = vscode.Uri.file(
                path.join(this.context.extensionPath, 'src', 'media')
            );
            const mediaUri = webviewView.webview.asWebviewUri(mediaPath);
            htmlContent = htmlContent.replace(/src="\.\/media\//g, `src="${mediaUri}/`);
            webviewView.webview.html = htmlContent;
        } catch (error: any) {
            await this.handleError(error, 'Failed to start local backend');
        }

        // Handle view closure
        webviewView.onDidDispose(() => {
            this._serverManager.stopServer();
        });

        // Handle messages
        webviewView.webview.onDidReceiveMessage(async message => {
            const backendUrl = 'http://localhost:8000';
            
            switch (message.command) {
                case 'sendMessage':
                    await this.handleMessage(message, webviewView);
                    break;

                case 'newChatSession':
                    this._currentSessionId = undefined;
                    webviewView.webview.postMessage({
                        command: 'updateChatHistory',
                        messages: []
                    });
                    break;

                case 'reconfigure':
                    await this._serverManager.stopServer();
                    await vscode.workspace.getConfiguration().update('sage.isConfigured', false, true);
                    await vscode.commands.executeCommand('sage.switchView');
                    break;
            }
        });
    }

    private async handleMessage(message: any, webviewView: vscode.WebviewView) {
        try {
            const backendUrl = 'http://localhost:8000';
            
            switch (message.command) {
                case 'sendMessage':
                    if (message.text) {
                        if (!this._currentSessionId) {
                            const sessionResponse = await axios.post(
                                `${backendUrl}/api/chat/sessions`,
                                null,
                                { headers: { 'x-user-id': 'standalone-user' } }
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
                            { headers: { 'x-user-id': 'standalone-user' } }
                        );

                        if (response.data.message) {
                            webviewView.webview.postMessage({
                                command: 'addMessage',
                                message: response.data.message
                            });
                        }
                    }
                    break;

                case 'newChatSession':
                    this._currentSessionId = undefined;
                    webviewView.webview.postMessage({
                        command: 'updateChatHistory',
                        messages: []
                    });
                    break;

                case 'reconfigure':
                    await this._serverManager.stopServer();
                    await vscode.workspace.getConfiguration().update('sage.isConfigured', false, true);
                    await vscode.commands.executeCommand('sage.switchView');
                    break;
            }
        } catch (error: any) {
            await this.handleError(error, 'Failed to process message');
        }
    }
} 