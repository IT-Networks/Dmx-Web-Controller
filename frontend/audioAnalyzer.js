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
    }

    analyze() {
        if (!this.isActive) return;

        this.animationFrame = requestAnimationFrame(() => this.analyze());

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate band levels
        const audioData = {
            raw: Array.from(this.dataArray),
            bass: this.getBandLevel('bass'),
            mid: this.getBandLevel('mid'),
            high: this.getBandLevel('high'),
            overall: this.getOverallLevel(),
            peak: Math.max(...this.dataArray),
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

    getFrequencyData() {
        if (!this.isActive || !this.analyser) return null;

        this.analyser.getByteFrequencyData(this.dataArray);
        return Array.from(this.dataArray);
    }
}
