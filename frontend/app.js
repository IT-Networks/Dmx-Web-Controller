// DMX Web Controller Pro - Frontend JavaScript

class DMXController {
    constructor() {
        this.ws = null;
        this.devices = [];
        this.scenes = [];
        this.groups = [];
        this.effects = [];
        this.sequences = [];
        this.fixtures = {};
        this.selectedFixture = null;
        this.selectedDeviceType = 'dimmer';
        this.selectedSceneColor = 'blue';
        this.currentTab = 'devices';
        this.currentEffect = null;
        this.reconnectInterval = null;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.loadData();
        this.loadFixtures();
        this.setupKeyboardShortcuts();
    }
    
    // ===== WebSocket =====
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus(true);
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
            this.updateConnectionStatus(false);
            
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
                this.groups = data.groups || [];
                this.effects = data.effects || [];
                this.renderAll();
                break;
                
            case 'devices_updated':
                this.devices = data.devices;
                this.renderDevices();
                this.renderGroups();
                break;
                
            case 'scenes_updated':
                this.scenes = data.scenes;
                this.renderScenes();
                break;
                
            case 'groups_updated':
                this.groups = data.groups;
                this.renderGroups();
                break;
                
            case 'effects_updated':
                this.effects = data.effects;
                this.renderEffects();
                break;

            case 'sequences_updated':
                this.sequences = data.sequences;
                this.renderSequences();
                break;

