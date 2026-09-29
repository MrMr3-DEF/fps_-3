import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { lobbyCalloutPreset, lobbyPreviewPosition, lobbyScanPlayers } from '../src/lobbyLineup.ts';
import { buildBeanModel } from '../src/weapons.ts';
import { getStablePeerEnvelope } from '../src/smartGogglesPeerMath.ts';
import { createScreenBounds, createSmartGogglesCalloutLayout, layoutLobbyCallout,
    placeLobbyCallout, projectStableTargetEnvelopeToScreen, type LobbyCalloutPlan } from '../src/smartGogglesMath.ts';

test('host stays centered while guests alternate sides and recede in admission order', () => {
    const positions = Array.from({ length: 5 }, (_, index) => lobbyPreviewPosition(index, 16 / 9));
    assert.deepEqual(positions[0], { x: 0, z: 0 });
    assert.ok(positions[1].x < 0 && positions[2].x > 0);
    assert.ok(positions[3].x < positions[1].x && positions[4].x > positions[2].x);
    assert.equal(positions[1].z, positions[2].z);
    assert.ok(positions[3].z < positions[1].z);
    assert.equal(positions[3].z, positions[4].z);
    assert.ok(Math.abs(positions[1].x) < 2.7 && positions[1].z > -1.8,
        'the first pair sits nearer the host');
    assert.ok(Math.abs(lobbyPreviewPosition(4, 0.5).x) < Math.abs(positions[4].x),
        'portrait view keeps side avatars inside the stage');
});

test('each client omits only its own name from lobby scans', () => {
    const players = ['host', 'one', 'two'].map(peerId => ({ peerId, username: peerId,
        bodyColor: 0x3b5998 }));
    assert.deepEqual(lobbyScanPlayers(players, 'host').map(player => player.peerId), ['one', 'two']);
    assert.deepEqual(lobbyScanPlayers(players, 'one').map(player => player.peerId), ['host', 'two']);
});

test('every supported lobby size has an intentional callout orientation per slot', () => {
    for (let total = 1; total <= 5; total++) {
        for (let index = 0; index < total; index++) {
            const preset = lobbyCalloutPreset(total, index);
            assert.ok(['left', 'right'].includes(preset.horizontal));
            assert.ok(['up', 'down'].includes(preset.vertical));
            assert.ok(preset.diagonal >= 30 && preset.diagonal <= 126);
        }
    }
    assert.deepEqual(lobbyCalloutPreset(5, 4),
        { horizontal: 'left', vertical: 'down', diagonal: 54 });
});

test('each lobby size and viewer gets separate name callouts at portrait and landscape widths', () => {
    for (const [width, height, menuTop] of [[652, 909, 566], [821, 400, 150]]) {
        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 30);
        camera.position.set(0, 0.25, 11.5);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        for (let total = 1; total <= 5; total++) {
            const beans = Array.from({ length: total }, (_, index) => {
                const bean = buildBeanModel(0x3b5998, 0x00ffcc);
                const position = lobbyPreviewPosition(index, width / height);
                bean.position.set(position.x, 0, position.z);
                bean.rotation.y = Math.PI;
                return bean;
            });
            const project = (bean: THREE.Group) => {
                bean.updateWorldMatrix(true, true);
                const envelope = getStablePeerEnvelope(bean)!;
                const box = createScreenBounds();
                assert.equal(projectStableTargetEnvelopeToScreen(envelope, bean.matrixWorld,
                    camera, width, height, box), true);
                box.left -= 6; box.top -= 6; box.right += 6; box.bottom += 6;
                box.width += 12; box.height += 12;
                return box;
            };
            const bounds = beans.map(project);
            for (let self = 0; self < total; self++) {
                const menu = { left: 24, top: menuTop, right: 300, bottom: height - 24 };
                const occupied = [menu];
                const plans: Array<LobbyCalloutPlan | undefined> = Array(total);
                for (let index = 0; index < total; index++) {
                    if (index === self) continue;
                    const layout = createSmartGogglesCalloutLayout();
                    const { box, plan } = layoutLobbyCallout(bounds[index], width, height, 82, occupied,
                        layout, lobbyCalloutPreset(total, index));
                    plans[index] = plan;
                    assert.ok(occupied.every(other => box.right + 12 <= other.left || box.left >= other.right + 12 ||
                        box.bottom + 12 <= other.top || box.top >= other.bottom + 12),
                        `${width}x${height}, ${total} players, viewer ${self}, target ${index}`);
                    occupied.push(box);
                }
                for (let frame = 0; frame < 12; frame++) {
                    const animated = [menu];
                    for (let index = 0; index < total; index++) {
                        if (index === self) continue;
                        beans[index].position.y = Math.sin(frame * Math.PI / 6 + index * 0.7) * 0.13;
                        const layout = createSmartGogglesCalloutLayout();
                        const { box } = placeLobbyCallout(project(beans[index]), width, height, 82,
                            layout, plans[index]!);
                        assert.ok(animated.every(other => box.right <= other.left || box.left >= other.right ||
                            box.bottom <= other.top || box.top >= other.bottom),
                            `latched ${width}x${height}, ${total} players, viewer ${self}, frame ${frame}`);
                        animated.push(box);
                    }
                }
                for (const bean of beans) bean.position.y = 0;
            }
        }
    }
});
