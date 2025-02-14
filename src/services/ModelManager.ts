import { Ollama } from 'ollama';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { STORAGE_KEYS, DEFAULT_MODEL_CONFIG } from '../constants';
import { ModelInfo, ChatMessage, OllamaError } from '../types/messages';
import { ErrorHandler } from './ErrorHandler';

export class ModelManager {
    private _ollamaClient?: Ollama;

    constructor(private context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        try {
            this._ollamaClient = new Ollama({ host: 'http://127.0.0.1:11434' });
            await this.updateAvailableModels();
        } catch (error) {
            await ErrorHandler.handle(error as Error, 'Model initialization');
        }
    }

    async getAvailableModels(): Promise<ModelInfo[]> {
        if (!this._ollamaClient) {
            throw new Error('Ollama client not initialized');
        }

        try {
            const response = await this._ollamaClient.list();
            return response.models.map(model => ({
                name: model.name
            }));
        } catch (error) {
            const err = error as OllamaError;
            throw new Error(`Failed to fetch models: ${err.message}`);
        }
    }

    async updateAvailableModels(): Promise<ModelInfo[]> {
        const models = await this.getAvailableModels();
        return models;
    }

    async getCurrentModel(): Promise<string> {
        const savedModel = await this.context.globalState.get<string>(STORAGE_KEYS.CURRENT_MODEL);
        if (savedModel) return savedModel;
        
        try {
            const models = await this.getAvailableModels();
            if (models.length > 0) {
                const firstModel = models[0].name;
                await this.context.globalState.update(STORAGE_KEYS.CURRENT_MODEL, firstModel);
                return firstModel;
            }
        } catch (error) {
            await ErrorHandler.handle(error as Error, 'Getting default model');
        }
        
        return '';
    }

    async setModel(model: string): Promise<void> {
        // Stop current model
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
                console.error('Failed to stop current model:', error);
            }
        }

        await this.context.globalState.update(STORAGE_KEYS.CURRENT_MODEL, model);
    }

    async generateResponse(messages: ChatMessage[]): Promise<string> {
        if (!this._ollamaClient) {
            throw new Error('Ollama client not initialized');
        }

        const currentModel = await this.getCurrentModel();
        if (!currentModel) {
            throw new Error('No models available. Please pull a model using Ollama first.');
        }

        try {
            const response = await this._ollamaClient.chat({
                model: currentModel,
                messages: messages,
                options: DEFAULT_MODEL_CONFIG
            });

            return response.message.content;
        } catch (error) {
            const err = error as OllamaError;
            throw new Error(`Failed to generate response: ${err.message}`);
        }
    }

    async stopModel(): Promise<void> {
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
        this._ollamaClient = undefined;
    }

    isInitialized(): boolean {
        return !!this._ollamaClient;
    }
} 