            case 'device_values_updated':
                this.updateDeviceUI(data.device_id, data.values);
                break;
        }
    }
    
    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (connected) {
            status.querySelector('span').textContent = 'Verbunden';
            status.querySelector('.status-indicator').style.background = 'var(--success)';
        } else {
            status.querySelector('span').textContent = 'Getrennt';
            status.querySelector('.status-indicator').style.background = 'var(--danger)';
        }
    }
    
    // ===== API Calls =====
    async loadData() {
        try {
            const [devicesRes, scenesRes, groupsRes, effectsRes] = await Promise.all([
                fetch('/api/devices'),
                fetch('/api/scenes'),
                fetch('/api/groups'),
                fetch('/api/effects')
            ]);
            
            const devicesData = await devicesRes.json();
            const scenesData = await scenesRes.json();
            const groupsData = await groupsRes.json();
            const effectsData = await effectsRes.json();
            
            this.devices = devicesData.devices;
            this.scenes = scenesData.scenes;
            this.groups = groupsData.groups;
            this.effects = effectsData.effects;
            
            this.renderAll();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Fehler beim Laden der Daten', 'error');
        }
    }
    
    renderAll() {
        this.renderDevices();
        this.renderGroups();
        this.renderScenes();
        this.renderEffects();
        this.renderSequences();
    }
    
    // ===== Tab Switching =====
    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.getElementById(`${tabName}Tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        this.updateHeader(tabName);
    }
    
    updateHeader(tabName) {
        const titles = {
            'devices': ['Geräte', 'Verwalte deine DMX-Geräte'],
            'groups': ['Gruppen', 'Steuere mehrere Geräte gleichzeitig'],
            'scenes': ['Szenen', 'Gespeicherte Lichtstimmungen'],
            'effects': ['Effekte', 'Dynamische Lichteffekte'],
            'sequences': ['Timeline', 'Erstelle Sequenzen aus Szenen und Effekten'],
            'settings': ['Einstellungen', 'App-Konfiguration und Audio-Einstellungen']
        };

        const [title, subtitle] = titles[tabName] || ['', ''];
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageSubtitle').textContent = subtitle;

        const buttons = {
            'devices': '<button class="btn btn-primary" onclick="app.showAddDevice()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Gerät hinzufügen</span></button>',
            'groups': '<button class="btn btn-primary" onclick="app.showAddGroup()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Gruppe erstellen</span></button>',
            'scenes': '<button class="btn btn-primary" onclick="app.showAddScene()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Szene erstellen</span></button>',
            'effects': '',
            'sequences': '<button class="btn btn-primary" onclick="app.showAddSequence()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Timeline hinzufügen</span></button>',
            'settings': ''
        };

        document.getElementById('headerActions').innerHTML = buttons[tabName] || '';
    }
    
    // ===== Devices =====
    async addDevice() {
        const name = document.getElementById('deviceName').value.trim();
        const ip = document.getElementById('deviceIp').value.trim();
        const universe = parseInt(document.getElementById('deviceUniverse').value);
        const startChannel = parseInt(document.getElementById('deviceChannel').value);

        if (!name || !ip) {
            this.showToast('Bitte alle Felder ausfüllen', 'error');
            return;
        }

        let device = {
            name,
            ip,
            universe,
            start_channel: startChannel
        };

        // Use fixture if selected, otherwise use manual type
        if (this.selectedFixture) {
            device.channel_count = this.selectedFixture.channels;
            device.device_type = this.selectedFixture.category;
            device.fixture_id = this.selectedFixture.id;
            device.channel_layout = this.selectedFixture.channel_layout;
        } else {
            const channelCounts = { dimmer: 1, rgb: 3, rgbw: 4 };
            device.channel_count = channelCounts[this.selectedDeviceType];
            device.device_type = this.selectedDeviceType;
        }

        try {
            const response = await fetch('/api/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(device)
            });

            if (response.ok) {
                this.showToast('Gerät hinzugefügt', 'success');
                this.closeModal('addDeviceModal');
                document.getElementById('deviceName').value = '';
                document.getElementById('deviceIp').value = '';
                document.getElementById('deviceUniverse').value = '0';
                document.getElementById('deviceChannel').value = '1';
                document.getElementById('fixtureSelect').value = '';
                this.selectedFixture = null;
                document.getElementById('manualTypeGroup').style.display = 'block';
                document.getElementById('fixtureInfo').style.display = 'none';
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'update_device_value',
                device_id: deviceId,
                channel_idx: channelIdx,
                value: parseInt(value)
            }));
        }
    }
    
    renderDevices() {
        const container = document.getElementById('devicesContainer');
        
        if (this.devices.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                    </svg>
                    <h3>Keine Geräte vorhanden</h3>
                    <p>Füge dein erstes DMX-Gerät hinzu</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.devices.map(device => this.createDeviceCard(device)).join('');
        
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
                           class="slider ${colors[idx] || ''}" 
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
    
    // Groups, Scenes, Effects - Rest of implementation
    async addGroup() {
        const name = document.getElementById('groupName').value.trim();
        if (!name) { this.showToast('Bitte Gruppennamen eingeben', 'error'); return; }
        const deviceIds = Array.from(document.querySelectorAll('.device-select-item input:checked')).map(cb => cb.value);
        if (deviceIds.length === 0) { this.showToast('Bitte mindestens ein Gerät auswählen', 'error'); return; }
        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, device_ids: deviceIds })
            });
            if (response.ok) { this.showToast('Gruppe erstellt', 'success'); this.closeModal('addGroupModal'); document.getElementById('groupName').value = ''; }
        } catch (error) { console.error(error); this.showToast('Fehler beim Erstellen', 'error'); }
    }
    
    async deleteGroup(groupId) {
        if (!confirm('Gruppe wirklich löschen?')) return;
        try {
            await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
            this.showToast('Gruppe gelöscht', 'success');
        } catch (error) { console.error(error); this.showToast('Fehler', 'error'); }
    }
    
    async updateGroupIntensity(groupId, intensity) {
        try {
            await fetch(`/api/groups/${groupId}/values`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intensity: parseInt(intensity) })
            });
        } catch (error) { console.error(error); }
    }
    
    renderGroups() {
        const container = document.getElementById('groupsContainer');
        if (this.groups.length === 0) {
            container.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/><circle cx="40" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/><circle cx="32" cy="44" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg><h3>Keine Gruppen vorhanden</h3><p>Erstelle eine Gruppe aus mehreren Geräten</p></div>';
            return;
        }
        container.innerHTML = this.groups.map(group => {
            const groupDevices = this.devices.filter(d => group.device_ids.includes(d.id));
            const deviceNames = groupDevices.map(d => d.name).join(', ');
            return `<div class="group-card"><div class="group-header"><div class="group-info"><h3>${group.name}</h3><p>${groupDevices.length} Geräte: ${deviceNames}</p></div><button class="group-delete" onclick="app.deleteGroup('${group.id}')">×</button></div><div class="group-controls"><div class="group-master"><div class="group-master-title">Master Intensity</div><div class="control-row"><span class="control-label">Alle</span><div class="slider-container"><input type="range" class="slider" id="group-slider-${group.id}" min="0" max="255" value="0"></div><span class="control-value" id="group-value-${group.id}">0</span></div></div></div></div>`;
        }).join('');
        this.groups.forEach(group => {
            const slider = document.getElementById(`group-slider-${group.id}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    document.getElementById(`group-value-${group.id}`).textContent = e.target.value;
                    this.updateGroupIntensity(group.id, e.target.value);
                });
            }
        });
    }
    
    showAddGroup() {
        const deviceSelect = document.getElementById('groupDeviceSelect');
        deviceSelect.innerHTML = this.devices.map(device => `<label class="device-select-item"><input type="checkbox" value="${device.id}"><span>${device.name}</span></label>`).join('');
        this.showModal('addGroupModal');
    }
    
    async addScene() {
        const name = document.getElementById('sceneName').value.trim();
        if (!name) { this.showToast('Bitte Szenenname eingeben', 'error'); return; }
        if (this.devices.length === 0) { this.showToast('Keine Geräte vorhanden', 'error'); return; }
        try {
            const response = await fetch('/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color: this.selectedSceneColor })
            });
            if (response.ok) { this.showToast('Szene erstellt', 'success'); this.closeModal('addSceneModal'); document.getElementById('sceneName').value = ''; }
        } catch (error) { console.error(error); this.showToast('Fehler', 'error'); }
    }
    
    async deleteScene(sceneId) {
        if (!confirm('Szene wirklich löschen?')) return;
        try {
            await fetch(`/api/scenes/${sceneId}`, { method: 'DELETE' });
            this.showToast('Szene gelöscht', 'success');
        } catch (error) { console.error(error); }
    }
    
    async activateScene(sceneId) {
        try {
            await fetch(`/api/scenes/${sceneId}/activate`, { method: 'POST' });
            this.showToast('Fade zur Szene...', 'success');
        } catch (error) { console.error(error); }
    }
    
    renderScenes() {
        const container = document.getElementById('scenesContainer');
        if (this.scenes.length === 0) {
            container.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 64 64"><rect x="12" y="12" width="40" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg><h3>Keine Szenen vorhanden</h3><p>Speichere die aktuelle Lichtstimmung als Szene</p></div>';
            return;
        }
        container.innerHTML = this.scenes.map(scene => `<div class="scene-card"><button class="scene-btn scene-${scene.color}" onclick="app.activateScene('${scene.id}')">${scene.name}</button><button class="scene-delete" onclick="app.deleteScene('${scene.id}')">Löschen</button></div>`).join('');
    }
    
    createEffect(effectType) {
        this.currentEffect = { type: effectType, name: '', target_ids: [], params: {}, is_group: false };
        this.showEffectConfig(effectType);
    }
    
    showEffectConfig(effectType) {
        const configBody = document.getElementById('effectConfigBody');
        const effectNames = { 'strobe': 'Stroboskop', 'rainbow': 'Regenbogen', 'chase': 'Lauflicht', 'pulse': 'Pulsieren', 'color_fade': 'Farbwechsel' };
        let html = `<div class="form-group"><label>Effektname</label><input type="text" id="effectName" placeholder="${effectNames[effectType]}" class="input" value="${effectNames[effectType]}"></div><div class="form-group"><label>Ziel</label><div class="button-group"><button class="btn-option active" data-target="devices" onclick="app.selectEffectTarget('devices')">Geräte</button><button class="btn-option" data-target="groups" onclick="app.selectEffectTarget('groups')">Gruppen</button></div></div><div class="form-group"><label id="targetLabel">Geräte auswählen</label><div class="device-select" id="effectTargetSelect">${this.devices.map(device => `<label class="device-select-item"><input type="checkbox" value="${device.id}" class="effect-target-cb"><span>${device.name}</span></label>`).join('')}</div></div><div class="form-group"><label>Geschwindigkeit</label><input type="range" id="effectSpeed" class="slider" min="0.01" max="1" step="0.01" value="0.1"><span id="effectSpeedValue">0.1s</span></div>`;
        configBody.innerHTML = html;
        document.getElementById('effectSpeed').addEventListener('input', (e) => { document.getElementById('effectSpeedValue').textContent = e.target.value + 's'; });
        this.showModal('configEffectModal');
    }
    
    selectEffectTarget(targetType) {
        document.querySelectorAll('#effectConfigBody .btn-option').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        const targetSelect = document.getElementById('effectTargetSelect');
        const targetLabel = document.getElementById('targetLabel');
        if (targetType === 'devices') {
            targetLabel.textContent = 'Geräte auswählen';
            targetSelect.innerHTML = this.devices.map(device => `<label class="device-select-item"><input type="checkbox" value="${device.id}" class="effect-target-cb"><span>${device.name}</span></label>`).join('');
            this.currentEffect.is_group = false;
        } else {
            targetLabel.textContent = 'Gruppen auswählen';
            targetSelect.innerHTML = this.groups.map(group => `<label class="device-select-item"><input type="checkbox" value="${group.id}" class="effect-target-cb"><span>${group.name}</span></label>`).join('');
            this.currentEffect.is_group = true;
        }
    }
    
    async saveEffect() {
        const name = document.getElementById('effectName').value.trim();
        if (!name) { this.showToast('Bitte Effektnamen eingeben', 'error'); return; }
        const targetIds = Array.from(document.querySelectorAll('.effect-target-cb:checked')).map(cb => cb.value);
        if (targetIds.length === 0) { this.showToast('Bitte Ziele auswählen', 'error'); return; }
        const speed = parseFloat(document.getElementById('effectSpeed').value);
        this.currentEffect.name = name;
        this.currentEffect.target_ids = targetIds;
        this.currentEffect.params = { speed };
        try {
            const response = await fetch('/api/effects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentEffect)
            });
            if (response.ok) { this.showToast('Effekt erstellt', 'success'); this.closeModal('configEffectModal'); }
        } catch (error) { console.error(error); this.showToast('Fehler', 'error'); }
    }
    
    async toggleEffect(effectId) {
        const effect = this.effects.find(e => e.id === effectId);
        if (!effect) return;
        const isActive = effect.active;
        try {
            const endpoint = isActive ? 'stop' : 'start';
            const response = await fetch(`/api/effects/${effectId}/${endpoint}`, { method: 'POST' });
            if (response.ok) {
                effect.active = !isActive;
                this.renderEffects();
                this.showToast(isActive ? 'Effekt gestoppt' : 'Effekt gestartet', 'success');
            }
        } catch (error) { console.error(error); }
    }
    
    async deleteEffect(effectId) {
        if (!confirm('Effekt wirklich löschen?')) return;
        try {
            await fetch(`/api/effects/${effectId}`, { method: 'DELETE' });
            this.showToast('Effekt gelöscht', 'success');
        } catch (error) { console.error(error); }
    }
    
    renderEffects() {
        const container = document.getElementById('effectsContainer');
        if (this.effects.length === 0) {
            container.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 64 64"><path d="M32 12 L40 32 L32 52 L24 32 Z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg><h3>Keine Effekte vorhanden</h3><p>Erstelle deinen ersten Lichteffekt</p></div>';
            return;
        }
        const effectIcons = { 'strobe': '⚡', 'rainbow': '🌈', 'chase': '🔄', 'pulse': '💓', 'color_fade': '🎨' };
        container.innerHTML = this.effects.map(effect => `<div class="effect-card ${effect.active ? 'active' : ''}"><div class="effect-info"><h3>${effectIcons[effect.type]} ${effect.name}</h3><p>${effect.is_group ? 'Gruppen' : 'Geräte'}: ${effect.target_ids.length}</p></div><div class="effect-controls"><button class="btn ${effect.active ? 'btn-danger' : 'btn-success'}" onclick="app.toggleEffect('${effect.id}')">${effect.active ? 'Stop' : 'Start'}</button><button class="btn btn-secondary btn-icon" onclick="app.deleteEffect('${effect.id}')">×</button></div></div>`).join('');
    }
    
    showModal(modalId) { document.getElementById(modalId).classList.add('active'); }
    closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }
    showAddDevice() { this.showModal('addDeviceModal'); }
    showAddScene() { if (this.devices.length === 0) { this.showToast('Bitte zuerst Geräte hinzufügen', 'error'); return; } this.showModal('addSceneModal'); }
    
    selectDeviceType(type) {
        this.selectedDeviceType = type;
        document.querySelectorAll('#addDeviceModal .btn-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === type) btn.classList.add('active');
        });
    }
    
    selectSceneColor(color) {
        this.selectedSceneColor = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === color) btn.classList.add('active');
        });
    }
    
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
    
    getChannelCount(deviceType) { return { dimmer: 1, rgb: 3, rgbw: 4 }[deviceType] || 1; }
    getChannelLabels(deviceType) {
        const labels = { dimmer: ['Helligkeit'], rgb: ['Rot', 'Grün', 'Blau'], rgbw: ['Rot', 'Grün', 'Blau', 'Weiß'] };
        return labels[deviceType] || ['Wert'];
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
            }
        });
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => e.target.parentElement.classList.remove('active'));
        });
    }

    // ===== Fixture Library =====
    async loadFixtures() {
        try {
            const response = await fetch('/api/fixtures/categories');
            const data = await response.json();
            this.fixtures = data.categories;
            this.populateFixtureSelect();
        } catch (error) {
            console.error('Error loading fixtures:', error);
        }
    }

    populateFixtureSelect() {
        const select = document.getElementById('fixtureSelect');
        const categoryNames = {
            'dimmer': 'Dimmer',
            'rgb': 'RGB',
            'rgbw': 'RGBW',
            'moving_head': 'Moving Heads',
            'par': 'PAR-Cans',
            'led_bar': 'LED Bars',
            'wash': 'Wash Lights',
            'beam': 'Beam Lights',
            'strobe': 'Strobes',
            'laser': 'Laser',
            'effect': 'Effekte',
            'panel': 'LED Panels'
        };

        for (const [category, fixtures] of Object.entries(this.fixtures)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = categoryNames[category] || category;

            fixtures.forEach(fixture => {
                const option = document.createElement('option');
                option.value = fixture.id;
                option.textContent = `${fixture.manufacturer} ${fixture.model} (${fixture.channels}CH)`;
                optgroup.appendChild(option);
            });

            select.appendChild(optgroup);
        }
    }

    async selectFixture() {
        const fixtureId = document.getElementById('fixtureSelect').value;
        const manualTypeGroup = document.getElementById('manualTypeGroup');
        const fixtureInfo = document.getElementById('fixtureInfo');
        const fixtureInfoText = document.getElementById('fixtureInfoText');

        if (!fixtureId) {
            manualTypeGroup.style.display = 'block';
            fixtureInfo.style.display = 'none';
            this.selectedFixture = null;
            return;
        }

        try {
            const response = await fetch(`/api/fixtures/${fixtureId}`);
            const data = await response.json();
            const fixture = data.fixture;

            if (fixture) {
                this.selectedFixture = fixture;
                manualTypeGroup.style.display = 'none';
                fixtureInfo.style.display = 'block';
                fixtureInfoText.textContent = `${fixture.manufacturer} ${fixture.model} - ${fixture.channels} Kanäle`;

                if (!document.getElementById('deviceName').value) {
                    document.getElementById('deviceName').value = `${fixture.manufacturer} ${fixture.model}`;
                }
            }
        } catch (error) {
            console.error('Error loading fixture:', error);
        }
    }

    // ===== Sound & Audio =====
    async toggleSound() {
        if (!this.audioAnalyzer) {
            this.audioAnalyzer = new AudioAnalyzer((audioData) => this.handleAudioData(audioData));
            this.currentAudioData = null;
        }

        const btn = document.getElementById('startSoundBtn');
        const status = document.getElementById('soundStatus');
        const levelsDisplay = document.getElementById('soundLevelsDisplay');

        // Settings page elements
        const settingsBtn = document.getElementById('settingsStartSoundBtn');
        const settingsStatus = document.getElementById('settingsSoundStatus');
        const settingsLevelsDisplay = document.getElementById('settingsSoundLevelsDisplay');

        if (this.audioAnalyzer.isActive) {
            this.audioAnalyzer.stop();
            if (btn) btn.textContent = '🎤 Audio aktivieren';
            if (status) {
                status.textContent = 'Inaktiv';
                status.style.color = 'var(--text-secondary)';
            }
            if (levelsDisplay) levelsDisplay.style.display = 'none';

            if (settingsBtn) settingsBtn.textContent = '🎤 Audio aktivieren';
            if (settingsStatus) {
                settingsStatus.textContent = 'Inaktiv';
                settingsStatus.style.color = 'var(--text-secondary)';
            }
            if (settingsLevelsDisplay) settingsLevelsDisplay.style.display = 'none';
        } else {
            const success = await this.audioAnalyzer.start();
            if (success) {
                if (btn) btn.textContent = '🔇 Audio deaktivieren';
                if (status) {
                    status.textContent = 'Aktiv';
                    status.style.color = 'var(--success)';
                }
                if (levelsDisplay) levelsDisplay.style.display = 'block';

                if (settingsBtn) settingsBtn.textContent = '🔇 Audio deaktivieren';
                if (settingsStatus) {
                    settingsStatus.textContent = 'Aktiv';
                    settingsStatus.style.color = 'var(--success)';
                }
                if (settingsLevelsDisplay) settingsLevelsDisplay.style.display = 'block';

                this.showToast('Audio-Analyse aktiviert', 'success');
            } else {
                this.showToast('Mikrofon-Zugriff verweigert', 'error');
            }
        }
    }

    handleAudioData(audioData) {
        this.currentAudioData = audioData;

        const levelBar = document.getElementById('soundLevelBar');
        const levelText = document.getElementById('soundLevelText');
        if (levelBar && levelText) {
            const percent = Math.round(audioData.overall * 100);
            levelBar.style.width = percent + '%';
            levelText.textContent = percent + '%';
        }

        if (document.getElementById('effectEditorModal') && document.getElementById('effectEditorModal').classList.contains('active')) {
            this.updateSoundVisualizer(audioData);
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'audio_data',
                data: {
                    bass: audioData.bass,
                    mid: audioData.mid,
                    high: audioData.high,
                    overall: audioData.overall,
                    peak: audioData.peak
                }
            }));
        }
    }

    updateSoundVisualizer(audioData) {
        // Update frequency levels in effect panel
        const levelBass = document.getElementById('levelBass');
        const levelMid = document.getElementById('levelMid');
        const levelHigh = document.getElementById('levelHigh');

        if (levelBass) levelBass.style.width = (audioData.bass * 100) + '%';
        if (levelMid) levelMid.style.width = (audioData.mid * 100) + '%';
        if (levelHigh) levelHigh.style.width = (audioData.high * 100) + '%';

        // Update frequency levels in settings page
        const settingsLevelBass = document.getElementById('settingsLevelBass');
        const settingsLevelMid = document.getElementById('settingsLevelMid');
        const settingsLevelHigh = document.getElementById('settingsLevelHigh');

        if (settingsLevelBass) settingsLevelBass.style.width = (audioData.bass * 100) + '%';
        if (settingsLevelMid) settingsLevelMid.style.width = (audioData.mid * 100) + '%';
        if (settingsLevelHigh) settingsLevelHigh.style.width = (audioData.high * 100) + '%';

        // Update settings page level bar and text
        const settingsSoundLevelBar = document.getElementById('settingsSoundLevelBar');
        const settingsSoundLevelText = document.getElementById('settingsSoundLevelText');
        if (settingsSoundLevelBar) settingsSoundLevelBar.style.width = (audioData.overall * 100) + '%';
        if (settingsSoundLevelText) settingsSoundLevelText.textContent = Math.round(audioData.overall * 100) + '%';

        const canvas = document.getElementById('soundVisualizerCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = 'getComputedStyle(document.body).getPropertyValue("--bg-primary")' || '#0f172a';
        ctx.fillRect(0, 0, width, height);

        if (audioData.raw && audioData.raw.length > 0) {
            const barWidth = width / Math.min(audioData.raw.length, 64);
            const maxHeight = height;
            const step = Math.floor(audioData.raw.length / 64);

            for (let i = 0; i < 64; i++) {
                const dataIndex = Math.floor(i * step);
                const barHeight = (audioData.raw[dataIndex] / 255) * maxHeight;
                const hue = (i / 64) * 180 + 180;
                ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                ctx.fillRect(i * barWidth, maxHeight - barHeight, barWidth - 1, barHeight);
            }
        }

        // Update settings page spectrum analyzer
        const settingsCanvas = document.getElementById('settingsSpectrumCanvas');
        if (settingsCanvas && audioData.raw && audioData.raw.length > 0) {
            const settingsCtx = settingsCanvas.getContext('2d');
            const settingsWidth = settingsCanvas.width;
            const settingsHeight = settingsCanvas.height;

            settingsCtx.fillStyle = 'rgba(30, 41, 59, 0.8)';
            settingsCtx.fillRect(0, 0, settingsWidth, settingsHeight);

            const barWidth = settingsWidth / Math.min(audioData.raw.length, 64);
            const maxHeight = settingsHeight;
            const step = Math.floor(audioData.raw.length / 64);

            for (let i = 0; i < 64; i++) {
                const dataIndex = Math.floor(i * step);
                const barHeight = (audioData.raw[dataIndex] / 255) * maxHeight;
                const hue = (i / 64) * 180 + 180;
                settingsCtx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                settingsCtx.fillRect(i * barWidth, maxHeight - barHeight, barWidth - 1, barHeight);
            }
        }
    }

    toggleSoundPanel() {
        const panel = document.getElementById('soundControlPanel');
        const body = panel.querySelector('.sound-panel-body');
        const btn = panel.querySelector('.btn-icon');

        if (body.style.display === 'none') {
            body.style.display = 'block';
            btn.textContent = '−';
        } else {
            body.style.display = 'none';
            btn.textContent = '+';
        }
    }

    // ===== Effect Editor =====
    createEffect(type) {
        this.currentEffectConfig = {
            type: type,
            name: '',
            target_ids: [],
            is_group: false,
            params: {},
            sound_reactive: false,
            sound_config: {}
        };

        this.openEffectEditor();
    }

    openEffectEditor() {
        const modal = document.getElementById('effectEditorModal');
        const title = document.getElementById('effectEditorTitle');

        modal.classList.add('active');
        title.textContent = this.currentEffectConfig.name || 'Neuer Effekt';

        document.getElementById('effectEditorType').value = this.currentEffectConfig.type || 'strobe';
        this.populateEffectTargets();
        this.updateEffectEditorParams();
        this.initEffectPreview();

        document.getElementById('effectSoundReactive').checked = this.currentEffectConfig.sound_reactive || false;
        this.toggleSoundReactive();
    }

    closeEffectEditor() {
        const modal = document.getElementById('effectEditorModal');
        modal.classList.remove('active');
        this.stopPreviewEffect();
        this.currentEffectConfig = null;
    }

    populateEffectTargets() {
        const deviceSelect = document.getElementById('effectDeviceSelect');
        deviceSelect.innerHTML = '';

        this.devices.forEach(device => {
            const label = document.createElement('label');
            label.className = 'device-select-item';
            label.innerHTML = `
                <input type="checkbox" value="${device.id}" onchange="app.updateEffectTarget()">
                <span>${device.name}</span>
            `;
            deviceSelect.appendChild(label);
        });

        const groupSelect = document.getElementById('effectGroupSelect');
        groupSelect.innerHTML = '';

        this.groups.forEach(group => {
            const label = document.createElement('label');
            label.className = 'device-select-item';
            label.innerHTML = `
                <input type="checkbox" value="${group.id}" onchange="app.updateEffectTarget()">
                <span>${group.name}</span>
            `;
            groupSelect.appendChild(label);
        });
    }

    selectEffectTargetType(type) {
        const deviceContainer = document.getElementById('effectTargetDevices');
        const groupContainer = document.getElementById('effectTargetGroups');
        const btns = document.querySelectorAll('.target-selector .btn-option');

        btns.forEach(btn => {
            if (btn.dataset.target === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (type === 'devices') {
            deviceContainer.style.display = 'block';
            groupContainer.style.display = 'none';
            this.currentEffectConfig.is_group = false;
        } else {
            deviceContainer.style.display = 'none';
            groupContainer.style.display = 'block';
            this.currentEffectConfig.is_group = true;
        }
    }

    updateEffectTarget() {
        const isGroup = this.currentEffectConfig.is_group;
        const container = isGroup ?
            document.getElementById('effectGroupSelect') :
            document.getElementById('effectDeviceSelect');

        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        this.currentEffectConfig.target_ids = Array.from(checkboxes).map(cb => cb.value);
    }

    updateEffectEditorParams() {
        const type = document.getElementById('effectEditorType').value;
        const paramsContainer = document.getElementById('effectEditorParams');

        this.currentEffectConfig.type = type;

        let paramsHTML = '';

        switch (type) {
            case 'strobe':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit (Blitze/Sek)</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="20" value="10" oninput="app.updateParamValue('speed', this.value)">
                        <div class="slider-value" id="paramSpeedValue">10 Hz</div>
                    </div>
                `;
                break;

            case 'rainbow':
            case 'chase':
            case 'color_fade':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="100" value="50" oninput="app.updateParamValue('speed', this.value)">
                        <div class="slider-value" id="paramSpeedValue">50%</div>
                    </div>
                `;
                break;

            case 'pulse':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="100" value="50" oninput="app.updateParamValue('speed', this.value)">
                        <div class="slider-value" id="paramSpeedValue">50%</div>
                    </div>
                    <div class="form-group">
                        <label>Minimale Helligkeit (%)</label>
                        <input type="range" id="paramMin" class="slider" min="0" max="100" value="0" oninput="app.updateParamValue('min', this.value)">
                        <div class="slider-value" id="paramMinValue">0%</div>
                    </div>
                `;
                break;

            case 'sound_reactive':
                paramsHTML = `
                    <div class="form-group">
                        <label>Effekt-Modus</label>
                        <select id="paramMode" class="input" onchange="app.updateParamValue('mode', this.value)">
                            <option value="flash">Flash (Blitze)</option>
                            <option value="intensity">Intensität</option>
                            <option value="color">Farbwechsel</option>
                        </select>
                    </div>
                `;
                break;

            case 'fire':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="100" value="50" oninput="app.updateParamValue('speed', this.value / 1000)">
                        <div class="slider-value" id="paramSpeedValue">50ms</div>
                    </div>
                    <div class="form-group">
                        <label>Intensität</label>
                        <input type="range" id="paramIntensity" class="slider" min="0" max="100" value="100" oninput="app.updateParamValue('intensity', this.value / 100)">
                        <div class="slider-value" id="paramIntensityValue">100%</div>
                    </div>
                `;
                break;

            case 'lightning':
                paramsHTML = `
                    <div class="form-group">
                        <label>Min. Verzögerung (Sek)</label>
                        <input type="range" id="paramMinDelay" class="slider" min="1" max="10" value="5" oninput="app.updateParamValue('min_delay', this.value / 10)">
                        <div class="slider-value" id="paramMinDelayValue">0.5s</div>
                    </div>
                    <div class="form-group">
                        <label>Max. Verzögerung (Sek)</label>
                        <input type="range" id="paramMaxDelay" class="slider" min="10" max="50" value="30" oninput="app.updateParamValue('max_delay', this.value / 10)">
                        <div class="slider-value" id="paramMaxDelayValue">3.0s</div>
                    </div>
                `;
                break;

            case 'scanner':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="100" value="50" oninput="app.updateParamValue('speed', this.value / 500)">
                        <div class="slider-value" id="paramSpeedValue">50%</div>
                    </div>
                    <div class="form-group">
                        <label>Bewegungsbereich (Grad)</label>
                        <input type="range" id="paramRange" class="slider" min="30" max="270" value="180" oninput="app.updateParamValue('range', this.value)">
                        <div class="slider-value" id="paramRangeValue">180°</div>
                    </div>
                `;
                break;

            case 'matrix':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="100" value="50" oninput="app.updateParamValue('speed', this.value / 250)">
                        <div class="slider-value" id="paramSpeedValue">50%</div>
                    </div>
                    <div class="form-group">
                        <label>Muster</label>
                        <select id="paramPattern" class="input" onchange="app.updateParamValue('pattern', this.value)">
                            <option value="wave">Welle</option>
                            <option value="circle">Kreis</option>
                            <option value="checkerboard">Schachbrett</option>
                        </select>
                    </div>
                `;
                break;

            case 'twinkle':
                paramsHTML = `
                    <div class="form-group">
                        <label>Geschwindigkeit</label>
                        <input type="range" id="paramSpeed" class="slider" min="1" max="100" value="50" oninput="app.updateParamValue('speed', this.value / 500)">
                        <div class="slider-value" id="paramSpeedValue">50%</div>
                    </div>
                    <div class="form-group">
                        <label>Dichte</label>
                        <input type="range" id="paramDensity" class="slider" min="0" max="100" value="30" oninput="app.updateParamValue('density', this.value / 100)">
                        <div class="slider-value" id="paramDensityValue">30%</div>
                    </div>
                `;
                break;
        }

        paramsContainer.innerHTML = paramsHTML;
    }

    updateParamValue(param, value) {
        this.currentEffectConfig.params[param] = parseFloat(value);

        const valueDisplay = document.getElementById(`param${param.charAt(0).toUpperCase() + param.slice(1)}Value`);
        if (valueDisplay) {
            if (param === 'speed' && this.currentEffectConfig.type === 'strobe') {
                valueDisplay.textContent = value + ' Hz';
            } else {
                valueDisplay.textContent = value + '%';
            }
        }
    }

    toggleSoundReactive() {
        const checkbox = document.getElementById('effectSoundReactive');
        const config = document.getElementById('soundReactivityConfig');
        const visualizer = document.getElementById('soundVisualizer');

        if (checkbox.checked) {
            config.style.display = 'block';
            visualizer.style.display = 'block';
            this.currentEffectConfig.sound_reactive = true;

            if (!this.audioAnalyzer || !this.audioAnalyzer.isActive) {
                this.toggleSound();
            }
        } else {
            config.style.display = 'none';
            visualizer.style.display = 'none';
            this.currentEffectConfig.sound_reactive = false;
        }
    }

    initEffectPreview() {
        const canvas = document.getElementById('effectPreviewCanvas');
        if (!canvas) return;

        this.previewCanvas = canvas;
        this.previewCtx = canvas.getContext('2d');
        this.previewAnimation = null;
    }

    previewEffect() {
        if (!this.previewCanvas || !this.previewCtx) return;

        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const width = canvas.width;
        const height = canvas.height;

        let frame = 0;
        const type = this.currentEffectConfig.type;

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            const numLights = 8;
            const lightWidth = (width - 40) / numLights;
            const lightHeight = height - 40;

            for (let i = 0; i < numLights; i++) {
                const x = 20 + i * lightWidth;
                const y = 20;

                let color = '#475569';

                switch (type) {
                    case 'strobe':
                        color = frame % 10 < 2 ? '#ffffff' : '#1e293b';
                        break;

                    case 'rainbow':
                        const hue = (frame * 2 + i * 45) % 360;
                        color = `hsl(${hue}, 70%, 60%)`;
                        break;

                    case 'chase':
                        const active = Math.floor(frame / 5) % numLights;
                        color = i === active ? '#3b82f6' : '#1e293b';
                        break;

                    case 'pulse':
                        const intensity = (Math.sin(frame * 0.1) + 1) / 2;
                        const brightness = Math.floor(intensity * 255);
                        color = `rgb(${brightness}, ${brightness}, ${brightness})`;
                        break;

                    case 'color_fade':
                        const hue2 = (frame * 3) % 360;
                        color = `hsl(${hue2}, 70%, 60%)`;
                        break;

                    case 'sound_reactive':
                        if (this.currentAudioData) {
                            const level = this.currentAudioData.overall;
                            const brightness = Math.floor(level * 255);
                            color = `rgb(${brightness}, ${brightness / 2}, ${brightness})`;
                        }
                        break;

                    case 'fire':
                        const flicker = Math.random() * 0.3 + 0.7;
                        const fireRed = Math.floor(255 * flicker);
                        const fireGreen = Math.floor((100 * flicker) * Math.random());
                        color = `rgb(${fireRed}, ${fireGreen}, 0)`;
                        break;

                    case 'lightning':
                        if (frame % 60 < 3 || (frame % 60 >= 5 && frame % 60 < 7)) {
                            color = '#ffffff';
                        } else {
                            color = '#1e293b';
                        }
                        break;

                    case 'scanner':
                        const scanPos = (Math.sin(frame * 0.05) + 1) / 2;
                        const activeScanner = Math.floor(scanPos * numLights);
                        color = i === activeScanner ? '#3b82f6' : '#1e293b';
                        break;

                    case 'matrix':
                        const waveIntensity = (Math.sin(frame * 0.1 + i * 0.5) + 1) / 2;
                        const matrixBrightness = Math.floor(waveIntensity * 255);
                        color = `rgb(${matrixBrightness}, ${matrixBrightness}, ${matrixBrightness})`;
                        break;

                    case 'twinkle':
                        if (Math.random() < 0.3) {
                            const twinkleBrightness = Math.floor(Math.random() * 55 + 200);
                            color = `rgb(${twinkleBrightness}, ${twinkleBrightness}, ${twinkleBrightness})`;
                        } else {
                            const dimBrightness = Math.floor(Math.random() * 50);
                            color = `rgb(${dimBrightness}, ${dimBrightness}, ${dimBrightness})`;
                        }
                        break;
                }

                ctx.fillStyle = color;
                ctx.fillRect(x, y, lightWidth - 5, lightHeight);
            }

            frame++;
            this.previewAnimation = requestAnimationFrame(animate);
        };

        animate();
    }

    stopPreviewEffect() {
        if (this.previewAnimation) {
            cancelAnimationFrame(this.previewAnimation);
            this.previewAnimation = null;

            if (this.previewCtx && this.previewCanvas) {
                this.previewCtx.fillStyle = '#0f172a';
                this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            }
        }
    }

    async saveEffectFromEditor() {
        const name = document.getElementById('effectEditorName').value;
        if (!name) {
            this.showToast('Bitte gib einen Effekt-Namen ein', 'error');
            return;
        }

        if (this.currentEffectConfig.target_ids.length === 0) {
            this.showToast('Bitte wähle mindestens ein Ziel aus', 'error');
            return;
        }

        this.currentEffectConfig.name = name;

        if (this.currentEffectConfig.sound_reactive) {
            this.currentEffectConfig.sound_config = {
                frequency_band: document.getElementById('soundFrequencyBand').value,
                sensitivity: parseInt(document.getElementById('soundSensitivity').value) / 100,
                control_param: document.getElementById('soundControlParam').value
            };
        }

        try {
            const response = await fetch('/api/effects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentEffectConfig)
            });

            if (response.ok) {
                const data = await response.json();
                this.showToast('Effekt erstellt', 'success');
                this.closeEffectEditor();
                this.stopPreviewEffect();

                await this.startEffect(data.effect.id);
            } else {
                this.showToast('Fehler beim Erstellen des Effekts', 'error');
            }
        } catch (error) {
            console.error('Error creating effect:', error);
            this.showToast('Fehler beim Erstellen des Effekts', 'error');
        }
    }

    // ===== Sequence/Timeline Management =====
    showAddSequence() {
        this.currentSequence = {
            name: '',
            steps: [],
            loop: false
        };
        this.openSequenceEditor();
    }

    openSequenceEditor() {
        const modal = document.getElementById('sequenceEditorModal');
        modal.classList.add('active');

        document.getElementById('sequenceName').value = this.currentSequence.name || '';
        document.getElementById('sequenceLoop').checked = this.currentSequence.loop || false;

        this.renderSequenceSteps();
    }

    closeSequenceEditor() {
        const modal = document.getElementById('sequenceEditorModal');
        modal.classList.remove('active');
        this.currentSequence = null;
    }

    addSequenceStep(type) {
        if (!this.currentSequence) return;

        const step = {
            type: type,
            target_id: '',
            duration: type === 'wait' ? 1000 : 5000
        };

        this.currentSequence.steps.push(step);
        this.renderSequenceSteps();
    }

    removeSequenceStep(index) {
        if (!this.currentSequence) return;

        this.currentSequence.steps.splice(index, 1);
        this.renderSequenceSteps();
    }

    updateSequenceStep(index, field, value) {
        if (!this.currentSequence) return;

        this.currentSequence.steps[index][field] = value;
    }

    renderSequenceSteps() {
        const container = document.getElementById('sequenceSteps');
        if (!this.currentSequence || this.currentSequence.steps.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Keine Steps vorhanden. Füge einen Step hinzu!</p>';
            return;
        }

        container.innerHTML = this.currentSequence.steps.map((step, index) => {
            let targetOptions = '';

            if (step.type === 'scene') {
                targetOptions = this.scenes.map(scene =>
                    `<option value="${scene.id}" ${step.target_id === scene.id ? 'selected' : ''}>${scene.name}</option>`
                ).join('');
            } else if (step.type === 'effect') {
                targetOptions = this.effects.map(effect =>
                    `<option value="${effect.id}" ${step.target_id === effect.id ? 'selected' : ''}>${effect.name}</option>`
                ).join('');
            }

            const durationSec = (step.duration || 0) / 1000;

            return `
                <div class="sequence-step">
                    <div class="sequence-step-number">${index + 1}</div>
                    <div class="sequence-step-content">
                        <div class="sequence-step-row">
                            <span class="sequence-step-type">${step.type}</span>
                            ${step.type !== 'wait' ? `
                                <select class="input sequence-step-select" onchange="app.updateSequenceStep(${index}, 'target_id', this.value)">
                                    <option value="">-- Auswählen --</option>
                                    ${targetOptions}
                                </select>
                            ` : '<span style="flex: 1;">Pause</span>'}
                        </div>
                        <div class="sequence-step-row">
                            <div class="sequence-step-duration">
                                <label style="font-size: 0.875rem;">Dauer:</label>
                                <input type="number" class="input" value="${durationSec}" min="0" step="0.5"
                                    onchange="app.updateSequenceStep(${index}, 'duration', this.value * 1000)">
                                <span style="font-size: 0.875rem;">Sek</span>
                            </div>
                        </div>
                    </div>
                    <div class="sequence-step-actions">
                        <button class="btn-icon btn-danger" onclick="app.removeSequenceStep(${index})">
                            ×
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async saveSequence() {
        const name = document.getElementById('sequenceName').value;
        if (!name) {
            this.showToast('Bitte gib einen Namen ein', 'error');
            return;
        }

        if (!this.currentSequence.steps.length) {
            this.showToast('Füge mindestens einen Step hinzu', 'error');
            return;
        }

        this.currentSequence.name = name;
        this.currentSequence.loop = document.getElementById('sequenceLoop').checked;

        try {
            const method = this.currentSequence.id ? 'PUT' : 'POST';
            const url = this.currentSequence.id
                ? `/api/sequences/${this.currentSequence.id}`
                : '/api/sequences';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentSequence)
            });

            if (response.ok) {
                this.showToast('Timeline gespeichert', 'success');
                this.closeSequenceEditor();
            } else {
                this.showToast('Fehler beim Speichern', 'error');
            }
        } catch (error) {
            console.error('Error saving sequence:', error);
            this.showToast('Fehler beim Speichern', 'error');
        }
    }

    renderSequences() {
        const container = document.getElementById('sequencesContainer');

        if (!this.sequences || this.sequences.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                        <rect x="8" y="24" width="12" height="16" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                        <rect x="26" y="16" width="12" height="32" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                        <rect x="44" y="20" width="12" height="24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                    </svg>
                    <h3>Keine Timeline vorhanden</h3>
                    <p>Erstelle eine Timeline-Sequence für automatisierte Abläufe</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.sequences.map(seq => `
            <div class="card">
                <div class="card-header">
                    <h3>${seq.name}</h3>
                    <span class="badge">${seq.steps.length} Steps</span>
                </div>
                <div class="card-body">
                    <div class="card-info">
                        ${seq.loop ? '<span class="badge">🔁 Loop</span>' : ''}
                        <span style="font-size: 0.875rem; color: var(--text-secondary);">
                            ${this.formatSequenceDuration(seq)}
                        </span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-success btn-sm" onclick="app.playSequence('${seq.id}')">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M4 2 L12 8 L4 14 Z" fill="currentColor"/>
                        </svg>
                        Play
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="app.stopSequence('${seq.id}')">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <rect x="4" y="4" width="8" height="8" fill="currentColor"/>
                        </svg>
                        Stop
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteSequence('${seq.id}')">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    formatSequenceDuration(seq) {
        const totalMs = seq.steps.reduce((sum, step) => sum + (step.duration || 0), 0);
        const seconds = Math.floor(totalMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    }

    async playSequence(sequenceId) {
        try {
            const response = await fetch(`/api/sequences/${sequenceId}/play`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showToast('Timeline gestartet', 'success');
            }
        } catch (error) {
            console.error('Error playing sequence:', error);
            this.showToast('Fehler beim Starten', 'error');
        }
    }

    async stopSequence(sequenceId) {
        try {
            const response = await fetch(`/api/sequences/${sequenceId}/stop`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showToast('Timeline gestoppt', 'success');
            }
        } catch (error) {
            console.error('Error stopping sequence:', error);
            this.showToast('Fehler beim Stoppen', 'error');
        }
    }

    async deleteSequence(sequenceId) {
        if (!confirm('Timeline wirklich löschen?')) return;

        try {
            const response = await fetch(`/api/sequences/${sequenceId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showToast('Timeline gelöscht', 'success');
            }
        } catch (error) {
            console.error('Error deleting sequence:', error);
            this.showToast('Fehler beim Löschen', 'error');
        }
    }

    // ===== Visual Effect Designer =====
    openVisualDesigner() {
        this.designerMode = 'spot';
        this.designerKeyframes = [];
        this.currentKeyframeIndex = -1;
        this.previewPlaying = false;
        this.previewProgress = 0;

        // Populate devices dropdown
        const select = document.getElementById('customEffectDevices');
        select.innerHTML = '';
        this.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.name;
            select.appendChild(option);
        });

        // Show modal first
        document.getElementById('visualDesignerModal').classList.add('active');

        // Initialize timeline after modal is visible (so we can measure container width)
        setTimeout(() => {
            this.initializeTimeline();

            // Add default keyframes
            this.designerKeyframes = [
                { time: 0, values: { default: [255, 255, 255] }, easing: 'linear' },
                { time: 100, values: { default: [255, 0, 0] }, easing: 'linear' }
            ];
            this.updateKeyframeList();
            this.drawTimeline();
        }, 50);
    }

    closeVisualDesigner() {
        if (this.previewPlaying) {
            this.stopPreview();
        }
        document.getElementById('visualDesignerModal').classList.remove('active');
        this.designerKeyframes = [];
        this.currentKeyframeIndex = -1;
    }

    setDesignerMode(mode) {
        this.designerMode = mode;

        // Update button states
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });

        // Show/hide appropriate editors
        document.getElementById('spotKeyframeEditor').style.display = mode === 'spot' ? 'block' : 'none';
        document.getElementById('stripKeyframeEditor').style.display = mode === 'strip' ? 'block' : 'none';

        // Reset keyframes when switching modes (they have different structures)
        this.designerKeyframes = [];
        this.currentKeyframeIndex = -1;
        document.getElementById('keyframeEditor').style.display = 'none';

        // Initialize default keyframes for the new mode
        if (mode === 'spot') {
            this.designerKeyframes = [
                { time: 0, values: { default: [255, 255, 255] }, easing: 'linear' },
                { time: 100, values: { default: [255, 0, 0] }, easing: 'linear' }
            ];
        } else {
            this.designerKeyframes = [
                { time: 0, pattern_type: 'solid', pattern: { color: [255, 255, 255] }, easing: 'linear' },
                { time: 100, pattern_type: 'solid', pattern: { color: [255, 0, 0] }, easing: 'linear' }
            ];
        }

        this.drawTimeline();
    }

    initializeTimeline() {
        const canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Make canvas responsive - set the actual canvas resolution
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width - 32; // Subtract padding
        canvas.height = 120;

        // Dragging state
        let isDragging = false;
        let draggedKeyframeIndex = -1;

        // Mouse/Touch start
        const handleStart = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            // Check if clicked on keyframe
            for (let i = 0; i < this.designerKeyframes.length; i++) {
                const kf = this.designerKeyframes[i];
                const kfX = (kf.time / 100) * canvas.width;
                const kfY = canvas.height / 2;

                const distance = Math.sqrt((x - kfX) ** 2 + (y - kfY) ** 2);
                if (distance < 15) {
                    isDragging = true;
                    draggedKeyframeIndex = i;
                    this.selectKeyframe(i);
                    e.preventDefault();
                    return;
                }
            }
        };

        // Mouse/Touch move
        const handleMove = (e) => {
            if (!isDragging || draggedKeyframeIndex < 0) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;

            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;

            // Calculate new time (0-100%)
            let newTime = (x / canvas.width) * 100;
            newTime = Math.max(0, Math.min(100, newTime));

            // Update keyframe time
            this.designerKeyframes[draggedKeyframeIndex].time = newTime;

            // Update list and redraw
            this.updateKeyframeList();
            this.drawTimeline();
            e.preventDefault();
        };

        // Mouse/Touch end
        const handleEnd = (e) => {
            if (isDragging) {
                isDragging = false;
                draggedKeyframeIndex = -1;
                this.updateKeyframeList();
                e.preventDefault();
            }
        };

        // Add event listeners
        canvas.addEventListener('mousedown', handleStart);
        canvas.addEventListener('mousemove', handleMove);
        canvas.addEventListener('mouseup', handleEnd);
        canvas.addEventListener('mouseleave', handleEnd);

        canvas.addEventListener('touchstart', handleStart);
        canvas.addEventListener('touchmove', handleMove);
        canvas.addEventListener('touchend', handleEnd);

        this.drawTimeline();
    }

    drawTimeline() {
        const canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Draw time labels
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${i * 10}%`, x + 2, 12);
        }

        // Draw center line
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw keyframe curve
        if (this.designerKeyframes.length > 1) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.beginPath();

            const sorted = [...this.designerKeyframes].sort((a, b) => a.time - b.time);
            sorted.forEach((kf, i) => {
                const x = (kf.time / 100) * width;
                const y = height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
        }

        // Draw keyframes
        this.designerKeyframes.forEach((kf, index) => {
            const x = (kf.time / 100) * width;
            const y = height / 2;

            const isSelected = index === this.currentKeyframeIndex;

            // Draw glow for selected keyframe
            if (isSelected) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw keyframe marker
            ctx.fillStyle = isSelected ? '#3b82f6' : '#f59e0b';
            ctx.beginPath();
            ctx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.stroke();

            // Draw keyframe number above
            ctx.fillStyle = isSelected ? '#3b82f6' : '#94a3b8';
            ctx.font = isSelected ? 'bold 11px sans-serif' : '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, x, y - 15);
        });
    }

    addKeyframe() {
        const duration = parseFloat(document.getElementById('customEffectDuration').value) || 10;
        const newTime = this.designerKeyframes.length > 0
            ? Math.min(100, this.designerKeyframes[this.designerKeyframes.length - 1].time + 10)
            : 50;

        let newKeyframe;

        if (this.designerMode === 'spot') {
            newKeyframe = {
                time: newTime,
                values: { default: [255, 255, 255] },
                easing: 'linear'
            };
        } else {
            newKeyframe = {
                time: newTime,
                pattern_type: 'solid',
                pattern: { color: [255, 255, 255] },
                easing: 'linear'
            };
        }

        this.designerKeyframes.push(newKeyframe);
        this.updateKeyframeList();
        this.drawTimeline();
        this.selectKeyframe(this.designerKeyframes.length - 1);
        this.showToast('Keyframe hinzugefügt', 'success');
    }

    updateKeyframeList() {
        const container = document.getElementById('keyframeListItems');
        if (!container) return;

        container.innerHTML = '';

        this.designerKeyframes.forEach((kf, index) => {
            const item = document.createElement('div');
            item.className = 'keyframe-list-item' + (index === this.currentKeyframeIndex ? ' active' : '');

            // Marker indicator
            const marker = document.createElement('div');
            marker.className = 'keyframe-marker-indicator';
            item.appendChild(marker);

            // Info
            const info = document.createElement('div');
            info.className = 'keyframe-info';

            const time = document.createElement('div');
            time.className = 'keyframe-time';
            time.textContent = `Keyframe ${index + 1}`;
            info.appendChild(time);

            const details = document.createElement('div');
            details.className = 'keyframe-details';
            details.textContent = `Position: ${kf.time.toFixed(1)}%`;
            info.appendChild(details);

            item.appendChild(info);

            // Color preview (if available)
            if (this.designerMode === 'spot' && kf.values && kf.values.default) {
                const colorPreview = document.createElement('div');
                colorPreview.className = 'keyframe-color-preview';
                const rgb = kf.values.default;
                colorPreview.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                item.appendChild(colorPreview);
            } else if (kf.pattern && kf.pattern.color) {
                const colorPreview = document.createElement('div');
                colorPreview.className = 'keyframe-color-preview';
                const rgb = kf.pattern.color;
                colorPreview.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                item.appendChild(colorPreview);
            }

            // Click to select
            item.onclick = () => this.selectKeyframe(index);

            container.appendChild(item);
        });
    }

    selectKeyframe(index) {
        this.currentKeyframeIndex = index;
        const kf = this.designerKeyframes[index];

        // Update list highlighting
        this.updateKeyframeList();

        // Redraw timeline to highlight selected keyframe
        this.drawTimeline();

        // Show keyframe editor
        document.getElementById('keyframeEditor').style.display = 'block';

        if (this.designerMode === 'spot') {
            // Populate spot keyframe editor
            document.getElementById('kfPosition').value = kf.time;
            document.getElementById('kfPositionValue').textContent = kf.time + '%';

            const rgb = kf.values.default || [255, 255, 255];
            document.getElementById('kfRed').value = rgb[0];
            document.getElementById('kfGreen').value = rgb[1];
            document.getElementById('kfBlue').value = rgb[2];

            const hexColor = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
            document.getElementById('kfColor').value = hexColor;

            document.getElementById('kfEasing').value = kf.easing || 'linear';

            // Setup event listeners
            const updateColor = () => {
                const r = parseInt(document.getElementById('kfRed').value) || 0;
                const g = parseInt(document.getElementById('kfGreen').value) || 0;
                const b = parseInt(document.getElementById('kfBlue').value) || 0;
                const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
                document.getElementById('kfColor').value = hex;
            };

            document.getElementById('kfRed').onchange = updateColor;
            document.getElementById('kfGreen').onchange = updateColor;
            document.getElementById('kfBlue').onchange = updateColor;

            document.getElementById('kfColor').onchange = (e) => {
                const hex = e.target.value;
                const r = parseInt(hex.substr(1, 2), 16);
                const g = parseInt(hex.substr(3, 2), 16);
                const b = parseInt(hex.substr(5, 2), 16);
                document.getElementById('kfRed').value = r;
                document.getElementById('kfGreen').value = g;
                document.getElementById('kfBlue').value = b;
            };

            document.getElementById('kfPosition').oninput = (e) => {
                document.getElementById('kfPositionValue').textContent = e.target.value + '%';
            };
        } else {
            // Populate strip keyframe editor
            document.getElementById('stripKfPosition').value = kf.time;
            document.getElementById('stripKfPositionValue').textContent = kf.time + '%';
            document.getElementById('stripPattern').value = kf.pattern_type || 'solid';

            this.updateStripPattern();

            // Load pattern parameters if they exist
            if (kf.pattern) {
                if (kf.pattern_type === 'solid' && kf.pattern.color) {
                    const hex = '#' + kf.pattern.color.map(v => v.toString(16).padStart(2, '0')).join('');
                    document.getElementById('stripColor').value = hex;
                } else if (kf.pattern_type === 'gradient') {
                    if (kf.pattern.start_color) {
                        const startHex = '#' + kf.pattern.start_color.map(v => v.toString(16).padStart(2, '0')).join('');
                        document.getElementById('gradientStart').value = startHex;
                    }
                    if (kf.pattern.end_color) {
                        const endHex = '#' + kf.pattern.end_color.map(v => v.toString(16).padStart(2, '0')).join('');
                        document.getElementById('gradientEnd').value = endHex;
                    }
                } else if (kf.pattern_type === 'wave') {
                    if (kf.pattern.color) {
                        const hex = '#' + kf.pattern.color.map(v => v.toString(16).padStart(2, '0')).join('');
                        document.getElementById('waveColor').value = hex;
                    }
                    if (kf.pattern.wavelength !== undefined) {
                        document.getElementById('waveLength').value = kf.pattern.wavelength;
                        document.getElementById('waveLengthValue').textContent = kf.pattern.wavelength;
                    }
                    if (kf.pattern.amplitude !== undefined) {
                        document.getElementById('waveAmplitude').value = kf.pattern.amplitude;
                        document.getElementById('waveAmplitudeValue').textContent = kf.pattern.amplitude;
                    }
                } else if (kf.pattern_type === 'chase') {
                    if (kf.pattern.color) {
                        const hex = '#' + kf.pattern.color.map(v => v.toString(16).padStart(2, '0')).join('');
                        document.getElementById('chaseColor').value = hex;
                    }
                    if (kf.pattern.width !== undefined) {
                        document.getElementById('chaseWidth').value = kf.pattern.width;
                        document.getElementById('chaseWidthValue').textContent = kf.pattern.width;
                    }
                }
            }

            document.getElementById('stripKfPosition').oninput = (e) => {
                document.getElementById('stripKfPositionValue').textContent = e.target.value + '%';
            };
        }

        this.drawTimeline();
    }

    updateStripPattern() {
        const patternType = document.getElementById('stripPattern').value;

        // Hide all pattern settings
        document.querySelectorAll('.pattern-settings').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected pattern settings
        if (patternType === 'solid') {
            document.getElementById('solidSettings').style.display = 'block';
        } else if (patternType === 'gradient') {
            document.getElementById('gradientSettings').style.display = 'block';
        } else if (patternType === 'wave') {
            document.getElementById('waveSettings').style.display = 'block';

            // Setup event listeners
            document.getElementById('waveLength').oninput = (e) => {
                document.getElementById('waveLengthValue').textContent = e.target.value;
            };
            document.getElementById('waveAmplitude').oninput = (e) => {
                document.getElementById('waveAmplitudeValue').textContent = e.target.value;
            };
        } else if (patternType === 'chase') {
            document.getElementById('chaseSettings').style.display = 'block';

            document.getElementById('chaseWidth').oninput = (e) => {
                document.getElementById('chaseWidthValue').textContent = e.target.value;
            };
        }
    }

    saveCurrentKeyframe() {
        if (this.currentKeyframeIndex < 0) return;

        const kf = this.designerKeyframes[this.currentKeyframeIndex];

        if (this.designerMode === 'spot') {
            kf.time = parseFloat(document.getElementById('kfPosition').value);
            kf.values = {
                default: [
                    parseInt(document.getElementById('kfRed').value) || 0,
                    parseInt(document.getElementById('kfGreen').value) || 0,
                    parseInt(document.getElementById('kfBlue').value) || 0
                ]
            };
            kf.easing = document.getElementById('kfEasing').value;
        } else {
            kf.time = parseFloat(document.getElementById('stripKfPosition').value);
            kf.pattern_type = document.getElementById('stripPattern').value;
            kf.easing = 'linear'; // Default easing for strips

            if (kf.pattern_type === 'solid') {
                const hex = document.getElementById('stripColor').value;
                const r = parseInt(hex.substr(1, 2), 16);
                const g = parseInt(hex.substr(3, 2), 16);
                const b = parseInt(hex.substr(5, 2), 16);
                kf.pattern = { color: [r, g, b] };
            } else if (kf.pattern_type === 'gradient') {
                const startHex = document.getElementById('gradientStart').value;
                const endHex = document.getElementById('gradientEnd').value;
                kf.pattern = {
                    start_color: [
                        parseInt(startHex.substr(1, 2), 16),
                        parseInt(startHex.substr(3, 2), 16),
                        parseInt(startHex.substr(5, 2), 16)
                    ],
                    end_color: [
                        parseInt(endHex.substr(1, 2), 16),
                        parseInt(endHex.substr(3, 2), 16),
                        parseInt(endHex.substr(5, 2), 16)
                    ]
                };
            } else if (kf.pattern_type === 'wave') {
                const hex = document.getElementById('waveColor').value;
                kf.pattern = {
                    color: [
                        parseInt(hex.substr(1, 2), 16),
                        parseInt(hex.substr(3, 2), 16),
                        parseInt(hex.substr(5, 2), 16)
                    ],
                    wavelength: parseInt(document.getElementById('waveLength').value),
                    amplitude: parseInt(document.getElementById('waveAmplitude').value)
                };
            } else if (kf.pattern_type === 'chase') {
                const hex = document.getElementById('chaseColor').value;
                kf.pattern = {
                    color: [
                        parseInt(hex.substr(1, 2), 16),
                        parseInt(hex.substr(3, 2), 16),
                        parseInt(hex.substr(5, 2), 16)
                    ],
                    width: parseInt(document.getElementById('chaseWidth').value)
                };
            }
        }

        this.updateKeyframeList();
        this.drawTimeline();
        this.showToast('Keyframe aktualisiert', 'success');
    }

    deleteCurrentKeyframe() {
        if (this.currentKeyframeIndex < 0) return;

        if (this.designerKeyframes.length <= 2) {
            this.showToast('Mindestens 2 Keyframes erforderlich', 'error');
            return;
        }

        this.designerKeyframes.splice(this.currentKeyframeIndex, 1);
        this.currentKeyframeIndex = Math.max(0, this.currentKeyframeIndex - 1);

        this.updateKeyframeList();
        this.drawTimeline();

        if (this.designerKeyframes.length > 0) {
            this.selectKeyframe(this.currentKeyframeIndex);
        } else {
            document.getElementById('keyframeEditor').style.display = 'none';
        }

        this.showToast('Keyframe gelöscht', 'success');
    }

    playPreview() {
        if (this.previewPlaying) {
            this.stopPreview();
            return;
        }

        this.previewPlaying = true;
        document.getElementById('playIcon').textContent = '⏸️';

        const duration = parseFloat(document.getElementById('customEffectDuration').value) || 10;
        const startTime = Date.now();

        const animate = () => {
            if (!this.previewPlaying) return;

            const elapsed = (Date.now() - startTime) / 1000;
            this.previewProgress = (elapsed % duration) / duration;

            // Update scrubber
            const canvas = document.getElementById('timelineCanvas');
            const scrubber = document.getElementById('timelineScrubber');
            if (canvas && scrubber) {
                const x = this.previewProgress * canvas.width + 16; // Add container padding
                scrubber.style.left = x + 'px';
            }

            // Update time display
            document.getElementById('timelineTime').textContent = elapsed.toFixed(1) + 's';

            this.previewAnimationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    stopPreview() {
        this.previewPlaying = false;
        document.getElementById('playIcon').textContent = '▶️';
        if (this.previewAnimationFrame) {
            cancelAnimationFrame(this.previewAnimationFrame);
        }

        // Reset scrubber
        document.getElementById('timelineScrubber').style.left = '16px';
        document.getElementById('timelineTime').textContent = '0.0s';
    }

    loadTemplate(templateName) {
        if (this.designerMode === 'spot') {
            switch (templateName) {
                case 'fade':
                    this.designerKeyframes = [
                        { time: 0, values: { default: [0, 0, 0] }, easing: 'linear' },
                        { time: 50, values: { default: [255, 255, 255] }, easing: 'ease-in-out' },
                        { time: 100, values: { default: [0, 0, 0] }, easing: 'linear' }
                    ];
                    break;
                case 'pulse':
                    this.designerKeyframes = [
                        { time: 0, values: { default: [50, 50, 50] }, easing: 'ease-in' },
                        { time: 50, values: { default: [255, 255, 255] }, easing: 'ease-out' },
                        { time: 100, values: { default: [50, 50, 50] }, easing: 'linear' }
                    ];
                    break;
                case 'colorCycle':
                    this.designerKeyframes = [
                        { time: 0, values: { default: [255, 0, 0] }, easing: 'linear' },
                        { time: 33, values: { default: [0, 255, 0] }, easing: 'linear' },
                        { time: 66, values: { default: [0, 0, 255] }, easing: 'linear' },
                        { time: 100, values: { default: [255, 0, 0] }, easing: 'linear' }
                    ];
                    break;
                case 'strobe':
                    this.designerKeyframes = [
                        { time: 0, values: { default: [0, 0, 0] }, easing: 'linear' },
                        { time: 10, values: { default: [255, 255, 255] }, easing: 'linear' },
                        { time: 20, values: { default: [0, 0, 0] }, easing: 'linear' },
                        { time: 30, values: { default: [255, 255, 255] }, easing: 'linear' },
                        { time: 40, values: { default: [0, 0, 0] }, easing: 'linear' }
                    ];
                    break;
            }
        } else {
            // Strip mode templates
            switch (templateName) {
                case 'fade':
                    this.designerKeyframes = [
                        { time: 0, pattern_type: 'solid', pattern: { color: [0, 0, 0] }, easing: 'linear' },
                        { time: 50, pattern_type: 'solid', pattern: { color: [255, 255, 255] }, easing: 'ease-in-out' },
                        { time: 100, pattern_type: 'solid', pattern: { color: [0, 0, 0] }, easing: 'linear' }
                    ];
                    break;
                case 'pulse':
                    this.designerKeyframes = [
                        { time: 0, pattern_type: 'solid', pattern: { color: [50, 50, 50] }, easing: 'ease-in' },
                        { time: 50, pattern_type: 'solid', pattern: { color: [255, 255, 255] }, easing: 'ease-out' },
                        { time: 100, pattern_type: 'solid', pattern: { color: [50, 50, 50] }, easing: 'linear' }
                    ];
                    break;
                case 'colorCycle':
                    this.designerKeyframes = [
                        { time: 0, pattern_type: 'solid', pattern: { color: [255, 0, 0] }, easing: 'linear' },
                        { time: 33, pattern_type: 'solid', pattern: { color: [0, 255, 0] }, easing: 'linear' },
                        { time: 66, pattern_type: 'solid', pattern: { color: [0, 0, 255] }, easing: 'linear' },
                        { time: 100, pattern_type: 'solid', pattern: { color: [255, 0, 0] }, easing: 'linear' }
                    ];
                    break;
                case 'strobe':
                    this.designerKeyframes = [
                        { time: 0, pattern_type: 'solid', pattern: { color: [0, 0, 0] }, easing: 'linear' },
                        { time: 10, pattern_type: 'solid', pattern: { color: [255, 255, 255] }, easing: 'linear' },
                        { time: 20, pattern_type: 'solid', pattern: { color: [0, 0, 0] }, easing: 'linear' },
                        { time: 30, pattern_type: 'solid', pattern: { color: [255, 255, 255] }, easing: 'linear' },
                        { time: 40, pattern_type: 'solid', pattern: { color: [0, 0, 0] }, easing: 'linear' }
                    ];
                    break;
            }
        }

        this.drawTimeline();
        this.showToast(`Template "${templateName}" geladen`, 'success');
    }

    async saveCustomEffect() {
        const name = document.getElementById('customEffectName').value.trim();
        if (!name) {
            this.showToast('Bitte Namen eingeben', 'error');
            return;
        }

        const select = document.getElementById('customEffectDevices');
        const selectedDevices = Array.from(select.selectedOptions).map(opt => opt.value);

        if (selectedDevices.length === 0) {
            this.showToast('Bitte mindestens ein Gerät auswählen', 'error');
            return;
        }

        const duration = parseFloat(document.getElementById('customEffectDuration').value) || 10;

        const effect = {
            name: name,
            type: 'custom',
            target_ids: selectedDevices,
            params: {
                keyframes: this.designerKeyframes,
                duration: duration,
                mode: this.designerMode
            },
            is_group: false
        };

        try {
            const response = await fetch('/api/effects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(effect)
            });

            if (response.ok) {
                this.showToast('Custom Effect erstellt', 'success');
                this.closeVisualDesigner();

                // Ask if user wants to start it immediately
                if (confirm('Effekt jetzt starten?')) {
                    const data = await response.json();
                    if (data.effect && data.effect.id) {
                        await this.startEffect(data.effect.id);
                    }
                }
            }
        } catch (error) {
            console.error('Error creating custom effect:', error);
            this.showToast('Fehler beim Erstellen', 'error');
        }
    }
}

const app = new DMXController();
window.app = app;
