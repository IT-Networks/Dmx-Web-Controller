// DMX Web Controller Pro - Frontend JavaScript

class DMXController {
    constructor() {
        this.ws = null;
        this.devices = [];
        this.scenes = [];
        this.groups = [];
        this.effects = [];
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
            'effects': ['Effekte', 'Dynamische Lichteffekte']
        };
        
        const [title, subtitle] = titles[tabName];
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageSubtitle').textContent = subtitle;
        
        const buttons = {
            'devices': '<button class="btn btn-primary" onclick="app.showAddDevice()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Gerät hinzufügen</span></button>',
            'groups': '<button class="btn btn-primary" onclick="app.showAddGroup()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Gruppe erstellen</span></button>',
            'scenes': '<button class="btn btn-primary" onclick="app.showAddScene()"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L10 17 M3 10 L17 10" stroke="currentColor" stroke-width="2"/></svg><span>Szene erstellen</span></button>',
            'effects': ''
        };
        
        document.getElementById('headerActions').innerHTML = buttons[tabName];
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

        if (this.audioAnalyzer.isActive) {
            this.audioAnalyzer.stop();
            btn.textContent = '🎤 Audio aktivieren';
            status.textContent = 'Inaktiv';
            status.style.color = 'var(--text-secondary)';
            levelsDisplay.style.display = 'none';
        } else {
            const success = await this.audioAnalyzer.start();
            if (success) {
                btn.textContent = '🔇 Audio deaktivieren';
                status.textContent = 'Aktiv';
                status.style.color = 'var(--success)';
                levelsDisplay.style.display = 'block';
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
        const levelBass = document.getElementById('levelBass');
        const levelMid = document.getElementById('levelMid');
        const levelHigh = document.getElementById('levelHigh');

        if (levelBass) levelBass.style.width = (audioData.bass * 100) + '%';
        if (levelMid) levelMid.style.width = (audioData.mid * 100) + '%';
        if (levelHigh) levelHigh.style.width = (audioData.high * 100) + '%';

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
}

const app = new DMXController();
