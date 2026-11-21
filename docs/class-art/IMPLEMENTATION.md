# Lickii Adventures — Class selection redesign

## Scope
Redesign only the existing Choose your path screen. Inspect the repository and current class definitions first. Reuse the newly developed ParchmentPanel, existing navigation, localization and character creation state. Do not change gameplay, class balancing, quests, HUD, character naming, outfit editor or saved player data. If the parchment work is still in progress, coordinate with it and avoid overwriting its changes.

## Assets
- assets/bastion.webp, hawk.webp, ember.webp: full illustrated portraits with backgrounds; use as card artwork, not transparent sprites.
- assets/bastion-emblem.png, hawk-emblem.png, ember-emblem.png: individual transparent crests.
- source/: original PNG artwork and emblem sheet for archival use.
- references/mobile-concept.webp and desktop-concept.webp: visual mockups only. Do not display these as functional UI or copy their Dutch text, TileQuest branding, invented sprites or unverified attributes.

## Layout
Use the existing class-selection temple background and official Lickii Adventures branding. Keep all interface copy in English. On portrait phones show one dominant class card, with narrow previews of adjacent classes only if space permits. Support swipe, previous/next buttons and direct class selection via tabs or dots; keyboard navigation on desktop. On wider screens display three cards side by side. Keep artwork proportions using object-fit and individually adjusted object-position; never stretch. Use restrained antique-gold selected borders, class crests and a compact parchment details panel. Avoid excessive glow and decoration.

## Content
Show class name, combat style, short description, up to three strengths, one weakness and starting equipment. Use existing class definitions as source of truth. Bastion is melee, Hawk is ranged, Ember is magic. Do not invent stats, movement bonuses, equipment, abilities or suitability categories from the mockups. The illustrations represent class fantasy, not the player's actual gender, outfit or starting equipment. If a sprite preview is included, use actual existing game assets and selected appearance.

Use a stable bottom CTA: Choose Bastion / Choose Hawk / Choose Ember. Provide Back to appearance without losing state. Browsing must not commit a class. Confirm before final selection, preserving existing persistence and game-start logic; prevent duplicate submissions.

## Mobile and performance
Respect safe-area insets and dynamic viewport units. Test 320, 375, 390 and 430 CSS px plus landscape, tablet and desktop. Minimum 44px controls, no horizontal page overflow, no clipped text or hidden CTA; allow vertical scrolling on short screens. Keep navigation position stable, support reduced motion, focus indicators and accessible labels. Use WebP portraits and PNG crests, preload active/adjacent artwork, avoid expensive blur and new dependencies.

## Execution
1. Inspect current screen, class data and parchment component; integrate assets.
2. Build responsive class carousel and desktop layout, preserve selection flow.
3. Verify all three classes, swipe/buttons, Back, confirmation, persistence, keyboard and responsive rendering; run existing tests.
4. Report modified files, actual test results and screenshots of each class on mobile and desktop. Deploy to existing test environment if available and authorized. Stop for visual approval; do not redesign other screens.
