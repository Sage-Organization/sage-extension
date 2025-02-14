import { formatMessageContent } from './utils.js';

function extractCodeBlocks(content) {
    const blocks = [];
    const regex = /File: ([^\n]+?)(?:\s+\(lines\s+(\d+(?:-\d+)?)\))?\n```(\w+)\n([\s\S]+?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        blocks.push({
            filename: match[1],
            lineRange: match[2] || '',
            language: match[3],
            code: match[4].trim()
        });
    }

    // Get the remaining text after all code blocks
    const lastIndex = regex.lastIndex;
    const remainingText = content.slice(lastIndex).trim();

    return { blocks, remainingText };
}

function createCodeTabsElement(blocks) {
    const container = document.createElement('div');
    container.className = 'code-blocks-container';

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'flex flex-wrap gap-2 mb-2';
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'code-blocks-content hidden';

    blocks.forEach((block, index) => {
        // Create tab button
        const tab = document.createElement('button');
        tab.className = 'px-2 py-1 rounded-md cursor-pointer transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center gap-2 text-xs';
        
        const filename = block.filename.split(/[\/\\]/).pop();
        const displayName = abbreviateFilename(filename);
        const lineInfo = block.lineRange ? `:${block.lineRange}` : '';
        
        tab.innerHTML = `
            <i class="fas fa-code text-xs"></i>
            <span>${displayName}${lineInfo}</span>
        `;
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'code-block-container hidden mt-2';
        
        content.innerHTML = `
            <div class="code-block-header bg-gray-700 rounded-t-md px-3 py-2">
                <div class="text-xs text-gray-300">
                    <span class="font-medium">${block.filename}</span>
                    ${block.lineRange ? `<span class="ml-2 opacity-75">lines ${block.lineRange}</span>` : ''}
                </div>
            </div>
            <div class="code-block-content bg-[#1e1e1e] rounded-b-md">
                <div class="markdown-content p-4">
                    <pre><code class="language-${block.language}">${block.code}</code></pre>
                </div>
            </div>
        `;

        // Handle click to expand/collapse
        tab.addEventListener('click', () => {
            const isExpanded = !content.classList.contains('hidden');
            
            // First collapse all other blocks
            tabsContainer.querySelectorAll('button').forEach(t => {
                t.classList.remove('bg-gray-600');
                t.classList.add('bg-gray-700');
            });
            contentContainer.querySelectorAll('.code-block-container').forEach(c => {
                c.classList.add('hidden');
            });
            
            if (!isExpanded) {
                // Expand this block
                tab.classList.remove('bg-gray-700');
                tab.classList.add('bg-gray-600');
                content.classList.remove('hidden');
                contentContainer.classList.remove('hidden');
            } else {
                // Collapse everything
                contentContainer.classList.add('hidden');
            }
        });

        tabsContainer.appendChild(tab);
        contentContainer.appendChild(content);
    });

    container.appendChild(tabsContainer);
    container.appendChild(contentContainer);
    return container;
}

function abbreviateFilename(filename, maxLength = 15) {
    if (!filename || filename.length <= maxLength) return filename;
    
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const name = filename.slice(0, filename.length - (ext.length + 1));
    
    if (name.length <= maxLength - (ext.length + 3)) return filename;
    
    const abbreviated = name.slice(0, maxLength - (ext.length + 4)) + '...';
    return ext ? `${abbreviated}.${ext}` : abbreviated;
}

export function createMessageElement(message) {
    if (!message || !message.content) {
        console.error('Invalid message:', message);
        return null;
    }

    const isUser = message.role === 'user';
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'} mb-4`;
    
    const safeId = encodeURIComponent(message.content).slice(0, 64);
    messageDiv.dataset.messageId = safeId;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'flex justify-start w-full';
    
    const mainContainer = document.createElement('div');
    mainContainer.className = isUser ? 'bg-gray-800 text-white rounded-lg py-3 px-4 w-[95%]' : 'max-w-[95%]';
    
    const flexContainer = document.createElement('div');
    flexContainer.className = 'flex items-start gap-4';
    
    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex-1';
    
    if (isUser && message.content.includes('```')) {
        const { blocks, remainingText } = extractCodeBlocks(message.content);
        
        if (blocks.length > 0) {
            contentDiv.appendChild(createCodeTabsElement(blocks));
            
            if (remainingText) {
                const textDiv = document.createElement('div');
                textDiv.className = 'markdown-content mt-3';
                textDiv.innerHTML = marked.parse(remainingText);
                contentDiv.appendChild(textDiv);
            }
        } else {
            contentDiv.innerHTML = marked.parse(message.content);
        }
    } else {
        contentDiv.innerHTML = `<div class="markdown-content">${isUser ? marked.parse(message.content) : formatMessageContent(message.content)}</div>`;
    }
    
    flexContainer.appendChild(avatar);
    flexContainer.appendChild(contentDiv);
    mainContainer.appendChild(flexContainer);
    messageContent.appendChild(mainContainer);
    messageDiv.appendChild(messageContent);
    
    return messageDiv;
}

function extractSimpleCodeBlocks(content) {
    const blocks = [];
    const regex = /```(\w+)?\n([\s\S]+?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        blocks.push({
            language: match[1] || 'plaintext',
            code: match[2].trim()
        });
        lastIndex = match.index + match[0].length;
    }

    return {
        blocks,
        remainingText: content.slice(lastIndex).trim()
    };
}

export function createSessionElement(session) {
    const sessionDiv = document.createElement('div');
    sessionDiv.classList.add('px-4', 'py-2', 'hover:bg-gray-700', 'cursor-pointer', 'flex', 'justify-between', 'items-center');

    // Left side: Session info
    const infoDiv = document.createElement('div');
    infoDiv.classList.add('flex-1');
    
    const idDiv = document.createElement('div');
    idDiv.classList.add('text-sm', 'font-medium');
    idDiv.textContent = `Session ${session.session_id.slice(0, 8)}...`;
    
    const timeDiv = document.createElement('div');
    timeDiv.classList.add('text-xs', 'text-gray-400');
    timeDiv.textContent = session.last_message_at || 'No messages';

    infoDiv.appendChild(idDiv);
    infoDiv.appendChild(timeDiv);

    return { sessionDiv, infoDiv };
} 