import setupMessageHandler from './modules/messageHandler.js';
import { initDomEvents } from './modules/domEvents.js';
import * as Chat from './modules/chat.js';
import * as CodePreview from './modules/codePreview.js';
import * as Utils from './modules/utils.js';

// Initialize the VS Code API and attach to window
const vscode = acquireVsCodeApi();
window.vscode = vscode;

// Setup the message event handler (for inbound VS Code messages)
setupMessageHandler();

// Initialize DOM event listeners (e.g. paste events, configured marked options, etc.)
initDomEvents();

// Expose functions globally for inline HTML usage
window.sendMessage = Chat.sendMessage;
window.newChatSession = Chat.newChatSession;
window.selectSession = Chat.selectSession;
window.handleSessionRightClick = Chat.handleSessionRightClick;
window.deleteSessionOption = Chat.deleteSessionOption;
window.updateSessionList = Chat.updateSessionList;
window.updateModelInfo = Chat.updateModelInfo;
window.handleKeyPress = Chat.handleKeyPress;
window.toggleHistoryDropdown = Chat.toggleHistoryDropdown;
window.closeDropdownOnClickOutside = Chat.closeDropdownOnClickOutside;
window.toggleCodePreview = CodePreview.toggleCodePreview;
window.clearCodePreview = CodePreview.clearCodePreview;
window.formatMessageContent = Utils.formatMessageContent;
window.autoGrow = Utils.autoGrow;
window.applySyntaxHighlighting = Utils.applySyntaxHighlighting;
window.escapeHtml = Utils.escapeHtml;
