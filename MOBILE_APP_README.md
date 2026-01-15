# DMX Web Controller - Mobile App

Native Android App für den DMX Web Controller, basierend auf Capacitor.

## 📱 Features

- Native Android App
- Nutzt das bestehende Web-Frontend
- Automatischer APK-Build über GitHub Actions
- Support für Android 5.0+ (API Level 21+)

## 🚀 APK Downloads

APKs werden automatisch bei jedem Push/PR gebaut und sind unter **GitHub Actions → Artifacts** verfügbar:

- **Debug APK** - Zum Testen, mit Debug-Informationen
- **Release APK** - Optimierte Version (unsigned)

## 🛠️ Lokale Entwicklung

### Voraussetzungen

- Node.js 18+
- JDK 17
- Android Studio (optional, für erweiterte Entwicklung)

### Installation

**Wichtig:** Das `android/` Verzeichnis ist in `.gitignore` und wird lokal von Capacitor generiert.

```bash
# Dependencies installieren
npm install

# Android Platform hinzufügen (nur beim ersten Mal)
# Dies generiert das vollständige android/ Verzeichnis
npm run add:android

# Frontend mit Android synchronisieren
npm run sync
```

### APK Build (Lokal)

```bash
# Debug APK
npm run android:build:debug

# Release APK
npm run android:build

# APK Pfad:
# Debug: android/app/build/outputs/apk/debug/app-debug.apk
# Release: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Android Studio öffnen

```bash
npm run open:android
```

## 📦 APK Signierung (für Production)

Die Release APK ist unsigned. Für die Veröffentlichung im Play Store muss sie signiert werden:

```bash
# Keystore erstellen (nur einmal)
keytool -genkey -v -keystore dmx-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias dmx-controller

# APK signieren
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore dmx-release-key.jks \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  dmx-controller

# APK optimieren (zipalign)
zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  dmx-controller-v1.0.0.apk
```

## 🔧 Konfiguration

### App-Details ändern

Bearbeite `capacitor.config.json`:

```json
{
  "appId": "com.itnetworks.dmxcontroller",
  "appName": "DMX Controller"
}
```

### Icon & Splash Screen

Platziere Bilder in:
- `android/app/src/main/res/mipmap-*/ic_launcher.png` (App Icon)
- `android/app/src/main/res/drawable*/splash.png` (Splash Screen)

## 📱 Installation auf Gerät

### Via USB (ADB)

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Via APK-Datei

1. APK auf Gerät übertragen
2. "Installation aus unbekannten Quellen" aktivieren
3. APK öffnen und installieren

## 🔄 Workflow

Die GitHub Action **Android APK Build** wird automatisch ausgeführt bei:

- Push auf `main` Branch
- Push auf `claude/mobile-app-*` Branches
- Pull Requests zu `main`
- Manuell über "Run workflow"

## 🐛 Troubleshooting

### Gradle Build Fehler

```bash
cd android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

### Capacitor Sync Fehler

```bash
npx cap sync android --force
```

### Android Platform neu erstellen

```bash
npx cap remove android
npx cap add android
```

## 📚 Weitere Ressourcen

- [Capacitor Dokumentation](https://capacitorjs.com/docs)
- [Android Entwickler Guide](https://developer.android.com/)
- [Gradle Build Guide](https://docs.gradle.org/)

## 🔐 Sicherheit

**WICHTIG:** Niemals Keystores oder Signing-Keys in Git committen!

Füge zu `.gitignore` hinzu:
```
*.jks
*.keystore
key.properties
```
