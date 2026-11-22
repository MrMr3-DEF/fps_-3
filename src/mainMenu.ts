import { isLight, reloadingBatteryStage } from './weaponHandling.js';
import { createPreviewProp, CyborgAvatar, cyborgAssetsReady, loadCyborgAssets } from './cyborgAvatar.js';
import { CYBORG_SCALE } from './playerAvatar.js';
import { setPeerScanBounds } from './smartGogglesPeerMath.js';
import { FIREARM_MAGAZINES, GRAPPLE_DRAW_TIME, HEAVY_HANDOFF_TIME, HOOK_MAX_RANGE, HOOK_SPEED, KATANA } from './config.js';
import * as THREE from 'three';
import { characterColor } from './appearance.js';
import { changePlayerSuitColor } from './playerAppearance.js';
import { state } from './state.js';
import { WEAPON_STATS, MINIGUN_MIN_RPM, MINIGUN_MAX_RPM, MINIGUN_RAMP_TIME, MINIGUN_SHOOT_DELAY, PROJECTILE_SPEED } from './config.js';
import { SCAN_EXIT_DURATION_MS, SmartGogglesHud } from './smartGoggles.js';
import { createMenuForest } from './menuForest.js';
import { createWeaponScanGeometry, fitWeaponPreviewDistance, getVisibleWeaponBounds, WeaponMenuScan, type WeaponScanGeometry } from './weaponMenuScan.js';
import { lobbyPreviewPosition, lobbyScanPlayers } from './lobbyLineup.js';

const MENU_MORPH_MS = 320;
const WEAPON_SCAN_EXIT_MS = 180;
const WEAPON_SLIDE_MS = 520;
const WEAPON_RETURN_DELAY_MS = 850;
const WEAPON_RETURN_MS = 700;
const WEAPON_IDLE_RADIANS_PER_SECOND = 0.24;

let renderPreview: (() => void) | undefined;
let livePreviewCanvasRef: HTMLCanvasElement | null = null;
let setLivePreviewActiveRef: ((active: boolean) => void) | undefined;

export function updateMenuPreview(): void { renderPreview?.(); }
export function getSettingsLivePreviewCanvas(): HTMLCanvasElement | null { return livePreviewCanvasRef; }
export function setSettingsLivePreviewActive(active: boolean): void { setLivePreviewActiveRef?.(active); }

