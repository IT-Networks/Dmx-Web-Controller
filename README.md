# 🎭 DMX Web Controller

Eine moderne, browserbasierte Steuerungslösung für DMX-Lichtanlagen mit Art-Net Protokoll. Perfekt für Theater, Events, Kirchen und Home-Automation.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-teal.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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
- **Stroboskop**: Hochgeschwindigkeits-Blitzeffekt mit einstellbarer Frequenz
- **Regenbogen**: Sanfter HSV-Farbzyklus durch das gesamte Spektrum
- **Lauflicht (Chase)**: Sequentielle Aktivierung von Geräten
- **Pulsieren**: Atmende Helligkeitsmodulation
- **Farbwechsel**: Smooth Fades zwischen benutzerdefinierten Farben
- **Echtzeit-Steuerung**: Start/Stop von Effekten während der Ausführung
- **Gruppen & Geräte**: Effekte auf einzelne Geräte oder ganze Gruppen anwendbar

### 🎮 Companion Integration
- **Stream Deck Support**: Vollständige Bitfocus Companion-Integration
- **Szenen-Trigger**: Szenen per Knopfdruck aktivieren
- **Gruppen-Steuerung**: On/Off/Toggle für Gerätegruppen
- **Effekt-Kontrolle**: Effekte starten und stoppen
- **Auto-Discovery**: Alle Aktionen werden automatisch bereitgestellt

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

### Voraussetzungen
- Docker & Docker Compose
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
├── main.py              # FastAPI Backend + Art-Net Controller
├── app.js               # Frontend JavaScript
├── Index.html           # Web-Interface
├── style.css            # Styling
├── Dockerfile           # Container-Build
├── Docker compose       # Deployment-Konfiguration
├── data/                # Persistente Daten (auto-generiert)
│   ├── dmx_config.json  # Geräte-Konfiguration
│   └── dmx_scenes.json  # Gespeicherte Szenen
└── README.md            # Diese Datei
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

- [x] **Gruppen**: Mehrere Geräte gleichzeitig steuern ✅
- [x] **Effekte**: Vordefinierte Lichteffekte (Strobe, Rainbow, etc.) ✅
- [x] **Moderne UI**: Dark Theme mit Sidebar-Navigation ✅
- [x] **Companion Integration**: Stream Deck Support ✅
- [ ] **Timeline**: Zeitbasierte Szenen-Abfolgen
- [ ] **MIDI Integration**: Steuerung via MIDI-Controller
- [ ] **Fixture Library**: Vordefinierte Gerätedefinitionen
- [ ] **Mobile App**: Native iOS/Android App
- [ ] **Backup/Restore**: Konfiguration exportieren/importieren
- [ ] **Effect Designer**: Visueller Editor für eigene Effekte
- [ ] **Multi-Universe UI**: Bessere Verwaltung mehrerer Universen

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
