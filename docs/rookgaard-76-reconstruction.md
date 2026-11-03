# Rookgaard 7.6 reconstruction — source and conversion checklist

Status: source validation in progress; no historical tiles imported yet.

## Primary candidate
- https://github.com/Ethaan/mintwall
- Candidate source: `server/data/world/Tibia74.otbm` (Tibia 7.4; **not verified as exact 7.6**).
- Reference landmarks: https://tibiadb.wiki/city/rookgaard
- Historical/modern comparison: https://tibiaarchive.com/explore?town=rookgaard
- Alternate minimap (not sufficient for objects): https://rookhard.com/downloads

## Required before any import
1. Obtain a legally usable source with actual tile, item, floor and spawn data.
2. Validate the source's Tibia version and compare 7.4 to 7.6 around Rookgaard.
3. Decode OTBM using a verified parser, including tile positions and item IDs.
4. Map original item IDs to the game's `THINGS` definitions; report unmapped IDs rather than silently replacing them.
5. Translate Tibia Z levels (surface Z=7) to game floors (surface Z=4), and verify floor direction.
6. Preserve ladders, stairs, holes, doors, containers, teleports and quest attributes.
7. Export `tilequest-map-4` JSON, and validate walkability, cave connectivity and entrance/exit routes.
8. Test in editor/game before replacing the built-in map or publishing.

## Guardrails
- Do not claim exact 7.6 fidelity until verified against a 7.6 reference.
- Do not overwrite the production world with an incomplete reconstruction.
- Do not copy a minimap image as a substitute for editable tile data.
