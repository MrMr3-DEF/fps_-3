import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCharacterPrompt, byteLength, clipBytes, parseLore, retrieveLore, validateCharacterConfig, PROMPT_BYTE_BUDGET, type CharacterKnowledge, type ChatMessage } from '../src/gothKnowledge.ts';
const root = new URL('../public/npc/goth/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const config = validateCharacterConfig(JSON.parse(read('character.json')));
const knowledge: CharacterKnowledge = { config, identity: read('identity.md'), behavior: read('behavior.md'), chunks: config.knowledgeFiles.flatMap(path => parseLore(path, read(path))) };

test('shipped character is unnamed, already the player’s girlfriend, and fits prompt limits', () => {
    assert.equal(config.name, 'Your girlfriend');
    assert.match(knowledge.identity, /girlfriend/);
    assert.match(knowledge.identity, /commanding and dominant/);
    assert.ok(byteLength(knowledge.identity) <= 1000);
    assert.ok(byteLength(knowledge.behavior) <= 1100);
    assert.equal(config.modelId, 'SmolLM2-360M-Instruct-q0f16-MLC');
    assert.ok(knowledge.chunks.length >= 8);
});

test('retrieval finds relevant world facts and uses recent topic for follow-ups', () => {
    assert.match(retrieveLore(knowledge.chunks, 'Where do I respawn?')[0].title, /respawning/i);
    assert.match(retrieveLore(knowledge.chunks, 'How does the grappling hook work?')[0].text, /Press R to fire or release the grappling hook/);
    assert.match(retrieveLore(knowledge.chunks, 'Why?', 'What is the coffin in your home?')[0].text, /coffin/);
    assert.deepEqual(retrieveLore(knowledge.chunks, 'xyzzy quux'), []);
});

test('personality stays in every prompt, RAG adds facts, and role pairs remain valid', () => {
    const history: ChatMessage[] = [
        { role: 'user', content: 'Hello there' }, { role: 'assistant', content: 'Come closer.' },
        { role: 'user', content: 'How are you?' }, { role: 'assistant', content: 'Better now. Sit down.' },
    ];
    const result = buildCharacterPrompt(knowledge, history, 'Where is the church?');
    assert.equal(result.messages[0].role, 'system');
    assert.ok(result.messages[0].content.startsWith(knowledge.identity.trim()));
    assert.ok(result.messages[0].content.includes(knowledge.behavior.trim()));
    assert.ok(result.sources.length > 0);
    assert.ok(result.messages.at(-1)!.content.includes('My message: Where is the church?'));
    assert.ok(result.messages.at(-1)!.content.includes('Facts from our world:'));
    assert.deepEqual(result.messages.slice(1 + config.styleExamples.length * 2, -1).map(m => m.role), ['user', 'assistant', 'user', 'assistant']);
});

test('long and multibyte conversations are bounded without damaging Unicode or orphaning turns', () => {
    const history: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '🦇秘密'.repeat(100) }));
    const result = buildCharacterPrompt(knowledge, history, '🦇秘密'.repeat(500));
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
    for (const file of ['../identity.md', 'https://example.com/info.md', 'lore/../../file.md']) {
        assert.throws(() => validateCharacterConfig({ ...config, knowledgeFiles: [file] }));
    }
    assert.throws(() => validateCharacterConfig({ ...config, maxReplyTokens: 99999 }));
});


test('model configuration accepts the f16 build and supported compact alternatives', () => {
    for (const modelId of ['SmolLM2-360M-Instruct-q0f16-MLC', 'SmolLM2-360M-Instruct-q4f16_1-MLC', 'SmolLM2-360M-Instruct-q4f32_1-MLC']) {
        assert.equal(validateCharacterConfig({ ...config, modelId }).modelId, modelId);
    }
    for (const modelId of ['SmolLM2-360M-Instruct-q0f16_1-MLC', 'SmolLM2-360M-Instruct-f16-MLC', 'https://example.com/model', '']) {
        assert.throws(() => validateCharacterConfig({ ...config, modelId }), /invalid/);
    }
});
