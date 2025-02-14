import * as vscode from 'vscode';
import { ChatMessage, ChatSession } from '../types/messages';
import { STORAGE_KEYS, SYSTEM_PROMPTS } from '../constants';
import crypto from 'crypto';

export class SessionManager {
    constructor(private context: vscode.ExtensionContext) {}

    async getCurrentSession(): Promise<ChatSession | undefined> {
        const sessions = await this.getSessions();
        const currentSessionId = this.context.globalState.get<string>(STORAGE_KEYS.LAST_SESSION);
        
        if (!currentSessionId) return undefined;
        
        const currentSession = sessions.find(s => s.session_id === currentSessionId);
        if (!currentSession) {
            // If the current session ID is invalid, clear it
            await this.context.globalState.update(STORAGE_KEYS.LAST_SESSION, undefined);
            return undefined;
        }
        
        return currentSession;
    }

    async getSessions(): Promise<ChatSession[]> {
        const sessions = this.context.globalState.get<ChatSession[]>(STORAGE_KEYS.SESSIONS) || [];
        // Sort sessions by last message time
        return sessions.sort((a, b) => {
            const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return timeB - timeA;
        });
    }

    async createSession(): Promise<ChatSession> {
        const sessionId = crypto.randomUUID();
        const sessions = await this.getSessions();
        const newSession: ChatSession = {
            session_id: sessionId,
            messages: [],
            last_message_at: new Date().toISOString()
        };
        
        sessions.unshift(newSession); // Add to the beginning of the array
        await this.context.globalState.update(STORAGE_KEYS.SESSIONS, sessions);
        await this.context.globalState.update(STORAGE_KEYS.LAST_SESSION, sessionId);
        
        return newSession;
    }

    async deleteSession(sessionId: string): Promise<void> {
        let sessions = await this.getSessions();
        const sessionToDelete = sessions.find(s => s.session_id === sessionId);
        if (!sessionToDelete) return; // Session doesn't exist
        
        sessions = sessions.filter(s => s.session_id !== sessionId);
        await this.context.globalState.update(STORAGE_KEYS.SESSIONS, sessions);

        // If the deleted session was the current session, update the current session
        const currentSessionId = this.context.globalState.get<string>(STORAGE_KEYS.LAST_SESSION);
        if (currentSessionId === sessionId) {
            // Set the most recent session as current, or clear if no sessions left
            const newCurrentSession = sessions[0];
            await this.context.globalState.update(
                STORAGE_KEYS.LAST_SESSION,
                newCurrentSession ? newCurrentSession.session_id : undefined
            );
        }
    }

    async updateSessionMessages(sessionId: string, userMessage: ChatMessage, assistantMessage: ChatMessage): Promise<void> {
        const sessions = await this.getSessions();
        const session = sessions.find(s => s.session_id === sessionId);
        if (!session) return; // Session doesn't exist
        
        // Simply append the new messages
        session.messages.push(userMessage, assistantMessage);
        session.last_message_at = new Date().toISOString();
        
        // Move the updated session to the top of the list
        const otherSessions = sessions.filter(s => s.session_id !== sessionId);
        const updatedSessions = [session, ...otherSessions];
        
        await this.context.globalState.update(STORAGE_KEYS.SESSIONS, updatedSessions);
    }

    async selectSession(sessionId: string): Promise<void> {
        const sessions = await this.getSessions();
        const sessionExists = sessions.some(s => s.session_id === sessionId);
        if (!sessionExists) return; // Don't select non-existent session
        
        await this.context.globalState.update(STORAGE_KEYS.LAST_SESSION, sessionId);
    }

    getSystemMessage(): ChatMessage {
        return {
            role: 'system',
            content: SYSTEM_PROMPTS.default
        };
    }
} 