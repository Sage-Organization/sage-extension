function extractCodeBlocks(message) {
    const codeBlockRegex = /```(?:[\w-]+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(message)) !== null) {
        if (match.index > lastIndex) {
            blocks.push({
                type: 'text',
                content: message.slice(lastIndex, match.index)
            });
        }
        blocks.push({
            type: 'code',
            content: match[1]
        });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.length) {
        blocks.push({
            type: 'text',
            content: message.slice(lastIndex)
        });
    }

    return blocks;
}

function createCodeTabsElement(codeBlocks) {
    const container = document.createElement('div');
    container.className = 'code-blocks-container mt-4 mb-4';

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'code-preview-tabs flex flex-wrap gap-2';

    const contentContainer = document.createElement('div');
    contentContainer.className = 'code-preview-content';

    codeBlocks.forEach((block, index) => {
        const blockContainer = document.createElement('div');
        blockContainer.className = 'code-block-container';
        blockContainer.style.display = index === 0 ? 'block' : 'none';

        const header = document.createElement('div');
        header.className = 'code-block-header text-sm text-gray-400';
        header.textContent = block.filename || 'Code Block ' + (index + 1);

        const content = document.createElement('div');
        content.className = 'code-block-content';
        content.innerHTML = marked.parse('```\n' + block.content + '\n```');

        blockContainer.appendChild(header);
        blockContainer.appendChild(content);
        contentContainer.appendChild(blockContainer);

        const tab = document.createElement('button');
        tab.className = 'px-3 py-1 text-sm rounded hover:bg-opacity-80 ' + 
                       (index === 0 ? 'bg-blue-600' : 'bg-gray-700');
        tab.textContent = block.filename || 'Block ' + (index + 1);
        tab.onclick = () => {
            Array.from(contentContainer.children).forEach(child => child.style.display = 'none');
            Array.from(tabsContainer.children).forEach(t => t.className = 'px-3 py-1 text-sm rounded hover:bg-opacity-80 bg-gray-700');
            blockContainer.style.display = 'block';
            tab.className = 'px-3 py-1 text-sm rounded hover:bg-opacity-80 bg-blue-600';
        };
        tabsContainer.appendChild(tab);
    });

    container.appendChild(tabsContainer);
    container.appendChild(contentContainer);
    return container;
}

function createMessageElement(message, role) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message flex gap-4 py-6 px-4';
    messageElement.dataset.role = role;

    const iconContainer = document.createElement('div');
    iconContainer.className = 'flex-none';
    const icon = document.createElement('div');
    icon.className = role === 'user' ? 'user-icon' : 'assistant-icon';
    iconContainer.appendChild(icon);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'flex-1 min-w-0 markdown-content';

    if (role === 'user') {
        const blocks = extractCodeBlocks(message);
        blocks.forEach(block => {
            if (block.type === 'text') {
                const textElement = document.createElement('div');
                textElement.innerHTML = marked.parse(block.content);
                contentContainer.appendChild(textElement);
            } else {
                const codeBlocks = [{
                    content: block.content,
                    filename: block.filename
                }];
                contentContainer.appendChild(createCodeTabsElement(codeBlocks));
            }
        });
    } else {
        contentContainer.innerHTML = marked.parse(message);
    }

    messageElement.appendChild(iconContainer);
    messageElement.appendChild(contentContainer);
    return messageElement;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message) return;

    // Get code blocks from the code preview
    const codeBlocks = document.querySelectorAll('.code-block-container');
    let fullMessage = message;

    if (codeBlocks.length > 0) {
        fullMessage += '\n\n';
        codeBlocks.forEach(block => {
            const header = block.querySelector('.code-block-header');
            const content = block.querySelector('pre code');
            if (header && content) {
                fullMessage += '```\n' + content.textContent + '\n```\n\n';
            }
        });
    }

    // Add user message immediately
    const messageElement = createMessageElement(fullMessage, 'user');
    const messagesContainer = document.getElementById('messages');
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Clear input and code preview
    input.value = '';
    clearCodePreview();

    // Send message to extension
    vscode.postMessage({
        type: 'message',
        message: fullMessage
    });
} 