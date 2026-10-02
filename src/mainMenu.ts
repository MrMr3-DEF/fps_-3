import * as THREE from 'three';
import { buildBeanModel, setBeanColor, buildGun, buildShotgun, buildAR, buildSniper, buildMinigun, isSharedGeometry, SHARED_BODY_MAT } from './weapons.js';
import { characterColor, saveCharacterColor } from './appearance.js';
import { state } from './state.js';
import { WEAPON_STATS, MINIGUN_MIN_RPM, MINIGUN_MAX_RPM, MINIGUN_RAMP_TIME, MINIGUN_SHOOT_DELAY, PROJECTILE_SPEED } from './config.js';
import { SmartGogglesHud } from './smartGoggles.js';
import { createWeaponScanGeometry, fitWeaponPreviewDistance, getVisibleWeaponBounds, WeaponMenuScan, type WeaponScanGeometry } from './weaponMenuScan.js';
import { lobbyPreviewPosition, lobbyScanPlayers } from './lobbyLineup.js';

const WEAPON_PREVIEW_FIT_RADIUS = 1.45;
const WEAPON_SCAN_EXIT_MS = 180;
const WEAPON_SLIDE_MS = 520;
const WEAPON_RETURN_DELAY_MS = 850;
const WEAPON_RETURN_MS = 700;
const WEAPON_IDLE_RADIANS_PER_SECOND = 0.24;

let renderPreview: (() => void) | undefined;
export function updateMenuPreview(): void { renderPreview?.(); }

