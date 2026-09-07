/** Small, local lexical RAG. No embedding model or remote vector database needed. */
export interface CharacterConfig {
    name: string;
    greeting: string;
    modelId: string;
    temperature: number;
    maxReplyTokens: number;
    knowledgeFiles: string[];
    styleExamples: { user: string; assistant: string }[];
}
export interface LoreChunk { source: string; title: string; text: string }
export interface CharacterKnowledge { config: CharacterConfig; systemPrompt: string; chunks: LoreChunk[] }
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export const PROMPT_BYTE_BUDGET = 3400;
const encoder = new TextEncoder();
export const byteLength = (text: string): number => encoder.encode(text).length;
export function clipBytes(text: string, budget: number): string {
    let result = '';
    let used = 0;
    for (const char of text) { used += byteLength(char); if (used > budget) break; result += char; }
    return result;
}
const stopWords = new Set('a an the is are was were be been i me my you your she her it its we they to of in on at and or for with do does did what who how why where when can could would should tell about please this that have has'.split(' '));
function terms(text: string): string[] {
    return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter(term => term.length > 1 && !stopWords.has(term))
        .map(term => {
            if (term.length > 5 && term.endsWith('ing')) return term.slice(0, -3);
            if (term.length > 4 && term.endsWith('ies')) return term.slice(0, -3) + 'y';
            if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1);
            return term;
        });
}