export function setupMainMenu(): void {
    const blocker = document.getElementById('blocker')!;
    if (blocker.dataset.menuInitialized === 'true') return;
    blocker.dataset.menuInitialized = 'true';
    const main = document.getElementById('panel-main')!;
    const weaponsButton = document.getElementById('btn-menu-weapons')!;
    const arsenal = document.getElementById('panel-weapons')!;
    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    interface MenuTransitionState {
        direction: 'to-weapons' | 'to-main';
        phase: 'descan' | 'morph';
        startedAt: number;
        fromPose: {
            centeredX: number;
            centeredY: number;
            distance: number;
            rotX: number;
            rotY: number;
            posY: number;
        };
    }
    let menuTransition: MenuTransitionState | null = null;
    const lastPose = { centeredX: 0, centeredY: 0, distance: 11.5, rotX: 0, rotY: -0.28, posY: 0 };
    const startMenuMorph = (direction: 'to-weapons' | 'to-main', now: number) => {
        const leaving = direction === 'to-weapons' ? main : arsenal;
        const entering = direction === 'to-weapons' ? arsenal : main;
        leaving.classList.remove('menu-panel-entering');
        entering.classList.remove('menu-panel-leaving');
        entering.classList.add('menu-panel-entering');
        entering.style.display = 'flex';
        void entering.offsetWidth;
        leaving.classList.add('menu-panel-leaving');
        entering.classList.remove('menu-panel-entering');
        menuTransition = { direction, phase: 'morph', startedAt: now, fromPose: { ...lastPose } };
        layoutDirty = true;
    };
    const cancelMenuTransition = (keepPanel?: HTMLElement) => {
        if (!menuTransition) return;
        const dir = menuTransition.direction;
        menuTransition = null;
        main.classList.remove('menu-panel-leaving', 'menu-panel-entering');
        arsenal.classList.remove('menu-panel-leaving', 'menu-panel-entering');
        if (keepPanel) {
            if (keepPanel !== main) main.style.display = 'none';
            if (keepPanel !== arsenal) arsenal.style.display = 'none';
        } else {
            const target = dir === 'to-weapons' ? arsenal : main;
            main.style.display = target === main ? 'flex' : 'none';
            arsenal.style.display = target === arsenal ? 'flex' : 'none';
        }
        layoutDirty = true;
    };
    weaponsButton.onclick = () => {
        if (menuTransition) return;
        if (reducedMotionQuery?.matches) {
            main.style.display = 'none';
            arsenal.style.display = 'flex';
            updateMenuPreview();
            return;
        }
        const now = performance.now();
        const left = scan.leave(now);
        scanActive = false;
        if (!left) startMenuMorph('to-weapons', now);
        else menuTransition = { direction: 'to-weapons', phase: 'descan', startedAt: now, fromPose: { ...lastPose } };
    };
    arsenal.querySelector<HTMLButtonElement>('[data-menu-back]')!.onclick = () => {
        if (menuTransition) return;
        if (reducedMotionQuery?.matches) {
            arsenal.style.display = 'none';
            main.style.display = 'flex';
            updateMenuPreview();
            return;
        }
        const now = performance.now();
        if (view === 'closeup') {
            weaponScan.leave();
            menuTransition = { direction: 'to-main', phase: 'descan', startedAt: now, fromPose: { ...lastPose } };
        } else {
            startMenuMorph('to-main', now);
        }
    };
    const labels: Record<string, string> = { PISTOL: 'Pistol', SHOTGUN: 'Shotgun', AR: 'Assault rifle', SNIPER: 'Sniper', MINIGUN: 'Minigun', KATANA: 'Katana', GRAPPLE: 'Grapple' };
    const tabs = arsenal.querySelector('.weapon-tabs')!;
    const weaponOrder = [...Object.keys(WEAPON_STATS), 'KATANA', 'GRAPPLE'];
    let selectedWeapon = 'PISTOL';
    let view: 'held' | 'closeup' = 'held';
    let reloadAt: number | undefined;
    const heldButton = document.getElementById('weapon-held') as HTMLButtonElement;
    const closeButton = document.getElementById('weapon-closeup') as HTMLButtonElement;
    const replayButton = document.getElementById('weapon-reload') as HTMLButtonElement;
    const setWeaponSpecs = (name: string) => {
        let facts: (string | number)[][];
        if (name === 'KATANA') {
            facts = [['Damage', `${KATANA.damage} / ${KATANA.chargedDamage} charged`], ['Radius', `${KATANA.radius} / ${KATANA.chargedRadius} m`],
                ['Arc', '180°'], ['Charge', `${KATANA.charge}s`], ['Swing', `${KATANA.duration}s`], ['Attack', 'Hold, then release']];
        } else if (name === 'GRAPPLE') {
            facts = [['Hand','Left'], ['Range', `${HOOK_MAX_RANGE} m`], ['Hook speed', `${HOOK_SPEED} m/s`],
                ['Draw', `${GRAPPLE_DRAW_TIME} s`], ['After heavy fire', `${HEAVY_HANDOFF_TIME} s`], ['Action', 'Launch / release']];
        } else {
            const stats = WEAPON_STATS[name as keyof typeof WEAPON_STATS];
            const magazine = FIREARM_MAGAZINES[name as keyof typeof FIREARM_MAGAZINES];
            const rpm = name === 'MINIGUN' ? `${MINIGUN_MIN_RPM}–${MINIGUN_MAX_RPM}` : (60 / stats.fireRate).toFixed(0);
            facts = [['Damage / pellet', stats.damage], ['Pellets / shot', stats.pellets ?? 1],
                ['Max damage / shot', stats.damage * (stats.pellets ?? 1)], ['RPM', rpm], ['Magazine', magazine.capacity],
                ['Reload', magazine.reloadSeconds + ' s'], ['Speed', name === 'SNIPER' ? 'Hitscan' : `${PROJECTILE_SPEED} m/s`],
                ['Base spread', `${(Math.atan(stats.spread) * 180 / Math.PI).toFixed(2)}°`], ['Recoil', stats.recoil.toFixed(2)]];
            if (name === 'MINIGUN') facts.push(['Spin-up delay', `${MINIGUN_SHOOT_DELAY}s`], ['Full ramp', `${MINIGUN_RAMP_TIME}s`]);
            else facts.push(['Shot cooldown', `${stats.fireRate}s`]);
        }
        facts.unshift(['Type', isLight(name) ? 'Light' : 'Heavy']);
        const panel = document.getElementById('weapon-specs')!;
        panel.setAttribute('aria-label', `${labels[name]} specifications`);
        const nodes = facts.map(([key,value]) => {
            const fact = document.createElement('span');
            fact.className = 'goggles-target-fact'; fact.textContent = `${key}: ${value}`; return fact;
        });
        panel.replaceChildren(...nodes);
    };
    function chooseView(next: 'held' | 'closeup') {
        view = next;
        heldButton.setAttribute('aria-pressed',String(next === 'held'));
        closeButton.setAttribute('aria-pressed',String(next === 'closeup'));
        stopDrag();
        updateMenuPreview();
    }
    heldButton.onclick = () => chooseView('held');
    closeButton.onclick = () => chooseView('closeup');
    replayButton.onclick = () => { reloadAt = performance.now(); };
    for (const name of weaponOrder) {
        const button = document.createElement('button'); button.className = 'menu-btn secondary'; button.textContent = labels[name]; tabs.append(button);
        button.onclick = () => {
            selectedWeapon = name;
            reloadAt = undefined; replayButton.hidden = name === 'KATANA';
            setWeaponSpecs(name);
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
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 260); camera.position.set(0, 0.25, 11.5); camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); stage.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x455670, 3));
    const light = new THREE.DirectionalLight(0xffffff, 4); light.position.set(-3, 4, 5); scene.add(light);
    const menuForest = createMenuForest();
    scene.add(menuForest.group);
    const previewRoot = new THREE.Group();
    scene.add(previewRoot);
    // Keep the frame on the armored silhouette as the boots and back ducts fire.
    const previewBounds = new THREE.Box3(new THREE.Vector3(-.48,-.86,-.30).multiplyScalar(CYBORG_SCALE), new THREE.Vector3(.48,.96,.36).multiplyScalar(CYBORG_SCALE));
    setPeerScanBounds(previewRoot, previewBounds);
    const previewPeer = { menu: { username: 'Character', mesh: previewRoot, hp: 10, maxHp: 10 } };
    let avatar: CyborgAvatar | undefined;
    let disposed = false;
    const retry = document.createElement('button');
    retry.className = 'menu-btn secondary preview-retry'; retry.textContent = 'Retry character preview'; retry.hidden = true;
    stage.append(retry);
    function loadPreview(): void {
        retry.hidden = true;
        void loadCyborgAssets().then(() => { if (!disposed) updateMenuPreview(); }).catch(() => {
            if (!disposed) retry.hidden = false;
        });
    }
    retry.onclick = loadPreview;
    loadPreview();
    function createPreviewAvatar(wrapper: THREE.Group, color: number): CyborgAvatar {
        const rig = new CyborgAvatar(color);
        rig.root.scale.setScalar(CYBORG_SCALE);
        rig.root.position.y = previewBounds.min.y;
        wrapper.add(rig.root);
        return rig;
    }
    const lobbyModels = new Map<string, { model: THREE.Group; rig: CyborgAvatar; color: number }>();
    const disposeLobbyModel = (id: string) => {
        const item = lobbyModels.get(id);
        if (!item) return;
        item.rig.dispose(); item.model.removeFromParent();
        lobbyModels.delete(id);
    };
    stage.tabIndex = 0;
    const weaponModels = new Map<string, THREE.Group>();
    const propPreviews = new Map<string, ReturnType<typeof createPreviewProp>>();
    const weaponGeometries = new Map<string, WeaponScanGeometry>();
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
    let heldYaw = .62, heldPitch = 0;
    let drag: { id: number; x: number; y: number } | null = null;
    const isWeaponsOpen = () => arsenal.style.display === 'flex' && blocker.style.display !== 'none';
    const getWeaponModel = (name: string): THREE.Group => {
        let weapon = weaponModels.get(name);
        if (weapon) return weapon;
        const prop = createPreviewProp(name);
        const model = prop.model;
        propPreviews.set(name, prop);
        // The socket adapter is designed for an actor's wrist. Restore an upright
        // standalone viewing frame while retaining the same physical asset scale.
        model.rotation.x = -Math.PI / 2;
        model.scale.setScalar(CYBORG_SCALE);
        const center = getVisibleWeaponBounds(model).getCenter(new THREE.Vector3());
        model.position.copy(center).negate();
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
        if (e.target === retry || !isWeaponsOpen() || transition || menuTransition || drag || e.button !== 0) return;
        e.preventDefault(); stage.setPointerCapture(e.pointerId);
        motion = 'manual'; lastInteractionAt = performance.now();
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; stage.classList.add('dragging');
    });
    const rotateWeapon = (x: number, y: number) => {
        if (transition || menuTransition) return;
        if (view === 'held') {
            heldYaw += x; heldPitch = THREE.MathUtils.clamp(heldPitch+y, -.55, .55);
            return;
        }
        if (!weaponModel) return;
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
        if (!isWeaponsOpen() || transition || menuTransition || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); rotateWeapon(e.key === 'ArrowLeft' ? -0.15 : e.key === 'ArrowRight' ? 0.15 : 0,
            e.key === 'ArrowUp' ? -0.15 : e.key === 'ArrowDown' ? 0.15 : 0);
    });
    const colorInput = customization.querySelector<HTMLInputElement>('input')!;
    const swatches = customization.querySelector('.color-options')!;
    const pickerTile = customization.querySelector<HTMLElement>('.color-picker-tile')!;
    const showColor = () => {
        colorInput.value = characterColor;
        let presetSelected = false;
        for (const button of swatches.querySelectorAll('button')) {
            const selected = button.dataset.color === characterColor;
            button.setAttribute('aria-pressed', String(selected));
            presetSelected ||= selected;
        }
        pickerTile.classList.toggle('is-selected', !presetSelected);
    };
    const setColor = (color: string) => {
        if (!state.isPlaying) changePlayerSuitColor(color);
        showColor();
    };
    for (const [label, color] of [['Cobalt', '#3b5998'], ['Coral', '#df5b64'], ['Mint', '#45b99a'], ['Gold', '#e4ad45'], ['Lilac', '#987bd1']]) {
        const button = document.createElement('button'); button.style.background = color; button.dataset.color = color; button.setAttribute('aria-label', `${label} suit`); button.onclick = () => setColor(color); swatches.append(button);
    }
    colorInput.addEventListener('input', () => setColor(colorInput.value)); showColor();
    let width = 0, height = 0, last = 0, scanActive = false, lobbyScanActive = false;
    const panels = ['settings','pause','weapons','host-waiting','join-room','mp','main'].map(key =>
        document.getElementById('panel-'+key)!);
    const otherPanels = panels.filter(p => p !== main && p !== arsenal);
    let activePanel: HTMLElement | null = null;
    const settingsSlot = document.createElement('div');
    settingsSlot.className = 'settings-character-preview';
    const livePreviewCanvas = document.createElement('canvas');
    livePreviewCanvas.className = 'settings-live-preview';
    livePreviewCanvas.hidden = true;
    settingsSlot.append(livePreviewCanvas);
    livePreviewCanvasRef = livePreviewCanvas;
    setLivePreviewActiveRef = (active: boolean) => {
        stage.hidden = active;
        livePreviewCanvas.hidden = !active;
    };
    let layoutDirty = true;
    const resize = new ResizeObserver(() => { layoutDirty = true; });
    for (const panel of panels) resize.observe(panel);
    resize.observe(stage);
    let navBounds = {right:0,top:0};
    let frame = {left:0,top:0,right:0,bottom:0};
    let previewVisible = true;
    renderPreview = () => {
        const visible = blocker.style.display !== 'none' && !document.hidden;
        if (!visible) {
            if (previewVisible) {
                cancelMenuTransition();
                stopDrag(); scan.reset(); lobbyScan.reset(); weaponScan.hide();
                scanActive = lobbyScanActive = false;
                for (const id of lobbyModels.keys()) disposeLobbyModel(id);
                if (transition?.incoming) scene.remove(transition.incoming);
                if (weaponModel) scene.remove(weaponModel);
                transition = null; displayedWeapon = null; weaponModel = null;
            }
            previewVisible = false; return;
        }
        previewVisible = true;
        const now = performance.now();
        if (now - last < 33) return;
        const otherOpen = otherPanels.find(item => item.style.display === 'flex');
        if (otherOpen && menuTransition) cancelMenuTransition(otherOpen);
        if (menuTransition?.phase === 'descan') {
            const exitDuration = menuTransition.direction === 'to-weapons' ? SCAN_EXIT_DURATION_MS : WEAPON_SCAN_EXIT_MS;
            if (now - menuTransition.startedAt >= exitDuration) {
                if (menuTransition.direction === 'to-weapons') scan.reset();
                else weaponScan.hide();
                startMenuMorph(menuTransition.direction, now);
            }
        }
        const panel = otherOpen ?? (menuTransition
            ? (menuTransition.phase === 'morph'
                ? (menuTransition.direction === 'to-weapons' ? arsenal : main)
                : (menuTransition.direction === 'to-weapons' ? main : arsenal))
            : (panels.find(item => item.style.display === 'flex') ?? main));
        const settingsOpen = panel.id === 'panel-settings';
        setSettingsLivePreviewActive(settingsOpen && state.isPlaying && !state.isMultiplayer);
        if (activePanel !== panel) {
            activePanel = panel; layoutDirty = true;
            stopDrag(); reloadAt = undefined;
            const sidebar = settingsOpen ? panel.querySelector<HTMLElement>('.settings-sidebar') : null;
            if (sidebar) {
                sidebar.prepend(settingsSlot);
                settingsSlot.append(stage);
            } else if (stage.parentElement !== preview) preview.append(stage);
            blocker.dataset.previewPanel = panel.id;
        }
        customization.disabled = state.isPlaying;
        if (colorInput.value.toLowerCase() !== characterColor.toLowerCase()) showColor();
        const weaponsOpen = panel === arsenal;
        const closeOpen = weaponsOpen && view === 'closeup';
        if (!cyborgAssetsReady()) {
            if (weaponsOpen) setWeaponSpecs(selectedWeapon);
            last = performance.now();
            return;
        }
        if (!avatar) avatar = createPreviewAvatar(previewRoot, Number.parseInt(characterColor.slice(1), 16));
        const lobbyOpen = !state.isPlaying && state.lobbyPlayers.length > 0 &&
            (document.getElementById('panel-host-waiting')!.style.display === 'flex' ||
                document.getElementById('panel-join-room')!.style.display === 'flex');
        const lobbyGuests = lobbyOpen ? state.lobbyPlayers.slice(1) : [];
        const ownColor = Number.parseInt(characterColor.slice(1),16);
        // Only this viewer's suit uses the pending picker color. Every other
        // person, including a guest's view of the host, follows the host roster.
        const lineupColor = (player: {peerId:string; bodyColor:number}) =>
            player.peerId === state.peer?.id ? ownColor : player.bodyColor;
        const wantedIds = new Set(lobbyGuests.map(player => player.peerId));
        for (const id of lobbyModels.keys()) if (!wantedIds.has(id)) disposeLobbyModel(id);
        for (const player of lobbyGuests) {
            const color = lineupColor(player);
            let item = lobbyModels.get(player.peerId);
            if (!item) {
                const model = new THREE.Group();
                const rig = createPreviewAvatar(model, color);
                scene.add(model); setPeerScanBounds(model, previewBounds);
                item = { model, rig, color };
                lobbyModels.set(player.peerId, item);
            }
            if (item.color !== color) {
                item.rig.setColor(color);
                item.color = color;
            }
        }
        const centerColor = lobbyOpen ? lineupColor(state.lobbyPlayers[0]) : ownColor;
        if (previewRoot.userData.previewColor !== centerColor) {
            avatar.setColor(centerColor);
            previewRoot.userData.previewColor = centerColor;
        }

        stage.classList.toggle('weapon-stage', weaponsOpen);
        if (!weaponsOpen) stopDrag();
        previewRoot.visible = !closeOpen;
        stage.tabIndex = weaponsOpen ? 0 : -1;
        if (!closeOpen && (displayedWeapon || transition)) {
            // Closing the panel may interrupt a slide. Remove both participants
            // so reopening starts with one centered model and a fresh scan.
            if (transition?.incoming) { transition.incoming.position.y = 0; scene.remove(transition.incoming); }
            if (weaponModel) { weaponModel.position.y = 0; scene.remove(weaponModel); }
            transition = null; displayedWeapon = null; weaponModel = null;
        }
        if (closeOpen && !displayedWeapon) {
            weaponModel = getWeaponModel(selectedWeapon);
            resetWeaponMotion(weaponModel);
            scene.add(weaponModel); displayedWeapon = selectedWeapon;
            setWeaponSpecs(selectedWeapon);
        }
        stage.setAttribute('aria-label', weaponsOpen ? `${labels[selectedWeapon]} 3D model. Drag or use arrow keys to rotate.` :
            lobbyOpen ? `Lobby lineup with ${state.lobbyPlayers.length} players` : 'Preview of your playable character');
        const shouldScan = !state.isPlaying && !weaponsOpen && !menuTransition && main.style.display !== 'none';
        if (!shouldScan && scanActive) { scan.reset(); scanActive = false; }
        if (!lobbyOpen && lobbyScanActive) { lobbyScan.reset(); lobbyScanActive = false; }
        if (!weaponsOpen || view === 'held') weaponScan.hide();
        last = now;
        const reducedMotion = reducedMotionQuery?.matches ?? false;
        const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
        if (w !== width || h !== height) {
            width = w; height = h; renderer.setSize(w,h,false); layoutDirty = true;
        }
        if (layoutDirty) {
            // Reserve the controls' actual footprint. World size stays fixed as
            // this camera reframes a phone, a desktop lineup or the settings tile.
            const bounds = panel.getBoundingClientRect();
            const titleBottom = document.getElementById('title')!.getBoundingClientRect().bottom;
            navBounds = {right:bounds.right,top:bounds.top};
            if (settingsOpen) frame = {left:2,top:2,right:w-2,bottom:h-2};
            else if (w < 700 && w/h < .9) {
                frame = {left:12,top:Math.max(14,titleBottom+5),right:w-12,bottom:Math.max(titleBottom+45,bounds.top-12)};
            } else {
                frame = {left:Math.min(w*.62,bounds.right+18),top:Math.max(18,titleBottom+14),right:w-18,bottom:h-28};
            }
            // The Character scan grows to the upper right. Its native tile and
            // five presets need room beyond the silhouette on compact menus.
            if (shouldScan && frame.right - frame.left < 640) {
                frame.right -= Math.min(162, (frame.right - frame.left) * .48);
            }
            layoutDirty = false;
        }
        if (closeOpen && weaponModel && displayedWeapon !== selectedWeapon && !transition) {
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
        const focal = h/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
        const halfW = Math.max(20,(frame.right-frame.left)*.5);
        const halfH = Math.max(20,(frame.bottom-frame.top)*.5);
        const centeredX = (frame.left+frame.right)*.5, centeredY = (frame.top+frame.bottom)*.5;
        const distanceFor = (name: string) => {
            const radius = weaponGeometries.get(name)!.radius;
            const pixels = Math.max(18,Math.min(halfW*.80,halfH*.67));
            return fitWeaponPreviewDistance(radius, focal, pixels);
        };
        const slideEase = slideProgress * slideProgress * (3 - 2 * slideProgress);
        let distance: number;
        if (closeOpen && displayedWeapon) distance = slide && slideProgress < 1 ?
            THREE.MathUtils.lerp(distanceFor(slide.from),distanceFor(slide.to!),slideEase) : distanceFor(displayedWeapon);
        else {
            const weapon = weaponsOpen ? selectedWeapon : state.isPlaying ? state.activeWeaponName : 'PISTOL';
            const reach = weaponsOpen && weapon === 'SNIPER' ? 1.69 : weaponsOpen && weapon === 'KATANA' ? 1.10 : .80;
            const availableWidth = halfW * .88, availableHeight = halfH * (settingsOpen ? .95 : .90);
            distance = CYBORG_SCALE * Math.max(1.13*focal/availableHeight+.15, reach*focal/availableWidth+.30);
            if (lobbyOpen) for (let i=1;i<state.lobbyPlayers.length;i++) {
                const pos = lobbyPreviewPosition(i,w/h);
                distance = Math.max(distance,(Math.abs(pos.x)+.52*CYBORG_SCALE)*focal/availableWidth+pos.z+.30*CYBORG_SCALE);
            }
        }
        const morph = menuTransition?.phase === 'morph' ? menuTransition : null;
        const morphProgress = morph ? Math.min(1, (last - morph.startedAt) / MENU_MORPH_MS) : 0;
        const morphEase = morphProgress * morphProgress * (3 - 2 * morphProgress);
        const renderCenteredX = morph ? THREE.MathUtils.lerp(morph.fromPose.centeredX, centeredX, morphEase) : centeredX;
        const renderCenteredY = morph ? THREE.MathUtils.lerp(morph.fromPose.centeredY, centeredY, morphEase) : centeredY;
        const renderDistance = morph ? THREE.MathUtils.lerp(morph.fromPose.distance, distance, morphEase) : distance;
        camera.position.set(0,0,renderDistance);
        camera.lookAt(0,0,0);
        camera.setViewOffset(w,h,w/2-renderCenteredX,h/2-renderCenteredY,w,h);
        lastPose.centeredX = renderCenteredX;
        lastPose.centeredY = renderCenteredY;
        lastPose.distance = renderDistance;
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
        const avatarTime = reducedMotion ? 0 : last / 1000;
        const isGrapple = selectedWeapon === 'GRAPPLE';
        const duration = FIREARM_MAGAZINES[selectedWeapon as keyof typeof FIREARM_MAGAZINES]?.reloadSeconds ?? 236/120;
        const held = weaponsOpen && view === 'held';
        const handoff = held && isLight(selectedWeapon) ? GRAPPLE_DRAW_TIME : 0;
        const elapsed = reloadAt === undefined || !weaponsOpen ? undefined : (last - reloadAt) / 1000;
        let progress: number | undefined;
        let grappleTime = avatarTime;
        let grapple: string | undefined;
        if (elapsed !== undefined) {
            const suffix = selectedWeapon === 'SHOTGUN' ? 'Shotgun' : 'Pistol';
            if (elapsed < handoff) {
                grapple = 'Grapple.Return.' + suffix;
                grappleTime = .52 * elapsed / handoff;
            } else if (elapsed < handoff + duration) {
                progress = (elapsed - handoff) / duration;
            } else if (elapsed < handoff * 2 + duration) {
                grapple = 'Grapple.Draw.' + suffix;
                grappleTime = .52 * (elapsed - handoff - duration) / handoff;
            } else reloadAt = undefined;
        }
        const charge = progress === undefined ? 4 : reloadingBatteryStage(0, progress);
        if (closeOpen && displayedWeapon === selectedWeapon) propPreviews.get(selectedWeapon)?.sampleReload(progress,charge);
        if (!closeOpen) {
            const weapon = weaponsOpen ? (isGrapple ? 'PISTOL' : selectedWeapon) : state.isPlaying ? state.activeWeaponName : 'PISTOL';
            avatar.setPrimaryVisible(!(held && isGrapple));
            if (held && isGrapple) {
                grapple = progress === undefined ? 'Grapple.Held' : 'Grapple.Reload';
                grappleTime = progress === undefined ? avatarTime : progress * 236/120;
            } else if (!grapple && progress === undefined &&
                (state.isPlaying && !weaponsOpen ? state.weaponHandling.hand === 'drawn' : isLight(weapon))) {
                grapple = 'Grapple.Held';
            }
            avatar.pose({body:held || settingsOpen || state.isPlaying ? 'Idle.Armed' : 'Hover.Hold',
                bodyTime:avatarTime,weapon,action:progress !== undefined && !isGrapple ? 'Reload' : 'Ready',
                reloadProgress:progress, chargeStage:charge, reducedMotion, grapple, grappleTime,
                grappleChargeStage:isGrapple ? charge : undefined});
            const targetRotX = held ? heldPitch : 0;
            const targetRotY = held ? heldYaw : -0.28;
            const targetPosY = held || settingsOpen || state.isPlaying || reducedMotion ? 0 : Math.sin(avatarTime * .9) * .065;
            if (morph) {
                previewRoot.rotation.set(
                    THREE.MathUtils.lerp(morph.fromPose.rotX, targetRotX, morphEase),
                    THREE.MathUtils.lerp(morph.fromPose.rotY, targetRotY, morphEase),
                    0,
                );
                previewRoot.position.y = THREE.MathUtils.lerp(morph.fromPose.posY, targetPosY, morphEase);
            } else {
                previewRoot.rotation.set(targetRotX, targetRotY, 0);
                previewRoot.position.y = targetPosY;
            }
            lastPose.rotX = previewRoot.rotation.x;
            lastPose.rotY = previewRoot.rotation.y;
            lastPose.posY = previewRoot.position.y;
        }
        for (let index = 0; index < lobbyGuests.length; index++) {
            const item = lobbyModels.get(lobbyGuests[index].peerId)!;
            const position = lobbyPreviewPosition(index + 1, camera.aspect);
            const t = reducedMotion ? 0 : avatarTime + index + 1;
            item.model.position.set(position.x, reducedMotion ? 0 : Math.sin(t * .9) * .065, position.z);
            item.rig.pose({body:'Hover.Hold', bodyTime:t, weapon:'PISTOL', grapple:'Grapple.Held', reducedMotion});
        }
        menuForest.group.visible = !settingsOpen;
        menuForest.update(avatarTime, reducedMotion);
        renderer.render(scene, camera);
        if (morph && morphProgress >= 1) {
            const leaving = morph.direction === 'to-weapons' ? main : arsenal;
            const entering = morph.direction === 'to-weapons' ? arsenal : main;
            leaving.style.display = 'none';
            leaving.classList.remove('menu-panel-leaving', 'menu-panel-entering');
            entering.classList.remove('menu-panel-leaving', 'menu-panel-entering');
            menuTransition = null;
            layoutDirty = true;
        }
        if (lobbyOpen) {
            const lobbyTargets: Record<string, { username: string; mesh: THREE.Group; hp: number; maxHp: number; lobbyOrder: number }> = {};
            for (const player of lobbyScanPlayers(state.lobbyPlayers, state.peer?.id ?? '')) {
                const mesh = player.peerId === state.lobbyPlayers[0].peerId ? previewRoot : lobbyModels.get(player.peerId)?.model;
                if (mesh) lobbyTargets[player.peerId] = { username: player.username, mesh, hp: 10, maxHp: 10,
                    lobbyOrder: state.lobbyPlayers.indexOf(player) };
            }
            lobbyScan.configureLobby(state.lobbyPlayers.length, state.lobbyPlayers.map(player => player.peerId).join('|'));
            lobbyScan.update(camera, camera.position, camera.position, [], lobbyTargets, true, last, null, [], false);
            lobbyScanActive = true;
        }
        if (closeOpen && weaponModel && weaponGeometry && !transition && !menuTransition && displayedWeapon === selectedWeapon && w >= 1000 && h >= 580) {
            weaponScan.update(labels[displayedWeapon!], weaponGeometry, camera, w, h, navBounds.right, navBounds.top, last);
        }
        else if (weaponsOpen && !menuTransition) weaponScan.hide();
        if (shouldScan) {
            scan.update(camera, camera.position, camera.position, [], previewPeer, true, last, null, [], false);
            scanActive = true;
        }
    };
    window.addEventListener('pagehide', event => {
        if (event.persisted) return;
        cancelMenuTransition();
        disposed = true; renderPreview = undefined;
        livePreviewCanvasRef = null; setLivePreviewActiveRef = undefined;
        menuForest.dispose();
        for (const id of lobbyModels.keys()) disposeLobbyModel(id);
        avatar?.dispose();
        for (const prop of propPreviews.values()) prop.dispose();
        resize.disconnect();
        weaponScan.hide();
        scan.reset();
        lobbyScan.reset();
        renderer.dispose();
    });
}
