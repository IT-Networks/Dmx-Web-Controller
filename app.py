// DMX Web Controller - Frontend JavaScript

class DMXController {
    constructor() {
        this.ws = null;
        this.devices = [];
        this.scenes = [];
        this.selectedDeviceType = 'dimmer';
        this.selectedSceneColor = 'blue';
        this.reconnectInterval = null;
        
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.loadData();
    }
    
    // WebSocket Connection
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.showToast('Verbunden', 'success');
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.showToast('Verbindung getrennt. Versuche erneut...', 'error');
            
            // Auto-reconnect
            if (!this.reconnectInterval) {
                this.reconnectInterval = setInterval(() => {
                    this.connectWebSocket();
                }, 3000);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'initial_data':
                this.devices = data.devices;
                this.scenes = data.scenes;
                this.renderDevices();
                this.renderScenes();
                break;
                
            case 'devices_updated':
                this.devices = data.devices;
                this.renderDevices();
                break;
                
            case 'scenes_updated':
                this.scenes = data.scenes;
                this.renderScenes();
                break;
                
            case 'device_values_updated':
                this.updateDeviceUI(data.device_id, data.values);
                break;
        }
    }
    
    // API Calls
    async loadData() {
        try {
            const [devicesRes, scenesRes] = await Promise.all([
                fetch('/api/devices'),
                fetch('/api/scenes')
            ]);
            
            const devicesData = await devicesRes.json();
            const scenesData = await scenesRes.json();
            
            this.devices = devicesData.devices;
            this.scenes = scenesData.scenes;
            
            this.renderDevices();
            this.renderScenes();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Fehler beim Laden der Daten', 'error');
        }
    }
    
    async addDevice() {
        const name = document.getElementById('deviceName').value.trim();
        const ip = document.getElementById('deviceIp').value.trim();
        const universe = parseInt(document.getElementById('deviceUniverse').value);
        const startChannel = parseInt(document.getElementById('deviceChannel').value);
        
        if (!name || !ip) {
            this.showToast('Bitte alle Felder ausfüllen', 'error');
            return;
        }
        
        const channelCounts = { dimmer: 1, rgb: 3, rgbw: 4 };
        
        const device = {
            name,
            ip,
            universe,
            start_channel: startChannel,
            channel_count: channelCounts[this.selectedDeviceType],
            device_type: this.selectedDeviceType
        };
        
        try {
            const response = await fetch('/api/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(device)
            });
            
            if (response.ok) {
                this.showToast('Gerät hinzugefügt', 'success');
                this.closeModal('addDeviceModal');
                
                // Reset form
                document.getElementById('deviceName').value = '';
                document.getElementById('deviceIp').value = '';
                document.getElementById('deviceUniverse').value = '0';
                document.getElementById('deviceChannel').value = '1';
            }
        } catch (error) {
            console.error('Error adding device:', error);
            this.showToast('Fehler beim Hinzufügen', 'error');
        }
    }
    
    async deleteDevice(deviceId) {
        if (!confirm('Gerät wirklich löschen?')) return;
        
        try {
            const response = await fetch(`/api/devices/${deviceId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showToast('Gerät gelöscht', 'success');
            }
        } catch (error) {
            console.error('Error deleting device:', error);
            this.showToast('Fehler beim Löschen', 'error');
        }
    }
    
    updateDeviceValue(deviceId, channelIdx, value) {
        // Send via WebSocket for instant update
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'update_device_value',
                device_id: deviceId,
                channel_idx: channelIdx,
                value: parseInt(value)
            }));
        }
    }
    
    async addScene() {
        const name = document.getElementById('sceneName').value.trim();
        
        if (!name) {
            this.showToast('Bitte Szenenname eingeben', 'error');
            return;
        }
        
        if (this.devices.length === 0) {
            this.showToast('Keine Geräte vorhanden', 'error');
            return;
        }
        
        const scene = {
            name,
            color: this.selectedSceneColor
        };
        
        try {
            const response = await fetch('/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scene)
            });
            
            if (response.ok) {
                this.showToast('Szene erstellt', 'success');
                this.closeModal('addSceneModal');
                document.getElementById('sceneName').value = '';
            }
        } catch (error) {
            console.error('Error adding scene:', error);
            this.showToast('Fehler beim Erstellen', 'error');
        }
    }
    
    async deleteScene(sceneId) {
        if (!confirm('Szene wirklich löschen?')) return;
        
        try {
            const response = await fetch(`/api/scenes/${sceneId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showToast('Szene gelöscht', 'success');
            }
        } catch (error) {
            console.error('Error deleting scene:', error);
            this.showToast('Fehler beim Löschen', 'error');
        }
    }
    
    async activateScene(sceneId) {
        try {
            const response = await fetch(`/api/scenes/${sceneId}/activate`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('Fade zur Szene...', 'success');
            }
        } catch (error) {
            console.error('Error activating scene:', error);
            this.showToast('Fehler beim Aktivieren', 'error');
        }
    }
    
    // UI Rendering
    renderDevices() {
        const container = document.getElementById('devicesContainer');
        
        if (this.devices.length === 0) {
            container.innerHTML = '<div class="empty-state">Keine Geräte vorhanden</div>';
            return;
        }
        
        container.innerHTML = this.devices.map(device => this.createDeviceCard(device)).join('');
        
        // Attach event listeners
        this.devices.forEach(device => {
            const channels = this.getChannelCount(device.device_type);
            for (let i = 0; i < channels; i++) {
                const slider = document.getElementById(`slider-${device.id}-${i}`);
                if (slider) {
                    slider.addEventListener('input', (e) => {
                        const value = parseInt(e.target.value);
                        document.getElementById(`value-${device.id}-${i}`).textContent = value;
                        this.updateDeviceValue(device.id, i, value);
                    });
                }
            }
        });
    }
    
    createDeviceCard(device) {
        const channels = this.getChannelLabels(device.device_type);
        const colors = ['', 'red', 'green', 'blue', 'white'];
        
        const controls = channels.map((label, idx) => `
            <div class="control-row">
                <span class="control-label">${label}</span>
                <div class="slider-container">
                    <input type="range" 
                           class="slider ${colors[idx]}" 
                           id="slider-${device.id}-${idx}"
                           min="0" 
                           max="255" 
                           value="${device.values[idx] || 0}">
                </div>
                <span class="control-value" id="value-${device.id}-${idx}">${device.values[idx] || 0}</span>
            </div>
        `).join('');
        
        return `
            <div class="device-card">
                <div class="device-header">
                    <div class="device-info">
                        <h3>${device.name}</h3>
                        <p>${device.ip} · Universe ${device.universe} · Ch ${device.start_channel}</p>
                    </div>
                    <button class="device-delete" onclick="app.deleteDevice('${device.id}')">×</button>
                </div>
                <div class="device-controls">
                    ${controls}
                </div>
            </div>
        `;
    }
    
    renderScenes() {
        const container = document.getElementById('scenesContainer');
        
        if (this.scenes.length === 0) {
            container.innerHTML = '<div class="empty-state">Keine Szenen vorhanden</div>';
            return;
        }
        
        container.innerHTML = this.scenes.map(scene => `
            <div class="scene-card">
                <button class="scene-btn scene-${scene.color}" onclick="app.activateScene('${scene.id}')">
                    ${scene.name}
                </button>
                <button class="scene-delete" onclick="app.deleteScene('${scene.id}')">Löschen</button>
            </div>
        `).join('');
    }
    
    updateDeviceUI(deviceId, values) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;
        
        device.values = values;
        
        values.forEach((value, idx) => {
            const slider = document.getElementById(`slider-${deviceId}-${idx}`);
            const valueSpan = document.getElementById(`value-${deviceId}-${idx}`);
            
            if (slider && slider !== document.activeElement) {
                slider.value = value;
            }
            if (valueSpan) {
                valueSpan.textContent = value;
            }
        });
    }
    
    // Helper Functions
    getChannelCount(deviceType) {
        return { dimmer: 1, rgb: 3, rgbw: 4 }[deviceType] || 1;
    }
    
    getChannelLabels(deviceType) {
        const labels = {
            dimmer: ['Helligkeit'],
            rgb: ['Rot', 'Grün', 'Blau'],
            rgbw: ['Rot', 'Grün', 'Blau', 'Weiß']
        };
        return labels[deviceType] || ['Wert'];
    }
    
    // Modal Functions
    showAddDevice() {
        document.getElementById('addDeviceModal').classList.add('active');
    }
    
    showAddScene() {
        if (this.devices.length === 0) {
            this.showToast('Bitte zuerst Geräte hinzufügen', 'error');
            return;
        }
        document.getElementById('addSceneModal').classList.add('active');
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }
    
    selectDeviceType(type) {
        this.selectedDeviceType = type;
        
        document.querySelectorAll('#deviceTypeGroup .btn-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            }
        });
    }
    
    selectSceneColor(color) {
        this.selectedSceneColor = color;
        
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === color) {
                btn.classList.add('active');
            }
        });
    }
    
    // Toast Notifications
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize App
const app = new DMXController();

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});
