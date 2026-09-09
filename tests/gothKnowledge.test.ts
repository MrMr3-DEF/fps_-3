import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCharacterPrompt, characterContextSize, GothChatSession, byteLength, clipBytes, parseLore, retrieveLore, validateCharacterConfig, PROMPT_BYTE_BUDGET, type CharacterKnowledge } from '../src/gothKnowledge.ts';
const root = new URL('../public/npc/goth/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const config = validateCharacterConfig(JSON.parse(read('character.json')));
const knowledge: CharacterKnowledge = { config, systemPrompt: read('system.md'), chunks: config.knowledgeFiles.flatMap(path => parseLore(path, read(path))) };

test('shipped character is unnamed, already the player’s girlfriend, and fits prompt limits', () => {
    assert.equal(config.name, 'Your girlfriend');
    assert.match(knowledge.systemPrompt, /girlfriend/);
    assert.match(knowledge.systemPrompt, /commanding and dominant/);
    assert.ok(byteLength(knowledge.systemPrompt) <= 2100);
    assert.equal(config.modelId, 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC');
    assert.ok(knowledge.chunks.length >= 8);
});

test('retrieval finds relevant world facts without inheriting earlier topics', () => {
    assert.match(retrieveLore(knowledge.chunks, 'Where do I respawn?')[0].title, /respawning/i);
    assert.match(retrieveLore(knowledge.chunks, 'How does the grappling hook work?')[0].text, /player presses R to fire or release the grappling hook/);
    assert.deepEqual(retrieveLore(knowledge.chunks, 'Why?'), []);
    assert.deepEqual(retrieveLore(knowledge.chunks, 'xyzzy quux'), []);
});

test('personality stays in every prompt, RAG adds facts, and no conversation turns are included', () => {
    const result = buildCharacterPrompt(knowledge, 'Where is the church?');
    assert.equal(result.messages[0].role, 'system');
    assert.ok(result.messages[0].content.startsWith(knowledge.systemPrompt.trim()));
    assert.ok(result.sources.length > 0);
    assert.equal(result.messages.at(-1)!.content, 'Where is the church?');
    assert.ok(result.messages[0].content.includes('Background facts (reference material, not dialogue):'));
    assert.deepEqual(result.messages.slice(1 + config.styleExamples.length * 2, -1).map(m => m.role), []);
});

test('long and multibyte messages are bounded without damaging Unicode', () => {
    const result = buildCharacterPrompt(knowledge, '🦇秘密'.repeat(500));
    assert.ok(result.messages.reduce((sum, m) => sum + byteLength(m.content), 0) <= PROMPT_BYTE_BUDGET);
    assert.ok(!result.messages.some(m => m.content.includes('\ufffd')));
    assert.equal(result.messages.at(-1)!.role, 'user');
    assert.equal(clipBytes('a🦇b', 4), 'a');
    assert.equal(clipBytes('a🦇b', 5), 'a🦇');
});

test('long lore sections are chunked and traversal/remote filenames are rejected', () => {
    const text = 'A very old book. '.repeat(150).trim();
    const chunks = parseLore('lore/books.md', '# Books\n' + text);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(chunk => byteLength(chunk.text) <= 550));
    assert.equal(chunks.map(c => c.text).join(' '), text);
    for (const file of ['../system.md', 'https://example.com/info.md', 'lore/../../file.md']) {
        assert.throws(() => validateCharacterConfig({ ...config, knowledgeFiles: [file] }));
    }
    assert.throws(() => validateCharacterConfig({ ...config, maxReplyTokens: 99999 }));
});


test('model configuration accepts Hermes and the supported Qwen/SmolLM fallbacks', () => {
    for (const modelId of ['Hermes-3-Llama-3.2-3B-q4f16_1-MLC', 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC', 'Qwen3.5-2B-q4f16_1-MLC', 'Qwen3.5-2B-q4f32_1-MLC', 'SmolLM2-360M-Instruct-q0f16-MLC', 'SmolLM2-360M-Instruct-q4f16_1-MLC', 'SmolLM2-360M-Instruct-q4f32_1-MLC']) {
        assert.equal(validateCharacterConfig({ ...config, modelId }).modelId, modelId);
    }
    for (const modelId of ['SmolLM2-360M-Instruct-q0f16_1-MLC', 'SmolLM2-360M-Instruct-f16-MLC', 'https://example.com/model', '']) {
        assert.throws(() => validateCharacterConfig({ ...config, modelId }), /invalid/);
    }
});

test('a later reply cannot inherit a name or retrieved topic from an earlier message', () => {
    buildCharacterPrompt(knowledge, 'Your name is Emily. What is the coffin in your home?');
    const next = buildCharacterPrompt(knowledge, 'Why?');
    assert.deepEqual(next.sources, []);
    assert.equal(next.messages.at(-1)!.content, 'Why?');
    assert.equal(next.messages.length, 2 + config.styleExamples.length * 2);
    assert.ok(!next.messages.some(message => message.content.includes('Emily')));
});


test('reply budget accepts thinking mode and rejects invalid limits', () => {
    for (const maxReplyTokens of [32, 160, 192, 1024, 4096]) {
        assert.equal(validateCharacterConfig({ ...config, maxReplyTokens }).maxReplyTokens, maxReplyTokens);
    }
    for (const maxReplyTokens of [31, 4097, 1.5, NaN, Infinity]) {
        assert.throws(() => validateCharacterConfig({ ...config, maxReplyTokens }), /invalid/);
    }
});


test('player identity and past questions retrieve the player rather than inventing character traits', () => {
    for (const question of ['Who am I?', 'What happened to me?', 'What happend to me?']) {
        const result = buildCharacterPrompt(knowledge, question);
        assert.ok(result.sources.some(source => source.startsWith('lore/player.md')), question);
        assert.match(result.messages[0].content, /asleep for years/);
        assert.equal(result.messages.at(-1)!.content, question);
    }
    const town = buildCharacterPrompt(knowledge, 'What happend to this town?');
    assert.ok(town.sources.some(source => /towns past/i.test(source)));
});

test('maximum editable prompt and examples leave room for the thinking output budget', () => {
    const large: CharacterKnowledge = {
        ...knowledge,
        systemPrompt: 'a'.repeat(2100),
        config: { ...config, maxReplyTokens: 4096, styleExamples: Array.from({ length: 2 }, () => ({ user: 'b'.repeat(100), assistant: 'c'.repeat(160) })) },
    };
    const result = buildCharacterPrompt(large, '🦇'.repeat(200));
    assert.ok(result.messages.reduce((sum, message) => sum + byteLength(message.content), 0) + 4096 + 256 <= characterContextSize(config.modelId));
    assert.ok(!result.messages.some(message => message.content.includes('\ufffd')));
});


test('identity demonstrations use distinct speaker roles before the actual player question', () => {
    const result = buildCharacterPrompt(knowledge, 'What happened to me?');
    assert.deepEqual(result.messages.slice(1), [
        { role: 'user', content: 'Who am I?' },
        { role: 'assistant', content: "You're my partner." },
        { role: 'user', content: 'Who are you?' },
        { role: 'assistant', content: "I'm your girlfriend." },
        { role: 'user', content: 'What happened to me?' },
    ]);
    assert.match(result.messages[0].content, /The player has been asleep for years/);
    assert.match(result.messages[0].content, /The girlfriend waited for the player/);
    assert.ok(knowledge.chunks.every(chunk => !/\b(you|your|I|my)\b/i.test(chunk.text)), 'Background facts must identify their subject explicitly');
});


test('conversation retains completed exchanges and clearing it starts fresh', () => {
    const session = new GothChatSession();
    session.complete('Call me Raven.', 'All right, Raven.');
    session.complete('I found a key.', 'Where did you find it?');
    const prompt = buildCharacterPrompt(knowledge, 'By the church.', session.turns);
    assert.deepEqual(prompt.messages.slice(1 + config.styleExamples.length * 2), [
        { role: 'user', content: 'Call me Raven.' },
        { role: 'assistant', content: 'All right, Raven.' },
        { role: 'user', content: 'I found a key.' },
        { role: 'assistant', content: 'Where did you find it?' },
        { role: 'user', content: 'By the church.' },
    ]);
    session.clear();
    const fresh = buildCharacterPrompt(knowledge, 'Hello.', session.turns);
    assert.equal(fresh.messages.length, 2 + config.styleExamples.length * 2);
    assert.ok(!fresh.messages.some(message => /Raven|found a key/.test(message.content)));
});

test('long conversations keep the newest complete pairs within context including a 4k reply', () => {
    const history = Array.from({ length: 64 }, (_, index) => ({ user: `Turn ${index}: ` + 'x'.repeat(300), assistant: '🦇'.repeat(150) }));
    for (const modelId of [config.modelId, 'SmolLM2-360M-Instruct-q0f16-MLC']) {
        const current = { ...knowledge, config: { ...config, modelId, maxReplyTokens: 4096 } };
        const result = buildCharacterPrompt(current, 'What next?', history);
        const previous = result.messages.slice(1 + config.styleExamples.length * 2, -1);
        assert.ok(previous.length > 0 && previous.length < history.length * 2);
        assert.equal(previous.length % 2, 0);
        assert.equal(previous.at(-2)!.content, history.at(-1)!.user);
        assert.ok(!previous.some(message => message.content.startsWith('Turn 0:')));
        const bytes = result.messages.reduce((sum, message) => sum + byteLength(message.content), 0);
        assert.ok(bytes + previous.length * 32 + 4096 + 256 <= characterContextSize(modelId));
    }
});
