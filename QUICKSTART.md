# 🚀 DMX Web Controller - Schnellstart für Anfänger

Willkommen! Diese Anleitung führt dich Schritt für Schritt durch die Einrichtung deines DMX Web Controllers.

---

## 📋 Was du brauchst

### Hardware
- **Computer/Server** mit Docker (oder Python 3.11+)
- **DMX-Interface** mit Art-Net Support, z.B.:
  - Raspberry Pi mit [OLA](https://www.openlighting.org/ola/) (Open Lighting Architecture)
  - USB-DMX-Interface (ENTTEC, DMXKing, etc.)
  - Art-Net Node (z.B. Artnet 4, DMXKing eDMX1)
- **DMX-Lichtgeräte** (Dimmer, RGB-Leuchten, Moving Heads, etc.)
- **Netzwerk** - Alle Geräte im gleichen Netzwerk

### Software
- **Docker Desktop** (empfohlen) ODER
- **Python 3.11+** für lokale Installation

---

## 🎯 Installation - 3 Wege

### Option 1: Docker (EMPFOHLEN für Anfänger)

```bash
# 1. Repository herunterladen
git clone https://github.com/IT-Networks/Dmx-Web-Controller.git
cd Dmx-Web-Controller

# 2. Container starten
docker-compose up -d

# 3. Browser öffnen
# Gehe zu: http://localhost:8000
```

**Fertig!** 🎉

---

### Option 2: Python (Ohne Docker)

```bash
# 1. Repository herunterladen
git clone https://github.com/IT-Networks/Dmx-Web-Controller.git
cd Dmx-Web-Controller

# 2. Dependencies installieren
cd backend
pip install -r requirements.txt

# 3. Server starten
python main.py

# 4. Browser öffnen
# Gehe zu: http://localhost:8000
```

---

### Option 3: Direkt ausprobieren (Demo-Modus)

Wenn du noch keine DMX-Hardware hast, kannst du den Controller trotzdem testen!

```bash
# Wie Option 2, aber:
python main.py
# Öffne http://localhost:8000
# Füge Geräte mit beliebigen IPs hinzu (z.B. 192.168.1.100)
# Die DMX-Pakete werden gesendet, auch wenn kein Empfänger da ist
```

---

## 🎬 Deine ersten Schritte

### Schritt 1: Erstes Gerät hinzufügen

1. **Klicke auf "+ Gerät hinzufügen"** im Header
2. **Wähle aus der Fixture Library** (z.B. "Stairville LED PAR")
   - ODER wähle "Manuell konfigurieren" für generische Geräte
3. **Fülle die Felder aus:**
   - **Name**: z.B. "Bühnenlicht Links"
   - **IP-Adresse**: IP deines Art-Net Nodes (z.B. `192.168.1.100`)
   - **Universe**: `0` (Standard)
   - **Start-Kanal**: `1` (erster DMX-Kanal, 1-512)
4. **Klicke "Hinzufügen"**

**Tipp:** Wenn du die IP deines Art-Net Nodes nicht kennst:
- Schaue im Router nach verbundenen Geräten
- Bei OLA: Standardmäßig läuft es auf dem gleichen Rechner → `127.0.0.1`
- Bei Raspberry Pi: Finde die IP mit `hostname -I` im Terminal

---

### Schritt 2: Licht steuern

1. **Bewege die Slider** auf deiner Gerätekarte
2. **Die Änderungen werden sofort** an die DMX-Hardware gesendet
3. **Öffne die Seite in mehreren Browsern** - alle Updates sind live!

**Kanäle erklärt:**
- **Dimmer (1 Kanal)**: Ein Slider für Helligkeit (0-255)
- **RGB (3 Kanäle)**: Rot, Grün, Blau
- **RGBW (4 Kanäle)**: Rot, Grün, Blau, Weiß

---

### Schritt 3: Erste Szene erstellen

1. **Stelle deine gewünschte Lichtstimmung ein** mit den Slidern
2. **Klicke auf "+ Szene erstellen"**
3. **Gib einen Namen ein**, z.B. "Gottesdienst Einzug"
4. **Wähle eine Farbe** zur visuellen Kennzeichnung
5. **Klicke "Szene erstellen"**

**Szene aktivieren:**
- Klicke einfach auf die Szenen-Karte
- Das System macht einen 2-Sekunden Fade zur gespeicherten Stimmung

---

### Schritt 4: Gruppe erstellen (mehrere Geräte steuern)

1. **Gehe zum "Gruppen"-Tab** in der Sidebar
2. **Klicke "+ Gruppe erstellen"**
3. **Name eingeben**, z.B. "Alle Bühnenlichter"
4. **Wähle die Geräte aus**, die zur Gruppe gehören
5. **Klicke "Gruppe erstellen"**

**Gruppensteuerung:**
- Master-Slider steuert alle Geräte gleichzeitig
- Perfekt für schnelle Helligkeitsanpassungen

---

### Schritt 5: Effekt starten

1. **Gehe zum "Effekte"-Tab**
2. **Wähle einen Effekt** aus der rechten Sidebar:
   - **Stroboskop** ⚡ - Blitzeffekt
   - **Regenbogen** 🌈 - Farbwechsel
   - **Lauflicht** 🔄 - Sequentiell
   - **Feuer** 🔥 - Flackernder Feuereffekt
   - **Blitz** ⚡️ - Zufällige Blitze
   - **Scanner** 🔦 - Moving Head Bewegung
   - **Matrix** 📊 - 2D Grid Patterns
   - **Funkeln** ✨ - Glitzereffekt
3. **Wähle Zielgeräte** (einzelne Geräte oder Gruppen)
4. **Passe Parameter an** (Geschwindigkeit, Intensität, etc.)
5. **Klicke "Speichern & Starten"**

**Sound-Reactive Effects:**
- Aktiviere "Sound Reaktiv"
- Effekt reagiert auf Musik (Beat Detection)
- Perfekt für Live-Musik oder DJ-Sets

---

### Schritt 6: Eigene Effekte erstellen (Visual Effect Designer)

Der Visual Effect Designer ermöglicht es dir, eigene keyframe-basierte Effekte zu erstellen!

**Spot Mode - Für einzelne Lichter:**

1. **Öffne den Designer**
   - Gehe zum "Effekte"-Tab
   - Klicke auf **"🎨 Custom Designer"** in der Effekt-Vorlagen Sidebar

2. **Grundeinstellungen**
   - **Name**: z.B. "Mein Sonnenaufgang"
   - **Modus**: Wähle "Spots (Einzellichter)"
   - **Geräte**: Wähle die Zielgeräte aus
   - **Dauer**: z.B. 10 Sekunden

3. **Keyframes bearbeiten**
   - **Timeline**: Klicke auf die Timeline um Keyframes hinzuzufügen
   - **Farbe wählen**: Nutze den Color Picker oder RGB-Inputs
   - **Easing**: Wähle die Übergangsart (Linear, Ease-In, Ease-Out, Ease-In-Out)
   - **Zeit**: Positioniere den Keyframe auf der Timeline (0-100%)

4. **Vorlagen nutzen (Empfohlen für Anfänger)**
   - **Fade**: Sanftes Ein- und Ausblenden
   - **Pulse**: Atmender Pulseffekt
   - **Farbwechsel**: RGB-Farbzyklus
   - **Stroboskop**: Schnelles Blinken

5. **Preview & Speichern**
   - Klicke **▶️ Play** um die Animation in der Timeline zu sehen
   - Klicke **"💾 Speichern & Starten"** um den Effekt zu aktivieren

**LED Strip Mode - Für LED-Streifen:**

1. **Modus wechseln**: Wähle "LED Strips" statt "Spots"

2. **Pattern auswählen**:
   - **Einfarbig (Solid)**: Gleichmäßige Farbe über alle Pixel
   - **Gradient**: Sanfter Farbverlauf
   - **Welle (Wave)**: Sinuswellen-Muster (einstellbare Wellenlänge)
   - **Lauflicht (Chase)**: Bewegendes Licht (einstellbare Breite & Geschwindigkeit)

3. **Pattern-Parameter einstellen**:
   - **Wave**: Wellenlänge (5-50), Amplitude (0-255)
   - **Chase**: Breite (1-20), Geschwindigkeit (0.5-10)
   - **Gradient**: Startfarbe, Endfarbe

4. **Keyframes für Strip-Patterns**:
   - Jeder Keyframe kann ein anderes Pattern haben
   - Z.B.: Start mit Gradient → Mitte mit Wave → Ende mit Chase

**Pro-Tipps:**
- 🎨 Nutze Vorlagen als Ausgangspunkt und passe sie an
- ⏱️ Die Timeline zeigt 0-100% - unabhängig von der Gesamtdauer
- 🔄 Kombiniere verschiedene Easing-Funktionen für interessante Effekte
- 📊 Strip Patterns sind ideal für lange LED-Streifen und Pixel-Bars
- 💾 Gespeicherte Custom Effects erscheinen in der Effekt-Liste

---

### Schritt 7: Timeline erstellen (Automatische Abläufe)

1. **Gehe zum "Timeline"-Tab**
2. **Klicke "+ Timeline hinzufügen"**
3. **Name eingeben**, z.B. "Gottesdienst Ablauf"
4. **Füge Steps hinzu:**
   - **Szene hinzufügen** → Wähle Szene + Dauer (z.B. 30 Sekunden)
   - **Effekt hinzufügen** → Wähle Effekt + Dauer
   - **Pause hinzufügen** → Wartezeit zwischen Steps
5. **Optional: "Endlos wiederholen"** aktivieren
6. **Klicke "Speichern"**

**Timeline abspielen:**
- Klicke den ▶️ Play-Button auf der Timeline-Karte
- Perfekt für wiederkehrende Events

---

## 🎵 Audio-Reaktive Features

### Beat Detection einrichten

1. **Im Effekt-Editor**: Aktiviere "Sound Reaktiv"
2. **Wähle Frequenzband:**
   - **Bass** 🔊 - Kickdrum, Bassgitarre (20-250 Hz)
   - **Mid** 🎸 - Vocals, Gitarre (250-2000 Hz)
   - **High** 🎺 - Cymbals, Hi-Hat (2000-20000 Hz)
   - **Overall** 🎵 - Gesamte Energie
3. **Wähle Modus:**
   - **Intensity** - Helligkeit folgt Lautstärke
   - **Color** - Farbe ändert sich mit Frequenz
   - **Strobe** - Blitze auf Beats
4. **Sensitivität anpassen** (0.1 - 3.0)

**Audio-Control-Panel:**
- Wird automatisch angezeigt wenn sound-reactive Effect aktiv ist
- Echtzeit-Visualisierung der Frequenzen
- Praktisch zum Fine-Tuning der Parameter

---

## 🔧 Problemlösung

### "Keine Verbindung zum Server"

**Lösung:**
```bash
# 1. Server-Status prüfen
docker ps  # (bei Docker)
# ODER
ps aux | grep python  # (bei Python)

# 2. Neustart
docker-compose restart  # (bei Docker)
# ODER
python main.py  # (bei Python)

# 3. Port prüfen
netstat -tlnp | grep 8000
```

---

### "Gerät reagiert nicht"

**Checkliste:**
- ✅ Ist das DMX-Interface eingeschaltet?
- ✅ Ist die IP-Adresse korrekt?
- ✅ Sind Controller und DMX-Interface im gleichen Netzwerk?
- ✅ Ist das richtige Universe eingestellt?
- ✅ Stimmt der Start-Kanal?
- ✅ Ist die Firewall deaktiviert oder Port 6454 (UDP) offen?

**Art-Net Port testen:**
```bash
# Linux/Mac
sudo tcpdump -i any udp port 6454

# Dann im Controller einen Slider bewegen
# Du solltest Art-Net Pakete sehen
```

---

### "Slider bewegt sich, aber Licht geht nicht an"

**Häufigste Ursachen:**

1. **Falscher Start-Kanal**
   - Prüfe im Handbuch deines Geräts
   - Viele Geräte starten bei Kanal 1

2. **Falsches Universe**
   - Standard ist Universe 0
   - Prüfe die Einstellung am DMX-Interface

3. **Netzwerk-Broadcast Problem**
   ```bash
   # Docker: Stelle sicher, dass network_mode: bridge ist
   # Oder nutze host mode:
   docker run --network host dmx-controller
   ```

4. **Art-Net vs. sACN**
   - Dieser Controller nutzt Art-Net
   - Dein Interface muss Art-Net unterstützen (nicht nur sACN)

---

### "Effekte sind zu schnell/langsam"

**Lösung:**
1. Gehe zum Effekte-Tab
2. Klicke auf den laufenden Effekt
3. Passe die Speed-Parameter an
4. Klicke "Aktualisieren"

---

### "Beat Detection funktioniert nicht"

**Checkliste:**
- ✅ Ist das Audio-Control-Panel sichtbar?
- ✅ Bewegen sich die Frequenzbalken wenn Musik spielt?
- ✅ Ist das Mikrofon im Browser freigegeben?
- ✅ Sensitivität hoch genug? (versuche 2.0)

**Browser-Mikrofon freigeben:**
- Chrome: Klicke auf das Schloss-Symbol in der Adresszeile
- Erlaube Mikrofon-Zugriff
- Seite neu laden

---

## 📚 Weiterführende Ressourcen

### Art-Net Guides
- [Art-Net Basics](https://art-net.org.uk/)
- [OLA Installation](https://www.openlighting.org/ola/getting-started/)
- [DMX Addressing Guide](https://www.learningaboutelectronics.com/Articles/DMX-addressing.php)

### API Dokumentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Community
- **GitHub Issues**: [Probleme melden](https://github.com/IT-Networks/Dmx-Web-Controller/issues)
- **Discussions**: [Fragen stellen](https://github.com/IT-Networks/Dmx-Web-Controller/discussions)

---

## 🎓 Häufig gestellte Fragen (FAQ)

### Kann ich mehrere Universen nutzen?
**Ja!** Jedes Gerät kann ein eigenes Universe haben (0-15). DMX unterstützt bis zu 512 Kanäle pro Universe.

### Brauche ich spezielle Hardware?
**Art-Net fähiges DMX-Interface** ist notwendig. Ein Raspberry Pi mit OLA ist eine günstige Lösung (~50€).

### Funktioniert es mit WLAN?
**Ja, aber Ethernet wird empfohlen** für stabile, latenzfreie Steuerung bei Live-Events.

### Kann ich mehrere Browser gleichzeitig nutzen?
**Ja!** WebSocket synchronisiert alle verbundenen Clients in Echtzeit.

### Unterstützt es Moving Heads/RGB-Bars/PAR-Cans?
**Ja!** Die Fixture Library enthält 16 vordefinierte Geräte. Du kannst auch eigene Geräte manuell konfigurieren.

### Wie viele Geräte kann ich steuern?
Technisch **bis zu 512 Kanäle pro Universe**. Praktisch getestet mit 50+ Geräten ohne Performance-Probleme.

### Kann ich das für kommerzielle Events nutzen?
**Ja!** MIT-Lizenz erlaubt kommerzielle Nutzung. Bitte beachte die Lizenz-Bedingungen.

---

## 🎉 Geschafft!

Du bist jetzt bereit, professionelle DMX-Lichtshows zu erstellen!

**Pro-Tipps:**
- 💾 Szenen werden automatisch gespeichert
- 🔄 WebSocket sorgt für Echtzeit-Sync auf allen Geräten
- 🎨 Nutze Farbcodes für Szenen zur besseren Organisation
- ⏱️ Timelines sind perfekt für wiederkehrende Events
- 🎵 Sound-Reactive Effects machen Live-Musik spektakulär

**Viel Spaß mit deinem DMX Web Controller!** 🎭✨

---

Made with ❤️ for the Lighting Community
