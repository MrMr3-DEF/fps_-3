import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonBody } from '../src/boundedJson.ts';
test('oversized stream without length is cancelled before remaining chunks are read',async()=>{
    let cancelled=false;let pulls=0;
    const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(5000));},cancel(){cancelled=true;}});
    const request=new Request('https://local',{method:'POST',body:stream,duplex:'half'} as RequestInit);
    assert.equal(await parseJsonBody(request),null);assert.ok(cancelled);assert.ok(pulls<=2);
});
test('bounded parser accepts split JSON and rejects scalar or invalid JSON',async()=>{
    const encoder=new TextEncoder();
    const stream=new ReadableStream({start(c){c.enqueue(encoder.encode('{"ok":'));c.enqueue(encoder.encode('true}'));c.close();}});
    assert.deepEqual(await parseJsonBody(new Request('https://local',{method:'POST',body:stream,duplex:'half'} as RequestInit)),{ok:true});
    for(const body of ['null','[]','broken'])assert.equal(await parseJsonBody(new Request('https://local',{method:'POST',body})),null);
});
