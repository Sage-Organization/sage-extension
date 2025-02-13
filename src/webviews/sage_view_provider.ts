import * as vscode from 'vscode';
import { ConnectionViewProvider } from './connection_view_provider';
import { StandaloneViewProvider } from './standalone_view_provider';
import { RemoteViewProvider } from './remote_view_provider';
import { MessageManager } from '../utils/message_manager';

export class SageViewProvider implements vscode.WebviewViewProvider {
	private _currentProvider?: vscode.WebviewViewProvider;
	private _connectionProvider: ConnectionViewProvider;
	private _standaloneProvider: StandaloneViewProvider;
	private _remoteProvider: RemoteViewProvider;
	private _view?: vscode.WebviewView;
	private static readonly STATE_KEY = 'sage.viewState';
	private _lastActiveProvider?: string;

	constructor(private readonly context: vscode.ExtensionContext) {
		this._connectionProvider = new ConnectionViewProvider(context);
		this._standaloneProvider = new StandaloneViewProvider(context);
		this._remoteProvider = new RemoteViewProvider(context);

		// Add configuration change listener
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('sage') && this._view) {
				this.updateProvider();
			}
		});

		// Add visibility change listener
		context.subscriptions.push(
			vscode.window.onDidChangeVisibleTextEditors(() => {
				if (this._view?.visible) {
					this.restoreState();
				}
			})
		);
	}

	private async restoreState() {
		if (!this._view || !this._currentProvider) return;

		// Only attempt to restore state for non-connection providers
		if (this._lastActiveProvider !== 'connection') {
			try {
				await this._currentProvider.resolveWebviewView(
					this._view,
					{} as vscode.WebviewViewResolveContext,
					{} as vscode.CancellationToken
				);
			} catch (error) {
				// If restoration fails, switch back to connection view
				console.error('Failed to restore state:', error);
				this._currentProvider = this._connectionProvider;
				this._lastActiveProvider = 'connection';
				await vscode.workspace.getConfiguration().update('sage.isConfigured', false, true);
				await this._currentProvider.resolveWebviewView(
					this._view,
					{} as vscode.WebviewViewResolveContext,
					{} as vscode.CancellationToken
				);
			}
		}
	}

	private async updateProvider() {
		if (!this._view) return;

		const config = vscode.workspace.getConfiguration('sage');
		const isConfigured = config.get('isConfigured') as boolean;
		const isStandalone = config.get('standalone') as boolean;

		if (!isConfigured) {
			this._currentProvider = this._connectionProvider;
			this._lastActiveProvider = 'connection';
		} else {
			this._currentProvider = isStandalone ? this._standaloneProvider : this._remoteProvider;
			this._lastActiveProvider = isStandalone ? 'standalone' : 'remote';
		}

		// ALWAYS force a full reload when updating provider
		await this._currentProvider.resolveWebviewView(
			this._view,
			{ state: undefined, forceReload: true } as vscode.WebviewViewResolveContext,
			{} as vscode.CancellationToken
		);
	}

	async resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		this._view = webviewView;

		const config = vscode.workspace.getConfiguration('sage');
		const isConfigured = config.get('isConfigured') as boolean;
		const isStandalone = config.get('standalone') as boolean;

		if (!isConfigured) {
			this._currentProvider = this._connectionProvider;
			this._lastActiveProvider = 'connection';
		} else {
			this._currentProvider = isStandalone ? this._standaloneProvider : this._remoteProvider;
			this._lastActiveProvider = isStandalone ? 'standalone' : 'remote';
		}

		// ALWAYS create a new context when resolving the view
		await this._currentProvider.resolveWebviewView(
			webviewView,
			{ ...context, forceReload: true } as vscode.WebviewViewResolveContext,
			token
		);
	}
}