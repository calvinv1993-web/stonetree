# Rookgaard temple reconstruction — reference audit

Status: **reference research only; not an approved visual reconstruction**.

## Verified
- Cipfried is the healer inside Rookgaard's temple, the traditional beginner spawn.
- The temple is near the village center. Historical versions of its architecture differ.
- Rookgaard temple is distinct from the Academy / Oracle building.
- Historical screenshots are needed to reconstruct actual tile positions rather than invent them.

## Sources
- https://tibiaguide.blogspot.com/2006/12/mortys-startup-guide.html — 2006 starting view and temple reference.
- https://rookie.com.pl/blogs/818/the-time-machine-edition-1 — compares temple details across versions.
- https://www.neoseeker.com/tibia/faqs/105540-rookgaard.html — temple location and function.
- https://forums.tibiabr.com/threads/303854-PR-Mapa-completo-de-Rookgaard — confirms temple and Cipfried.

## Implementation gate
1. Select a specific historical client version and a clear reference screenshot showing the target building.
2. Trace a tile-by-tile architectural map: boundaries, columns, floor, entry, collision, NPC location.
3. Create an original art asset sheet respecting that map and the chosen perspective.
4. Implement in an isolated route without altering production or saving state.
5. Verify rendered screenshots and actual touch movement, entry, collision and occlusion.
6. Only then integrate with the game.

Do **not** label the current architecture-lab or Lodge as a faithful Rookgaard reconstruction.