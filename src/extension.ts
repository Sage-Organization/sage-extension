import * as vscode from 'vscode';
import { SageViewProvider } from './webviews/sage_view_provider';

// Configuration type for better type safety
interface SageConfig {
    currentRemoteBackendUrl: string;
    localMode: boolean;
    isConfigured: boolean;
}

async function getConfiguration(): Promise<SageConfig> {
    const config = vscode.workspace.getConfiguration('sage');
    return {
        currentRemoteBackendUrl: config.get('currentRemoteBackendUrl') as string,
        localMode: config.get('localMode') as boolean,
        isConfigured: config.get('isConfigured') as boolean
    };
}

async function updateConfiguration(updates: Partial<SageConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration('sage');
    for (const [key, value] of Object.entries(updates)) {
        await config.update(key, value, true);
    }
}

async function activate(context: vscode.ExtensionContext) {
    console.log('Sage extension activating...');
    
    // Register the webview provider
    const provider = new SageViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('sageView', provider)
    );

    // Register the switchView command
    context.subscriptions.push(
        vscode.commands.registerCommand('sage.switchView', async () => {
            // Force the webview to reload by hiding and showing it
            await vscode.commands.executeCommand('workbench.view.extension.sageSidebar');
        })
    );

    console.log('Sage extension activated');
}

export function deactivate(context: vscode.ExtensionContext) {
    return;
}

module.exports = {
    activate,
    deactivate
};