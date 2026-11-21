# SORTIA UI-kit · Ontwikkelaarsdocumentatie

## Aansluiten

Laad in deze volgorde `Design Tokens/sortia-brand.css`, `Design Tokens/sortia-ui.css` en `UI Components/sortia-components.css`. Plaats de componenten binnen een element met `class="sui"`. De merken-CSS laadt `Typography/fonts.css`. Gebruik `UI Components/voorbeeldmarkup.md` en `UI_Kit.html` om specifieke markup over te nemen. Injecteer `Iconography/interface-sprite.svg` inline voor `<use href="#ico-[naam]">`, of gebruik een afzonderlijk SVG-bestand.

| Component | Classes en states |
| --- | --- |
| Primair, secundair, bevestigen, annuleren, destructief | `.sui-button.sui-frame`; `--primary`, `--secondary`, `--danger`; echte `:hover`, `:active`, `:focus-visible`, `:disabled` |
| Pijlen en sluiten | `.sui-icon-button`; beschrijvend `aria-label` |
| Tabbladen | `.sui-tabs`, `.sui-tab-panel`; `aria-selected`, roving tabindex, pijlen/Home/End |
| Invoer en selectie | `.sui-field`; echte labelbinding, `aria-invalid` en beschreven foutmelding |
| Vocation-kaart | `.sui-choice.sui-frame`; `aria-pressed`, zichtbaar vinkje; Bastion, Hawk en Ember gebruiken hun eigen illustratie en semantiek |
| Tooltip | `.sui-tipwrap`, `.sui-tooltip`; muis, focus en tik, sluiten met Escape of tik elders |
| Modal, bevestiging, waarschuwing, NPC, kaartvergroting, loot | `.sui-dialog` met native `<dialog>`; open met `showModal()`, focus naar begin, herstel naar opener, Escape of sluitknop |
| Progress, HP/Mana/EXP | `.sui-progress` met native `<progress>`, `data-resource` en zichtbare waarden naast de balk |
| Scrollbar | `.sui-scroll` op bijvoorbeeld chat; behoud native scroll en toetsenbordtoegang |
| Carrouseldots en pijlen | `.sui-pagination`, `.sui-page-dot`; `aria-current`, minimum 44px per doel |
| Kaders, vaandels, perkament, paneel, ornament | `.sui-frame`, `.sui-banner`, `.sui-paper`, `.sui-stone`, `.sui-ornament`, `.sui-divider` |
| Inventory, equipment, spellslots en zeldzaamheid | `.sui-slot`, `.sui-rarity[data-rarity]`; tekstlabel, zichtbare stack of afkoeling; decoratief voorwerpbeeld als `alt=""` bij een gelabelde knop |
| Action bar, Smart Button | `.sui-actionbar`, `.sui-smart`; Smart Button heeft een zichtbare glyph en een actielabel voor hulpsoftware |
| Minimap | `.sui-minimap`, met gelabelde knop voor kaarttoegang |
| Chat | `.sui-chat-log.sui-scroll`; `role="log"` voor toegevoegde regels, bericht invoeren via formulier |
| Quest tracker | `.sui-tracker`, gericht tekstlabel en numerieke voortgang |
| Combat en statuseffecten | `.sui-status[data-tone]`; icoon en leesbaar label, onafhankelijk van kleur |
| Lootrij | `.sui-loot-row`; pictogram, itemnaam, raritylabel, aantal en aparte vensteracties |

## Mobiel, PWA en desktop

Gebruik een aanraakdoel van minimaal 44 × 44 CSS-pixels. Zichtbare pictogrammen zijn meestal 20 px en functionele compacte glyphs 16 px. De action bar gebruikt drie vakken links, de Smart Button in het midden en drie vakken rechts. De laatste twee vakken zijn de vaste potions. HP, mana en EXP staan erboven. Minimap linksboven en chat bovenin blijven herkenbare onderdelen van de HUD.

Gebruik de CSS-safe-area-variabelen met `viewport-fit=cover` voor schermranden. Rond 48 rem en 75 rem wijzigt de typografie. In landscape met maximaal 500 px hoogte krijgen modals een interne scrollbar. Op een zeer smal scherm kan de voorbeeld-action bar horizontaal scrollen om de doelen beschikbaar te houden. De productie-inpassing van de HUD wordt in fase 4 beoordeeld.

## Materialen en hiërarchie

Gebruik het antiek gouden buitenkader rond belangrijke groepen. Laat tekstkaders, herhaalde gridcellen en scheidingslijnen soberder. Plaats textuur achter één rustige kleurlaag en bewaar ornament voor titels, hoekdetails en gekozen kaarten. De bordeauxstof en groene leerstaal zijn beschikbaar als materialen; knoppen gebruiken effen statekleuren voor contrast en snelheid.