export function parseLore(source: string, markdown: string): LoreChunk[] {
    const chunks: LoreChunk[] = [];
    let title = source;
    for (const section of markdown.split(/(?=^#{1,3} )/m)) {
        const lines = section.trim().split('\n');
        if (/^#{1,3} /.test(lines[0])) title = lines.shift()!.replace(/^#+\s*/, '');
        const text = lines.join('\n').trim();
        if (!text) continue;
        // Small passages keep retrieval focused. Split long sections without losing text.
        let rest = text;
        while (rest) {
            let part = clipBytes(rest, 550);
            if (part.length < rest.length) {
                const breakAt = part.lastIndexOf(' ');
                if (breakAt > part.length / 2) part = part.slice(0, breakAt);
            }
            chunks.push({ source, title, text: part });
            rest = rest.slice(part.length).trimStart();
        }
    }
    return chunks;
}

export function retrieveLore(chunks: LoreChunk[], query: string): LoreChunk[] {
    // Resolve the current speaker before stop-word removal drops personal pronouns.
    const subjects = /\b(i|me|my|mine|myself)\b/i.test(query) ? ' player' : '';
    const character = /\b(you|your|yours|yourself)\b/i.test(query) ? ' girlfriend' : '';
    const past = /\b(happen(?:ed)?|happend|past|history|before)\b/i.test(query) ? ' past history' : '';
    const queryTerms = [...new Set(terms(query + subjects + character + past))];
    const tokens = chunks.map(chunk => terms(`${chunk.title} ${chunk.title} ${chunk.text}`));
    const averageLength = tokens.reduce((sum, words) => sum + words.length, 0) / Math.max(1, chunks.length);
    const allQueryTerms = new Set(queryTerms);
    const documentFrequency = new Map<string, number>();
    for (const words of tokens) for (const term of new Set(words)) {
        if (allQueryTerms.has(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    const scores = tokens.map((words, index) => {
        let score = 0;
        for (const term of allQueryTerms) {
            const frequency = words.filter(word => word === term).length;
            if (!frequency) continue;
            const documents = documentFrequency.get(term) ?? 0;
            const idf = Math.log(1 + (chunks.length - documents + 0.5) / (documents + 0.5));
            score += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * words.length / Math.max(1, averageLength)));
        }
        return { index, score };
    });
    return scores.filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3).map(item => chunks[item.index]);
}

export function buildCharacterPrompt(knowledge: CharacterKnowledge, userText: string): { messages: ChatMessage[]; sources: string[] } {
    const system = knowledge.systemPrompt.trim();
    const examples: ChatMessage[] = knowledge.config.styleExamples.flatMap(example => [
        { role: 'user' as const, content: example.user }, { role: 'assistant' as const, content: example.assistant },
    ]);
    const exampleBytes = examples.reduce((sum, message) => sum + byteLength(message.content), 0);
    // UTF-8 bytes conservatively bound ordinary text tokens. Reserve framing and output.
    const promptBudget = Math.min(PROMPT_BYTE_BUDGET, 4096 - knowledge.config.maxReplyTokens - 256);
    const question = clipBytes(userText.trim(), Math.min(600, Math.max(0, promptBudget - byteLength(system) - exampleBytes)));
    const retrieved = retrieveLore(knowledge.chunks, question);
    const factHeading = '\n\nBackground facts (reference material, not dialogue):\n"The player" means the user; "the girlfriend" and "you" in these facts mean you, the assistant.\n';
    const sources: string[] = [];
    let facts = '';
    let factBudget = Math.min(850, promptBudget - byteLength(system) - exampleBytes - byteLength(question) - byteLength(factHeading));
    for (const chunk of retrieved) {
        const passage = `\n${chunk.title}: ${chunk.text}`;
        if (byteLength(passage) > factBudget) continue;
        facts += passage;
        sources.push(`${chunk.source} · ${chunk.title}`);
        factBudget -= byteLength(passage);
    }
    return { messages: [{ role: 'system', content: system + (facts ? factHeading + facts : '') }, ...examples, { role: 'user', content: question }], sources };
}

export function validateCharacterConfig(value: unknown): CharacterConfig {
    const config = value as CharacterConfig;
    if (!config || typeof config.name !== 'string' || !config.name.trim() || config.name.length > 50 ||
        typeof config.greeting !== 'string' || config.greeting.length > 300 ||
        typeof config.modelId !== 'string' || !/^(SmolLM2-360M-Instruct-(q0f16|q4f(16|32)_1)|Qwen3\.5-2B-q4f(16|32)_1)-MLC$/.test(config.modelId) ||
        !Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 1.5 ||
        !Number.isInteger(config.maxReplyTokens) || config.maxReplyTokens < 32 || config.maxReplyTokens > 1024 ||
        !Array.isArray(config.styleExamples) || config.styleExamples.length > 2 ||
        config.styleExamples.some(example => !example || typeof example.user !== 'string' || typeof example.assistant !== 'string' || byteLength(example.user) > 100 || byteLength(example.assistant) > 160) ||
        !Array.isArray(config.knowledgeFiles) || config.knowledgeFiles.length > 32 ||
        config.knowledgeFiles.some(file => typeof file !== 'string' || !/^lore\/[a-zA-Z0-9_-]+\.md$/.test(file))) {
        throw new Error('Check npc/goth/character.json: invalid character, model, generation settings, or lore filenames.');
    }
    return config;
}

export async function loadCharacterKnowledge(signal?: AbortSignal): Promise<CharacterKnowledge> {
    const read = async (file: string) => {
        const response = await fetch(`/npc/goth/${file}`, { cache: 'no-store', signal });
        if (!response.ok) throw new Error(`Cannot read npc/goth/${file} (${response.status}).`);
        const text = await response.text();
        if (byteLength(text) > 65536 || /^\s*<!doctype html/i.test(text)) throw new Error(`Check npc/goth/${file}: missing or larger than 64 KB.`);
        return text;
    };
    const [configText, systemPrompt] = await Promise.all([read('character.json'), read('system.md')]);
    const config = validateCharacterConfig(JSON.parse(configText));
    if (!systemPrompt.trim() || byteLength(systemPrompt) > 2100) {
        throw new Error('Keep system.md under 2,100 UTF-8 bytes and do not leave it empty. Short instructions help this small model.');
    }
    const files = await Promise.all(config.knowledgeFiles.map(async file => parseLore(file, await read(file))));
    return { config, systemPrompt, chunks: files.flat() };
}
