import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKatanaLightning, updateKatanaLightning } from '../src/katanaLightning.ts';

function vertices(group: THREE.Group): number[] {
    const mesh = group.children[0] as THREE.Mesh;
    return Array.from(mesh.geometry.getAttribute('position').array.slice(0, mesh.geometry.drawRange.count * 3));
}
function dispose(group: THREE.Group): void {
    group.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); child.material.dispose(); } });
}
test('lightning waits 0.3 seconds then climbs over 2.7 seconds within the charge front', () => {
    const effect = createKatanaLightning();
    for (const gentle of [false, true]) for (const charge of [0, .1, .299, .3]) {
        updateKatanaLightning(effect, charge, 12.75, gentle);
        assert.equal(effect.visible, false);
        assert.equal(vertices(effect).length, 0);
    }
    for (const charge of [.301, .5, 1.65, 2.99, 3, 30]) {
        updateKatanaLightning(effect, charge, 12.75, false);
        const points = vertices(effect), front = .165 + Math.min(1, (charge - .3) / 2.7) * 1.135;
        assert.ok(points.length > 0);
        for (let i = 0; i < points.length; i += 3) {
            assert.ok(points.slice(i, i + 3).every(Number.isFinite));
            assert.ok(points[i + 1] >= .165 - 1e-6 && points[i + 1] <= front + 1e-6);
        }
        assert.ok(Math.abs(Math.max(...points.filter((_, i) => i % 3 === 1)) - front) < 1e-6);
    }
    updateKatanaLightning(effect, 0, 13, false);
    assert.equal(effect.visible, false);
    assert.equal(vertices(effect).length, 0);
    dispose(effect);
});
test('held lightning keeps moving without reallocating buffers or affecting another sword', () => {
    const first = createKatanaLightning(), second = createKatanaLightning();
    const buffer = (first.children[0] as THREE.Mesh).geometry.getAttribute('position').array;
    updateKatanaLightning(first, 3, 4, false);
    const before = vertices(first);
    updateKatanaLightning(first, 8, 4.1, false);
    assert.notDeepEqual(vertices(first), before);
    assert.equal((first.children[0] as THREE.Mesh).geometry.getAttribute('position').array, buffer);
    assert.equal(second.visible, false);
    updateKatanaLightning(first, 3, 4, false);
    assert.deepEqual(vertices(first), before);
    dispose(first); dispose(second);
});
test('gentle lightning is steady at a fixed charge and clears on cancellation', () => {
    const effect = createKatanaLightning();
    updateKatanaLightning(effect, 1.5, 1, true);
    const before = vertices(effect);
    updateKatanaLightning(effect, 1.5, 100, true);
    assert.deepEqual(vertices(effect), before);
    updateKatanaLightning(effect, 0, 101, true);
    assert.equal(effect.visible, false);
    assert.equal(vertices(effect).length, 0);
    dispose(effect);
});

test('all cluster vertices including halos stay close to the blade',()=>{
    const effect=createKatanaLightning();
    for(const time of [0,.13,.7,2.1,7.9]){
        updateKatanaLightning(effect,3,time,false);
        for(const child of effect.children){
            const mesh=child as THREE.Mesh;
            const p=mesh.geometry.getAttribute('position');
            assert.ok(mesh.geometry.drawRange.count<=384*12);
            for(let i=0;i<mesh.geometry.drawRange.count;i++){
                const t=(p.getY(i)-.165)/1.135;
                const center=t<=1.035/1.135?.125*(t*1.135/1.035)**2:.125+(.18-.125)*(t*1.135-1.035)/.1;
                const width=.045*Math.min(1,(1-t)/.088);
                const dx=Math.max(0,Math.abs(p.getX(i)-center)-width);
                const dz=Math.max(0,Math.abs(p.getZ(i))-.018);
                assert.ok(Math.hypot(dx,dz)<=.043+1e-6);
            }
        }
    }
    dispose(effect);
});

test('clusters surround both blade faces and both narrow edges',()=>{
    const effect=createKatanaLightning();
    for(const gentle of [false,true]) for(const time of [0,.7,2.1]){
        updateKatanaLightning(effect,3,time,gentle);
        const p=vertices(effect), sides=new Set<string>();
        for(let i=0;i<p.length;i+=3){
            const t=(p[i+1]-.165)/1.135;
            if(t>.85)continue;
            const center=.125*(t*1.135/1.035)**2;
            if(p[i+2]>.024)sides.add('front');
            if(p[i+2]<-.024)sides.add('back');
            if(Math.abs(p[i+2])<.015){
                if(p[i]-center>.05)sides.add('right');
                if(p[i]-center<-.05)sides.add('left');
            }
        }
        assert.equal(sides.size,4);
    }
    dispose(effect);
});
