# SORTIA · Bastion-lichtanimatie overnemen

Voeg deze map toe aan de Claude-sessie die bij de bestaande SORTIA-game kan. Plak de opdracht hieronder. De map preview bevat de zelfstandige HTML-proef en een MP4 met het gewenste eindbeeld.

## Opdracht voor Claude

> Implementeer de meegeleverde Bastion-lichtanimatie in het bestaande mobiele scherm “Choose Your Path” van SORTIA. Gebruik preview/bastion-motion-preview.mp4 om timing en compositie te vergelijken. Neem de laagopbouw en animaties uit de HTML-proef over in de bestaande schermcomponent.
>
> 1. Lees eerst de bestaande vocation-component en volg de projectinstructies. Vervang alleen de beeldlaag van Bastion door assets/bastion-background.webp en assets/bastion-character.png. Sluit aan bij de bestaande UI, klassedata, navigatie, bevestiging en safe areas.
> 2. Plaats achter Bastion de achtergrond met een trage, kleine perspectiefbeweging. Geef Bastion een korte, subtiele beweging bij binnenkomst. Laat warm licht in één passage van de rechterschouder richting het leeuwenschild lopen. Het eindbeeld blijft staan. Volg de meegeleverde timing. Deze richting gebruikt uitsluitend diepte en licht.
> 3. Isoleer CSS en gedrag tot Bastions beeldlaag. Laat de titel, classknoppen en bevestigingsknop op hun plek. Zorg dat beeldlagen geen invoer onderscheppen, respecteer prefers-reduced-motion en stop animaties wanneer het tabblad verborgen is. Laat het effect één keer afspelen per keer dat Bastion actief wordt.
> 4. Test op smalle en normale iPhone-breedtes en controleer uitlijning, bedienbaarheid en uitsnede. Toon een korte video of mobiele preview en noem de gewijzigde bestanden en uitgevoerde checks.

## Bestanden

| Bestand | Gebruik |
| --- | --- |
| assets/bastion-background.webp | Vesting en landschap · 852 × 1846 px |
| assets/bastion-character.png | Bastion vrijstaand · 1120 × 1568 px · RGBA |
| effect/bastion-motion.css | Exacte timing, transformaties en belichting uit de proef |
| effect/bastion-motion.js | Proefgedrag voor pauzeren, herhalen en minder beweging |
| preview/bastion-motion-preview.html | Zelfstandige, offline afspeelbare proef |
| preview/bastion-motion-preview.mp4 | Opname van de actuele lichtversie, 7 seconden |

## Technische vertaling naar de game

- De beeldlagen gebruiken CSS-transformaties en een gemaskeerde kopie van dezelfde Bastion-PNG. De lichtkopie gebruikt een radial-gradient en een helderheidsfilter. Het oorspronkelijke alfakanaal houdt het licht binnen het silhouet.
- De volgorde van achter naar voor is .scene-depth, .scene-sun, .hero, .hero-light, donkere overgang naar de UI en de bestaande interface. Gebruik position: relative, isolation: isolate, veilige randuitsnede, pointer-events: none op beeldeffecten en lokale laagindices.
- De proef gebruikt --castle-art als CSS-variabele voor de achtergrond. Positioneer de hero en lichtkopie met dezelfde afmetingen en hetzelfde anker. De proef staat in een viewport van 394 × 852 CSS-px. Het hoofd begint tussen de titel en kaartkeuze. Het schild valt aan de rechterkant, boven de classknoppen.
- De achtergrond loopt 7 s, de korte beweging van Bastion 1,6 s en de eenmalige lichtpassage 5,9 s. Gebruik de meegeleverde CSS-keyframes voor de exacte waarden. De tijdsbemonstering captureMotionPreview, grafische voorbeeldbediening en afspeelknop dienen uitsluitend de proef.
- Gebruik een statische compositie bij minder beweging. Bewaar de laagposities terwijl de assets laden en pas de uitsnede aan wanneer de viewport wijzigt.
