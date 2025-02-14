import * as vscode from 'vscode';
import { MessageManager } from '../utils/message_manager';

export class ErrorHandler {
    static async handle(error: Error, context: string): Promise<void> {
        console.error(`Error in ${context}:`, error);
        
        // Log the error
        const message = `${context}: ${error.message}`;
        console.error(message);
        
        // Show error to user
        MessageManager.showError(message);
        
        // Reset configuration if it's a connection error
        if (context.includes('connection') || context.includes('model')) {
            await vscode.workspace.getConfiguration().update('sage.isConfigured', false, true);
        }
    }

    static async handleWithFallback<T>(
        operation: () => Promise<T>,
        context: string,
        fallback: T
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            await this.handle(error as Error, context);
            return fallback;
        }
    }
} 