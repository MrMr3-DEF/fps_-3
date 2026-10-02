import * as THREE from 'three';

interface Foot { hip: THREE.Bone; knee: THREE.Bone; ankle: THREE.Bone; anchor: THREE.Vector3; rotation: THREE.Quaternion; planted: boolean }

/** The GLB bakes its editing IK. Reapply a small analytical two-link constraint
 * during runtime transitions to keep supporting soles fixed while clips blend. */
export class MechaFootPlant {
    private readonly feet: Foot[];
    private readonly hipPos = new THREE.Vector3();
    private readonly kneePos = new THREE.Vector3();
    private readonly anklePos = new THREE.Vector3();
    private readonly axis = new THREE.Vector3();
    private readonly pole = new THREE.Vector3();
    private readonly joint = new THREE.Vector3();
    private readonly from = new THREE.Vector3();
    private readonly to = new THREE.Vector3();
    private readonly rotation = new THREE.Quaternion();
    private readonly parent = new THREE.Quaternion();
    private readonly world = new THREE.Quaternion();
    private stationaryTime = 0;
    constructor(bones: ReadonlyMap<string, THREE.Bone>) {
        this.feet = ['L', 'R'].map(side => ({ hip: bones.get(`CTRL_Hip_${side}`)!, knee: bones.get(`CTRL_Knee_${side}`)!, ankle: bones.get(`CTRL_Ankle_${side}`)!,
            anchor: new THREE.Vector3(), rotation: new THREE.Quaternion(), planted: false }));
    }
    reset(): void { for (const foot of this.feet) foot.planted = false; this.stationaryTime = 0; }
    private rotateToward(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3): void {
        bone.getWorldPosition(this.from);
        child.getWorldPosition(this.to);
        this.to.sub(this.from).normalize();
        this.from.subVectors(target, this.from).normalize();
        this.rotation.setFromUnitVectors(this.to, this.from);
        bone.getWorldQuaternion(this.world);
        bone.parent!.getWorldQuaternion(this.parent).invert();
        bone.quaternion.copy(this.parent.multiply(this.rotation).multiply(this.world));
        bone.updateWorldMatrix(false, true);
    }
    update(phase: number, stationary: boolean, delta: number): void {
        this.stationaryTime = stationary ? this.stationaryTime + delta : 0;
        if (this.stationaryTime >= 0.4) { for (const foot of this.feet) foot.planted = false; return; }
        for (let side = 0; side < this.feet.length; side++) {
            const foot = this.feet[side];
            const localPhase = (phase + (side ? 0.5 : 0)) % 1;
            const support = stationary || localPhase < 0.6;
            if (!support) { foot.planted = false; continue; }
            if (!foot.planted) {
                foot.ankle.getWorldPosition(foot.anchor);
                foot.ankle.getWorldQuaternion(foot.rotation);
                foot.planted = true;
            }
            if (stationary) {
                // A stopped swing must settle instead of pinning an airborne
                // ankle forever. Release toward the authored standing pose
                // over the same interval as the body crossfade.
                foot.ankle.getWorldPosition(this.anklePos);
                foot.ankle.getWorldQuaternion(this.world);
                const settle = Math.min(1, this.stationaryTime / 0.4);
                foot.anchor.lerp(this.anklePos, settle);
                foot.rotation.slerp(this.world, settle);
            }
            foot.hip.getWorldPosition(this.hipPos);
            foot.knee.getWorldPosition(this.kneePos);
            foot.ankle.getWorldPosition(this.anklePos);
            const upper = this.hipPos.distanceTo(this.kneePos), lower = this.kneePos.distanceTo(this.anklePos);
            this.axis.subVectors(foot.anchor, this.hipPos);
            const distance = Math.max(0.001, Math.min(this.axis.length(), upper + lower - 0.00001));
            this.axis.normalize();
            this.pole.subVectors(this.kneePos, this.hipPos).addScaledVector(this.axis, -this.pole.dot(this.axis));
            if (this.pole.lengthSq() < 1e-8) this.pole.set(0, 0, 1).addScaledVector(this.axis, -this.axis.z);
            this.pole.normalize();
            const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
            this.joint.copy(this.hipPos).addScaledVector(this.axis, along).addScaledVector(this.pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
            this.rotateToward(foot.hip, foot.knee, this.joint);
            this.rotateToward(foot.knee, foot.ankle, foot.anchor);
            foot.ankle.parent!.getWorldQuaternion(this.parent).invert();
            foot.ankle.quaternion.copy(this.parent.multiply(foot.rotation));
            foot.ankle.updateWorldMatrix(false, true);
        }
    }
}
