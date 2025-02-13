import * as vscode from 'vscode';

export class MessageManager {
    private static readonly MESSAGE_TIMEOUT = 5000; // 5 seconds

    static showInfo(message: string) {
        const notification = vscode.window.showInformationMessage("Sage: " + message, { modal: false });
        this.autoClose(notification);
    }

    static showError(message: string) {
        const notification = vscode.window.showErrorMessage("Sage: " + message, { modal: false });
        this.autoClose(notification);
    }

    static showWarning(message: string) {
        const notification = vscode.window.showWarningMessage("Sage: " + message, { modal: false });
        this.autoClose(notification);
    }

    private static autoClose(notification: Thenable<any>) {
        // Force close the notification after timeout
        setTimeout(async () => {
            try {
                const value = await notification;
                if (value) {
                    // Close via command instead of dispose
                    await vscode.commands.executeCommand('workbench.action.closeMessages');
                }
            } catch (e) {
                // Ignore errors if notification is already closed
            }
        }, this.MESSAGE_TIMEOUT);
    }
} 