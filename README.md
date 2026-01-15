# 🎭 DMX Web Controller

Eine moderne, browserbasierte Steuerungslösung für DMX-Lichtanlagen mit Art-Net Protokoll. Perfekt für Theater, Events, Kirchen und Home-Automation.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-teal.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI/CD Pipeline](https://github.com/IT-Networks/Dmx-Web-Controller/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/IT-Networks/Dmx-Web-Controller/actions/workflows/ci-cd.yml)

---

## ✨ Features

### 🎛️ Geräteverwaltung
- **Flexible Gerätetypen**: Unterstützung für Dimmer (1 Kanal), RGB (3 Kanäle) und RGBW (4 Kanäle)
- **Intuitive Steuerung**: Echtzeit-Slider für präzise Lichtsteuerung (0-255)
- **Multi-Universe**: Unterstützung mehrerer DMX-Universen
- **IP-basiert**: Art-Net über Standard-Netzwerk (keine spezielle Hardware erforderlich)

### 🎬 Szenen-Management
- **Snapshot-Funktion**: Aktuelle Lichtstimmung als Szene speichern
- **Sanfte Übergänge**: 2 Sekunden Fade-Effekte zwischen Szenen
- **Farbcodierung**: Visuelle Organisation mit Farbmarkierungen
- **Ein-Klick-Aktivierung**: Schneller Szenenwechsel

### ⚡ Echtzeit-Synchronisation
- **WebSocket-basiert**: Instant-Updates über alle verbundenen Clients
- **Multi-User**: Mehrere Benutzer können gleichzeitig steuern
- **Auto-Reconnect**: Automatische Wiederverbindung bei Netzwerkproblemen
- **Live-Feedback**: Änderungen werden sofort auf allen Geräten sichtbar

### 🎯 Gruppen-Management
- **Multi-Device Control**: Steuere mehrere Geräte gleichzeitig
- **Master Intensity**: Gemeinsame Helligkeitssteuerung für alle Gruppengeräte
- **Flexible Zuordnung**: Beliebige Geräte zu Gruppen kombinieren
- **Echtzeit-Synchronisation**: Änderungen wirken sofort auf alle Gruppengeräte

### ✨ Effekt-Engine
**Klassische Effekte:**
- **Stroboskop**: Hochgeschwindigkeits-Blitzeffekt mit einstellbarer Frequenz
- **Regenbogen**: Sanfter HSV-Farbzyklus durch das gesamte Spektrum
- **Lauflicht (Chase)**: Sequentielle Aktivierung von Geräten
- **Pulsieren**: Atmende Helligkeitsmodulation
- **Farbwechsel**: Smooth Fades zwischen benutzerdefinierten Farben

**Erweiterte Effekte:**
- **Feuer** 🔥: Realistischer Flackereffekt mit Orange/Rot-Tönen
- **Blitz** ⚡: Zufällige Lightning-Strikes mit Multi-Flash
- **Scanner** 🔦: Moving Head Pan-Sweep-Bewegungen
- **Matrix** 📊: 2D Grid Patterns (Wave, Circle, Checkerboard)
- **Funkeln** ✨: Random Sparkle-Effekt mit konfigurierbarer Dichte

**Visual Effect Designer:**
- **Keyframe-basiert** 🎬: Erstelle eigene Effekte mit visueller Timeline
- **Dual-Mode**: Separate Modi für Spots (uniforme Farben) und LED Strips (Pixel-Muster)
- **Canvas Timeline**: Interaktive Timeline mit Drag & Drop Keyframes
- **Easing Functions**: Linear, Ease-In, Ease-Out, Ease-In-Out für professionelle Übergänge
- **Strip Patterns**: Solid, Gradient, Wave, Chase mit individuellen Parametern
- **Vorlagen**: Fade, Pulse, Color Cycle, Strobe als Startpunkt
- **Live-Preview**: Echtzeit-Vorschau mit Scrubber-Animation

**Features:**
- **Echtzeit-Steuerung**: Start/Stop von Effekten während der Ausführung
- **Gruppen & Geräte**: Effekte auf einzelne Geräte oder ganze Gruppen anwendbar
- **Parameteranpassung**: Speed, Intensity, Pattern individuell einstellbar

### 🎬 Timeline & Sequenzen
- **Timeline-Editor**: Erstelle automatisierte Lichtabläufe
- **Sequenz-Steps**: Kombiniere Szenen, Effekte und Pausen
- **Loop-Modus**: Endlos-Wiederholung für wiederkehrende Events
- **Dauer-Kontrolle**: Präzise Zeitsteuerung für jeden Step
- **Playback-Engine**: Zuverlässige Wiedergabe mit Resource Management

### 🎵 Audio-Reaktive Effekte
- **Beat Detection**: Echtzeit-Erkennung von Musik-Beats
- **BPM-Messung**: Automatische Tempo-Erkennung (60-200 BPM)
- **Frequenzband-Analyse**: Bass, Mid, High, Overall
- **Sound-Reactive Modes**: Intensity, Color, Strobe
- **Audio-Visualizer**: Echtzeit-Frequenz-Anzeige
- **Sensitivität**: Anpassbare Reaktionsstärke

### 📚 Fixture Library
- **16 vordefinierte Geräte**: Professionelle Fixture-Definitionen
- **Hersteller-Support**: Eurolite, Stairville, Cameo, Showtec u.v.m.
- **Kanal-Layouts**: Automatische Kanal-Zuordnung
- **One-Click-Setup**: Gerät aus Library wählen und loslegen

### 🎮 Companion Integration
- **Stream Deck Support**: Vollständige Bitfocus Companion-Integration
- **Szenen-Trigger**: Szenen per Knopfdruck aktivieren
- **Gruppen-Steuerung**: On/Off/Toggle für Gerätegruppen
- **Effekt-Kontrolle**: Effekte starten und stoppen
- **Auto-Discovery**: Alle Aktionen werden automatisch bereitgestellt

### 🛡️ Stabilität & Performance
- **Automatische Backups**: Backup vor jedem Save (7 Tage Retention)
- **Error Recovery**: Automatische Wiederherstellung bei Fehlern
- **DMX-Caching**: Nur geänderte Werte werden gesendet (~70% Traffic-Reduktion)
- **Resource Limits**: Schutz vor Überlastung (Max 20 Effekte, 5 Sequenzen)
- **Input Validation**: Umfassende Validierung aller Eingaben
- **Structured Logging**: Detaillierte Logs für Debugging

### 🎨 Moderne UI/UX
- **Dark Theme**: Professionelles dunkles Design
- **Sidebar Navigation**: Intuitive Tab-Navigation (Geräte/Gruppen/Szenen/Effekte)
- **Responsive Design**: Optimiert für Desktop, Tablet und Mobile
- **Glassmorphism**: Moderne visuelle Effekte
- **Toast Notifications**: Dezentes Feedback zu allen Aktionen
- **Empty States**: Hilfreiche Hinweise bei leeren Ansichten

### 💾 Persistenz & Deployment
- **Automatisches Speichern**: Konfigurationen und Szenen werden persistent gespeichert
- **Docker-Ready**: Einfaches Deployment mit Docker Compose
- **Unraid-kompatibel**: Vorbereitet für Unraid Community Applications
- **Volume-Mapping**: Daten bleiben bei Container-Updates erhalten

---

## 🚀 Schnellstart

> **👉 Neu hier? Schau dir den [ausführlichen QUICKSTART Guide](QUICKSTART.md) an!**
> Schritt-für-Schritt Anleitung für Anfänger mit Troubleshooting und FAQ.

### Voraussetzungen
- Docker & Docker Compose (oder Python 3.11+)
- Art-Net fähiges DMX-Interface (z.B. OLA, QLC+, ENTTEC, etc.)
- Netzwerkverbindung zu DMX-Hardware

### Installation

1. **Repository klonen**
```bash
git clone https://github.com/IT-Networks/Dmx-Web-Controller.git
cd Dmx-Web-Controller
```

2. **Container starten**
```bash
docker-compose up -d
```

3. **Web-Interface öffnen**
```
http://localhost:8000
```

Das war's! Der DMX Controller ist nun einsatzbereit. 🎉

### Alternative: Python (ohne Docker)
```bash
cd backend
pip install -r requirements.txt
python main.py
# Öffne http://localhost:8000
```

---

## 📖 Verwendung

### Gerät hinzufügen

1. Klicke auf **"+ Gerät"** im Header
2. Fülle die Felder aus:
   - **Name**: Bezeichnung des Geräts (z.B. "Bühnenlicht Links")
   - **IP-Adresse**: IP des Art-Net Nodes (z.B. "192.168.1.100")
   - **Universe**: DMX Universe (Standard: 0)
   - **Start-Kanal**: Erster DMX-Kanal (1-512)
   - **Gerätetyp**: Dimmer, RGB oder RGBW
3. Klicke **"Hinzufügen"**

### Licht steuern

- Verwende die **Slider** um Kanäle zu steuern
- Werte werden **in Echtzeit** via Art-Net gesendet
- Änderungen sind **sofort** auf allen verbundenen Geräten sichtbar

### Szene erstellen

1. Stelle die gewünschte Lichtstimmung ein
2. Klicke auf **"+ Szene"**
3. Gib einen Namen ein (z.B. "Redner", "Musiknummer")
4. Wähle eine Farbe zur Kennzeichnung
5. Klicke **"Szene erstellen"**

Die aktuellen Werte aller Geräte werden gespeichert.

### Szene aktivieren

- Klicke auf eine **Szenen-Karte**
- Das System führt einen **2 Sekunden Fade** zur gespeicherten Stimmung durch
- Perfekt für Live-Events ohne harte Schnitte

---

## 🏗️ Technologie-Stack

### Backend
- **FastAPI** - Modernes, schnelles Python Web Framework
- **WebSockets** - Echtzeit-Kommunikation
- **Art-Net** - Standardprotokoll für DMX über IP
- **Uvicorn** - ASGI Server

### Frontend
- **Vanilla JavaScript** - Keine Framework-Abhängigkeiten
- **CSS Grid/Flexbox** - Responsives Design
- **WebSocket API** - Bidirektionale Kommunikation

### Deployment
- **Docker** - Containerisierung
- **Docker Compose** - Orchestrierung
- **Volume Persistence** - Datensicherheit

---

## 📁 Projektstruktur

```
Dmx-Web-Controller/
├── backend/
│   ├── main.py              # FastAPI Backend + Art-Net Controller
│   ├── fixtures.json        # Fixture Library (16 Geräte)
│   ├── requirements.txt     # Python Dependencies
│   └── dmx_controller.log   # Application Log
├── frontend/
│   ├── Index.html           # Web-Interface
│   ├── app.js               # Frontend JavaScript
│   ├── style.css            # Styling & Dark Theme
│   └── audioAnalyzer.js     # Beat Detection & Audio Analysis
├── data/                    # Persistente Daten (auto-generiert)
│   ├── dmx_config.json      # Geräte-Konfiguration
│   ├── dmx_scenes.json      # Gespeicherte Szenen
│   ├── dmx_groups.json      # Gruppen
│   ├── dmx_effects.json     # Effekt-Definitionen
│   ├── dmx_sequences.json   # Timeline-Sequenzen
│   └── backups/             # Automatische Backups (7 Tage)
├── Dockerfile               # Container-Build
├── docker-compose.yml       # Deployment-Konfiguration
├── README.md                # Hauptdokumentation
├── QUICKSTART.md            # Schnellstart für Anfänger
└── .gitignore               # Git Ignore Patterns
```

---

## 🔧 Konfiguration

### Umgebungsvariablen

```yaml
environment:
  - TZ=Europe/Berlin           # Zeitzone
  - PYTHONUNBUFFERED=1         # Python Logging
```

### Ports

- **8000**: Web-Interface (HTTP)
- **6454**: Art-Net (UDP, automatisch)

### Volumes

```yaml
volumes:
  - ./data:/data  # Konfigurationen & Szenen
```

---

## 🌐 Art-Net Kompatibilität

Getestet mit:
- ✅ **OLA** (Open Lighting Architecture)
- ✅ **QLC+** (Q Light Controller Plus)
- ✅ **ENTTEC** DMX USB Pro
- ✅ **DMXKing** eDMX1
- ✅ **Artnet-Node** (generisch)

Sollte mit allen Art-Net kompatiblen Geräten funktionieren.

---

## 🐛 Bekannte Einschränkungen

- Max. **512 Kanäle** pro Universe (DMX-Standard)
- **UDP Broadcast** erfordert Bridge-Netzwerk-Modus
- Bei sehr vielen Geräten (>50) kann Performance beeinträchtigt werden

---

## 🔧 Troubleshooting

### Problem: "Keine Verbindung zum Server"

**Lösung:**
```bash
# Docker: Status prüfen
docker ps
docker logs dmx-controller

# Python: Prozess prüfen
ps aux | grep python
```

### Problem: "Gerät reagiert nicht"

**Checkliste:**
1. ✅ Ist die **IP-Adresse** korrekt? (`ping [IP]`)
2. ✅ Ist das **richtige Universe** eingestellt?
3. ✅ Stimmt der **Start-Kanal**?
4. ✅ Ist **Port 6454 (UDP)** in der Firewall offen?
5. ✅ Sind Controller und DMX-Interface **im gleichen Netzwerk**?

**Art-Net Traffic testen:**
```bash
# Linux/Mac
sudo tcpdump -i any udp port 6454

# Windows (Wireshark)
# Filter: udp.port == 6454
```

### Problem: "Beat Detection funktioniert nicht"

**Lösungen:**
- Browser-Mikrofon-Zugriff erlauben (Schloss-Symbol in Adresszeile)
- Sensitivität erhöhen (versuche 2.0-3.0)
- Prüfe, ob Audio-Visualizer sich bewegt
- Nutze "Overall" statt spezifischer Frequenzbänder

### Problem: "Performance-Probleme"

**Optimierungen:**
- Reduziere die Anzahl gleichzeitig aktiver Effekte (Max: 20)
- Verwende Gruppen statt individueller Geräte
- Deaktiviere Sound-Reactive wenn nicht benötigt
- Prüfe Netzwerk-Latenz: `ping -c 10 [DMX-Interface-IP]`

### Weitere Hilfe

**Logs anschauen:**
```bash
# Docker
docker logs -f dmx-controller

# Python
tail -f backend/dmx_controller.log
```

**API-Dokumentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Community Support:**
- [GitHub Issues](https://github.com/IT-Networks/Dmx-Web-Controller/issues)
- [Discussions](https://github.com/IT-Networks/Dmx-Web-Controller/discussions)

---

## 🛠️ Entwicklung

### Lokale Entwicklung ohne Docker

1. **Python Dependencies installieren**
```bash
pip install fastapi uvicorn websockets
```

2. **Backend starten**
```bash
python main.py
```

3. **Frontend öffnen**
```bash
# Öffne Index.html im Browser oder nutze einen lokalen Server
python -m http.server 8080
```

### API Dokumentation

FastAPI generiert automatisch interaktive API-Docs:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## 🎮 Companion / Stream Deck Setup

### Bitfocus Companion einrichten

1. **Companion installieren** (https://bitfocus.io/companion)
2. **DMX Controller Modul hinzufügen**:
   - Generic HTTP Request Modul verwenden
   - URL: `http://[YOUR_IP]:8000/api/companion/trigger`
   - Method: POST
   - Body: `{"type": "scene", "id": "scene_[SCENE_ID]"}`

3. **Aktionen abrufen**:
   ```bash
   curl http://localhost:8000/api/companion/actions
   ```

4. **Verfügbare Aktionen**:
   - **Szenen aktivieren**: `{"type": "scene", "id": "scene_ID"}`
   - **Gruppe einschalten**: `{"type": "group", "id": "group_ID", "params": {"action": "on"}}`
   - **Gruppe ausschalten**: `{"type": "group", "id": "group_ID", "params": {"action": "off"}}`
   - **Gruppe toggle**: `{"type": "group", "id": "group_ID", "params": {"action": "toggle"}}`
   - **Effekt starten**: `{"type": "effect", "id": "effect_ID"}`
   - **Effekt stoppen**: `{"type": "effect", "id": "effect_ID", "params": {"stop": true}}`

---

## 🤝 Beitragen

Beiträge sind willkommen! Hier sind einige Ideen:

- 🔌 Zusätzliche Gerätetypen (Moving Heads, PAR-Cans, Laser)
- ⏰ Zeitsteuerung & Scheduler
- 🎮 MIDI/OSC Support
- 🌍 Mehrsprachigkeit
- 📱 PWA Support für Offline-Nutzung
- 🎛️ DMX Input Monitoring
- 📊 Erweiterte Fixture Library

---

## 📋 Roadmap

### ✅ Fertiggestellt
- [x] **Gruppen**: Mehrere Geräte gleichzeitig steuern
- [x] **Effekte**: 10 vordefinierte Lichteffekte
- [x] **Moderne UI**: Dark Theme mit Sidebar-Navigation
- [x] **Companion Integration**: Stream Deck Support
- [x] **Timeline**: Zeitbasierte Szenen-Abfolgen mit Loop
- [x] **Fixture Library**: 16 vordefinierte Gerätedefinitionen
- [x] **Audio-Reaktivität**: Beat Detection & Sound-Reactive Effects
- [x] **Stability**: Backups, Error Recovery, Input Validation
- [x] **Performance**: DMX-Caching, Resource Management
- [x] **Visual Effect Designer**: Keyframe-basierter Editor für eigene Effekte (Spots & LED Strips)

### 🚧 In Planung
- [ ] **MIDI Integration**: Steuerung via MIDI-Controller
- [ ] **Mobile App**: Native iOS/Android App (PWA)
- [ ] **Backup/Restore**: Konfiguration exportieren/importieren
- [ ] **Multi-Universe UI**: Bessere Verwaltung mehrerer Universen
- [ ] **Fixture Editor**: Eigene Fixture-Definitionen erstellen
- [ ] **Cloud Sync**: Konfiguration über mehrere Instanzen synchronisieren

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT License** lizenziert - siehe [LICENSE](LICENSE) Datei für Details.

---

## 👤 Autor

**IT-Networks**

- GitHub: [@IT-Networks](https://github.com/IT-Networks)
- Repository: [Dmx-Web-Controller](https://github.com/IT-Networks/Dmx-Web-Controller)

---

## 🙏 Danksagungen

- **Art-Net Protocol**: Artistic Licence Holdings Ltd
- **FastAPI**: Sebastián Ramírez
- **Docker Community**: Für einfaches Deployment

---

## 📞 Support

Bei Fragen oder Problemen:
- 🐛 [Issues](https://github.com/IT-Networks/Dmx-Web-Controller/issues)
- 💬 [Discussions](https://github.com/IT-Networks/Dmx-Web-Controller/discussions)

---

<div align="center">

**⭐ Wenn dir dieses Projekt gefällt, gib ihm einen Stern! ⭐**

Made with ❤️ for the Lighting Community

</div>
