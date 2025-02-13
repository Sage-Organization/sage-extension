import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const axios = require('axios');
import { BaseViewProvider } from './base_view_provider';
const { BackendInstaller } = require('../installation');
import { loadServerProfiles, saveServerProfiles } from '../utils/server_profiles';
import { MessageManager } from '../utils/message_manager';

export class ConnectionViewProvider extends BaseViewProvider {
    constructor(context: vscode.ExtensionContext) {
        super(context);
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = this.getWebviewOptions();

        // Check if backend is installed
        const installer = new BackendInstaller(this.context);
        const isInstalled = await installer.isInstalled();

        // Get current configuration
        const config = vscode.workspace.getConfiguration('sage');
        const currentRemoteBackendUrl = config.get('currentRemoteBackendUrl') as string;
        const isStandalone = config.get('standalone') as boolean;

        const filePath = path.join(this.context.extensionPath, 'src', 'media', 'connection_panel.html');
        try {
            let htmlContent = fs.readFileSync(filePath, 'utf8');
            
            // Replace template variables
            const standaloneSection = !isInstalled 
                ? `<button id="installButton" 
                       class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                       Install Local Backend
                   </button>`
                : '';
            
            htmlContent = htmlContent
                .replace('{{standaloneSection}}', standaloneSection)
                .replace('{{remoteBackendUrl}}', currentRemoteBackendUrl || '')
                .replace('{{currentMode}}', isStandalone ? 'standalone' : 'remote')
                .replace('{{standaloneChecked}}', isStandalone ? 'checked' : '')
                .replace('{{remoteChecked}}', !isStandalone ? 'checked' : '')
                .replace('{{standaloneHidden}}', isStandalone ? '' : 'hidden')
                .replace('{{remoteHidden}}', !isStandalone ? '' : 'hidden');

            webviewView.webview.html = htmlContent;
        } catch (error) {
            console.error("Error reading connection HTML file:", error);
            webviewView.webview.html = `<html><body>Error loading configuration content</body></html>`;
        }

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'saveConfiguration':
                    await this.handleSaveConfiguration(message, webviewView);
                    break;
                case 'installBackend':
                    await this.handleInstallBackend(webviewView);
                    break;
            }
        });
    }

    private async handleSaveConfiguration(message: any, webviewView: vscode.WebviewView) {
        try {
            MessageManager.showInfo('Testing connection...');
            const { mode, remoteBackendUrl } = message;
            const isStandalone = mode === 'standalone';

            if (isStandalone) {
                // Check if backend is installed for standalone mode
                const installer = new BackendInstaller(this.context);
                const isInstalled = await installer.isInstalled();
                
                if (!isInstalled) {
                    MessageManager.showError('Local backend is not installed. Please install it first.');
                    return;
                }
            } else if (remoteBackendUrl) {
                // Handle remote backend configuration
                const healthResponse = await axios.get(`${remoteBackendUrl}/health`);
                if (healthResponse.status !== 200) {
                    throw new Error('Could not connect to backend');
                }
                MessageManager.showInfo('Connection successful');

                // Check if we already have a user ID for this backend
                const serverProfiles = await loadServerProfiles(this.context);
                if (!serverProfiles[remoteBackendUrl] || !serverProfiles[remoteBackendUrl].userId) {
                    const userResponse = await axios.post(`${remoteBackendUrl}/api/user/users`);
                    const userId = userResponse.data.id;
                    serverProfiles[remoteBackendUrl] = { userId };
                    await saveServerProfiles(this.context, serverProfiles);
                }
            }

            // Save configuration
            await vscode.workspace.getConfiguration().update('sage.standalone', isStandalone, true);
            await vscode.workspace.getConfiguration().update(
                'sage.currentRemoteBackendUrl',
                isStandalone ? 'http://localhost:8000' : remoteBackendUrl,
                true
            );
            await vscode.workspace.getConfiguration().update('sage.isConfigured', true, true);

            MessageManager.showInfo('Configuration saved successfully');
            
            // Switch to the chat view
            await vscode.commands.executeCommand('sage.switchView');
        } catch (error: any) {
            MessageManager.showError(`Configuration failed: ${error.message}`);
        }
    }

    private async handleInstallBackend(webviewView: vscode.WebviewView) {
        try {
            const installer = new BackendInstaller(this.context);
            MessageManager.showInfo('Installing backend...');
            const success = await installer.install();
            if (success) {
                // Refresh the view to show updated installation status
                await this.resolveWebviewView(webviewView, {} as any, {} as any);
            }
        } catch (error: any) {
            MessageManager.showError(`Installation failed: ${error.message}`);
        }
    }
} 