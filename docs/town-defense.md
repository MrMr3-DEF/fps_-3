# Defend the Town

Town defense runs in solo and multiplayer alongside Forgotten Mecha. The match
starts on Day 1, and each dawn begins a new wave on the eight-minute sky cycle.
Multiplayer Day 1 begins at the room's current sky phase.
Five Base robots spawn on Day 1. The Day 2 wave adds three Fast robots, and the
Day 3 wave adds three Big robots. Each later wave adds one of each kind to the
previous wave's composition. Surviving robots carry over. Up to 48 robots and
their temporary wrecks share the battlefield, with overflow waiting for slots.

Robots enter at reachable seeded points along the map edge and travel toward
outer wall sections. They prioritize the nearest visible living player in a
50 m sphere. Cover blocks attacks, and robots return to their wall approach
when they lose the player.

| Robot | HP | Damage per hit | Attack |
| --- | ---: | ---: | --- |
| Base | 5 | 1 | Rifle with a 50 m spherical range and a three-second interval |
| Fast | 3 | 1 | Quick melee at the LightHit contact frame |
| Big | 10 | 3 | Heavy melee at the HeavyHit contact frame |

The HUD shows **Defend the Town** on entering play and the day below the
elimination counter. Aim at the central well to see the **Wall durability**
bar. Scoped goggles scan visible robots as **Enemy**. The locator tracks
players and Ironmaw. Each defeated bot counts toward Targets Eliminated.

The wall starts at 500 HP. A wall hit that reduces it to zero commits the same
seeded collapse, debris, and aftermath sequence as Ironmaw's wall attack. The
scene frames the infantry strike location without an on-screen actor. The
first loss committed ends the match. Respawning preserves the current wave and
durability. Offline pause freezes the clock and attacks. Multiplayer continues
under the host while a player is paused or dead.

## Runtime

`infantry.ts` owns robot lifetimes, animation sampling, attacks, edge routes
and durability. `config.ts` holds gameplay values. The world owns asset
preparation, render culling, spatial queries, and disposal. Render culling
affects presentation while collision, attack range, and cover use world
geometry. The asset guide lists the [robot clips and rig cues](../blender_assets/README.md#enemy-robots).

The host owns wave and combat decisions. Clients interpolate the host's
sequenced robot snapshots, and late joiners receive a complete defense state.
Bot slot revisions bind weapon claims and goggles locks to one robot. The host
validates moving-target claims using bounded pose history, terrain, and the
shooter’s accepted weapon and pellet. Damage events address a particular player
life. Both loss causes share the terminal clock and viewer-readiness barrier.
