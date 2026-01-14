// Audio Analyzer for Sound-Reactive Light Control

class AudioAnalyzer {
    constructor(onAudioData) {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isActive = false;
        this.onAudioData = onAudioData;
        this.animationFrame = null;

        // Frequency bands for different effects
        this.frequencyBands = {
            bass: { min: 20, max: 250 },      // Low frequencies
            mid: { min: 250, max: 2000 },     // Mid frequencies
            high: { min: 2000, max: 20000 }   // High frequencies
        };

        // Beat Detection
        this.energyHistory = [];
        this.energyHistorySize = 43; // ~1 second at 43 FPS
        this.beatThreshold = 1.5;
        this.lastBeatTime = 0;
        this.minBeatInterval = 300; // ms between beats minimum

        // BPM Detection
        this.beatTimes = [];
        this.bpm = 0;
        this.bpmHistorySize = 8;

        // Onset Detection
        this.spectralFlux = [];
        this.fluxHistorySize = 10;
    }

    async start() {
        if (this.isActive) return;

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Configure analyser
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);

            // Connect nodes
            this.microphone.connect(this.analyser);

            this.isActive = true;
            this.analyze();

            return true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            return false;
        }
    }

    stop() {
        if (!this.isActive) return;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.isActive = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;

        // Reset beat detection
        this.energyHistory = [];
        this.beatTimes = [];
        this.spectralFlux = [];
    }

    analyze() {
        if (!this.isActive) return;

        this.animationFrame = requestAnimationFrame(() => this.analyze());

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate band levels
        const bass = this.getBandLevel('bass');
        const mid = this.getBandLevel('mid');
        const high = this.getBandLevel('high');
        const overall = this.getOverallLevel();
        const peak = Math.max(...this.dataArray);

        // Beat Detection
        const beatDetected = this.detectBeat(bass);

        // Onset Detection
        const onsetStrength = this.detectOnset();

        // Calculate audio data
        const audioData = {
            raw: Array.from(this.dataArray),
            bass: bass,
            mid: mid,
            high: high,
            overall: overall,
            peak: peak,
            beat: beatDetected,
            bpm: this.bpm,
            onsetStrength: onsetStrength,
            timestamp: Date.now()
        };

        // Send data to callback
        if (this.onAudioData) {
            this.onAudioData(audioData);
        }
    }

    getBandLevel(bandName) {
        const band = this.frequencyBands[bandName];
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / this.bufferLength;

        const startBin = Math.floor(band.min / binWidth);
        const endBin = Math.floor(band.max / binWidth);

        let sum = 0;
        let count = 0;

        for (let i = startBin; i < endBin && i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
            count++;
        }

        return count > 0 ? sum / count / 255 : 0; // Normalize to 0-1
    }

    getOverallLevel() {
        const sum = this.dataArray.reduce((a, b) => a + b, 0);
        return (sum / this.dataArray.length) / 255; // Normalize to 0-1
    }

    detectBeat(currentEnergy) {
        // Add current energy to history
        this.energyHistory.push(currentEnergy);
        if (this.energyHistory.length > this.energyHistorySize) {
            this.energyHistory.shift();
        }

        // Need enough history
        if (this.energyHistory.length < this.energyHistorySize) {
            return false;
        }

        // Calculate average energy
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b) / this.energyHistory.length;

        // Calculate variance
        const variance = this.energyHistory.reduce((sum, val) => {
            return sum + Math.pow(val - avgEnergy, 2);
        }, 0) / this.energyHistory.length;

        // Adaptive threshold
        const C = -0.0025714 * variance + 1.5142857;
        const threshold = C * avgEnergy;

        // Check for beat
        const now = Date.now();
        const timeSinceLastBeat = now - this.lastBeatTime;

        if (currentEnergy > threshold &&
            currentEnergy > avgEnergy * this.beatThreshold &&
            timeSinceLastBeat > this.minBeatInterval) {

            this.lastBeatTime = now;

            // Update BPM
            this.beatTimes.push(now);
            if (this.beatTimes.length > this.bpmHistorySize) {
                this.beatTimes.shift();
            }
            this.calculateBPM();

            return true;
        }

        return false;
    }

    calculateBPM() {
        if (this.beatTimes.length < 2) {
            return;
        }

        // Calculate intervals between beats
        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
            intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }

        // Average interval
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;

        // Convert to BPM
        this.bpm = Math.round(60000 / avgInterval);

        // Sanity check (typical music range)
        if (this.bpm < 60 || this.bpm > 200) {
            this.bpm = 0;
        }
    }

    detectOnset() {
        // Calculate spectral flux (change in spectrum)
        if (!this.lastSpectrum) {
            this.lastSpectrum = Array.from(this.dataArray);
            return 0;
        }

        let flux = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const diff = this.dataArray[i] - this.lastSpectrum[i];
            if (diff > 0) {
                flux += diff;
            }
        }

        this.lastSpectrum = Array.from(this.dataArray);

        // Normalize
        flux = flux / (this.dataArray.length * 255);

        // Keep flux history
        this.spectralFlux.push(flux);
        if (this.spectralFlux.length > this.fluxHistorySize) {
            this.spectralFlux.shift();
        }

        // Calculate mean flux
        const meanFlux = this.spectralFlux.reduce((a, b) => a + b) / this.spectralFlux.length;

        // Return onset strength (how much above average)
        return Math.max(0, (flux - meanFlux) / (meanFlux + 0.01));
    }

    getFrequencyData() {
        if (!this.isActive || !this.analyser) return null;

        this.analyser.getByteFrequencyData(this.dataArray);
        return Array.from(this.dataArray);
    }

    // Manual beat trigger for testing
    triggerBeat() {
        this.lastBeatTime = Date.now();
        this.beatTimes.push(this.lastBeatTime);
        if (this.beatTimes.length > this.bpmHistorySize) {
            this.beatTimes.shift();
        }
        this.calculateBPM();
    }
}
