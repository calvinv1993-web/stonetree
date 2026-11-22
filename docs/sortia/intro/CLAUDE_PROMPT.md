# SORTIA — The Broken Seal onboarding

Implementeer deze intro in de bestaande game. Bekijk eerst `index.html` en doorloop de demo offline. Open `index.html?art=sketch` voor de schetsvariant. In deze oplevering staat de geschilderde versie standaard aan. De gebruiker kan de schetsvariant aanwijzen als definitieve richting. Beide gebruiken dezelfde tekst en navigatie. Houd de variantkeuze als projectinstelling, buiten de onboarding-UI.

## Volgorde

1. The Broken Seal, The Hollow Host, The Last Crossing, The False Signal.
2. Sister Ama vraagt de naam. Valideer die met de bestaande regels en gebruik de bestaande state. Toon de fout bij het veld als de naam niet geldig is en houd de invoer beschikbaar.
3. Na invoer volgen de drie dialoogstappen uit `intro.js`. Eerst vertelt Ama waarom dezelfde wachters terug zijn gegaan. Daarna stuurt ze iemand naar de poort om te waarschuwen. Als laatste legt ze de drie functies van de wacht uit en nodigt ze de speler uit een pad te kiezen.
4. **Choose Your Path** opent de bestaande interactieve vocation-pagina. Gebruik de bestaande Hawk/Bastion/Ember IDs, opslag, bevestiging en terugkeer. De screenshot die de demo aan het einde toont, is de visuele referentie. Gebruik in de game de huidige interactieve component.

## Gedrag en ontwerp

- Gebruik de bestaande route voor nieuwe spelers of personages. Behoud de hervatlogica voor bestaande spelers en de huidige lifecycle rond aanmaken en bevestigen.
- **Skip intro** brengt de speler naar het naamscherm. Behoud verder, terug en swipe op de vier verhaalkaarten. Wijzig een scherm alleen bij een bedoelde horizontale swipe. Verticaal scrollen werkt op korte schermen. Het naamveld heeft een zichtbaar label en blijft bruikbaar met het mobiele toetsenbord.
- Gebruik de woordmarkering, afzonderlijke WebP-illustraties, live HTML-tekst, Cinzel voor titels en Inter voor lopende tekst. Houd de donkere onderste gradient, veilige schermranden en een rustige overgang met ondersteuning voor verminderde beweging.
- Gebruik `intro.js` als kopij- en interactiereferentie. `Verhaalreferentie.md` bevat ook achtergrondinformatie die pas later wordt onthuld. Voeg die spoilers niet toe aan de openingskaarten. Scope de stijlen tot de onboarding en hergebruik bestaande UI- en navigatiecomponenten waar ze passen.
- Test minimaal 320 en 393 CSS-px breed, plus een korte viewport. Controleer iPhone Safari/PWA als die beschikbaar is. Controleer skip, terug, swipe, toetsenbord, naamfouten, het overdragen van de naam en het openen en bevestigen van de echte vocation-keuze. Houd gameplay, wereldkaart en camera buiten deze wijziging.
