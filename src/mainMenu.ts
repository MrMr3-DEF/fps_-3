import * as THREE from 'three';
import { buildBeanModel, setBeanColor, buildGun, buildShotgun, buildAR, buildSniper, buildMinigun, isSharedGeometry, SHARED_BODY_MAT } from './weapons.js';
import { characterColor, saveCharacterColor } from './appearance.js';
import { state } from './state.js';
import { WEAPON_STATS, MINIGUN_MIN_RPM, MINIGUN_MAX_RPM, MINIGUN_RAMP_TIME, MINIGUN_SHOOT_DELAY } from './config.js';
import './mainMenu.css';

let renderPreview: (() => void) | undefined;
export function updateMenuPreview(): void { renderPreview?.(); }

export function setupMainMenu(): void {
    const blocker = document.getElementById('blocker')!;
    const instructions = document.getElementById('instructions')!;
    const main = document.getElementById('panel-main')!;
    const weaponsButton = document.createElement('button');
    weaponsButton.className = 'menu-btn secondary'; weaponsButton.textContent = 'Weapons';
    main.insertBefore(weaponsButton, document.getElementById('btn-menu-settings'));
    const arsenal = document.createElement('div');
    arsenal.className = 'menu-panel'; arsenal.id = 'panel-weapons';
    arsenal.innerHTML = '<h2>Weapons</h2><div class="weapon-tabs" aria-label="Choose a weapon"></div><article id="weapon-specs"></article><button class="menu-btn secondary">Back to Main Menu</button>';
    instructions.append(arsenal);
    weaponsButton.onclick = () => { main.style.display = 'none'; arsenal.style.display = 'flex'; };
    arsenal.querySelector<HTMLButtonElement>('.menu-btn')!.onclick = () => { arsenal.style.display = 'none'; main.style.display = 'flex'; };
    const labels: Record<string, string> = { PISTOL: 'Pistol', SHOTGUN: 'Shotgun', AR: 'Assault rifle', SNIPER: 'Sniper', MINIGUN: 'Minigun' };
    const tabs = arsenal.querySelector('.weapon-tabs')!;
    let selectedWeapon = 'PISTOL';
    for (const [name, stats] of Object.entries(WEAPON_STATS)) {
        const button = document.createElement('button'); button.textContent = labels[name]; tabs.append(button);
        button.onclick = () => {
            selectedWeapon = name;
            for (const tab of tabs.querySelectorAll('button')) tab.setAttribute('aria-pressed', String(tab === button));
            const rpm = name === 'MINIGUN' ? `${MINIGUN_MIN_RPM}–${MINIGUN_MAX_RPM}` : (60 / stats.fireRate).toFixed(0);
            const specs = [['Damage / pellet', stats.damage], ['Pellets / shot', stats.pellets ?? 1], ['Max damage / shot', stats.damage * (stats.pellets ?? 1)], ['Rounds / minute', rpm], ['Base spread', `${(Math.atan(stats.spread) * 180 / Math.PI).toFixed(2)}°`], ['Recoil', stats.recoil.toFixed(2)]];
            arsenal.querySelector('#weapon-specs')!.innerHTML = `<h3>${labels[name]}</h3><dl>${specs.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="weapon-note">${name === 'MINIGUN' ? `Spin-up delay: ${MINIGUN_SHOOT_DELAY}s · Full ramp: ${MINIGUN_RAMP_TIME}s.` : `Shot cooldown: ${stats.fireRate}s.`}</p>`;
        };
    }
    (tabs.firstElementChild as HTMLButtonElement).click();
    const preview = document.createElement('aside'); preview.id = 'character-panel';
    preview.innerHTML = '<div class="character-heading"><h2>Character</h2></div><div id="character-stage" role="img" aria-label="Preview of your playable character"></div><fieldset class="character-customize" aria-label="Suit customization"><label for="character-color">Suit color</label><div class="color-options"></div><label class="custom-color">Custom <input id="character-color" type="color"></label><span id="color-value"></span></fieldset>';
    blocker.insertBefore(preview, document.getElementById('legal-links'));
    const stage = preview.querySelector<HTMLElement>('#character-stage')!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30); camera.position.set(0, 0.4, 6); camera.lookAt(0, -0.1, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); stage.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x455670, 3));
    const light = new THREE.DirectionalLight(0xffffff, 4); light.position.set(-3, 4, 5); scene.add(light);
    const bean = buildBeanModel(Number.parseInt(characterColor.slice(1), 16), 0x00ffcc); bean.rotation.y = Math.PI + 0.35; scene.add(bean);
    const heading = preview.querySelector('h2')!;
    const rotateHint = document.createElement('p');
    rotateHint.className = 'weapon-rotate-hint'; rotateHint.textContent = 'Drag to rotate'; rotateHint.hidden = true;
    stage.after(rotateHint);
    stage.tabIndex = 0;
    const weaponModels = new Map<string, THREE.Group>();
    const factories: Record<string, () => THREE.Group> = {
        PISTOL: () => buildGun(WEAPON_STATS.PISTOL.bulletColor),
        SHOTGUN: buildShotgun, AR: buildAR, SNIPER: buildSniper, MINIGUN: buildMinigun,
    };
    let displayedWeapon: string | null = null;
    let weaponModel: THREE.Group | null = null;
    const rotation = new THREE.Quaternion();
    const yawAxis = new THREE.Vector3(0, 1, 0), pitchAxis = new THREE.Vector3(1, 0, 0);
    let drag: { id: number; x: number; y: number } | null = null;
    const isWeaponsOpen = () => arsenal.style.display === 'flex' && blocker.style.display !== 'none';
    const stopDrag = () => {
        const pointerId = drag?.id;
        drag = null; stage.classList.remove('dragging');
        if (pointerId !== undefined && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
    };
    stage.addEventListener('pointerdown', e => {
        if (!isWeaponsOpen() || drag || e.button !== 0) return;
        e.preventDefault(); stage.setPointerCapture(e.pointerId);
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; stage.classList.add('dragging');
    });
    const rotateWeapon = (x: number, y: number) => {
        if (!weaponModel) return;
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
        if (!isWeaponsOpen() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); rotateWeapon(e.key === 'ArrowLeft' ? -0.15 : e.key === 'ArrowRight' ? 0.15 : 0,
            e.key === 'ArrowUp' ? -0.15 : e.key === 'ArrowDown' ? 0.15 : 0);
    });
    const colorInput = preview.querySelector<HTMLInputElement>('input')!;
    const swatches = preview.querySelector('.color-options')!;
    const customization = preview.querySelector<HTMLFieldSetElement>('.character-customize')!;
    const setColor = (color: string) => {
        if (state.isPlaying) { colorInput.value = characterColor; return; }
        saveCharacterColor(color); colorInput.value = characterColor;
        preview.querySelector('#color-value')!.textContent = characterColor.toUpperCase();
        const hex = Number.parseInt(characterColor.slice(1), 16); setBeanColor(bean, hex);
        if (state.playerMesh) setBeanColor(state.playerMesh, hex);
        for (const button of swatches.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.color === characterColor));
    };
    for (const [label, color] of [['Cobalt', '#3b5998'], ['Coral', '#df5b64'], ['Mint', '#45b99a'], ['Gold', '#e4ad45'], ['Lilac', '#987bd1'], ['Slate', '#586779']]) {
        const button = document.createElement('button'); button.style.background = color; button.dataset.color = color; button.setAttribute('aria-label', `${label} suit`); button.onclick = () => setColor(color); swatches.append(button);
    }
    colorInput.addEventListener('input', () => setColor(colorInput.value)); setColor(characterColor);
    let width = 0, height = 0, last = 0;
    renderPreview = () => {
        const weaponsOpen = isWeaponsOpen();
        customization.disabled = state.isPlaying;
        customization.hidden = state.isPlaying || weaponsOpen;
        rotateHint.hidden = !weaponsOpen;
        stage.classList.toggle('weapon-stage', weaponsOpen);
        if (!weaponsOpen) stopDrag();
        bean.visible = !weaponsOpen;
        if (weaponsOpen && displayedWeapon !== selectedWeapon) {
            stopDrag();
            if (weaponModel) scene.remove(weaponModel);
            weaponModel = weaponModels.get(selectedWeapon) ?? null;
            if (!weaponModel) {
                const model = factories[selectedWeapon]();
                const bounds = new THREE.Box3().setFromObject(model);
                const center = bounds.getCenter(new THREE.Vector3());
                const scale = 2.4 / bounds.getSize(new THREE.Vector3()).length();
                model.position.copy(center).multiplyScalar(-scale); model.scale.setScalar(scale);
                weaponModel = new THREE.Group(); weaponModel.add(model);
                weaponModel.rotation.set(0.25, -Math.PI / 3, 0);
                weaponModels.set(selectedWeapon, weaponModel);
            }
            scene.add(weaponModel); displayedWeapon = selectedWeapon;
        }
        if (weaponModel) weaponModel.visible = weaponsOpen;
        const headingText = weaponsOpen ? labels[selectedWeapon] : 'Character';
        if (heading.textContent !== headingText) heading.textContent = headingText;
        stage.setAttribute('aria-label', weaponsOpen ? `${labels[selectedWeapon]} 3D model. Drag or use arrow keys to rotate.` : 'Preview of your playable character');
        if (blocker.style.display === 'none' || document.hidden || performance.now() - last < 33) return;
        last = performance.now();
        const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
        if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h); camera.aspect = w / h; camera.position.z = Math.max(5, 1.35 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)); camera.updateProjectionMatrix(); }
        bean.rotation.y = Math.PI + 0.35 + Math.sin(last / 2500) * 0.18;
        renderer.render(scene, camera);
    };
    window.addEventListener('beforeunload', () => {
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
        for (const model of weaponModels.values()) model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            if (!isSharedGeometry(object.geometry)) geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (material !== SHARED_BODY_MAT) materials.add(material);
            }
        });
        geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
        renderer.dispose();
    }, { once: true });
}
