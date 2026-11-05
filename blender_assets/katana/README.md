# Classic katana

Simple minifigure-inspired black molded blade and guard with a polished silver
cylindrical handle. No textures, skeleton, wrapping, or scabbard.

- `katana.blend`: editable meshes, bevel modifiers, studio lights and camera.
- `katana.glb`: evaluated game-ready meshes and PBR materials.
- `katana.mesh.json`: the same evaluated triangle surfaces and material values,
  used synchronously by the game. Animated lightning is generated at runtime.
- `preview_front.png`, `preview_side.png`, `preview_three_quarter.png`: studio views.

Regenerate with Blender 5.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python blender_assets/katana/generate_katana.py
```

Run from the project root. Outputs are placed beside the script. Regeneration
replaces the generated asset files; preserve manual Blender edits separately or
incorporate them into the script first.

Game coordinates use Y up, with the grip centered at the origin, blade tip at
Y=1.30, and grip bottom at Y=-0.135. Blender uses Z up; export converts coordinates
with (x, y, z) -> (x, z, -y). The game uses a 1.14 presentation scale and holds the cutting edge forward.
Colors in JSON are sRGB hex values; Blender materials use their linear equivalents.
Each game model creates independent geometry and materials for safe charge effects
and disposal. GLB export excludes studio lights/cameras.
