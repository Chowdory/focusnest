# Focus Nest — Implementierungs- und Designplan

## Produktumfang
Focus Nest ist eine mobile Fokus-Timer-App mit gemütlicher Stimmung. Sie verbindet Pomodoro-Sitzungen mit anpassbaren Fokus- und Pausenlängen, eine Aufgabenliste für aktuelle Arbeiten, einen Umgebungsgeräusch-Mixer mit Regen, Café, Kamin und Wellen sowie eine illustrierte Zimmeransicht, die sich abhängig von der Tageszeit von Tag zu Nacht verändert. Die Woche wird als Anzahl abgeschlossener Fokus-Sitzungen sichtbar gemacht.

## Technische Umsetzung
- **Stack:** Der fixierte Expo Router / React Native / TypeScript / NativeWind-Starter bleibt erhalten; die zentrale Oberfläche lebt in `app/(tabs)/index.tsx`.
- **Zustand:** Der Timer läuft lokal über `useEffect` und `setInterval`. Aufgaben, Einstellungen, Sound-Mix und Sitzungszähler werden mit `@react-native-async-storage/async-storage` unter einem versionierten Schlüssel gespeichert, damit die App ohne zusätzliche Zugangsdaten und ohne Netzwerkabhängigkeit nutzbar bleibt.
- **Timer:** Fokus- und Pausenlänge werden über ein kleines Einstellungs-Panel angepasst. Start, Pause/Fortsetzen und Zurücksetzen sind portrait-tauglich und mit einer verknüpften aktiven Aufgabe sichtbar. Beim Ablauf wechselt der Modus automatisch; abgeschlossene Fokusläufe erhöhen die aktuelle Wochenstatistik.
- **Aufgaben:** Inline-Eingabe erstellt Aufgaben. Tippen auf den Kreis hakt ab, Löschen entfernt. Eine Aufgabe kann als aktive Fokusaufgabe gewählt werden und wird im Timer-Chip angezeigt.
- **Sound-Mixer:** Vier lokale Mixer-Zeilen zeigen Icon, Name, Ein-/Aus-Schalter und Lautstärke-Slider. Die vier kurzen, lizenzfreien WAV-Loops in `assets/audio/` werden über `expo-audio` geladen, geloopt, mit separater Lautstärke gesteuert und nur nach einer Nutzerinteraktion abgespielt, damit Browser-Autoplay-Regeln respektiert werden.
- **Zimmerillustration:** Das Zimmer wird mit React-Native-Views, Farbflächen, Fenstern, Pflanzen-, Schreibtisch- und Lampenformen gezeichnet. Die Palette ergibt sich aus der lokalen Stunde: tagsüber warme Himmel-/Sonnenfarben, abends tiefes Blau mit Mond und kleinen Sternen. Der Timerbereich sitzt als ruhiger „Schreibtisch“-Fokuspunkt in dieser Szene.
- **Navigation:** Eine einzelne Home-Ansicht vermeidet unnötige Tab-Komplexität und hält die wichtigste Aktion thumb-reichweite-nah.
- **Branding:** Eine eigene quadratische Focus-Nest-Launcher-Ikone ohne eingebrannte Rundung wird für alle Expo-Asset-Varianten erzeugt und in `app.config.ts` referenziert.

## Designoptionen
- **Nordic Hygge Dashboard** — helle Holz-, Leinen- und Petrolflächen mit stiller Produktivität. (0,07)
- **Moonlit Storybook Room** — sanfte, handillustrierte Farbflächen, Nachtblau, Amberlicht und kleine narrative Details. (0,06)
- **Café Notebook Utility** — cremefarbenes Papier, Tintenlinien und kräftige Kaffeebraun-Akzente. (0,04)

### Gewählte Richtung: Moonlit Storybook Room

- **Design Movement:** Editoriale Storybook-Illustration trifft ruhiges Mobile Utility Design; die App fühlt sich wie ein kleines Zimmer an, in dem man gern bleibt.
- **Core Principles:** (1) Eine klare Hauptaktion pro Moment, (2) Stimmung entsteht durch Licht statt Dekoration, (3) Status wird als freundliches Objekt statt als technische Warnung gezeigt, (4) jede Einstellung bleibt mit einem Tap erreichbar.
- **Color Philosophy:** Tiefes Tintenblau und gedämpftes Salbeigrün bilden die ruhige Grundfläche. Warmes Apricot und Lampenamber markieren aktive Momente, während Papiercreme Lesbarkeit und Behaglichkeit geben.
- **Layout Paradigm:** Ein vertikaler „Zimmerblick“ statt Dashboard-Raster: Szene oben, Timer als Schreibtischkarte im Vordergrund, Aufgaben und Sounds als aufeinanderfolgende Wohnungsdetails darunter.
- **Signature Elements:** Fenster mit wechselndem Himmel, amberfarbene Fokuslampe, kleine runde Sitzungs-Punkte als Wochenlichter.
- **Interaction Philosophy:** Schalter und Chips fühlen sich wie kleine Gegenstände im Zimmer an; große, abgerundete Touch-Ziele geben Sicherheit, ohne laut zu wirken.
- **Animation:** Nur kurze, ruhige Übergänge: Lampen-/Himmelswechsel beim Tageszeitwechsel, sanftes Pulsieren des Timer-Rings während des Laufens, keine dauerhafte Bewegung in Listen.
- **Typography System:** System-Sans für verlässliche mobile Lesbarkeit; große semibold Zeitwerte, kompakte uppercase Mikro-Labels mit leichtem Tracking, normale Textzeilen in warmem Weiß/Creme.
- **Brand Essence:** Ein ruhiger digitaler Raum, der Fokusarbeit in ein kleines tägliches Ritual verwandelt — persönlich, warm, unaufdringlich.
- **Brand Voice:** Freundlich, konkret, leise ermutigend. Beispiele: „Ein kleiner Schritt, dann wird es leichter.“ und „Dein Zimmer ist bereit für 25 ruhige Minuten.“
- **Wordmark & Logo:** Ein Nest aus zwei geschwungenen Linien mit einem kleinen Fensterpunkt als „Ei“; die Wortmarke „Focus Nest“ steht daneben in einer weichen, kompakten Sans.
- **Signature Brand Color:** Lampenamber `#F4B36A` — der wiedererkennbare warme Lichtpunkt der App.

## Projektstruktur
- `app/(tabs)/index.tsx`: Home-Screen, Timer, Zimmerillustration, Aufgaben- und Sound-Sektionen, Interaktionen.
- `app/(tabs)/_layout.tsx`: Mobile-Navigation und ruhige App-Chrome-Konfiguration.
- `components/`: nur wiederverwendbare Starter-Komponenten; produktnahe UI bleibt zunächst zusammenhängend, damit die visuelle Komposition schnell iterierbar bleibt.
- `app.config.ts`: Focus-Nest-Branding und unveränderte Bundle-/Scheme-IDs.
- `assets/images/`: Launcher-, Splash-, Android- und Favicon-Varianten.
- `plan.md`, `TODO.md`: genehmigte Richtung und laufende Outcome-Dokumentation.

## Material- und Laufzeitgrenzen
Es werden keine externen Bild- oder Audio-Downloads benötigt. Die Zimmerillustration ist deterministisch aus React-Native-Views gebaut; die Soundkanäle verwenden kleine lokale WAV-Loops. Die vorhandene Datenbank bleibt ungenutzt, weil der Blueprint die dauerhafte Speicherung als optional markiert hat und lokale Fortschrittsspeicherung für diesen persönlichen Timer ausreicht.
