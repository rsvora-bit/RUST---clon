# Tideland world asset pipeline

`npm run assets:world` runs the installed Blender in background mode and
deterministically exports the catalog in `catalog.json` as original GLB files
under `public/assets/world/`. Set `BLENDER_BIN` only when Blender is outside
the standard executable path. The Python source is self-contained and reads no
external models, textures, or commercial game assets.

Every GLB contains a named root and three meter-scale mesh levels (`LOD0`,
`LOD1`, `LOD2`). Runtime code selects the levels through `THREE.LOD`; all
materials are procedural Blender Principled materials, and each model keeps
its origin at the asset placement point. Geometry is joined per LOD while
material regions remain available. The Breakwater uses the `shipwreck_hull_a`
render asset on Generation-5 Revision-6 worlds. It replaces only the old hull
mesh; the saved POI, existing collision proxies, gameplay stations, and legacy
world revisions are unchanged. Other catalog assets form the reusable library
for later POI and environment integration.

Regenerate and check file sizes with:

```sh
npm run assets:world
```

GLB files are intended runtime content, not build output. Do not commit Blender
temporary files, QA screenshots, or generated `dist/` and `site/` directories.
