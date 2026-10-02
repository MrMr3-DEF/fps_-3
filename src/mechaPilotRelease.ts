import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_BODY_CAMERA_OFFSET } from './playerHitbox.js';

export interface MechaPilotRelease {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    viewPosition: THREE.Vector3;
}
const rotation = new THREE.Euler(0, 0, 0, 'YXZ');

/** Release is not a respawn: HP, life identity, equipment and fuel survive.
 * Capture precedes the breakup pose, which otherwise moves the seated bean
 * with a flying chest fragment before it can be detached. */
export function releaseMechaPilot(pose: MechaPilotRelease): void {
    if (state.playerMesh && state.scene) {
        state.scene.add(state.playerMesh);
        state.playerMesh.position.copy(pose.position); state.playerMesh.scale.setScalar(1.5);
        rotation.setFromQuaternion(pose.quaternion);
        state.playerMesh.rotation.set(0, rotation.y, 0);
        state.playerMesh.visible = state.isThirdPerson;
    }
    const player = state.controls?.getObject() ?? state.camera;
    if (player) { player.position.copy(pose.position); player.position.y += PLAYER_BODY_CAMERA_OFFSET; player.quaternion.copy(pose.quaternion); }
    state.velocity.set(0, 0, 0); state.canJump = state.normalJumpActive = state.isHovering = false;
    state.isMouseDown = state.rightClickActive = state.keyCActive = state.isScoped = state.isShiftDown = false;
    state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
    state.inspectState = 'IDLE'; state.inspectTimer = 0;
}