Kaders gebruiken nine-slice. Het SVG-bronbestand is 96 × 96 met een slice van 20 eenheden. De PNG is 288 × 288 en gebruikt de overeenkomstige slice van 60 px. Gebruik rond een informatiepaneel circa 14 CSS-pixels border-image-breedte. Het midden is transparant. Zet achter een kader een zelfstandig oppervlak. Gebruik het perkament-PNG voor vaste verhoudingen en `.sui-paper` voor variabele teksthoogte. Texturen zijn vlakke materiaalstalen, geschikt voor cover of beperkt gebruik.

De laagvolgorde staat in de tokens. De native dialoglaag heeft voorrang op gestapelde game-elementen. De HTML-demo activeert de native dialoglaag en heeft gescheiden lokale feedback. Laat de bestaande game beslissen over gevecht, praten, looten en beschikbare context. De demo gebruikt vier handmatig gekozen situaties voor visuele controle.

## Assetregels

- Bestandsnamen in kleine letters en kebab-case. Decor in `UI Components/Decorations`, materiaal in `Textures`, functies in `Iconography/Interface` en geschilderde assets in `Iconography/Items and Spells`.
- Functionele iconen delen een 24 × 24-grid, een lijn van 1,65 px en `currentColor`. Houd ze monochroom. Geschilderde item- en spreukiconen gebruiken 192 × 192 PNG-alpha en belichting van linksboven.
- Zet labels in HTML. Houd textuur-, decor- en icoonbestanden tekstvrij op het doek. Gebruik gekopieerde woordmerk- en zegelmasters uit fase 1 voor merkaanduidingen.
- Gebruik gecomprimeerde WebP-materialen, één sprite per view en zo nodig lagere illustratieresoluties. Gebruik geen doorlopende filters of decoratieve animaties. Respecteer `prefers-reduced-motion`.

## Correctie op basis van de definitieve referentie

Gebruik `Preview/Reference/vocation-source.jpg` bij iedere visuele vergelijking. Raadpleeg `Preview/Reference/Richtlijn_voor_Claude.html` voor x/y- en breedte-/hoogtematen van het ontwerp. De getoonde compositie heeft een hoog gewelfd vaandel, drie uitgesproken portretten met eigen medaillons, zijkaarten met zichtbare namen, een doorlopend perkamentvlak met twee kolommen en een diepgroene knop die de onderste papierrand overlapt.

- Gebruik `.sui-banner` voor ceremoniële titels met live tekst. De gebruikte vaandelafwerking staat in `banner-burgundy-textured.png` en `.webp`.
- Gebruik `.sui-paper` met de nieuwe `parchment-panel-textured.webp`. Het CSS-frame gebruikt een slice van 86 bronpixels met een weergavebreedte van 24 CSS-pixels en vult het leesvlak. Het PNG levert ook een vaste decoratieve export met alpha.
- Gebruik `.sui-button--ceremonial` samen met `.sui-button` voor een eenmalige hoofdactie met een lang, ingesneden silhouet. Gebruik de schaalbare dubbele goudrand voor gewone acties, geselecteerde kaarten en kleinere slots. De oudere vlakke decorvarianten staan in de map als vereenvoudigde vormen voor compacte toepassingen.
- Gebruik in de carrousel zichtbare labels voor de zijkaarten, linkse en rechtse pijlknoppen met doelen vanaf 44 CSS-pixels, en indicatoren onder de groene knop. De componentproef houdt levende tekst en interactieve bediening los van de visuele assets.
- Voor zichtbaar merkgebruik geldt de goedgekeurde O-master. In vergelijkingsmateriaal blijven historische emblemen zichtbaar omdat ze tot de referentie behoren.

CSS en HTML uit dit pakket zijn componentvoorbeelden. De game bepaalt zelf wanneer een keuze kan worden opgeslagen en welke ondertitels, sterktes, zwaktes en startitems een klasse krijgt.

## Gebogen vaandeltitel

Plaats de titel als live SVG-tekst op een `textPath`. De boog voor dit vaandel gebruikt `viewBox="0 0 670 142"` en `M46 97 Q335 53 624 97`. Centreer met `startOffset="50%"` en `text-anchor="middle"`. Geef elk vaandel een eigen pad-ID en houd de titel toegankelijk via de omringende kop. Houd het vaandel en het SVG-element op dezelfde afmetingen. Controleer bij een langere vertaling of de volledige titel op het pad past.
