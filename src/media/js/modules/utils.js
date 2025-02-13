export function formatMessageContent(content) {
    if (typeof marked === 'undefined') {
        return content; // Fallback to plain text if marked isn't loaded
    }
    return marked.parse(content);
}

export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function autoGrow(element) {
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight) + 'px';
}

export function applySyntaxHighlighting() {
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
} 