export function setupMainMenu(): void {
    const blocker = document.getElementById('blocker')!;
    if (blocker.dataset.menuInitialized === 'true') return;
    blocker.dataset.menuInitialized = 'true';
    const main = document.getElementById('panel-main')!;
    const weaponsButton = document.getElementById('btn-menu-weapons')!;
    const arsenal = document.getElementById('panel-weapons')!;
    weaponsButton.onclick = () => { main.style.display = 'none'; arsenal.style.display = 'flex'; };
    arsenal.querySelector<HTMLButtonElement>('[data-menu-back]')!.onclick = () => { arsenal.style.display = 'none'; main.style.display = 'flex'; };
    const labels: Record<string, string> = { PISTOL: 'Pistol', SHOTGUN: 'Shotgun', AR: 'Assault rifle', SNIPER: 'Sniper', MINIGUN: 'Minigun' };
    const tabs = arsenal.querySelector('.weapon-tabs')!;
    const weaponOrder = Object.keys(WEAPON_STATS);
    let selectedWeapon = 'PISTOL';
    const setWeaponSpecs = (name: string) => {
        const stats = WEAPON_STATS[name as keyof typeof WEAPON_STATS];
        const rpm = name === 'MINIGUN' ? `${MINIGUN_MIN_RPM}–${MINIGUN_MAX_RPM}` : (60 / stats.fireRate).toFixed(0);
        const specs = [['Damage / pellet', stats.damage], ['Pellets / shot', stats.pellets ?? 1], ['Max damage / shot', stats.damage * (stats.pellets ?? 1)], ['RPM', rpm], ['Speed', name === 'SNIPER' ? 'Hitscan' : `${PROJECTILE_SPEED} m/s`], ['Base spread', `${(Math.atan(stats.spread) * 180 / Math.PI).toFixed(2)}°`], ['Recoil', stats.recoil.toFixed(2)]];
        if (name === 'MINIGUN') specs.push(['Spin-up delay', `${MINIGUN_SHOOT_DELAY}s`], ['Full ramp', `${MINIGUN_RAMP_TIME}s`]);
        else specs.push(['Shot cooldown', `${stats.fireRate}s`]);
        const specsPanel = document.getElementById('weapon-specs')!;
        specsPanel.setAttribute('aria-label', `${labels[name]} specifications`);
        specsPanel.replaceChildren(...specs.map(([key, value]) => {
            const fact = document.createElement('span');
            fact.className = 'goggles-target-fact';
            fact.textContent = `${key}: ${value}`;
            return fact;
        }));
    };
    for (const name of weaponOrder) {
        const button = document.createElement('button'); button.className = 'menu-btn secondary'; button.textContent = labels[name]; tabs.append(button);
        button.onclick = () => {
            selectedWeapon = name;
            for (const tab of tabs.querySelectorAll('button')) tab.setAttribute('aria-pressed', String(tab === button));
        };
    }
    (tabs.firstElementChild as HTMLButtonElement).click();
    setWeaponSpecs(selectedWeapon);
    const preview = document.getElementById('character-panel')!;
    const stage = preview.querySelector<HTMLElement>('#character-stage')!;
    const customization = document.getElementById('menu-character-customize') as HTMLFieldSetElement;
    const menuScanLayer = document.getElementById('menu-goggles-target-layer')!;
    const scan = new SmartGogglesHud(menuScanLayer, {
        horizontal: 'right', vertical: 'up', customPeerReadout: customization, gameplayLimits: false,
    });
    const lobbyScan = new SmartGogglesHud(menuScanLayer, { lobbyPreview: true, gameplayLimits: false, lobbyAvoidElements: [
        main, document.getElementById('panel-host-waiting')!, document.getElementById('panel-join-room')!,
    ] });
    const weaponScan = new WeaponMenuScan(document.getElementById('weapon-scan-layer')!, document.getElementById('weapon-specs')!);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30); camera.position.set(0, 0.25, 11.5); camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); stage.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x455670, 3));
    const light = new THREE.DirectionalLight(0xffffff, 4); light.position.set(-3, 4, 5); scene.add(light);
    const bean = buildBeanModel(Number.parseInt(characterColor.slice(1), 16), 0x00ffcc); bean.rotation.y = Math.PI; scene.add(bean);
    // A fixed pool of glowing boxes echoes the in-match rocket particles. The
    // flame is a sibling so its animation cannot resize the peer scan box.
    const flameGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const flame = new THREE.Group();
    const flameCount = 24;
    const flameParticles = new THREE.InstancedMesh(flameGeometry, flameMaterial, flameCount);
    const flameMatrix = new THREE.Matrix4();
    flameParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flameParticles.frustumCulled = false;
    for (let i = 0; i < flameCount; i++) flameParticles.setColorAt(i, new THREE.Color(i % 3 === 0 ? 0xffeb70 : i % 2 === 0 ? 0xffb01d : 0xff6e00));
    flame.add(flameParticles);
    scene.add(flame);
    const lobbyModels = new Map<string, { model: THREE.Group; booster: THREE.Group; particles: THREE.InstancedMesh; color: number }>();
    const disposeLobbyModel = (id: string) => {
        const item = lobbyModels.get(id);
        if (!item) return;
        scene.remove(item.model, item.booster);
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        item.model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            if (!isSharedGeometry(object.geometry)) geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (material !== SHARED_BODY_MAT) materials.add(material);
            }
        });
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        lobbyModels.delete(id);
    };
    const previewPeer = { menu: { username: 'Character', mesh: bean, hp: 10, maxHp: 10 } };
    stage.tabIndex = 0;
    const weaponModels = new Map<string, THREE.Group>();
    const weaponGeometries = new Map<string, WeaponScanGeometry>();
    const factories: Record<string, () => THREE.Group> = {
        PISTOL: () => buildGun(WEAPON_STATS.PISTOL.bulletColor),
        SHOTGUN: buildShotgun, AR: buildAR, SNIPER: buildSniper, MINIGUN: buildMinigun,
    };
    const baseWeaponRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, -Math.PI / 3, 0));
    const returnFromRotation = new THREE.Quaternion();
    let displayedWeapon: string | null = null;
    let weaponModel: THREE.Group | null = null;
    let transition: {
        phase: 'exit' | 'slide';
        startedAt: number;
        from: string;
        to: string | null;
        outgoing: THREE.Group;
        incoming: THREE.Group | null;
        direction: number;
    } | null = null;
    let motion: 'idle' | 'manual' | 'returning' = 'idle';
    let lastInteractionAt = 0;
    let returnStartedAt = 0;
    let idleYaw = 0;
    let lastMotionFrame = 0;
    const rotation = new THREE.Quaternion();
    const yawAxis = new THREE.Vector3(0, 1, 0), pitchAxis = new THREE.Vector3(1, 0, 0);
    let drag: { id: number; x: number; y: number } | null = null;
    const isWeaponsOpen = () => arsenal.style.display === 'flex' && blocker.style.display !== 'none';
    const getWeaponModel = (name: string): THREE.Group => {
        let weapon = weaponModels.get(name);
        if (weapon) return weapon;
        const model = factories[name]();
        const bounds = getVisibleWeaponBounds(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const rawDiagonal = bounds.getSize(new THREE.Vector3()).length();
        // Compress the raw size range so small guns remain readable while
        // each weapon retains its own visible size and scan envelope.
        const scale = 2.4 / Math.pow(rawDiagonal, 0.75);
        model.position.copy(center).multiplyScalar(-scale); model.scale.setScalar(scale);
        weaponGeometries.set(name, createWeaponScanGeometry(model));
        weapon = new THREE.Group(); weapon.add(model);
        weapon.quaternion.copy(baseWeaponRotation);
        weaponModels.set(name, weapon);
        return weapon;
    };
    const resetWeaponMotion = (weapon: THREE.Group) => {
        weapon.position.y = 0;
        weapon.quaternion.copy(baseWeaponRotation);
        motion = 'idle'; idleYaw = 0; lastMotionFrame = 0;
    };
    const stopDrag = () => {
        const pointerId = drag?.id;
        drag = null; stage.classList.remove('dragging');
        if (pointerId !== undefined) lastInteractionAt = performance.now();
        if (pointerId !== undefined && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
    };
    stage.addEventListener('pointerdown', e => {
        if (!isWeaponsOpen() || !weaponModel || transition || drag || e.button !== 0) return;
        e.preventDefault(); stage.setPointerCapture(e.pointerId);
        motion = 'manual'; lastInteractionAt = performance.now();
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; stage.classList.add('dragging');
    });
    const rotateWeapon = (x: number, y: number) => {
        if (!weaponModel || transition) return;
        motion = 'manual'; lastInteractionAt = performance.now();
        weaponModel.quaternion.premultiply(rotation.setFromAxisAngle(yawAxis, x));
        weaponModel.quaternion.premultiply(rotation.setFromAxisAngle(pitchAxis, y));
    };
    stage.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId || !isWeaponsOpen()) return;
        rotateWeapon((e.clientX - drag.x) * 0.01, (e.clientY - drag.y) * 0.01);
        drag.x = e.clientX; drag.y = e.clientY;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        stage.addEventListener(event, e => { if ((e as PointerEvent).pointerId === drag?.id) stopDrag(); });
    }
    window.addEventListener('blur', stopDrag);
    stage.addEventListener('keydown', e => {
        if (!isWeaponsOpen() || transition || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); rotateWeapon(e.key === 'ArrowLeft' ? -0.15 : e.key === 'ArrowRight' ? 0.15 : 0,
            e.key === 'ArrowUp' ? -0.15 : e.key === 'ArrowDown' ? 0.15 : 0);
    });
    const colorInput = customization.querySelector<HTMLInputElement>('input')!;
    const swatches = customization.querySelector('.color-options')!;
    const pickerTile = customization.querySelector<HTMLElement>('.color-picker-tile')!;
    const setColor = (color: string) => {
        if (state.isPlaying) { colorInput.value = characterColor; return; }
        saveCharacterColor(color); colorInput.value = characterColor;
        const hex = Number.parseInt(characterColor.slice(1), 16); setBeanColor(bean, hex);
        if (state.playerMesh) setBeanColor(state.playerMesh, hex);
        let presetSelected = false;
        for (const button of swatches.querySelectorAll('button')) {
            const selected = button.dataset.color === characterColor;
            button.setAttribute('aria-pressed', String(selected));
            presetSelected ||= selected;
        }
        pickerTile.classList.toggle('is-selected', !presetSelected);
    };
    for (const [label, color] of [['Cobalt', '#3b5998'], ['Coral', '#df5b64'], ['Mint', '#45b99a'], ['Gold', '#e4ad45'], ['Lilac', '#987bd1']]) {
        const button = document.createElement('button'); button.style.background = color; button.dataset.color = color; button.setAttribute('aria-label', `${label} suit`); button.onclick = () => setColor(color); swatches.append(button);
    }
    colorInput.addEventListener('input', () => setColor(colorInput.value)); setColor(characterColor);
    let width = 0, height = 0, last = 0, scanActive = false, lobbyScanActive = false;
    renderPreview = () => {
        const weaponsOpen = isWeaponsOpen();
        const lobbyOpen = !state.isPlaying && state.lobbyPlayers.length > 0 &&
            (document.getElementById('panel-host-waiting')!.style.display === 'flex' ||
                document.getElementById('panel-join-room')!.style.display === 'flex');
        const lobbyGuests = lobbyOpen ? state.lobbyPlayers.slice(1) : [];
        const wantedIds = new Set(lobbyGuests.map(player => player.peerId));
        for (const id of lobbyModels.keys()) if (!wantedIds.has(id)) disposeLobbyModel(id);
        for (const player of lobbyGuests) {
            let item = lobbyModels.get(player.peerId);
            if (!item) {
                const model = buildBeanModel(player.bodyColor, 0x00ffcc);
                model.rotation.y = Math.PI;
                const booster = new THREE.Group();
                const particles = new THREE.InstancedMesh(flameGeometry, flameMaterial, flameCount);
                particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                particles.frustumCulled = false;
                for (let i = 0; i < flameCount; i++) particles.setColorAt(i,
                    new THREE.Color(i % 3 === 0 ? 0xffeb70 : i % 2 === 0 ? 0xffb01d : 0xff6e00));
                booster.add(particles);
                scene.add(model, booster);
                item = { model, booster, particles, color: player.bodyColor };
                lobbyModels.set(player.peerId, item);
            }
            if (item.color !== player.bodyColor) {
                setBeanColor(item.model, player.bodyColor);
                item.color = player.bodyColor;
            }
        }
        const centerColor = lobbyOpen ? state.lobbyPlayers[0].bodyColor : Number.parseInt(characterColor.slice(1), 16);
        if (bean.userData.previewColor !== centerColor) {
            setBeanColor(bean, centerColor);
            bean.userData.previewColor = centerColor;
        }
        customization.disabled = state.isPlaying;
        stage.classList.toggle('weapon-stage', weaponsOpen);
        if (!weaponsOpen) stopDrag();
        bean.visible = !weaponsOpen;
        flame.visible = !weaponsOpen;
        if (!weaponsOpen && (displayedWeapon || transition)) {
            // Closing the panel may interrupt a slide. Remove both participants
            // so reopening starts with one centered model and a fresh scan.
            if (transition?.incoming) { transition.incoming.position.y = 0; scene.remove(transition.incoming); }
            if (weaponModel) { weaponModel.position.y = 0; scene.remove(weaponModel); }
            transition = null; displayedWeapon = null; weaponModel = null;
        }
        if (weaponsOpen && !displayedWeapon) {
            weaponModel = getWeaponModel(selectedWeapon);
            resetWeaponMotion(weaponModel);
            scene.add(weaponModel); displayedWeapon = selectedWeapon;
            setWeaponSpecs(selectedWeapon);
        }
        stage.setAttribute('aria-label', weaponsOpen ? `${labels[selectedWeapon]} 3D model. Drag or use arrow keys to rotate.` :
            lobbyOpen ? `Lobby lineup with ${state.lobbyPlayers.length} players` : 'Preview of your playable character');
        const shouldScan = !state.isPlaying && !weaponsOpen && main.style.display !== 'none';
        if (!shouldScan && scanActive) { scan.reset(); scanActive = false; }
        if (!lobbyOpen && lobbyScanActive) { lobbyScan.reset(); lobbyScanActive = false; }
        if (!weaponsOpen) weaponScan.hide();
        if (blocker.style.display === 'none' || document.hidden || performance.now() - last < 33) return;
        last = performance.now();
        const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
        if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
        if (weaponsOpen && weaponModel && displayedWeapon !== selectedWeapon && !transition) {
            stopDrag();
            if (reducedMotion) {
                scene.remove(weaponModel);
                weaponModel = getWeaponModel(selectedWeapon);
                resetWeaponMotion(weaponModel);
                scene.add(weaponModel); displayedWeapon = selectedWeapon;
                setWeaponSpecs(selectedWeapon);
                weaponScan.hide();
            } else {
                transition = { phase: 'exit', startedAt: last, from: displayedWeapon!, to: null,
                    outgoing: weaponModel, incoming: null, direction: 0 };
                weaponScan.leave();
            }
        }
        if (transition?.phase === 'exit' && last - transition.startedAt >= WEAPON_SCAN_EXIT_MS) {
            weaponScan.hide();
            if (selectedWeapon === transition.from) {
                transition = null;
            } else {
                transition.to = selectedWeapon;
                transition.incoming = getWeaponModel(selectedWeapon);
                resetWeaponMotion(transition.incoming);
                scene.add(transition.incoming);
                transition.direction = weaponOrder.indexOf(selectedWeapon) > weaponOrder.indexOf(transition.from) ? -1 : 1;
                transition.phase = 'slide'; transition.startedAt = last;
            }
        }
        const slide = transition?.phase === 'slide' ? transition : null;
        const slideProgress = slide ? Math.min(1, (last - slide.startedAt) / WEAPON_SLIDE_MS) : 0;
        if (slide && slideProgress >= 1) {
            slide.outgoing.position.y = 0;
            slide.incoming!.position.y = 0;
            scene.remove(slide.outgoing);
            weaponModel = slide.incoming;
            displayedWeapon = slide.to;
            transition = null;
            resetWeaponMotion(weaponModel!);
            setWeaponSpecs(displayedWeapon!);
        }
        const weaponGeometry = weaponsOpen && displayedWeapon ? weaponGeometries.get(displayedWeapon) : undefined;
        const distanceFor = (name: string) => fitWeaponPreviewDistance(
            Math.max(WEAPON_PREVIEW_FIT_RADIUS, weaponGeometries.get(name)!.radius), w, h, camera.fov);
        const slideEase = slideProgress * slideProgress * (3 - 2 * slideProgress);
        camera.position.z = slide && slideProgress < 1
            ? THREE.MathUtils.lerp(distanceFor(slide.from), distanceFor(slide.to!), slideEase)
            : weaponGeometry
                ? distanceFor(displayedWeapon!)
            : Math.max(11.5, 1.35 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
        // The gun center projects to three quarters of the screen width.
        camera.position.x = weaponGeometry ? -camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.5 : 0;
        camera.lookAt(camera.position.x, 0, 0);
        if (slide && slideProgress < 1) {
            const travel = Math.max(distanceFor(slide.from), distanceFor(slide.to!)) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
                + Math.max(weaponGeometries.get(slide.from)!.radius, weaponGeometries.get(slide.to!)!.radius) + 0.5;
            slide.outgoing.position.y = slide.direction * travel * slideEase;
            slide.incoming!.position.y = -slide.direction * travel * (1 - slideEase);
        }
        if (weaponsOpen && weaponModel && !transition) {
            const dt = lastMotionFrame ? Math.min(0.05, (last - lastMotionFrame) / 1000) : 0;
            lastMotionFrame = last;
            if (motion === 'manual' && !drag && last - lastInteractionAt >= WEAPON_RETURN_DELAY_MS) {
                if (reducedMotion) {
                    weaponModel.quaternion.copy(baseWeaponRotation);
                    motion = 'idle';
                } else {
                    returnFromRotation.copy(weaponModel.quaternion);
                    returnStartedAt = last;
                    motion = 'returning';
                }
            }
            if (motion === 'returning') {
                const t = Math.min(1, (last - returnStartedAt) / WEAPON_RETURN_MS);
                const eased = t * t * (3 - 2 * t);
                weaponModel.quaternion.slerpQuaternions(returnFromRotation, baseWeaponRotation, eased);
                if (t >= 1) { motion = 'idle'; idleYaw = 0; }
            } else if (motion === 'idle' && !reducedMotion) {
                idleYaw += dt * WEAPON_IDLE_RADIANS_PER_SECOND;
                weaponModel.quaternion.copy(baseWeaponRotation).premultiply(rotation.setFromAxisAngle(yawAxis, idleYaw));
            }
        } else lastMotionFrame = 0;
        bean.position.y = reducedMotion ? 0 : Math.sin(last / 1400) * 0.13;
        flame.position.y = bean.position.y;
        for (let i = 0; i < flameCount; i++) {
            const phase = reducedMotion ? i / flameCount : (last * 0.0018 + i / flameCount) % 1;
            const size = 0.65 + (1 - phase) * 0.7;
            flameMatrix.makeScale(size, size, size);
            flameMatrix.setPosition(Math.sin(i * 13.7) * (0.04 + phase * 0.18), -1.16 - phase * 0.96, Math.cos(i * 5.9) * 0.08);
            flameParticles.setMatrixAt(i, flameMatrix);
        }
        flameParticles.instanceMatrix.needsUpdate = true;
        for (let index = 0; index < lobbyGuests.length; index++) {
            const player = lobbyGuests[index];
            const item = lobbyModels.get(player.peerId)!;
            const position = lobbyPreviewPosition(index + 1, camera.aspect);
            const hover = reducedMotion ? 0 : Math.sin(last / 1400 + (index + 1) * 0.7) * 0.13;
            item.model.position.set(position.x, hover, position.z);
            item.booster.position.copy(item.model.position);
            for (let i = 0; i < flameCount; i++) {
                const phase = reducedMotion ? i / flameCount : (last * 0.0018 + i / flameCount) % 1;
                const size = 0.65 + (1 - phase) * 0.7;
                flameMatrix.makeScale(size, size, size);
                flameMatrix.setPosition(Math.sin(i * 13.7) * (0.04 + phase * 0.18), -1.16 - phase * 0.96, Math.cos(i * 5.9) * 0.08);
                item.particles.setMatrixAt(i, flameMatrix);
            }
            item.particles.instanceMatrix.needsUpdate = true;
        }
        renderer.render(scene, camera);
        if (lobbyOpen) {
            const lobbyTargets: Record<string, { username: string; mesh: THREE.Group; hp: number; maxHp: number; lobbyOrder: number }> = {};
            for (const player of lobbyScanPlayers(state.lobbyPlayers, state.peer?.id ?? '')) {
                const mesh = player.peerId === state.lobbyPlayers[0].peerId ? bean : lobbyModels.get(player.peerId)?.model;
                if (mesh) lobbyTargets[player.peerId] = { username: player.username, mesh, hp: 10, maxHp: 10,
                    lobbyOrder: state.lobbyPlayers.indexOf(player) };
            }
            lobbyScan.configureLobby(state.lobbyPlayers.length, state.lobbyPlayers.map(player => player.peerId).join('|'));
            lobbyScan.update(camera, camera.position, camera.position, [], lobbyTargets, true, last, null, [], false);
            lobbyScanActive = true;
        }
        if (weaponsOpen && weaponModel && weaponGeometry && !transition && displayedWeapon === selectedWeapon) {
            const navBounds = arsenal.getBoundingClientRect();
            weaponScan.update(labels[displayedWeapon!], weaponGeometry, camera, w, h, navBounds.right, navBounds.top, last);
        }
        if (shouldScan) {
            // Reuse the live peer detector and its moving brackets and leader.
            // Its menu-only readout hosts the interactive color controls.
            scan.update(camera, camera.position, camera.position, [], previewPeer, true, last, null, [], false);
            scanActive = true;
        }
    };
    window.addEventListener('beforeunload', () => {
        for (const id of lobbyModels.keys()) disposeLobbyModel(id);
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
        for (const model of [...weaponModels.values(), bean]) model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            if (!isSharedGeometry(object.geometry)) geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (material !== SHARED_BODY_MAT) materials.add(material);
            }
        });
        geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
        flameGeometry.dispose(); flameMaterial.dispose();
        weaponScan.hide();
        scan.reset();
        lobbyScan.reset();
        renderer.dispose();
    }, { once: true });
}
