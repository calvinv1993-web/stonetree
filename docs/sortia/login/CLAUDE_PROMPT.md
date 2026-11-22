# SORTIA — loginpagina implementeren

Implementeer de mobiele en desktop-login uit dit pakket in de bestaande SORTIA-game. Open eerst `index.html` om **Log in** en **Create account** offline te bekijken. Gebruik `Referentie_Mobiel.png` als visuele referentie. De Oakvale-achtergrond, het woordmerk en de lettertypen staan los in `assets/`.

1. Zoek de bestaande accountinterface, routes en authenticatie. Vervang de presentatie van de inlog- en registratieweergave door deze UI. Hergebruik de bestaande velden, validatie, handlers en stappen zoals e-mailbevestiging waar die al bestaan. Het formulier in de demo heeft een lokale demo-handler in `login.js`. Koppel de productieformulieren aan de bestaande accountfuncties. Houd aanklikken, Enter en toetsenbordfocus werkend.
2. Behoud de bestaande beslissingen na inloggen, registreren en het herstellen van een sessie. Spelers die al een personage hebben, komen op hun huidige bestemming terecht. Gebruik voor een nieuw personage de bestaande route naar de intro van *The Broken Seal*. Behoud het bestaande laadscherm en de onboardingvolgorde.
3. Volg het ontwerp uit `index.html` en `login.css`. Op mobiel staat de illustratie boven het formulier. Op desktop staan beeld en formulier naast elkaar. Gebruik dezelfde versie van het SORTIA-logo, de subtitel en de kleuren. Scope de CSS tot de accountpagina, inclusief de generieke selectors en body-stijl uit de losse demo.
4. Geef tijdens aanmelden en registreren de bestaande laad- en foutfeedback op het formulier weer. Houd een verzoek tijdens verzending enkelvoudig, laat een gebruiker na een fout opnieuw proberen en gebruik de bestaande routes voor bevestiging of herstel als de game die aanbiedt.
5. Test login, registratie, ongeldige invoer, een mislukte poging, het terugschakelen tussen formulieren en de bestemming na succes. Controleer 320 en 393 CSS-px breed, desktop en waar mogelijk iPhone Safari/PWA met geopend toetsenbord en safe areas. Controleer ook dat een terugkerende speler met een bestaande sessie zijn gebruikelijke route behoudt.

Beperk de wijziging tot deze accountpagina en de aansluiting op de bestaande accountflow.
