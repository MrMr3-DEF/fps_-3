import * as THREE from 'three';
import { MECHA_NAPE } from './config.js';

/** Anatomical +Z faces the eye; the bind-frame fit then follows the animated head. */
export class MechaNape {
    readonly anchor = new THREE.Object3D();
    readonly box = new THREE.Box3();
    constructor(head: THREE.Object3D, helmet: THREE.Mesh, eye: THREE.Object3D) {
        head.updateWorldMatrix(true, false);
        helmet.updateWorldMatrix(true, false);
        const center = new THREE.Box3().setFromObject(helmet, true).getCenter(new THREE.Vector3());
        const forward = eye.getWorldPosition(new THREE.Vector3()).sub(center);
        forward.y = 0;
        forward.normalize();
        const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(up, forward).normalize();
        const worldFrame = new THREE.Matrix4().makeBasis(right, up, forward).setPosition(center);
        const inverse = worldFrame.clone().invert(), bounds = new THREE.Box3(), vertex = new THREE.Vector3();
        for (let i = 0; i < helmet.geometry.attributes.position.count; i++) {
            helmet.getVertexPosition(i, vertex).applyMatrix4(helmet.matrixWorld).applyMatrix4(inverse);
            bounds.expandByPoint(vertex);
        }
        const size = bounds.getSize(new THREE.Vector3()).multiply(new THREE.Vector3(MECHA_NAPE.width, MECHA_NAPE.height, MECHA_NAPE.depth));
        const rear = bounds.getCenter(new THREE.Vector3()); rear.y = bounds.min.y; rear.z = bounds.min.z;
        this.box.setFromCenterAndSize(rear, size);
        this.anchor.name = 'Mecha rear nape volume';
        this.anchor.matrix.copy(head.matrixWorld).invert().multiply(worldFrame);
        this.anchor.matrix.decompose(this.anchor.position, this.anchor.quaternion, this.anchor.scale);
        head.add(this.anchor);
    }
    /** Rear hemisphere only: a side/front cut cannot execute through the helmet. */
    fromBehind(origin: THREE.Vector3): boolean {
        this.anchor.updateWorldMatrix(true, false);
        // Test the anatomical rear edge, not the expanded box exterior: being
        // close enough to enter the rear half of the weak spot must still count.
        return this.anchor.worldToLocal(origin.clone()).z < (this.box.min.z + this.box.max.z) / 2;
    }
    dispose(): void { this.anchor.removeFromParent(); }
}
