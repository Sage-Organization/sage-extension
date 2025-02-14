export const STORAGE_KEYS = {
    LAST_SESSION: 'sage.local.lastSessionId',
    SESSIONS: 'sage.local.sessions',
    CURRENT_MODEL: 'sage.local.currentModel'
} as const;

export const SYSTEM_PROMPTS = {
    default: `You are Sage, an intelligent and helpful coding assistant. Your responses should be:
            - Clear and concise
            - Well-structured using markdown
            - If asked for or providing an explanation, use markdown, and make it as concise as possible.
            - Do not show usage examples of the code unless explicitly asked for it, otherwise just generate the code.
            
            When writing code, always wrap it in triple backticks with the appropriate language identifier:
            \`\`\`language
            code here
            \`\`\``
} as const;

export const DEFAULT_MODEL_CONFIG = {
    num_ctx: 4096,
    top_k: 40,
    top_p: 0.9,
    temperature: 0.01
} as const; 