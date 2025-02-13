import { autoGrow, applySyntaxHighlighting } from './utils.js';

let isCodePreviewExpanded = false;

export function toggleCodePreview() {
    const preview = document.getElementById('codePreviewContent');
    const container = document.getElementById('codePreview').firstElementChild;
    
    isCodePreviewExpanded = !isCodePreviewExpanded;
    
    if (isCodePreviewExpanded) {
        preview.style.maxHeight = '400px';
        container.style.maxHeight = '400px';
    } else {
        preview.style.maxHeight = '200px';
        container.style.maxHeight = '200px';
    }
}

export function clearCodePreview() {
    const preview = document.getElementById('codePreview');
    preview.classList.add('hidden');
    preview.querySelector('#codePreviewContent').innerHTML = '';
    
    const messageInput = document.getElementById('messageInput');
    messageInput.value = '';
    autoGrow(messageInput);
}

export function handlePaste(event) {
    const clipboardData = event.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('text');
    
    // Try to get VS Code's language identifier and metadata
    const vscodeFormat = clipboardData.getData('vscode-editor-data');
    
    if (vscodeFormat) {
        try {
            const metadata = JSON.parse(vscodeFormat);
            
            // Request the active file from VS Code
            window.vscode.postMessage({ 
                command: 'getActiveFile'
            });
            
            if (metadata.mode) {
                const preview = document.getElementById('codePreview');
                const previewContent = document.getElementById('codePreviewContent');
                preview.classList.remove('hidden');
                
                // For now, show language type until we get the filename
                document.getElementById('codePreviewFilename').textContent = 
                    `${metadata.mode.charAt(0).toUpperCase() + metadata.mode.slice(1)} Snippet`;
                
                // Create a line-numbered code display using markdown formatting
                previewContent.innerHTML = marked.parse(`\`\`\`${metadata.mode}\n${pastedText}\n\`\`\``);
                
                // Apply syntax highlighting to the preview
                applySyntaxHighlighting();
            }
            event.preventDefault();
        } catch (e) {
            console.error('Error processing paste:', e);
            return;
        }
    }
} 