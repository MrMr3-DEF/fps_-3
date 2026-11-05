import * as THREE from 'three';
import { KATANA, KATANA_FEEDBACK, LASER_BEAM_FADE_TIME } from './config.js';
import { sampleKatanaPose } from './katanaModel.js';

interface Trail { owner: string; swing: string; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; points: number[]; sample: number; end: number; previous?: THREE.Vector3[] }
const cutEnd = KATANA.windup + KATANA.chargedSlash;
/** World-space ribbons and baked hit silhouettes own all of their GPU resources. */
export class KatanaEffects {
    readonly trails: Trail[] = [];
    readonly impactScene = new THREE.Scene();
    private impactUntil = -Infinity;
    private seen = new Set<string>();
    private framedSwings = new Set<string>();
    private material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthTest: false });
    private samplePose = new THREE.Object3D();
    sample(owner: string, swing: string, root: THREE.Object3D, elapsed: number, now: number, scene: THREE.Scene): void {
        if (elapsed < KATANA.windup || elapsed > cutEnd + LASER_BEAM_FADE_TIME) return;
        let trail = this.trails.find(t => t.owner === owner && t.swing === swing);
        if (!trail) {
            if (this.trails.length >= KATANA_FEEDBACK.maxTrails) this.removeTrail(this.trails[0]);
            const geometry = new THREE.BufferGeometry();
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
            mesh.frustumCulled = false;
            scene.add(mesh);
            trail = { owner, swing, mesh, points: [], sample: 0, end: now - elapsed + cutEnd };
            this.trails.push(trail);
        }
        root.updateWorldMatrix(true, false);
        // Fixed animation samples retain the curved sweep even when a frame crosses the whole cut.
        const count = 24;
        while (trail.sample <= count && KATANA.windup + trail.sample / count * KATANA.chargedSlash <= Math.min(elapsed, cutEnd) + 1e-9) {
            sampleKatanaPose(this.samplePose, KATANA.windup + trail.sample / count * KATANA.chargedSlash, true);
            this.samplePose.updateMatrix();
            const matrix = new THREE.Matrix4().multiplyMatrices(root.matrixWorld, this.samplePose.matrix);
            const points = [new THREE.Vector3(0, .165, 0), new THREE.Vector3(.18, 1.30, 0)].map(p => p.applyMatrix4(matrix));
            if (trail.previous) for (const point of [trail.previous[0], trail.previous[1], points[1], trail.previous[0], points[1], points[0]]) trail.points.push(point.x, point.y, point.z);
            trail.previous = points;
            trail.sample++;
        }
        trail.mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(trail.points, 3));
    }
    /** Called only for host-confirmed hits, before a locally killed target can respawn. */
    confirm(swing: string, target: string, object: THREE.Object3D | undefined, contact: THREE.Vector3, now: number, gentle: boolean, rotation = new THREE.Quaternion()): boolean {
        const key = `${swing}/${target}`;
        if (this.seen.has(key)) return false;
        this.seen.add(key);
        if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
        if (now >= this.impactUntil) {
            // A late hit from this swing cannot flash again; simultaneous targets share one deadline.
            if (this.framedSwings.has(swing)) return false;
            this.clearSnapshots();
            this.impactUntil = now + KATANA_FEEDBACK.impactDuration;
        }
        this.framedSwings.add(swing);
        if (this.framedSwings.size > 64) this.framedSwings.delete(this.framedSwings.values().next().value!);
        this.material.wireframe = gentle;
        this.material.opacity = gentle ? .35 : 1;
        this.impactScene.background = gentle ? null : new THREE.Color(0x050608);
        if (this.impactScene.children.length >= KATANA_FEEDBACK.maxSnapshots) return true;
        const group = new THREE.Group();
        object?.updateWorldMatrix(true, true);
        object?.traverseVisible(node => {
            if (!(node instanceof THREE.Mesh) || node.userData.damageTarget || !node.geometry.attributes.position) return;
            const geometry = node.geometry.clone();
            const positions = geometry.attributes.position, vertex = new THREE.Vector3();
            // Baking skinned vertices preserves the struck pose across death/respawn updates.
            for (let i = 0; i < positions.count; i++) { node.getVertexPosition(i, vertex).applyMatrix4(node.matrixWorld); positions.setXYZ(i, vertex.x, vertex.y, vertex.z); }
            geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight');
            geometry.morphAttributes = {};
            const snapshot = new THREE.Mesh(geometry, this.material); snapshot.frustumCulled = false;
            group.add(snapshot);
        });
        // A contact slash remains readable even when damage precedes the fast cut (window starts at release).
        const stroke = new THREE.Mesh(new THREE.BoxGeometry(1.8, .035, .035), this.material);
        stroke.position.copy(contact); stroke.quaternion.copy(rotation); group.add(stroke);
        this.impactScene.add(group);
        return true;
    }
    update(now: number, gentle: boolean): void {
        for (const trail of [...this.trails]) {
            const fade = 1 - Math.max(0, now - trail.end) / LASER_BEAM_FADE_TIME;
            if (fade <= 0) this.removeTrail(trail);
            else trail.mesh.material.opacity = fade * (gentle ? .35 : .8);
        }
        if (now >= this.impactUntil) this.clearSnapshots();
    }
    render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, now: number): void {
        if (now >= this.impactUntil || !this.impactScene.children.length) return;
        const autoClear = renderer.autoClear, target = renderer.getRenderTarget();
        const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
        const highlights: THREE.Mesh[] = [];
        try {
            for (const trail of this.trails) {
                const mesh = new THREE.Mesh(trail.mesh.geometry, this.material); mesh.frustumCulled = false;
                this.impactScene.add(mesh); highlights.push(mesh);
            }
            renderer.autoClear = false;
            renderer.clearDepth();
            renderer.render(this.impactScene, camera);
        } finally {
            for (const mesh of highlights) mesh.removeFromParent();
            renderer.autoClear = autoClear;
            renderer.setRenderTarget(target);
            renderer.setClearColor(color, alpha);
        }
    }
    private clearSnapshots(): void {
        for (const child of [...this.impactScene.children]) {
            child.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
            child.removeFromParent();
        }
    }
    private removeTrail(trail: Trail): void {
        trail.mesh.removeFromParent(); trail.mesh.geometry.dispose(); trail.mesh.material.dispose();
        this.trails.splice(this.trails.indexOf(trail), 1);
    }
    cancel(owner: string, local: boolean): void {
        for (const trail of [...this.trails]) if (trail.owner === owner) this.removeTrail(trail);
        if (local) { this.clearSnapshots(); this.impactUntil = -Infinity; }
    }
    reset(): void {
        for (const trail of [...this.trails]) this.removeTrail(trail);
        this.clearSnapshots(); this.seen.clear(); this.framedSwings.clear(); this.impactUntil = -Infinity;
    }
    dispose(): void { this.reset(); this.material.dispose(); }
}
