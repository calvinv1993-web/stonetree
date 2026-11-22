# SORTIA — parallax voor de verhaalintro

Implementeer de kleurrijke parallaxscène uit dit pakket in de bestaande SORTIA-intro. Open eerst `index.html` als losse demo. Gebruik `preview-composite.png` om de samenstelling te bekijken. `asset-manifest.json` geeft de canvasmaat, laagvolgorde, posities, getoonde maten en kleine diepteverschuiving per asset.

## Assets

Het coördinatenstelsel is 2172 × 724. Iedere laag is afzonderlijk aangeleverd. De sky/mountain-plaat is WebP. De overige dertien lagen zijn echte RGBA-PNG’s. De gebouwen zijn verdeeld in drie bouwdelen die intern samen blijven bewegen. De reiziger, goblin, wolf en Sister Ama zijn elk apart. De kleine groepen op de brug en bij de molen zijn ook aparte lagen.

De illustraties zijn gereconstrueerd voor parallax. Gebruik de nieuwe compositie uit de demo en de plaatsingen uit het manifest. Het bijgevoegde originele panorama is een vergelijkingsbeeld. Sommige contouren en de afmetingen van de gebouwen en figuren wijken daarvan af.

## Camera en interactie

- Begin links bij het zegel. Een veeg met de vinger naar links gaat vooruit, met de camera naar rechts. Een veeg naar rechts gaat terug. Continue en terug doen hetzelfde. Gebruik de vijf genormaliseerde cameracentra uit het manifest als startpunten en begrens de camera zodat hij het doek blijft vullen.
- Beweeg één gedeelde wereldcontainer met een transform. De basisplaatsing van alle lagen volgt deze camera. Voeg alleen kleine extra diepteverschuivingen toe. In de demo zijn dit circa 0–8 pixels in wereldcoördinaten. Voorkom dat poorten loskomen van bruggen of dat figuren van hun ondergrond schuiven.
- Tijdens slepen volgt het beeld de vinger. Na loslaten landt het in circa 650 ms op het volgende kijkpunt. Een verticale swipe blijft bruikbaar om langere tekst te lezen. Handel pointercancel af en voorkom dubbel doorklikken of afgebroken camerabewegingen bij snelle invoer.
- Gebruik rustige parallax bij muisbeweging en een kleine extra laagverschuiving tijdens horizontaal slepen. Ondersteun reduced motion met directe overgang en stilstaande dieptelagen. Gyroscooptoegang is voor deze uitvoering niet nodig.
- Behoud de bestaande introcopy, navigatie, skip en zichtbare bediening uit de game. De korte teksten in deze assetdemo zijn kijkpuntlabels. De geschreven verhaalreferentie bevat ook spoilers voor later in de game.
- Bij Sister Ama stopt de camera. Koppel daar het bestaande naamveld en de dialoog aan. Daarna opent het bestaande interactieve Choose Your Path. Neem de bestaande opslag van naam en vocation over.

## Licht, sneeuw en beweging

De assets bevatten geschilderde sneeuw op oppervlakken en de basisverlichting van ramen, kaarsen en lantaarns. Voeg de afgesproken lichteffecten en vallende sneeuw apart toe. Houd basislicht en dynamische helderheid consistent. De PNG’s bevatten geen losse vonken- of mistlaag.

De figuren kunnen als geheel ruimtelijk meebewegen. Voor oogknipperen, afzonderlijke lichaamsbeweging of echte loopanimatie zijn aanvullende animatieframes of rigs nodig. Laat ze in deze implementatie in hun aangeleverde pose.

## Integratie en controle

Gebruik de bestaande projectstructuur en scope alle stijlen tot de intro. Houd beelden responsief, behoud verhouding en bepaal de uitsnede aan de hand van de kijkpunten. Open de preview op 320 en 393 CSS-px, op desktop en waar mogelijk op iPhone Safari/PWA. Controleer vooral alle randen tijdens het pannen, de twee lantaarns, de richting van de goblin, voeten en ondergrond, naamveld met toetsenbord, skip, teruggaan en de overgang naar de vocation-pagina.

Gebruik het bestaande laadproces en decodeer de benodigde beelden voordat ze zichtbaar worden. De totale transparante beelddata wordt groter in werkgeheugen dan op schijf. Behoud de native resolutie, vermijd onnodige opschaling en permanente animatielussen, en gebruik tijdelijke compositorlagen alleen tijdens beweging.

Lever de aangepaste bestanden en een korte beschrijving van de uitgevoerde controles op.
