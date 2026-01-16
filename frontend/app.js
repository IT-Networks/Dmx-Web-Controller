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

        // Truss system
        this.trusses = [];
        this.currentTruss = null;
        this.editingTruss = null;
        this.spotAssignments = {}; // { spotId: { trussId, position, pan, tilt, targetX, targetY, targetZ } }

        this.init();
    }

    init() {
        this.loadSettings();
        this.connectWebSocket();
        this.loadData();
        this.loadFixtures();
        this.setupKeyboardShortcuts();
    }

    loadSettings() {
        // Load audio panel visibility setting
        const showAudioPanel = localStorage.getItem('showAudioPanel');
        if (showAudioPanel !== null) {
            const shouldShow = showAudioPanel === 'true';
            const checkbox = document.getElementById('showAudioPanelCheckbox');
            if (checkbox) {
                checkbox.checked = shouldShow;
            }
            this.setAudioPanelVisibility(shouldShow);
        }
    }

    toggleAudioPanelVisibility() {
        const checkbox = document.getElementById('showAudioPanelCheckbox');
        const shouldShow = checkbox.checked;

        // Save to localStorage
        localStorage.setItem('showAudioPanel', shouldShow);

        // Apply visibility
        this.setAudioPanelVisibility(shouldShow);

        this.showToast(
            shouldShow ? 'Audio Panel aktiviert' : 'Audio Panel deaktiviert',
            'success'
        );
    }

    setAudioPanelVisibility(visible) {
        const panel = document.getElementById('soundControlPanel');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
        }
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
            'stage': ['Bühnen-Visualisierung', 'Live-Darstellung aller Spots auf der Bühne'],
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
            'stage': '',
            'settings': ''
        };

        document.getElementById('headerActions').innerHTML = buttons[tabName] || '';

        // Initialize stage visualizer if switching to stage tab
        if (tabName === 'stage') {
            setTimeout(() => {
                this.initStageVisualizer();
                this.restoreStageDemoState();
            }, 100);
        }
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
            this.renderEffectPreview();
        }, 50);
    }

    closeVisualDesigner() {
        if (this.previewPlaying) {
            this.stopPreview();
        }
        if (this.effectPreviewPlaying) {
            this.stopEffectPreview();
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
        this.renderEffectPreview();
        this.selectKeyframe(this.designerKeyframes.length - 1);
        this.showToast('Keyframe hinzugefügt', 'success');
    }

    updateKeyframeList() {
        const container = document.getElementById('keyframeListItems');
        if (!container) return;

        container.innerHTML = '';

        this.designerKeyframes.forEach((kf, index) => {
            const item = document.createElement('div');
            item.className = 'keyframe-list-item' + (index === this.currentKeyframeIndex ? ' active expanded' : '');

            // Header
            const header = document.createElement('div');
            header.className = 'keyframe-item-header';

            // Expand icon
            const expandIcon = document.createElement('div');
            expandIcon.className = 'keyframe-expand-icon';
            expandIcon.textContent = '▶';
            header.appendChild(expandIcon);

            // Marker indicator
            const marker = document.createElement('div');
            marker.className = 'keyframe-marker-indicator';
            header.appendChild(marker);

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

            header.appendChild(info);

            // Color preview
            if (this.designerMode === 'spot' && kf.values && kf.values.default) {
                const colorPreview = document.createElement('div');
                colorPreview.className = 'keyframe-color-preview';
                const rgb = kf.values.default;
                colorPreview.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                header.appendChild(colorPreview);
            } else if (kf.pattern && kf.pattern.color) {
                const colorPreview = document.createElement('div');
                colorPreview.className = 'keyframe-color-preview';
                const rgb = kf.pattern.color;
                colorPreview.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                header.appendChild(colorPreview);
            }

            // Click header to toggle expand
            header.onclick = (e) => {
                e.stopPropagation();
                this.toggleKeyframeExpand(index);
            };

            item.appendChild(header);

            // Content (editor)
            const content = document.createElement('div');
            content.className = 'keyframe-item-content';

            if (this.designerMode === 'spot') {
                content.innerHTML = this.createSpotKeyframeEditor(kf, index);
            } else {
                content.innerHTML = this.createStripKeyframeEditor(kf, index);
            }

            item.appendChild(content);
            container.appendChild(item);
        });

        // Setup event listeners for all inputs after DOM is ready
        setTimeout(() => this.setupKeyframeInputListeners(), 0);
    }

    toggleKeyframeExpand(index) {
        const items = document.querySelectorAll('.keyframe-list-item');
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.toggle('expanded');
                if (item.classList.contains('expanded')) {
                    this.currentKeyframeIndex = index;
                    this.drawTimeline();
                }
            }
        });
    }

    createSpotKeyframeEditor(kf, index) {
        const rgb = kf.values.default || [255, 255, 255];
        const hexColor = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
        const intensity = kf.intensity !== undefined ? kf.intensity : 100;
        const strobe = kf.strobe || { enabled: false, frequency: 5 };

        return `
            <div class="form-group">
                <label>Position (0-100%)</label>
                <input type="range" id="kfPos_${index}" min="0" max="100" value="${kf.time}" class="input-range" data-kf-index="${index}">
                <span id="kfPosValue_${index}">${kf.time.toFixed(1)}%</span>
            </div>

            <div class="form-group">
                <label>💡 Intensität / Helligkeit</label>
                <input type="range" id="kfIntensity_${index}" min="0" max="100" value="${intensity}" class="input-range" data-kf-index="${index}">
                <span id="kfIntensityValue_${index}">${intensity}%</span>
            </div>

            <div class="form-group">
                <label>Farbe</label>
                <div class="color-picker-group">
                    <input type="color" id="kfColor_${index}" value="${hexColor}" class="color-input" data-kf-index="${index}">
                    <div class="rgb-inputs">
                        <input type="number" id="kfRed_${index}" min="0" max="255" value="${rgb[0]}" placeholder="R" class="input input-sm" data-kf-index="${index}">
                        <input type="number" id="kfGreen_${index}" min="0" max="255" value="${rgb[1]}" placeholder="G" class="input input-sm" data-kf-index="${index}">
                        <input type="number" id="kfBlue_${index}" min="0" max="255" value="${rgb[2]}" placeholder="B" class="input input-sm" data-kf-index="${index}">
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="kfStrobeEnabled_${index}" ${strobe.enabled ? 'checked' : ''} data-kf-index="${index}">
                    <span>⚡ Strobe/Flash aktivieren</span>
                </label>
            </div>

            <div id="kfStrobeSettings_${index}" class="strobe-settings" style="display: ${strobe.enabled ? 'block' : 'none'}; margin-left: 1.5rem;">
                <div class="form-group">
                    <label>Strobe Frequenz</label>
                    <input type="range" id="kfStrobeFreq_${index}" min="1" max="20" value="${strobe.frequency}" class="input-range" data-kf-index="${index}">
                    <span id="kfStrobeFreqValue_${index}">${strobe.frequency} Hz</span>
                </div>
            </div>

            <div class="form-group">
                <label>Übergang (Easing)</label>
                <select id="kfEasing_${index}" class="input" data-kf-index="${index}">
                    <option value="linear" ${kf.easing === 'linear' ? 'selected' : ''}>Linear</option>
                    <option value="ease-in" ${kf.easing === 'ease-in' ? 'selected' : ''}>Ease In</option>
                    <option value="ease-out" ${kf.easing === 'ease-out' ? 'selected' : ''}>Ease Out</option>
                    <option value="ease-in-out" ${kf.easing === 'ease-in-out' ? 'selected' : ''}>Ease In-Out</option>
                </select>
            </div>
            <div class="keyframe-actions-inline">
                <button class="btn btn-secondary btn-sm" onclick="app.deleteKeyframeByIndex(${index})">
                    🗑️ Löschen
                </button>
            </div>
        `;
    }

    createStripKeyframeEditor(kf, index) {
        const color = kf.pattern?.color || [255, 255, 255];
        const hexColor = '#' + color.map(v => v.toString(16).padStart(2, '0')).join('');
        const intensity = kf.intensity !== undefined ? kf.intensity : 100;
        const speed = kf.pattern?.speed !== undefined ? kf.pattern.speed : 5;

        return `
            <div class="form-group">
                <label>Position (0-100%)</label>
                <input type="range" id="kfPos_${index}" min="0" max="100" value="${kf.time}" class="input-range" data-kf-index="${index}">
                <span id="kfPosValue_${index}">${kf.time.toFixed(1)}%</span>
            </div>

            <div class="form-group">
                <label>💡 Intensität / Helligkeit</label>
                <input type="range" id="kfIntensity_${index}" min="0" max="100" value="${intensity}" class="input-range" data-kf-index="${index}">
                <span id="kfIntensityValue_${index}">${intensity}%</span>
            </div>

            <div class="form-group">
                <label>Pattern-Typ</label>
                <select id="kfPattern_${index}" class="input" data-kf-index="${index}">
                    <option value="solid" ${kf.pattern_type === 'solid' ? 'selected' : ''}>🎨 Einfarbig</option>
                    <option value="gradient" ${kf.pattern_type === 'gradient' ? 'selected' : ''}>🌈 Gradient</option>
                    <option value="rainbow" ${kf.pattern_type === 'rainbow' ? 'selected' : ''}>🌟 Regenbogen</option>
                    <option value="wave" ${kf.pattern_type === 'wave' ? 'selected' : ''}>〰️ Welle</option>
                    <option value="chase" ${kf.pattern_type === 'chase' ? 'selected' : ''}>➡️ Lauflicht</option>
                    <option value="sparkle" ${kf.pattern_type === 'sparkle' ? 'selected' : ''}>✨ Funkeln</option>
                    <option value="strobe" ${kf.pattern_type === 'strobe' ? 'selected' : ''}>⚡ Stroboskop</option>
                </select>
            </div>

            <div class="form-group">
                <label>Farbe</label>
                <input type="color" id="kfColor_${index}" value="${hexColor}" class="color-input" data-kf-index="${index}">
            </div>

            <div class="form-group">
                <label>Geschwindigkeit / Speed</label>
                <input type="range" id="kfSpeed_${index}" min="1" max="10" value="${speed}" class="input-range" data-kf-index="${index}">
                <span id="kfSpeedValue_${index}">${speed}</span>
            </div>

            <div class="keyframe-actions-inline">
                <button class="btn btn-secondary btn-sm" onclick="app.deleteKeyframeByIndex(${index})">
                    🗑️ Löschen
                </button>
            </div>
        `;
    }

    setupKeyframeInputListeners() {
        // Position sliders
        document.querySelectorAll('[id^="kfPos_"]').forEach(input => {
            const index = parseInt(input.dataset.kfIndex);
            input.oninput = (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById(`kfPosValue_${index}`).textContent = value.toFixed(1) + '%';
                this.designerKeyframes[index].time = value;
                this.drawTimeline();
            };
        });

        // Color pickers
        document.querySelectorAll('[id^="kfColor_"]').forEach(input => {
            const index = parseInt(input.dataset.kfIndex);
            input.onchange = (e) => {
                const hex = e.target.value;
                const r = parseInt(hex.substr(1, 2), 16);
                const g = parseInt(hex.substr(3, 2), 16);
                const b = parseInt(hex.substr(5, 2), 16);

                if (this.designerMode === 'spot') {
                    this.designerKeyframes[index].values.default = [r, g, b];
                    const redInput = document.getElementById(`kfRed_${index}`);
                    const greenInput = document.getElementById(`kfGreen_${index}`);
                    const blueInput = document.getElementById(`kfBlue_${index}`);
                    if (redInput) redInput.value = r;
                    if (greenInput) greenInput.value = g;
                    if (blueInput) blueInput.value = b;
                } else {
                    if (!this.designerKeyframes[index].pattern) {
                        this.designerKeyframes[index].pattern = {};
                    }
                    this.designerKeyframes[index].pattern.color = [r, g, b];
                }

                this.updateKeyframeList();
                this.drawTimeline();
                this.renderEffectPreview();
            };
        });

        // RGB inputs (spot mode)
        document.querySelectorAll('[id^="kfRed_"], [id^="kfGreen_"], [id^="kfBlue_"]').forEach(input => {
            const index = parseInt(input.dataset.kfIndex);
            input.onchange = () => {
                const r = parseInt(document.getElementById(`kfRed_${index}`).value) || 0;
                const g = parseInt(document.getElementById(`kfGreen_${index}`).value) || 0;
                const b = parseInt(document.getElementById(`kfBlue_${index}`).value) || 0;

                this.designerKeyframes[index].values.default = [r, g, b];

                const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
                const colorInput = document.getElementById(`kfColor_${index}`);
                if (colorInput) colorInput.value = hex;

                this.updateKeyframeList();
                this.drawTimeline();
                this.renderEffectPreview();
            };
        });

        // Easing selects
        document.querySelectorAll('[id^="kfEasing_"]').forEach(select => {
            const index = parseInt(select.dataset.kfIndex);
            select.onchange = (e) => {
                this.designerKeyframes[index].easing = e.target.value;
            };
        });

        // Pattern selects (strip mode)
        document.querySelectorAll('[id^="kfPattern_"]').forEach(select => {
            const index = parseInt(select.dataset.kfIndex);
            select.onchange = (e) => {
                this.designerKeyframes[index].pattern_type = e.target.value;
                this.updateKeyframeList();
                this.renderEffectPreview();
            };
        });

        // Intensity sliders
        document.querySelectorAll('[id^="kfIntensity_"]').forEach(input => {
            const index = parseInt(input.dataset.kfIndex);
            input.oninput = (e) => {
                const value = parseInt(e.target.value);
                document.getElementById(`kfIntensityValue_${index}`).textContent = value + '%';
                this.designerKeyframes[index].intensity = value;
                this.renderEffectPreview();
            };
        });

        // Strobe enable checkboxes
        document.querySelectorAll('[id^="kfStrobeEnabled_"]').forEach(checkbox => {
            const index = parseInt(checkbox.dataset.kfIndex);
            checkbox.onchange = (e) => {
                const enabled = e.target.checked;
                if (!this.designerKeyframes[index].strobe) {
                    this.designerKeyframes[index].strobe = { enabled: false, frequency: 5 };
                }
                this.designerKeyframes[index].strobe.enabled = enabled;

                // Show/hide strobe settings
                const settings = document.getElementById(`kfStrobeSettings_${index}`);
                if (settings) {
                    settings.style.display = enabled ? 'block' : 'none';
                }
                this.renderEffectPreview();
            };
        });

        // Strobe frequency sliders
        document.querySelectorAll('[id^="kfStrobeFreq_"]').forEach(input => {
            const index = parseInt(input.dataset.kfIndex);
            input.oninput = (e) => {
                const value = parseInt(e.target.value);
                document.getElementById(`kfStrobeFreqValue_${index}`).textContent = value + ' Hz';
                if (!this.designerKeyframes[index].strobe) {
                    this.designerKeyframes[index].strobe = { enabled: true, frequency: 5 };
                }
                this.designerKeyframes[index].strobe.frequency = value;
                this.renderEffectPreview();
            };
        });

        // Speed sliders (strip mode)
        document.querySelectorAll('[id^="kfSpeed_"]').forEach(input => {
            const index = parseInt(input.dataset.kfIndex);
            input.oninput = (e) => {
                const value = parseInt(e.target.value);
                document.getElementById(`kfSpeedValue_${index}`).textContent = value;
                if (!this.designerKeyframes[index].pattern) {
                    this.designerKeyframes[index].pattern = {};
                }
                this.designerKeyframes[index].pattern.speed = value;
                this.renderEffectPreview();
            };
        });
    }

    deleteKeyframeByIndex(index) {
        if (this.designerKeyframes.length <= 2) {
            this.showToast('Mindestens 2 Keyframes erforderlich', 'error');
            return;
        }

        this.designerKeyframes.splice(index, 1);
        this.currentKeyframeIndex = Math.max(0, Math.min(index, this.designerKeyframes.length - 1));

        this.updateKeyframeList();
        this.drawTimeline();
        this.renderEffectPreview();
        this.showToast('Keyframe gelöscht', 'success');
    }

    selectKeyframe(index) {
        this.currentKeyframeIndex = index;
        const kf = this.designerKeyframes[index];

        // Update list highlighting
        this.updateKeyframeList();

        // Redraw timeline to highlight selected keyframe
        this.drawTimeline();

        // Show keyframe editor (old editor - can be hidden now)
        const oldEditor = document.getElementById('keyframeEditor');
        if (oldEditor) oldEditor.style.display = 'none';

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

        this.updateKeyframeList();
        this.drawTimeline();
        this.renderEffectPreview();
        this.showToast(`Template "${templateName}" geladen`, 'success');
    }

    playEffectPreview() {
        if (this.effectPreviewPlaying) {
            this.stopEffectPreview();
            return;
        }

        this.effectPreviewPlaying = true;
        document.getElementById('previewPlayIcon').textContent = '⏸';

        const duration = parseFloat(document.getElementById('customEffectDuration').value) || 10;
        const startTime = Date.now();

        const animate = () => {
            if (!this.effectPreviewPlaying) return;

            const elapsed = (Date.now() - startTime) / 1000;
            const progress = (elapsed % duration) / duration * 100; // 0-100%

            this.renderEffectPreview(progress);

            this.effectPreviewAnimFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    stopEffectPreview() {
        this.effectPreviewPlaying = false;
        document.getElementById('previewPlayIcon').textContent = '▶️';
        if (this.effectPreviewAnimFrame) {
            cancelAnimationFrame(this.effectPreviewAnimFrame);
        }
        this.renderEffectPreview(0);
    }

    renderEffectPreview(progress = 0) {
        const canvas = document.getElementById('effectPreviewAnimCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        if (this.designerKeyframes.length === 0) {
            // No keyframes - show placeholder
            ctx.fillStyle = '#334155';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Füge Keyframes hinzu um eine Vorschau zu sehen', width / 2, height / 2);
            return;
        }

        // Get color and intensity at current progress
        const colorData = this.getColorAtProgress(progress);
        const color = colorData.color;
        const intensity = colorData.intensity / 100;
        const strobe = colorData.strobe;

        // Apply strobe effect
        let strobeActive = true;
        if (strobe && strobe.enabled) {
            const time = Date.now() / 1000;
            const cycleTime = 1 / strobe.frequency;
            const cycleProgress = (time % cycleTime) / cycleTime;
            strobeActive = cycleProgress < 0.5; // 50% duty cycle
        }

        // Calculate number of lights to show (simulate multiple devices)
        const numLights = this.designerMode === 'spot' ? 8 : 1;
        const lightWidth = width / numLights;

        if (this.designerMode === 'spot') {
            // Spot mode: show individual lights
            for (let i = 0; i < numLights; i++) {
                if (!strobeActive) continue;

                const x = i * lightWidth + lightWidth / 2;
                const radius = Math.min(lightWidth * 0.4, height * 0.4);

                // Apply intensity to color
                const r = Math.round(color[0] * intensity);
                const g = Math.round(color[1] * intensity);
                const b = Math.round(color[2] * intensity);

                // Draw light with glow
                const gradient = ctx.createRadialGradient(x, height / 2, 0, x, height / 2, radius);
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
                gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.6)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, height / 2, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Strip mode: show LED strip
            const ledCount = 30;
            const ledWidth = width / ledCount;

            for (let i = 0; i < ledCount; i++) {
                if (!strobeActive) continue;

                // Apply intensity to color
                const r = Math.round(color[0] * intensity);
                const g = Math.round(color[1] * intensity);
                const b = Math.round(color[2] * intensity);

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(i * ledWidth, height * 0.3, ledWidth - 2, height * 0.4);
            }
        }

        // Draw progress indicator
        const progressX = (progress / 100) * width;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, height);
        ctx.stroke();
    }

    getColorAtProgress(progress) {
        if (this.designerKeyframes.length === 0) {
            return { color: [0, 0, 0], intensity: 100, strobe: null };
        }

        // Sort keyframes by time
        const sorted = [...this.designerKeyframes].sort((a, b) => a.time - b.time);

        // Find surrounding keyframes
        let beforeKf = sorted[0];
        let afterKf = sorted[sorted.length - 1];

        for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].time <= progress && sorted[i + 1].time >= progress) {
                beforeKf = sorted[i];
                afterKf = sorted[i + 1];
                break;
            }
        }

        // If exactly on a keyframe
        if (beforeKf.time === progress) {
            return {
                color: this.extractColor(beforeKf),
                intensity: beforeKf.intensity !== undefined ? beforeKf.intensity : 100,
                strobe: beforeKf.strobe || null
            };
        }
        if (afterKf.time === progress) {
            return {
                color: this.extractColor(afterKf),
                intensity: afterKf.intensity !== undefined ? afterKf.intensity : 100,
                strobe: afterKf.strobe || null
            };
        }

        // Interpolate between keyframes
        const t = (progress - beforeKf.time) / (afterKf.time - beforeKf.time);
        const beforeColor = this.extractColor(beforeKf);
        const afterColor = this.extractColor(afterKf);

        // Apply easing
        const easedT = this.applyEasing(t, beforeKf.easing || 'linear');

        // Interpolate color
        const color = [
            Math.round(beforeColor[0] + (afterColor[0] - beforeColor[0]) * easedT),
            Math.round(beforeColor[1] + (afterColor[1] - beforeColor[1]) * easedT),
            Math.round(beforeColor[2] + (afterColor[2] - beforeColor[2]) * easedT)
        ];

        // Interpolate intensity
        const beforeIntensity = beforeKf.intensity !== undefined ? beforeKf.intensity : 100;
        const afterIntensity = afterKf.intensity !== undefined ? afterKf.intensity : 100;
        const intensity = Math.round(beforeIntensity + (afterIntensity - beforeIntensity) * easedT);

        // Use strobe from before keyframe (strobe is a discrete property)
        const strobe = beforeKf.strobe || null;

        return { color, intensity, strobe };
    }

    extractColor(keyframe) {
        if (this.designerMode === 'spot') {
            return keyframe.values?.default || [0, 0, 0];
        } else {
            return keyframe.pattern?.color || [0, 0, 0];
        }
    }

    applyEasing(t, easing) {
        switch (easing) {
            case 'ease-in':
                return t * t;
            case 'ease-out':
                return t * (2 - t);
            case 'ease-in-out':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            default: // linear
                return t;
        }
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

    // ===== Stage Visualizer =====
    initStageVisualizer() {
        if (this.stageInitialized) return;

        this.stageView = 'perspective';
        this.showBeams = true;
        this.showGrid = true;
        this.showLabels = true;
        this.stageCamera = { x: 0, y: -5, z: 10, rotX: -30, rotY: 0 };
        this.stageSpots = [];
        this.stageAnimationFrame = null;
        this.stageFPS = 60;
        this.stageLastFrame = Date.now();
        this.stageDemoMode = false; // Start in live mode
        this.stageDemoTime = 0; // For demo animation

        const canvas = document.getElementById('stageCanvas');
        if (!canvas) return;

        const container = document.getElementById('stageCanvasContainer');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        this.stageCtx = canvas.getContext('2d');
        this.stageInitialized = true;

        // Generate spots from devices or demo spots
        this.updateStageSpots();

        // Start rendering
        this.renderStageFrame();

        // Handle resize
        window.addEventListener('resize', () => this.resizeStageCanvas());

        // Handle mouse interaction
        this.setupStageInteraction();
    }

    resizeStageCanvas() {
        const canvas = document.getElementById('stageCanvas');
        const container = document.getElementById('stageCanvasContainer');
        if (!canvas || !container) return;

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }

    updateStageSpots() {
        if (this.stageDemoMode) {
            this.createDemoSpots();
        } else {
            // Load trusses if not loaded
            if (!this.trusses || this.trusses.length === 0) {
                this.loadTrusses();
            }

            this.stageSpots = this.devices.map((device, index) => {
                const assignment = this.spotAssignments[device.id];

                let x, y, z, pan = 0, tilt = -45;

                if (assignment) {
                    // Position based on truss assignment
                    const truss = this.trusses.find(t => t.id === assignment.trussId);
                    if (truss) {
                        // Calculate position along truss
                        const radians = (truss.rotation * Math.PI) / 180;
                        x = truss.x + Math.cos(radians) * assignment.position;
                        z = truss.z + Math.sin(radians) * assignment.position;
                        y = truss.y;
                        pan = assignment.pan;
                        tilt = assignment.tilt;
                    } else {
                        // Fallback to grid
                        const gridSize = Math.ceil(Math.sqrt(this.devices.length));
                        const row = Math.floor(index / gridSize);
                        const col = index % gridSize;
                        const spacing = 3;
                        x = (col - gridSize / 2) * spacing;
                        y = 3;
                        z = (row - gridSize / 2) * spacing;
                    }
                } else {
                    // Default grid position for unassigned spots
                    const gridSize = Math.ceil(Math.sqrt(this.devices.length));
                    const row = Math.floor(index / gridSize);
                    const col = index % gridSize;
                    const spacing = 3;
                    x = (col - gridSize / 2) * spacing;
                    y = 3;
                    z = (row - gridSize / 2) * spacing;
                }

                return {
                    id: device.id,
                    name: device.name,
                    x,
                    y,
                    z,
                    pan,
                    tilt,
                    color: [255, 255, 255],
                    intensity: 0,
                    dmxValues: device.current_values || {},
                    device: device,
                    assignment: assignment
                };
            });
        }

        // Update stats
        this.updateStageStats();
    }

    createDemoSpots() {
        // Create a variety of demo spots with different positions and types
        this.stageSpots = [
            // Front row - PAR spots
            { id: 'demo-1', name: 'PAR Front L', x: -6, y: 2.5, z: -8, color: [255, 0, 0], intensity: 80, type: 'par' },
            { id: 'demo-2', name: 'PAR Front C', x: 0, y: 2.5, z: -8, color: [0, 255, 0], intensity: 90, type: 'par' },
            { id: 'demo-3', name: 'PAR Front R', x: 6, y: 2.5, z: -8, color: [0, 0, 255], intensity: 85, type: 'par' },

            // Mid row - Moving Heads
            { id: 'demo-4', name: 'Moving Head L', x: -4, y: 3.5, z: -4, color: [255, 255, 0], intensity: 70, type: 'moving' },
            { id: 'demo-5', name: 'Moving Head C', x: 0, y: 3.5, z: -4, color: [255, 0, 255], intensity: 95, type: 'moving' },
            { id: 'demo-6', name: 'Moving Head R', x: 4, y: 3.5, z: -4, color: [0, 255, 255], intensity: 75, type: 'moving' },

            // Back row - Wash lights
            { id: 'demo-7', name: 'Wash Back L', x: -6, y: 4, z: 0, color: [255, 128, 0], intensity: 60, type: 'wash' },
            { id: 'demo-8', name: 'Wash Back C', x: 0, y: 4, z: 0, color: [128, 255, 128], intensity: 65, type: 'wash' },
            { id: 'demo-9', name: 'Wash Back R', x: 6, y: 4, z: 0, color: [128, 128, 255], intensity: 70, type: 'wash' },

            // Side spots
            { id: 'demo-10', name: 'Side Spot L', x: -8, y: 3, z: -4, color: [255, 200, 100], intensity: 50, type: 'spot' },
            { id: 'demo-11', name: 'Side Spot R', x: 8, y: 3, z: -4, color: [100, 200, 255], intensity: 55, type: 'spot' },

            // Top truss
            { id: 'demo-12', name: 'Truss Front L', x: -3, y: 5, z: -6, color: [255, 100, 200], intensity: 40, type: 'truss' },
            { id: 'demo-13', name: 'Truss Front R', x: 3, y: 5, z: -6, color: [200, 100, 255], intensity: 45, type: 'truss' },
            { id: 'demo-14', name: 'Truss Back L', x: -3, y: 5, z: -2, color: [100, 255, 200], intensity: 35, type: 'truss' },
            { id: 'demo-15', name: 'Truss Back R', x: 3, y: 5, z: -2, color: [200, 255, 100], intensity: 38, type: 'truss' },
        ];
    }

    updateDemoSpots() {
        if (!this.stageDemoMode) return;

        // Animate demo spots with varying colors and intensities
        this.stageDemoTime += 0.016; // ~60fps

        this.stageSpots.forEach((spot, index) => {
            // Different animation speeds for different spots
            const speed = 1 + (index % 3) * 0.5;
            const offset = index * 0.5;

            // Animate intensity with sine wave
            const intensityBase = 30 + Math.sin(this.stageDemoTime * speed + offset) * 30;
            spot.intensity = 40 + intensityBase;

            // Animate colors with different frequencies
            const hue = (this.stageDemoTime * 20 + index * 24) % 360;
            const rgb = this.hslToRgb(hue / 360, 0.8, 0.5);
            spot.color = [rgb.r, rgb.g, rgb.b];

            // Occasional flash effect
            if (Math.sin(this.stageDemoTime * 3 + index) > 0.95) {
                spot.intensity = 100;
                spot.color = [255, 255, 255];
            }
        });
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    updateStageStats() {
        const activeSpots = this.stageSpots.filter(s => s.intensity > 0).length;
        const totalPower = this.stageSpots.reduce((sum, s) => {
            return sum + (s.intensity / 100 * 200); // Assume 200W per spot at full
        }, 0);

        const activeEl = document.getElementById('stageActiveSpots');
        const powerEl = document.getElementById('stageTotalPower');
        const fpsEl = document.getElementById('stageFPS');

        if (activeEl) activeEl.textContent = activeSpots;
        if (powerEl) powerEl.textContent = Math.round(totalPower) + 'W';
        if (fpsEl) fpsEl.textContent = Math.round(this.stageFPS);
    }

    renderStageFrame() {
        if (!this.stageInitialized || this.currentTab !== 'stage') return;

        // Calculate FPS
        const now = Date.now();
        const delta = now - this.stageLastFrame;
        this.stageFPS = 1000 / delta;
        this.stageLastFrame = now;

        // Update spot data from devices or demo animation
        if (this.stageDemoMode) {
            this.updateDemoSpots();
        } else {
            this.updateStageSpotData();
        }

        // Clear canvas
        const canvas = document.getElementById('stageCanvas');
        const ctx = this.stageCtx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw based on current view
        if (this.stageView === 'perspective') {
            this.renderPerspectiveView();
        } else if (this.stageView === 'top') {
            this.renderTopView();
        } else if (this.stageView === 'front') {
            this.renderFrontView();
        }

        // Update stats periodically
        if (Math.random() < 0.1) {
            this.updateStageStats();
        }

        // Continue animation
        this.stageAnimationFrame = requestAnimationFrame(() => this.renderStageFrame());
    }

    updateStageSpotData() {
        if (this.stageDemoMode) return; // Skip in demo mode

        this.stageSpots.forEach(spot => {
            const device = this.devices.find(d => d.id === spot.id);
            if (!device || !device.current_values) return;

            const values = device.current_values;

            // Extract RGB color
            if (device.channels) {
                const redCh = device.channels.find(ch => ch.type === 'red');
                const greenCh = device.channels.find(ch => ch.type === 'green');
                const blueCh = device.channels.find(ch => ch.type === 'blue');
                const dimmerCh = device.channels.find(ch => ch.type === 'dimmer');

                if (redCh && greenCh && blueCh) {
                    spot.color = [
                        values[redCh.channel] || 0,
                        values[greenCh.channel] || 0,
                        values[blueCh.channel] || 0
                    ];
                }

                if (dimmerCh) {
                    spot.intensity = ((values[dimmerCh.channel] || 0) / 255) * 100;
                } else {
                    // Calculate intensity from RGB average
                    const avg = (spot.color[0] + spot.color[1] + spot.color[2]) / 3;
                    spot.intensity = (avg / 255) * 100;
                }
            }

            spot.dmxValues = values;
        });
    }

    renderPerspectiveView() {
        const canvas = document.getElementById('stageCanvas');
        const ctx = this.stageCtx;
        const width = canvas.width;
        const height = canvas.height;

        // Draw stage floor
        this.drawStageFloor(ctx, width, height);

        // Sort spots by distance for correct layering
        const sortedSpots = [...this.stageSpots].sort((a, b) => {
            return (b.z - a.z); // Back to front
        });

        // Draw spots with beams
        sortedSpots.forEach(spot => {
            this.drawSpotPerspective(ctx, spot, width, height);
        });
    }

    drawStageFloor(ctx, width, height) {
        // Draw grid if enabled
        if (!this.showGrid) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 1;

        const gridSize = 20;
        const gridSpacing = 40;
        const centerX = width / 2;
        const centerY = height * 0.7;

        for (let i = -gridSize; i <= gridSize; i++) {
            // Horizontal lines
            const y1 = centerY + (i * gridSpacing) * 0.3;
            const y2 = centerY + (i * gridSpacing) * 0.3;
            ctx.beginPath();
            ctx.moveTo(centerX - gridSize * gridSpacing, y1);
            ctx.lineTo(centerX + gridSize * gridSpacing, y2);
            ctx.stroke();

            // Vertical lines with perspective
            const x = centerX + i * gridSpacing;
            ctx.beginPath();
            ctx.moveTo(x, centerY - gridSize * gridSpacing * 0.3);
            ctx.lineTo(x, centerY + gridSize * gridSpacing * 0.3);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawSpotPerspective(ctx, spot, width, height) {
        // Project 3D to 2D with perspective
        const scale = 50;
        const perspective = 800;
        const centerX = width / 2;
        const centerY = height * 0.7;

        const z = spot.z + 5; // Add offset for perspective
        const projScale = perspective / (perspective + z * scale);

        const x2d = centerX + spot.x * scale * projScale;
        const y2d = centerY - spot.y * scale * projScale + spot.z * scale * 0.3;

        // Draw light beam if enabled
        if (this.showBeams && spot.intensity > 5) {
            this.drawLightBeam(ctx, x2d, y2d, spot, projScale);
        }

        // Draw spot fixture
        const spotRadius = 15 * projScale;
        const intensity = spot.intensity / 100;

        // Glow effect
        if (intensity > 0.1) {
            const gradient = ctx.createRadialGradient(x2d, y2d, 0, x2d, y2d, spotRadius * 2);
            gradient.addColorStop(0, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, ${intensity * 0.5})`);
            gradient.addColorStop(1, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x2d, y2d, spotRadius * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Spot body
        ctx.fillStyle = intensity > 0.1 ?
            `rgb(${Math.round(spot.color[0] * intensity)}, ${Math.round(spot.color[1] * intensity)}, ${Math.round(spot.color[2] * intensity)})` :
            '#334155';
        ctx.beginPath();
        ctx.arc(x2d, y2d, spotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = intensity > 0.5 ? '#fbbf24' : '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label if enabled
        if (this.showLabels) {
            ctx.fillStyle = '#e2e8f0';
            ctx.font = `${10 * projScale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(spot.name, x2d, y2d + spotRadius + 15 * projScale);
        }
    }

    drawLightBeam(ctx, x, y, spot, scale) {
        const beamLength = 200 * scale;
        const beamWidth = 60 * scale;
        const intensity = spot.intensity / 100;

        ctx.save();
        ctx.globalAlpha = intensity * 0.4;

        // Create beam gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + beamLength);
        gradient.addColorStop(0, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0.8)`);
        gradient.addColorStop(1, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - beamWidth / 2, y + beamLength);
        ctx.lineTo(x + beamWidth / 2, y + beamLength);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    renderTopView() {
        const canvas = document.getElementById('stageCanvas');
        const ctx = this.stageCtx;
        const width = canvas.width;
        const height = canvas.height;

        const scale = 30;
        const centerX = width / 2;
        const centerY = height / 2;

        // Draw grid
        if (this.showGrid) {
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
            ctx.lineWidth = 1;

            for (let i = -10; i <= 10; i++) {
                ctx.beginPath();
                ctx.moveTo(centerX + i * scale, centerY - 10 * scale);
                ctx.lineTo(centerX + i * scale, centerY + 10 * scale);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(centerX - 10 * scale, centerY + i * scale);
                ctx.lineTo(centerX + 10 * scale, centerY + i * scale);
                ctx.stroke();
            }
        }

        // Draw spots
        this.stageSpots.forEach(spot => {
            const x2d = centerX + spot.x * scale;
            const y2d = centerY + spot.z * scale;
            const radius = 20;
            const intensity = spot.intensity / 100;

            // Glow
            if (intensity > 0.1) {
                const gradient = ctx.createRadialGradient(x2d, y2d, 0, x2d, y2d, radius * 3);
                gradient.addColorStop(0, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, ${intensity * 0.6})`);
                gradient.addColorStop(1, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x2d, y2d, radius * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Spot
            ctx.fillStyle = intensity > 0.1 ?
                `rgb(${Math.round(spot.color[0] * intensity)}, ${Math.round(spot.color[1] * intensity)}, ${Math.round(spot.color[2] * intensity)})` :
                '#334155';
            ctx.beginPath();
            ctx.arc(x2d, y2d, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = intensity > 0.5 ? '#fbbf24' : '#64748b';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            if (this.showLabels) {
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(spot.name, x2d, y2d + radius + 15);
            }
        });
    }

    renderFrontView() {
        const canvas = document.getElementById('stageCanvas');
        const ctx = this.stageCtx;
        const width = canvas.width;
        const height = canvas.height;

        const scale = 40;
        const centerX = width / 2;
        const floorY = height * 0.8;

        // Draw stage line
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(width, floorY);
        ctx.stroke();

        // Sort by X position
        const sortedSpots = [...this.stageSpots].sort((a, b) => a.x - b.x);

        // Draw spots
        sortedSpots.forEach(spot => {
            const x2d = centerX + spot.x * scale;
            const y2d = floorY - spot.y * scale;
            const radius = 20;
            const intensity = spot.intensity / 100;

            // Beam
            if (this.showBeams && intensity > 0.1) {
                const beamLength = 300;
                const beamWidth = 80;

                ctx.save();
                ctx.globalAlpha = intensity * 0.3;

                const gradient = ctx.createLinearGradient(x2d, y2d, x2d, y2d + beamLength);
                gradient.addColorStop(0, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0.8)`);
                gradient.addColorStop(1, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(x2d, y2d);
                ctx.lineTo(x2d - beamWidth / 2, y2d + beamLength);
                ctx.lineTo(x2d + beamWidth / 2, y2d + beamLength);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }

            // Glow
            if (intensity > 0.1) {
                const gradient = ctx.createRadialGradient(x2d, y2d, 0, x2d, y2d, radius * 2.5);
                gradient.addColorStop(0, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, ${intensity * 0.6})`);
                gradient.addColorStop(1, `rgba(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x2d, y2d, radius * 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Spot
            ctx.fillStyle = intensity > 0.1 ?
                `rgb(${Math.round(spot.color[0] * intensity)}, ${Math.round(spot.color[1] * intensity)}, ${Math.round(spot.color[2] * intensity)})` :
                '#334155';
            ctx.beginPath();
            ctx.arc(x2d, y2d, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = intensity > 0.5 ? '#fbbf24' : '#64748b';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            if (this.showLabels) {
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(spot.name, x2d, y2d - radius - 10);
            }
        });
    }

    setupStageInteraction() {
        const canvas = document.getElementById('stageCanvas');
        if (!canvas) return;

        let isDragging = false;
        let isDraggingSpot = false;
        let draggedSpot = null;
        let lastX = 0;
        let lastY = 0;

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if clicking on a spot
            const spot = this.getSpotAtPosition(x, y);

            if (spot && (this.stageView === 'top' || this.stageView === 'front')) {
                isDraggingSpot = true;
                draggedSpot = spot;
                canvas.style.cursor = 'grabbing';
            } else {
                isDragging = true;
            }

            lastX = e.clientX;
            lastY = e.clientY;
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (isDraggingSpot && draggedSpot) {
                // Move spot based on view
                const deltaX = (e.clientX - lastX) / 30; // Scale factor
                const deltaY = (e.clientY - lastY) / 30;

                if (this.stageView === 'top') {
                    draggedSpot.x += deltaX;
                    draggedSpot.z += deltaY;
                } else if (this.stageView === 'front') {
                    draggedSpot.x += deltaX;
                    draggedSpot.y -= deltaY;
                }

                lastX = e.clientX;
                lastY = e.clientY;
            } else if (isDragging && this.stageView === 'perspective') {
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;

                this.stageCamera.rotY += deltaX * 0.5;
                this.stageCamera.rotX += deltaY * 0.5;

                lastX = e.clientX;
                lastY = e.clientY;
            } else {
                // Update cursor if hovering over spot
                const spot = this.getSpotAtPosition(x, y);
                if (spot && (this.stageView === 'top' || this.stageView === 'front')) {
                    canvas.style.cursor = 'grab';
                } else {
                    canvas.style.cursor = 'default';
                }
            }

            // Show spot details on hover
            this.handleStageHover(e);
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            isDraggingSpot = false;
            draggedSpot = null;
            canvas.style.cursor = 'default';
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            isDraggingSpot = false;
            draggedSpot = null;
            canvas.style.cursor = 'default';
            this.hideSpotDetails();
        });

        // Zoom with mouse wheel
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.stageCamera.z += e.deltaY * 0.01;
            this.stageCamera.z = Math.max(5, Math.min(20, this.stageCamera.z));
        });
    }

    getSpotAtPosition(x, y) {
        const canvas = document.getElementById('stageCanvas');
        const width = canvas.width;
        const height = canvas.height;

        if (this.stageView === 'top') {
            const scale = 30;
            const centerX = width / 2;
            const centerY = height / 2;

            for (const spot of this.stageSpots) {
                const x2d = centerX + spot.x * scale;
                const y2d = centerY + spot.z * scale;
                const radius = 15;

                const dist = Math.sqrt((x - x2d) ** 2 + (y - y2d) ** 2);
                if (dist < radius) {
                    return spot;
                }
            }
        } else if (this.stageView === 'front') {
            const scale = 30;
            const centerX = width / 2;
            const baseY = height - 100;

            for (const spot of this.stageSpots) {
                const x2d = centerX + spot.x * scale;
                const y2d = baseY - spot.y * scale;
                const radius = 15;

                const dist = Math.sqrt((x - x2d) ** 2 + (y - y2d) ** 2);
                if (dist < radius) {
                    return spot;
                }
            }
        }

        return null;
    }

    handleStageHover(e) {
        const canvas = document.getElementById('stageCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if hovering over a spot (simplified check for top view)
        if (this.stageView === 'top') {
            const width = canvas.width;
            const height = canvas.height;
            const scale = 30;
            const centerX = width / 2;
            const centerY = height / 2;

            for (const spot of this.stageSpots) {
                const x2d = centerX + spot.x * scale;
                const y2d = centerY + spot.z * scale;
                const distance = Math.sqrt((x - x2d) ** 2 + (y - y2d) ** 2);

                if (distance < 20) {
                    this.showSpotDetails(spot, e.clientX, e.clientY);
                    return;
                }
            }
        }

        this.hideSpotDetails();
    }

    showSpotDetails(spot, x, y) {
        const popup = document.getElementById('spotDetailsPopup');
        if (!popup) return;

        document.getElementById('spotDetailName').textContent = spot.name;
        document.getElementById('spotDetailPosition').textContent =
            `X:${spot.x.toFixed(1)} Y:${spot.y.toFixed(1)} Z:${spot.z.toFixed(1)}`;

        const colorDiv = document.getElementById('spotDetailColor');
        colorDiv.style.background = `rgb(${spot.color[0]}, ${spot.color[1]}, ${spot.color[2]})`;

        document.getElementById('spotDetailIntensity').textContent = `${Math.round(spot.intensity)}%`;

        const device = spot.device;
        const startCh = device.start_channel || 1;
        const chCount = device.channels ? device.channels.length : 0;
        document.getElementById('spotDetailDMX').textContent = `Ch ${startCh}-${startCh + chCount - 1}`;

        popup.style.display = 'block';
        popup.style.left = (x + 15) + 'px';
        popup.style.top = (y + 15) + 'px';
    }

    hideSpotDetails() {
        const popup = document.getElementById('spotDetailsPopup');
        if (popup) popup.style.display = 'none';
    }

    setStageView(view) {
        this.stageView = view;

        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        // Switch between 2D canvas and 3D Three.js
        const canvas2D = document.getElementById('stageCanvas');
        const container3D = document.getElementById('stage3DContainer');

        if (view === '3d') {
            // Show 3D container, hide 2D canvas
            canvas2D.style.display = 'none';
            container3D.style.display = 'block';

            // Initialize Three.js if not already done
            if (!this.threeInitialized) {
                this.initThreeJS();
            }
        } else {
            // Show 2D canvas, hide 3D container
            canvas2D.style.display = 'block';
            container3D.style.display = 'none';
        }
    }

    toggleStageDemoMode() {
        this.stageDemoMode = !this.stageDemoMode;
        this.stageDemoTime = 0; // Reset animation time

        if (this.stageDemoMode) {
            // Add demo devices to device list
            this.addDemoDevices();
        } else {
            // Remove demo devices from device list
            this.removeDemoDevices();
        }

        // Update button states
        this.updateStageDemoButtons();

        // Regenerate spots for both 2D and 3D
        this.updateStageSpots();

        // Update 3D spots if in 3D view
        if (this.threeInitialized && this.stageView === '3d') {
            this.update3DSpots();
        }
    }

    updateStageDemoButtons() {
        const demoBtn = document.getElementById('stageDemoModeBtn');
        const liveBtn = document.getElementById('stageLiveModeBtn');

        if (!demoBtn || !liveBtn) return;

        if (this.stageDemoMode) {
            demoBtn.classList.add('active');
            liveBtn.classList.remove('active');
        } else {
            demoBtn.classList.remove('active');
            liveBtn.classList.add('active');
        }
    }

    restoreStageDemoState() {
        // Restore demo mode button states after tab switch
        this.updateStageDemoButtons();

        // If demo mode is active, make sure demo devices are loaded
        if (this.stageDemoMode) {
            // Check if demo devices are already in the list
            const hasDemo = this.devices.some(d => d.id && d.id.startsWith('demo-'));

            if (!hasDemo) {
                // Re-add demo devices if they were removed
                this.addDemoDevices();
            }

            // Update stage spots to reflect demo mode
            this.updateStageSpots();

            // Update 3D spots if in 3D view
            if (this.threeInitialized && this.stageView === '3d') {
                this.update3DSpots();
            }
        }
    }

    addDemoDevices() {
        // Store original devices to restore later
        if (!this.originalDevices) {
            this.originalDevices = [...this.devices];
        }

        // Create demo devices with realistic DMX structure
        const demoDevices = [
            {
                id: 'demo-1',
                name: 'PAR Front L',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 1,
                values: [0, 255, 0, 0],
                current_values: { 1: 0, 2: 255, 3: 0, 4: 0 },
                channels: [
                    { channel: 1, type: 'dimmer', name: 'Dimmer' },
                    { channel: 2, type: 'red', name: 'Red' },
                    { channel: 3, type: 'green', name: 'Green' },
                    { channel: 4, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-2',
                name: 'PAR Front C',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 5,
                values: [0, 0, 255, 0],
                current_values: { 5: 0, 6: 0, 7: 255, 8: 0 },
                channels: [
                    { channel: 5, type: 'dimmer', name: 'Dimmer' },
                    { channel: 6, type: 'red', name: 'Red' },
                    { channel: 7, type: 'green', name: 'Green' },
                    { channel: 8, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-3',
                name: 'PAR Front R',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 9,
                values: [0, 0, 0, 255],
                current_values: { 9: 0, 10: 0, 11: 0, 12: 255 },
                channels: [
                    { channel: 9, type: 'dimmer', name: 'Dimmer' },
                    { channel: 10, type: 'red', name: 'Red' },
                    { channel: 11, type: 'green', name: 'Green' },
                    { channel: 12, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-4',
                name: 'Moving Head L',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 13,
                values: [0, 255, 255, 0],
                current_values: { 13: 0, 14: 255, 15: 255, 16: 0 },
                channels: [
                    { channel: 13, type: 'dimmer', name: 'Dimmer' },
                    { channel: 14, type: 'red', name: 'Red' },
                    { channel: 15, type: 'green', name: 'Green' },
                    { channel: 16, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-5',
                name: 'Moving Head C',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 17,
                values: [0, 255, 0, 255],
                current_values: { 17: 0, 18: 255, 19: 0, 20: 255 },
                channels: [
                    { channel: 17, type: 'dimmer', name: 'Dimmer' },
                    { channel: 18, type: 'red', name: 'Red' },
                    { channel: 19, type: 'green', name: 'Green' },
                    { channel: 20, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-6',
                name: 'Moving Head R',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 21,
                values: [0, 0, 255, 255],
                current_values: { 21: 0, 22: 0, 23: 255, 24: 255 },
                channels: [
                    { channel: 21, type: 'dimmer', name: 'Dimmer' },
                    { channel: 22, type: 'red', name: 'Red' },
                    { channel: 23, type: 'green', name: 'Green' },
                    { channel: 24, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-7',
                name: 'Wash Back L',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 25,
                values: [0, 255, 128, 0],
                current_values: { 25: 0, 26: 255, 27: 128, 28: 0 },
                channels: [
                    { channel: 25, type: 'dimmer', name: 'Dimmer' },
                    { channel: 26, type: 'red', name: 'Red' },
                    { channel: 27, type: 'green', name: 'Green' },
                    { channel: 28, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-8',
                name: 'Wash Back C',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 29,
                values: [0, 128, 255, 128],
                current_values: { 29: 0, 30: 128, 31: 255, 32: 128 },
                channels: [
                    { channel: 29, type: 'dimmer', name: 'Dimmer' },
                    { channel: 30, type: 'red', name: 'Red' },
                    { channel: 31, type: 'green', name: 'Green' },
                    { channel: 32, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-9',
                name: 'Wash Back R',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 33,
                values: [0, 128, 128, 255],
                current_values: { 33: 0, 34: 128, 35: 128, 36: 255 },
                channels: [
                    { channel: 33, type: 'dimmer', name: 'Dimmer' },
                    { channel: 34, type: 'red', name: 'Red' },
                    { channel: 35, type: 'green', name: 'Green' },
                    { channel: 36, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-10',
                name: 'Side Spot L',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 37,
                values: [0, 255, 200, 100],
                current_values: { 37: 0, 38: 255, 39: 200, 40: 100 },
                channels: [
                    { channel: 37, type: 'dimmer', name: 'Dimmer' },
                    { channel: 38, type: 'red', name: 'Red' },
                    { channel: 39, type: 'green', name: 'Green' },
                    { channel: 40, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-11',
                name: 'Side Spot R',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 41,
                values: [0, 100, 200, 255],
                current_values: { 41: 0, 42: 100, 43: 200, 44: 255 },
                channels: [
                    { channel: 41, type: 'dimmer', name: 'Dimmer' },
                    { channel: 42, type: 'red', name: 'Red' },
                    { channel: 43, type: 'green', name: 'Green' },
                    { channel: 44, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-12',
                name: 'Truss Front L',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 45,
                values: [0, 255, 100, 200],
                current_values: { 45: 0, 46: 255, 47: 100, 48: 200 },
                channels: [
                    { channel: 45, type: 'dimmer', name: 'Dimmer' },
                    { channel: 46, type: 'red', name: 'Red' },
                    { channel: 47, type: 'green', name: 'Green' },
                    { channel: 48, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-13',
                name: 'Truss Front R',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 49,
                values: [0, 200, 100, 255],
                current_values: { 49: 0, 50: 200, 51: 100, 52: 255 },
                channels: [
                    { channel: 49, type: 'dimmer', name: 'Dimmer' },
                    { channel: 50, type: 'red', name: 'Red' },
                    { channel: 51, type: 'green', name: 'Green' },
                    { channel: 52, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-14',
                name: 'Truss Back L',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 53,
                values: [0, 100, 255, 200],
                current_values: { 53: 0, 54: 100, 55: 255, 56: 200 },
                channels: [
                    { channel: 53, type: 'dimmer', name: 'Dimmer' },
                    { channel: 54, type: 'red', name: 'Red' },
                    { channel: 55, type: 'green', name: 'Green' },
                    { channel: 56, type: 'blue', name: 'Blue' }
                ]
            },
            {
                id: 'demo-15',
                name: 'Truss Back R',
                device_type: 'spot_rgb',
                universe: 1,
                start_channel: 57,
                values: [0, 200, 255, 100],
                current_values: { 57: 0, 58: 200, 59: 255, 60: 100 },
                channels: [
                    { channel: 57, type: 'dimmer', name: 'Dimmer' },
                    { channel: 58, type: 'red', name: 'Red' },
                    { channel: 59, type: 'green', name: 'Green' },
                    { channel: 60, type: 'blue', name: 'Blue' }
                ]
            }
        ];

        // Add demo devices to the device list
        this.devices = [...demoDevices];

        // Re-render devices and groups
        this.renderDevices();
        this.renderGroups();
    }

    removeDemoDevices() {
        // Restore original devices
        if (this.originalDevices) {
            this.devices = [...this.originalDevices];
            this.originalDevices = null;
        }

        // Re-render devices and groups
        this.renderDevices();
        this.renderGroups();
    }

    toggleStageBeams() {
        this.showBeams = document.getElementById('showBeamsCheckbox').checked;
    }

    toggleStageGrid() {
        this.showGrid = document.getElementById('showGridCheckbox').checked;
    }

    toggleStageLabels() {
        this.showLabels = document.getElementById('showLabelsCheckbox').checked;
    }

    resetStageCamera() {
        this.stageCamera = { x: 0, y: -5, z: 10, rotX: -30, rotY: 0 };
    }

    toggleStageFullscreen() {
        const container = document.getElementById('stageCanvasContainer');
        const icon = document.getElementById('fullscreenIcon');
        const text = document.getElementById('fullscreenText');

        if (!document.fullscreenElement) {
            // Enter fullscreen
            container.requestFullscreen().then(() => {
                if (icon) icon.textContent = '⛶';
                if (text) text.textContent = 'Vollbild beenden';
                this.resizeStageCanvas();
                this.setupFullscreenControls();
            }).catch(err => {
                console.error('Fullscreen error:', err);
                // Fallback to CSS fullscreen
                container.classList.add('fullscreen');
                if (icon) icon.textContent = '⛶';
                if (text) text.textContent = 'Vollbild beenden';
                this.resizeStageCanvas();
                this.setupFullscreenControls();
            });
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => {
                    if (icon) icon.textContent = '⛶';
                    if (text) text.textContent = 'Vollbild';
                    this.resizeStageCanvas();
                    this.cleanupFullscreenControls();
                });
            } else {
                // Fallback: remove CSS fullscreen class
                container.classList.remove('fullscreen');
                if (icon) icon.textContent = '⛶';
                if (text) text.textContent = 'Vollbild';
                this.resizeStageCanvas();
                this.cleanupFullscreenControls();
            }
        }

        // Listen for fullscreen changes (handles ESC key)
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                if (icon) icon.textContent = '⛶';
                if (text) text.textContent = 'Vollbild';
                container.classList.remove('fullscreen');
                this.resizeStageCanvas();
                this.cleanupFullscreenControls();
            }
        }, { once: true });
    }

    setupFullscreenControls() {
        const container = document.getElementById('stageCanvasContainer');
        const overlay = document.getElementById('fullscreenControlsOverlay');

        if (!container || !overlay) return;

        // Auto-hide timeout
        let hideTimeout;

        // Show controls function
        const showControls = () => {
            overlay.classList.add('visible');
            container.classList.remove('hide-cursor');

            // Clear existing timeout
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }

            // Hide after 3 seconds of inactivity
            hideTimeout = setTimeout(() => {
                overlay.classList.remove('visible');
                container.classList.add('hide-cursor');
            }, 3000);
        };

        // Hide controls function
        const hideControls = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
            overlay.classList.remove('visible');
            container.classList.add('hide-cursor');
        };

        // Mouse move handler
        this.fullscreenMouseMove = (e) => {
            // Show controls when mouse moves in upper 20% of screen or clicks anywhere
            if (e.clientY < window.innerHeight * 0.2) {
                showControls();
            }
        };

        // Click/Touch handler for showing controls
        this.fullscreenClick = (e) => {
            // Don't show if clicking the exit button itself
            if (e.target.closest('.btn-fullscreen-exit')) {
                return;
            }
            showControls();
        };

        // Touch start handler for mobile
        this.fullscreenTouchStart = (e) => {
            const touch = e.touches[0];
            if (touch.clientY < window.innerHeight * 0.2) {
                showControls();
            }
        };

        // Add event listeners
        container.addEventListener('mousemove', this.fullscreenMouseMove);
        container.addEventListener('click', this.fullscreenClick);
        container.addEventListener('touchstart', this.fullscreenTouchStart);

        // Show controls initially
        showControls();
    }

    cleanupFullscreenControls() {
        const container = document.getElementById('stageCanvasContainer');
        const overlay = document.getElementById('fullscreenControlsOverlay');

        if (!container || !overlay) return;

        // Remove event listeners
        if (this.fullscreenMouseMove) {
            container.removeEventListener('mousemove', this.fullscreenMouseMove);
        }
        if (this.fullscreenClick) {
            container.removeEventListener('click', this.fullscreenClick);
        }
        if (this.fullscreenTouchStart) {
            container.removeEventListener('touchstart', this.fullscreenTouchStart);
        }

        // Hide overlay
        overlay.classList.remove('visible');
        container.classList.remove('hide-cursor');
    }

    // ===== Three.js 3D View =====
    initThreeJS() {
        if (this.threeInitialized || typeof THREE === 'undefined') {
            console.log('Three.js already initialized or not loaded');
            return;
        }

        const container = document.getElementById('stage3DContainer');
        if (!container) {
            console.error('3D container not found');
            return;
        }

        console.log('Initializing Three.js, container size:', container.clientWidth, 'x', container.clientHeight);

        // Scene setup
        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x0a0e1a);
        this.threeScene.fog = new THREE.Fog(0x0a0e1a, 20, 60);

        // Camera setup - look at stage center
        this.threeCamera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.threeCamera.position.set(15, 10, 10);
        this.threeCamera.lookAt(0, 3, -4); // Look at stage center

        // Renderer setup
        this.threeRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.threeRenderer.setSize(container.clientWidth, container.clientHeight);
        this.threeRenderer.setPixelRatio(window.devicePixelRatio);
        this.threeRenderer.shadowMap.enabled = true;
        this.threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.threeRenderer.domElement);

        // Lighting - brighter for better visibility
        const ambientLight = new THREE.AmbientLight(0x606060, 1.0);
        this.threeScene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 500;
        mainLight.shadow.camera.left = -30;
        mainLight.shadow.camera.right = 30;
        mainLight.shadow.camera.top = 30;
        mainLight.shadow.camera.bottom = -30;
        this.threeScene.add(mainLight);

        // Add helper light from other side
        const fillLight = new THREE.DirectionalLight(0x8080ff, 0.4);
        fillLight.position.set(-10, 15, -10);
        this.threeScene.add(fillLight);

        // Add stage platform
        this.createStagePlatform();

        // Add grid helper at floor level
        const gridHelper = new THREE.GridHelper(40, 40, 0x666666, 0x333333);
        gridHelper.position.y = 0;
        this.threeScene.add(gridHelper);

        // Store spot meshes
        this.threeSpotMeshes = [];

        // Ensure spots are loaded before creating 3D models
        if (this.stageSpots.length === 0) {
            console.log('No spots available, updating spots...');
            this.updateStageSpots();
        }

        // Create initial spots
        console.log('Creating 3D spots, count:', this.stageSpots.length);
        this.update3DSpots();

        // Mouse controls for camera
        this.setup3DControls();

        // Handle resize
        window.addEventListener('resize', () => {
            if (this.stageView === '3d' && container.clientWidth > 0) {
                this.threeCamera.aspect = container.clientWidth / container.clientHeight;
                this.threeCamera.updateProjectionMatrix();
                this.threeRenderer.setSize(container.clientWidth, container.clientHeight);
            }
        });

        this.threeInitialized = true;

        // Render once immediately to show scene
        this.threeRenderer.render(this.threeScene, this.threeCamera);

        // Start animation loop
        this.animate3D();

        console.log('Three.js initialization complete');
    }

    createStagePlatform() {
        // Stage floor
        const floorGeometry = new THREE.BoxGeometry(30, 0.5, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1f2e,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(0, -0.25, -4);
        floor.receiveShadow = true;
        this.threeScene.add(floor);

        // Stage edges (decorative)
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            emissive: 0x1e40af,
            emissiveIntensity: 0.3
        });

        // Front edge
        const frontEdge = new THREE.Mesh(
            new THREE.BoxGeometry(30, 0.8, 0.2),
            edgeMaterial
        );
        frontEdge.position.set(0, 0.15, 6);
        this.threeScene.add(frontEdge);

        // Truss structure (simplified)
        const trussMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.2
        });

        const trussGeometry = new THREE.CylinderGeometry(0.1, 0.1, 30, 8);
        const truss1 = new THREE.Mesh(trussGeometry, trussMaterial);
        truss1.rotation.z = Math.PI / 2;
        truss1.position.set(0, 8, -4);
        this.threeScene.add(truss1);
    }

    update3DSpots() {
        if (!this.threeScene) {
            console.warn('Cannot update 3D spots: scene not initialized');
            return;
        }

        console.log('Updating 3D spots, count:', this.stageSpots.length);

        // Remove old spot meshes
        this.threeSpotMeshes.forEach(mesh => {
            this.threeScene.remove(mesh);
            if (mesh.light) {
                this.threeScene.remove(mesh.light);
            }
            if (mesh.lens) {
                this.threeScene.remove(mesh.lens);
            }
        });
        this.threeSpotMeshes = [];

        // Create new spot meshes
        this.stageSpots.forEach((spot, index) => {
            console.log(`Creating spot ${index}: ${spot.name} at (${spot.x}, ${spot.y}, ${spot.z})`);

            // Spot body (cylinder) - make it more visible
            const spotGeometry = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 16);
            const spotMaterial = new THREE.MeshStandardMaterial({
                color: 0x444444,
                metalness: 0.7,
                roughness: 0.3,
                emissive: 0x222222,
                emissiveIntensity: 0.2
            });
            const spotMesh = new THREE.Mesh(spotGeometry, spotMaterial);
            spotMesh.position.set(spot.x, spot.y, spot.z);
            spotMesh.castShadow = true;
            spotMesh.receiveShadow = true;
            this.threeScene.add(spotMesh);

            // Add a small sphere at the front for lens
            const lensGeometry = new THREE.SphereGeometry(0.2, 16, 16);
            const lensMaterial = new THREE.MeshStandardMaterial({
                color: 0x111111,
                metalness: 0.9,
                roughness: 0.1
            });
            const lens = new THREE.Mesh(lensGeometry, lensMaterial);
            lens.position.set(spot.x, spot.y - 0.7, spot.z);
            this.threeScene.add(lens);
            spotMesh.lens = lens;

            // Light source - always create for demo
            const intensity = spot.intensity / 100;
            if (intensity > 0.05) {
                const color = new THREE.Color(
                    spot.color[0] / 255,
                    spot.color[1] / 255,
                    spot.color[2] / 255
                );

                const light = new THREE.PointLight(color, intensity * 3, 15);
                light.position.set(spot.x, spot.y - 0.8, spot.z);
                light.castShadow = true;
                light.shadow.mapSize.width = 512;
                light.shadow.mapSize.height = 512;
                this.threeScene.add(light);

                spotMesh.light = light;

                // Update lens emissive
                lens.material.emissive = color;
                lens.material.emissiveIntensity = intensity * 0.8;
            }

            this.threeSpotMeshes.push(spotMesh);
        });

        console.log('3D spots created:', this.threeSpotMeshes.length);
    }

    setup3DControls() {
        const container = document.getElementById('stage3DContainer');
        if (!container) return;

        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            // Rotate camera around center
            const rotationSpeed = 0.005;
            const radius = Math.sqrt(
                this.threeCamera.position.x ** 2 +
                this.threeCamera.position.z ** 2
            );

            const angle = Math.atan2(this.threeCamera.position.z, this.threeCamera.position.x);
            const newAngle = angle - deltaX * rotationSpeed;

            this.threeCamera.position.x = radius * Math.cos(newAngle);
            this.threeCamera.position.z = radius * Math.sin(newAngle);

            this.threeCamera.position.y += -deltaY * 0.05;
            this.threeCamera.position.y = Math.max(2, Math.min(20, this.threeCamera.position.y));

            this.threeCamera.lookAt(0, 3, -4); // Look at stage center

            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        container.addEventListener('mouseup', () => {
            isDragging = false;
        });

        container.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        // Zoom with mouse wheel
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.5;
            const direction = e.deltaY > 0 ? 1 : -1;

            const radius = Math.sqrt(
                this.threeCamera.position.x ** 2 +
                this.threeCamera.position.z ** 2
            );

            const newRadius = Math.max(5, Math.min(30, radius + direction * zoomSpeed));
            const angle = Math.atan2(this.threeCamera.position.z, this.threeCamera.position.x);

            this.threeCamera.position.x = newRadius * Math.cos(angle);
            this.threeCamera.position.z = newRadius * Math.sin(angle);

            this.threeCamera.lookAt(0, 3, -4); // Look at stage center
        });
    }

    animate3D() {
        if (!this.threeInitialized || !this.threeRenderer) return;

        requestAnimationFrame(() => this.animate3D());

        // Only render if in 3D view
        if (this.stageView === '3d') {
            // Update spot data
            if (this.stageDemoMode) {
                this.updateDemoSpots();
            } else {
                this.updateStageSpotData();
            }

            // Update 3D spot visuals
            this.threeSpotMeshes.forEach((mesh, index) => {
                const spot = this.stageSpots[index];
                if (!spot) return;

                const intensity = spot.intensity / 100;

                // Update light
                if (mesh.light) {
                    const color = new THREE.Color(
                        spot.color[0] / 255,
                        spot.color[1] / 255,
                        spot.color[2] / 255
                    );
                    mesh.light.color = color;
                    mesh.light.intensity = intensity * 2;
                } else if (intensity > 0.1) {
                    // Create light if it doesn't exist
                    const color = new THREE.Color(
                        spot.color[0] / 255,
                        spot.color[1] / 255,
                        spot.color[2] / 255
                    );
                    const light = new THREE.PointLight(color, intensity * 2, 10);
                    light.position.copy(mesh.position);
                    light.position.y -= 0.5;
                    light.castShadow = true;
                    this.threeScene.add(light);
                    mesh.light = light;
                }

                // Update emissive color
                if (intensity > 0.05) {
                    mesh.material.emissive = new THREE.Color(
                        spot.color[0] / 255,
                        spot.color[1] / 255,
                        spot.color[2] / 255
                    );
                    mesh.material.emissiveIntensity = intensity * 0.5;
                } else {
                    mesh.material.emissiveIntensity = 0;
                }

                // Update lens emissive
                if (mesh.lens && intensity > 0.05) {
                    mesh.lens.material.emissive = new THREE.Color(
                        spot.color[0] / 255,
                        spot.color[1] / 255,
                        spot.color[2] / 255
                    );
                    mesh.lens.material.emissiveIntensity = intensity * 0.8;
                } else if (mesh.lens) {
                    mesh.lens.material.emissiveIntensity = 0;
                }
            });

            this.threeRenderer.render(this.threeScene, this.threeCamera);

            // Update stats
            if (Math.random() < 0.1) {
                this.updateStageStats();
            }
        }
    }

    // ===== Truss Management =====
    showTrussManager() {
        this.loadTrusses();
        this.renderTrussList();
        document.getElementById('trussManagerModal').classList.add('active');
    }

    closeTrussManager() {
        document.getElementById('trussManagerModal').classList.remove('active');
    }

    loadTrusses() {
        // Load from localStorage
        const saved = localStorage.getItem('stageTrusses');
        if (saved) {
            this.trusses = JSON.parse(saved);
        } else {
            // Create default truss
            this.trusses = [
                {
                    id: 'truss-1',
                    name: 'Front Traverse',
                    x: 0,
                    y: 6,
                    z: -6,
                    length: 12,
                    rotation: 0
                }
            ];
            this.saveTrusses();
        }

        // Load spot assignments
        const assignments = localStorage.getItem('spotAssignments');
        if (assignments) {
            this.spotAssignments = JSON.parse(assignments);
        }
    }

    saveTrusses() {
        localStorage.setItem('stageTrusses', JSON.stringify(this.trusses));
        localStorage.setItem('spotAssignments', JSON.stringify(this.spotAssignments));
    }

    renderTrussList() {
        const container = document.getElementById('trussList');
        if (!container) return;

        if (this.trusses.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Keine Traversen vorhanden</p>';
            return;
        }

        container.innerHTML = this.trusses.map(truss => {
            const spotCount = Object.values(this.spotAssignments).filter(a => a.trussId === truss.id).length;
            const isSelected = this.currentTruss && this.currentTruss.id === truss.id;

            return `
                <div class="truss-item ${isSelected ? 'selected' : ''}" onclick="app.selectTruss('${truss.id}')">
                    <div>
                        <strong>${truss.name}</strong>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            Position: (${truss.x}, ${truss.y}, ${truss.z}) | Länge: ${truss.length}m | ${spotCount} Spots
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); app.editTruss('${truss.id}')">
                            ✏️
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); app.deleteTruss('${truss.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    selectTruss(trussId) {
        this.currentTruss = this.trusses.find(t => t.id === trussId);
        this.renderTrussList();
        this.renderSpotAssignment();
    }

    renderSpotAssignment() {
        const container = document.getElementById('spotAssignmentArea');
        if (!container || !this.currentTruss) return;

        const assignedSpots = Object.entries(this.spotAssignments)
            .filter(([_, assignment]) => assignment.trussId === this.currentTruss.id)
            .map(([spotId, _]) => this.devices.find(d => d.id === spotId))
            .filter(d => d);

        const availableSpots = this.devices.filter(d =>
            !this.spotAssignments[d.id] || this.spotAssignments[d.id].trussId !== this.currentTruss.id
        );

        container.innerHTML = `
            <h4>${this.currentTruss.name}</h4>
            <div style="margin-bottom: 1rem;">
                <label>Spot hinzufügen:</label>
                <select id="spotToAdd" class="form-control">
                    <option value="">-- Spot auswählen --</option>
                    ${availableSpots.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
                <button class="btn btn-primary btn-sm" onclick="app.addSpotToTruss()" style="margin-top: 0.5rem;">
                    Spot hinzufügen
                </button>
            </div>

            <h5>Zugeordnete Spots:</h5>
            <div style="max-height: 300px; overflow-y: auto;">
                ${assignedSpots.map(spot => {
                    const assignment = this.spotAssignments[spot.id];
                    return `
                        <div class="spot-assignment-item">
                            <div>
                                <strong>${spot.name}</strong>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                    Pos: ${assignment.position.toFixed(1)}m |
                                    Tilt: ${assignment.tilt}° |
                                    Pan: ${assignment.pan}°
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-secondary btn-sm" onclick="app.configureSpot('${spot.id}')">
                                    ⚙️ Config
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="app.removeSpotFromTruss('${spot.id}')">
                                    ✖️
                                </button>
                            </div>
                        </div>
                    `;
                }).join('') || '<p style="color: var(--text-secondary);">Keine Spots zugeordnet</p>'}
            </div>
        `;
    }

    showAddTruss() {
        this.editingTruss = null;
        document.getElementById('trussModalTitle').textContent = 'Traverse hinzufügen';
        document.getElementById('trussName').value = '';
        document.getElementById('trussX').value = '0';
        document.getElementById('trussY').value = '6';
        document.getElementById('trussZ').value = '-4';
        document.getElementById('trussLength').value = '10';
        document.getElementById('trussRotation').value = '0';
        document.getElementById('addTrussModal').classList.add('active');
    }

    editTruss(trussId) {
        this.editingTruss = this.trusses.find(t => t.id === trussId);
        if (!this.editingTruss) return;

        document.getElementById('trussModalTitle').textContent = 'Traverse bearbeiten';
        document.getElementById('trussName').value = this.editingTruss.name;
        document.getElementById('trussX').value = this.editingTruss.x;
        document.getElementById('trussY').value = this.editingTruss.y;
        document.getElementById('trussZ').value = this.editingTruss.z;
        document.getElementById('trussLength').value = this.editingTruss.length;
        document.getElementById('trussRotation').value = this.editingTruss.rotation;
        document.getElementById('addTrussModal').classList.add('active');
    }

    closeAddTruss() {
        document.getElementById('addTrussModal').classList.remove('active');
        this.editingTruss = null;
    }

    saveTruss() {
        const name = document.getElementById('trussName').value.trim();
        const x = parseFloat(document.getElementById('trussX').value);
        const y = parseFloat(document.getElementById('trussY').value);
        const z = parseFloat(document.getElementById('trussZ').value);
        const length = parseFloat(document.getElementById('trussLength').value);
        const rotation = parseFloat(document.getElementById('trussRotation').value);

        if (!name || length <= 0) {
            this.showToast('Bitte alle Felder ausfüllen', 'error');
            return;
        }

        if (this.editingTruss) {
            // Update existing
            this.editingTruss.name = name;
            this.editingTruss.x = x;
            this.editingTruss.y = y;
            this.editingTruss.z = z;
            this.editingTruss.length = length;
            this.editingTruss.rotation = rotation;
        } else {
            // Create new
            const newTruss = {
                id: 'truss-' + Date.now(),
                name,
                x,
                y,
                z,
                length,
                rotation
            };
            this.trusses.push(newTruss);
        }

        this.saveTrusses();
        this.closeAddTruss();
        this.renderTrussList();
        this.updateStageWithTrusses();
        this.showToast('Traverse gespeichert', 'success');
    }

    deleteTruss(trussId) {
        if (!confirm('Traverse wirklich löschen? Alle zugeordneten Spots werden entfernt.')) {
            return;
        }

        // Remove truss
        this.trusses = this.trusses.filter(t => t.id !== trussId);

        // Remove spot assignments
        Object.keys(this.spotAssignments).forEach(spotId => {
            if (this.spotAssignments[spotId].trussId === trussId) {
                delete this.spotAssignments[spotId];
            }
        });

        this.saveTrusses();
        this.renderTrussList();
        this.updateStageWithTrusses();
        this.showToast('Traverse gelöscht', 'success');
    }

    addSpotToTruss() {
        const spotId = document.getElementById('spotToAdd').value;
        if (!spotId || !this.currentTruss) return;

        this.spotAssignments[spotId] = {
            trussId: this.currentTruss.id,
            position: 0, // Center of truss
            pan: 0,
            tilt: -45, // Default downward angle
            targetX: 0,
            targetY: 0,
            targetZ: 0
        };

        this.saveTrusses();
        this.renderSpotAssignment();
        this.updateStageWithTrusses();
        this.showToast('Spot hinzugefügt', 'success');
    }

    removeSpotFromTruss(spotId) {
        delete this.spotAssignments[spotId];
        this.saveTrusses();
        this.renderSpotAssignment();
        this.updateStageWithTrusses();
        this.showToast('Spot entfernt', 'success');
    }

    configureSpot(spotId) {
        this.editingSpot = spotId;
        const assignment = this.spotAssignments[spotId];
        const spot = this.devices.find(d => d.id === spotId);

        if (!assignment || !spot) return;

        document.getElementById('spotConfigTitle').textContent = `${spot.name} konfigurieren`;
        document.getElementById('spotTrussPosition').value = assignment.position;
        document.getElementById('spotTrussPositionValue').textContent = assignment.position.toFixed(1) + ' m';
        document.getElementById('spotTilt').value = assignment.tilt;
        document.getElementById('spotTiltValue').textContent = assignment.tilt + '°';
        document.getElementById('spotPan').value = assignment.pan;
        document.getElementById('spotPanValue').textContent = assignment.pan + '°';
        document.getElementById('spotTargetX').value = assignment.targetX;
        document.getElementById('spotTargetY').value = assignment.targetY;
        document.getElementById('spotTargetZ').value = assignment.targetZ;

        // Set max/min based on truss length
        const truss = this.trusses.find(t => t.id === assignment.trussId);
        if (truss) {
            const halfLength = truss.length / 2;
            document.getElementById('spotTrussPosition').min = -halfLength;
            document.getElementById('spotTrussPosition').max = halfLength;
        }

        document.getElementById('spotConfigModal').classList.add('active');
    }

    closeSpotConfig() {
        document.getElementById('spotConfigModal').classList.remove('active');
        this.editingSpot = null;
    }

    updateSpotPositionPreview() {
        const value = document.getElementById('spotTrussPosition').value;
        document.getElementById('spotTrussPositionValue').textContent = parseFloat(value).toFixed(1) + ' m';
    }

    updateSpotTiltPreview() {
        const value = document.getElementById('spotTilt').value;
        document.getElementById('spotTiltValue').textContent = value + '°';
    }

    updateSpotPanPreview() {
        const value = document.getElementById('spotPan').value;
        document.getElementById('spotPanValue').textContent = value + '°';
    }

    autoAimSpot() {
        if (!this.editingSpot) return;

        const assignment = this.spotAssignments[this.editingSpot];
        const truss = this.trusses.find(t => t.id === assignment.trussId);
        if (!truss) return;

        // Calculate spot world position
        const radians = (truss.rotation * Math.PI) / 180;
        const spotWorldX = truss.x + Math.cos(radians) * assignment.position;
        const spotWorldZ = truss.z + Math.sin(radians) * assignment.position;
        const spotWorldY = truss.y;

        // Get target position
        const targetX = parseFloat(document.getElementById('spotTargetX').value) || 0;
        const targetY = parseFloat(document.getElementById('spotTargetY').value) || 0;
        const targetZ = parseFloat(document.getElementById('spotTargetZ').value) || 0;

        // Calculate direction vector
        const dx = targetX - spotWorldX;
        const dy = targetY - spotWorldY;
        const dz = targetZ - spotWorldZ;

        // Calculate pan (rotation around Y axis)
        const pan = Math.atan2(dx, dz) * (180 / Math.PI);

        // Calculate tilt (rotation around X axis)
        const distXZ = Math.sqrt(dx * dx + dz * dz);
        const tilt = -Math.atan2(dy, distXZ) * (180 / Math.PI);

        // Update UI
        document.getElementById('spotPan').value = Math.round(pan);
        document.getElementById('spotTilt').value = Math.round(tilt);
        this.updateSpotPanPreview();
        this.updateSpotTiltPreview();

        this.showToast('Spot automatisch ausgerichtet', 'success');
    }

    saveSpotConfig() {
        if (!this.editingSpot) return;

        const assignment = this.spotAssignments[this.editingSpot];
        assignment.position = parseFloat(document.getElementById('spotTrussPosition').value);
        assignment.tilt = parseInt(document.getElementById('spotTilt').value);
        assignment.pan = parseInt(document.getElementById('spotPan').value);
        assignment.targetX = parseFloat(document.getElementById('spotTargetX').value) || 0;
        assignment.targetY = parseFloat(document.getElementById('spotTargetY').value) || 0;
        assignment.targetZ = parseFloat(document.getElementById('spotTargetZ').value) || 0;

        this.saveTrusses();
        this.closeSpotConfig();
        this.renderSpotAssignment();
        this.updateStageWithTrusses();
        this.showToast('Spot-Konfiguration gespeichert', 'success');
    }

    updateStageWithTrusses() {
        // Update stage spots based on truss assignments
        this.updateStageSpots();

        // Update 3D if initialized
        if (this.threeInitialized) {
            this.rebuild3DScene();
        }
    }

    rebuild3DScene() {
        if (!this.threeScene) return;

        // Remove old trusses and spots
        if (this.threeTrussMeshes) {
            this.threeTrussMeshes.forEach(mesh => this.threeScene.remove(mesh));
        }
        this.threeTrussMeshes = [];

        // Create new trusses and spots
        this.create3DTrusses();
        this.update3DSpots();
    }

    create3DTrusses() {
        if (!this.threeScene) return;

        this.threeTrussMeshes = [];

        this.trusses.forEach(truss => {
            // Truss structure
            const trussGeometry = new THREE.CylinderGeometry(0.15, 0.15, truss.length, 8);
            const trussMaterial = new THREE.MeshStandardMaterial({
                color: 0x555555,
                metalness: 0.8,
                roughness: 0.2
            });
            const trussMesh = new THREE.Mesh(trussGeometry, trussMaterial);

            // Position and rotate
            trussMesh.position.set(truss.x, truss.y, truss.z);
            trussMesh.rotation.y = (truss.rotation * Math.PI) / 180;
            trussMesh.rotation.z = Math.PI / 2; // Horizontal

            trussMesh.castShadow = true;
            trussMesh.receiveShadow = true;

            this.threeScene.add(trussMesh);
            this.threeTrussMeshes.push(trussMesh);
        });
    }
}

const app = new DMXController();
window.app = app;
