# Tideland world asset pipeline

`npm run assets:world` runs the installed Blender in background mode and
deterministically exports the catalog in `catalog.json` as original GLB files
under `public/assets/world/`. Set `BLENDER_BIN` only when Blender is outside
the standard executable path. The Python source is self-contained and reads no
external models, textures, or commercial game assets.

Every GLB contains a named root and three meter-scale mesh levels (`LOD0`,
`LOD1`, `LOD2`). Landmark meshes select levels through `THREE.LOD`; instanced
trees select shared geometry by graphics preset. All materials are procedural
Blender Principled materials, and each model keeps
its origin at the asset placement point. Geometry is joined per LOD while
material regions remain available. The Breakwater uses the `shipwreck_hull_a`
render asset on Generation-5 Revision-6 worlds. It replaces only the old hull
mesh; the saved POI, existing collision proxies, gameplay stations, and legacy
world revisions are unchanged. Other catalog assets form the reusable library
for later POI and environment integration. The tree set currently includes
three distinct broadleaf forms, three temperate conifers, an alpine conifer,
a splayed-root marsh tree, and a wind-leaning coastal tree. Five temperate tree
variants now use the existing instanced gameplay batches with two meshes per
batch (trunk and foliage), so tree count does not add per-object draw calls.
Low and Medium select LOD2, High selects LOD1, and Ultra selects LOD0. Harvest
identity, colliders, and falling-tree animation remain attached to the
procedural gameplay nodes. Tree variants are seeded by asset ID and exported
with the same three-LOD pipeline. The fractured-stone
set contains three size variants each for small, medium, and large rocks, plus
coastal/alpine stones, two cliff slabs, and broken stone. Facet shape and
material regions are generated deterministically from each asset ID.

The same command writes one compact sidecar under
`public/assets/world/collision-proxies/` for each catalog model. Tree variants
receive a vertical trunk capsule; other props receive a meter-scaled bounding
box that contains LOD0, LOD1, and LOD2 in glTF Y-up coordinates. This keeps
lower-detail silhouettes inside their authoring proxy. These are coarse hints
for future static integrations, not replacements for the hand-authored
gameplay colliders currently owned by `WorldSurvival` and `PhysicsWorld`.
After joining an asset's parts, the exporter bakes the active part's location,
rotation, and scale into the merged vertices before clearing object transforms.
This preserves authored geometry orientation and origin for assets assembled
from translated or rotated primitives, including horizontal shoreline driftwood
and the grounded salvage crate used at Breakwater.

Regenerate and check file sizes with:

```sh
npm run assets:world
```

GLB files are intended runtime content, not build output. Do not commit Blender
temporary files, QA screenshots, or generated `dist/` and `site/` directories.
