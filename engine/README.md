# Stonetree world core v1

New independent engine; existing index.html remains unchanged.

- Coordinates: signed integer X/Y and Z 0–15; Z 7 is ground.
- Sparse 32×32 tile chunks keyed by X/Y/Z. Chunk size is a Stonetree choice, **not** a Tibia binary map-file requirement.
- A present tile has exactly one ground item, ordered static items, ordered movable items, at most one creature, and effects.
- Walking, projectile blocking and line-of-sight flags are independent.
- Movable stack cap: 100 (configurable in a later iteration). Full stacks reject additions without deleting old items.
- Missing tiles are not walkable.
- Rendering, networking, persistence, pathfinding and map import are **not implemented yet**.

## Sources and distinction
TibiaMaps https://tibiamaps.io/guides/map-file-format describes **Tibia 10 client automap cache**, not the complete server world format. Its 256×256 areas and friction bytes are not a required format for Stonetree.

Stack ordering and game rules are Stonetree design choices informed by the supplied description, not a claim of exact Tibia 7.8 parity.

## Test
`node --test engine/world-core.test.mjs`
