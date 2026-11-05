// Static production-effect samples for inspecting sub-frame visuals without extending gameplay durations.
import * as THREE from 'three';
import { KatanaEffects } from '/src/katanaEffects.ts';
import { buildKatana, updateKatanaModel } from '/src/katanaModel.ts';
import { ForgottenMecha } from '/src/forgottenMecha.ts';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight - 70); document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x334b60);
const camera = new THREE.PerspectiveCamera(65, innerWidth / (innerHeight - 70), .01, 1000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 3));
const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-10, 30, -10); scene.add(light);
const sword = buildKatana(); sword.position.set(.7, 0, -2.5); scene.add(sword);
const enemy = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .6), new THREE.MeshStandardMaterial({ color: 0x8c627e }));
enemy.position.set(-.2, -.1, -3.3); scene.add(enemy);
const fx = new KatanaEffects(); let impact = false, actor:ForgottenMecha|null = null;
const status = document.getElementById('status')!;
function sample(gentle: boolean, hit: boolean) {
    actor?.group.removeFromParent(); fx.reset(); scene.add(sword, enemy); camera.position.set(0, .2, 0); camera.rotation.set(0, 0, 0);
    updateKatanaModel(sword, 0, .18, true, 0, gentle); sword.updateMatrixWorld(true);
    fx.sample('review', '1', sword, .18, .18, scene); fx.update(.25, gentle);
    impact = hit;
    if(hit) fx.confirm('review', 'enemy:1', enemy, enemy.position, 0, gentle);
    status.textContent = hit ? gentle ? 'Paused gentle outline and slash' : 'Paused 120 ms impact frame' : 'Paused curved world-space trail (0.3 s fade)';
}
document.getElementById('trail')!.onclick = () => sample(false, false);
document.getElementById('impact')!.onclick = () => sample(false, true);
document.getElementById('gentle')!.onclick = () => sample(true, true);
document.getElementById('nape')!.onclick = async () => {
    impact = false; fx.reset(); sword.removeFromParent(); enemy.removeFromParent();
    if (!actor) {
        actor = new ForgottenMecha([], [], 42); await actor.load();
        const nape = actor.nape!, size = nape.box.getSize(new THREE.Vector3());
        const box = new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z), new THREE.MeshBasicMaterial({ color: 0xffdd00, wireframe: true, depthTest: false }));
        box.position.copy(nape.box.getCenter(new THREE.Vector3())); nape.anchor.add(box);
    }
    scene.add(actor.group); actor.group.updateMatrixWorld(true);
    const nape = actor.nape!, center = nape.box.getCenter(new THREE.Vector3()).applyMatrix4(nape.anchor.matrixWorld);
    const rear = new THREE.Vector3(.7,.3,-1).transformDirection(nape.anchor.matrixWorld);
    camera.position.copy(center).addScaledVector(rear, 15); camera.lookAt(center);
    status.textContent = 'Animated-head nape: yellow box at lower rear helmet edge';
};
sample(false,false);
renderer.setAnimationLoop(() => { renderer.render(scene,camera); if(impact)fx.render(renderer,camera,0); });
window.addEventListener('pagehide',()=>{fx.dispose();actor?.dispose();renderer.dispose();});
