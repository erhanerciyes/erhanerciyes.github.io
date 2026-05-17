
let activeIntervals = [];

function clearEngineIntervals() {
    activeIntervals.forEach(clearInterval);
    activeIntervals = [];
}

function safeSetInterval(fn, time) {
    const id = setInterval(fn, time);
    activeIntervals.push(id);
}


async function loadPage(pageName, btnElement) {
    try {
        const response = await fetch(`${pageName}.html`);
        if (!response.ok) throw new Error("Dosya bulunamadı. Lütfen Live Server kullanın.");
        
        const html = await response.text();
        document.getElementById('page-content').innerHTML = html;

        
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if(btnElement) btnElement.classList.add('active');

        clearEngineIntervals();

        if (pageName === 'monitor') {
            initMonitorEngine();
        }
    } catch (error) {
        document.getElementById('page-content').innerHTML = `<div style="padding: 20px; color: red;"><b>Hata:</b> HTML dosyalarını fetch edebilmek için sayfayı VSCode Live Server (veya benzeri bir HTTP sunucusu) üzerinden çalıştırmalısın. Çift tıklayarak (file://) açarsan CORS hatası alırsın.</div>`;
    }
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('nurse_dashboard_theme', themeName);
    
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${themeName}`);
    if(activeBtn) activeBtn.classList.add('active');

    const avatar = document.getElementById('avatar-img');
    if(avatar) {
        if(themeName === 'vice-city') {
            avatar.src = "assets/pp_vice.jpg"; 
        } else if(themeName === 'dark') {
            avatar.src = "assets/pp.jpg";
        } else {
            avatar.src = "assets/pp.jpg"; 
        }
    }
    
    if(document.getElementById('ekg-canvas-1')) {
        updateEKGColors();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('nurse_dashboard_theme') || 'light';
    setTheme(savedTheme);

    loadPage('profile', document.querySelector('.nav-menu .active'));
});

let monitorsConfig = [];
let ekgState = 'normal'; 
let currentVoltage = 200; 

function initMonitorEngine() {
    monitorsConfig = [
        { px: 0, py: 0, speed: 1.2, nextBeat: 50 + Math.random()*50, lineColor: '', glowColor: '', lastPy: 0 }, 
        { px: 0, py: 0, speed: 1.5, nextBeat: 80 + Math.random()*50, lineColor: '', glowColor: '', lastPy: 0 }, 
        { px: 0, py: 0, speed: 1.0, nextBeat: 60 + Math.random()*50, lineColor: '', glowColor: '', lastPy: 0 }  
    ];
    ekgState = 'normal';
    currentVoltage = 200;

    initClock();
    initTerminal();
    
    resizeAllCanvases(); 
    initEKGCanvasEngine();
    
    window.removeEventListener('resize', resizeAllCanvases);
    window.addEventListener('resize', resizeAllCanvases);
}

function initTerminal() {
    const logMessages = [
        "> Bed 1 vitals stable.",
        "> Bed 2 NIBP reading normal.",
        "> Trauma 1 requesting O- blood.",
        "> Dispensing 50mg Propofol.",
        "> Incoming EMT... ETA 5 mins.",
        "> System check... All nodes green."
    ];

    window.addTerminalLog = function(message, targetId = 'terminal-content') {
        const terminal = document.getElementById(targetId);
        if(!terminal) return;
        
        const time = new Date().toLocaleTimeString([], { hour12: false });
        const logLine = document.createElement('div');
        logLine.className = 'log-line';
        logLine.innerText = `[${time}] ${message}`;
        
        terminal.appendChild(logLine);
        
        const limit = targetId === 'digital-screen' ? 4 : 6;
        if(terminal.children.length > limit) {
            terminal.removeChild(terminal.firstChild);
        }
    };

    safeSetInterval(() => {
        if(ekgState === 'normal') {
            const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
            addTerminalLog(msg, 'terminal-content');
        }
    }, 4500);
}

function initClock() {
    function updateMatrixClock() {
        const now = new Date();
        const clockEl = document.getElementById('live-clock');
        const dateEl = document.getElementById('live-date');
        
        if(clockEl) clockEl.innerText = now.toLocaleTimeString('en-US', { hour12: false });
        if(dateEl) dateEl.innerText = now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
    updateMatrixClock();
    safeSetInterval(updateMatrixClock, 1000);
}

window.toggleDefibPower = function() {
    const isPowered = document.getElementById('power-switch').checked;
    const shockBtn = document.getElementById('shock-btn');
    const screen = document.getElementById('digital-screen');
    const statusText = document.getElementById('defib-status');
    
    if(isPowered) {
        shockBtn.classList.remove('disabled');
        screen.classList.remove('off');
        statusText.innerText = "READY";
        addTerminalLog("> DEFIB POWER: ON", 'terminal-content');
    } else {
        shockBtn.classList.add('disabled');
        screen.classList.add('off');
        statusText.innerText = "OFFLINE";
        addTerminalLog("> DEFIB POWER: OFF", 'terminal-content');
    }
}

window.changeVoltage = function(amount) {
    if(!document.getElementById('power-switch').checked) return;

    currentVoltage += amount;
    if(currentVoltage > 360) currentVoltage = 360;
    if(currentVoltage < 10) currentVoltage = 10;
    
    document.getElementById('main-voltage-display').innerText = currentVoltage;
}

window.handleShock = function() {
    const isPowered = document.getElementById('power-switch').checked;
    if(!isPowered) return;

    addTerminalLog(`> SHOCK DELIVERED! (${currentVoltage}J)`, 'terminal-content');
    
    let flashEl = document.getElementById('shock-flash');
    if(!flashEl) {
        flashEl = document.createElement('div');
        flashEl.id = 'shock-flash';
        document.body.appendChild(flashEl);
    }
    
    flashEl.classList.remove('active'); 
    setTimeout(() => { flashEl.classList.add('active'); }, 1); 
    setTimeout(() => { flashEl.classList.remove('active'); }, 500); 

    ekgState = 'asystole'; 
    document.getElementById('bpm-1').innerHTML = `<i class="fas fa-heart pulse-icon neutrals"></i> 0`;
    document.getElementById('bpm-2').innerHTML = `<i class="fas fa-heart pulse-icon neutrals"></i> 0`;
    document.getElementById('bpm-3').innerHTML = `<i class="fas fa-heart pulse-icon neutrals"></i> 0`;
    document.getElementById('defib-status').innerText = "DISCHARGED";

    setTimeout(() => {
        ekgState = 'tachycardia';
        addTerminalLog("> V-Tach Detected...", 'terminal-content');
        document.getElementById('bpm-1').innerHTML = `<i class="fas fa-heart pulse-icon warn-text"></i> 165`;
        document.getElementById('bpm-2').innerHTML = `<i class="fas fa-heart pulse-icon warn-text"></i> 160`;
        document.getElementById('bpm-3').innerHTML = `<i class="fas fa-heart pulse-icon warn-text"></i> 172`;
        document.getElementById('defib-status').innerText = "RECHARGING...";
    }, 1000);

    setTimeout(() => {
        ekgState = 'normal';
        addTerminalLog("> Rhythm stabilized.", 'terminal-content');
        document.getElementById('bpm-1').innerHTML = `<i class="fas fa-heart pulse-icon"></i> 72`;
        document.getElementById('bpm-2').innerHTML = `<i class="fas fa-heart pulse-icon"></i> 68`;
        document.getElementById('bpm-3').innerHTML = `<i class="fas fa-heart pulse-icon"></i> 75`;
        document.getElementById('defib-status').innerText = "READY";
    }, 3500);
}

window.updateEKGColors = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let themeColors = {
        'light': [
            { line: '#16a34a', glow: 'rgba(22, 163, 74, 0.2)' },
            { line: '#2563eb', glow: 'rgba(37, 99, 235, 0.2)' }, 
            { line: '#0e7490', glow: 'rgba(14, 116, 144, 0.2)' }  
        ],
        'dark': [
            { line: '#38bdf8', glow: 'rgba(56, 189, 248, 0.5)' }, 
            { line: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' }, 
            { line: '#fb923c', glow: 'rgba(251, 146, 60, 0.5)' }  
        ],
        'vice-city': [
            { line: '#00ffaa', glow: 'rgba(0, 255, 170, 0.7)' }, 
            { line: '#00ffff', glow: 'rgba(0, 255, 255, 0.7)' }, 
            { line: '#ffff00', glow: 'rgba(255, 255, 0, 0.7)' }  
        ]
    };

    const palette = themeColors[currentTheme] || themeColors['light'];
    monitorsConfig.forEach((config, index) => {
        config.lineColor = palette[index].line;
        config.glowColor = palette[index].glow;
    });

    for(let i=1; i<=3; i++) {
        const cvs = document.getElementById(`ekg-canvas-${i}`);
        if(cvs) {
            const ctx = cvs.getContext('2d');
            ctx.clearRect(0, 0, cvs.width, cvs.height);
        }
    }
}

function resizeAllCanvases() {
    const canvasIds = ['ekg-canvas-1', 'ekg-canvas-2', 'ekg-canvas-3'];
    canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        if(canvas) {
            canvas.width = canvas.parentElement.clientWidth - 16; 
            canvas.height = 80;
        }
    });
}

function getHeartbeatY(x, midY, state) {
    if(state === 'asystole') return midY; 

    const scale = state === 'tachycardia' ? 1.5 : 1; 
    
    if (x < 5) return midY - (x/5)*3 * scale; 
    if (x < 10) return (midY - 3 * scale) + ((x-5)/5)*3 * scale; 
    if (x < 15) return midY; 
    if (x < 18) return midY + ((x-15)/3)*8 * scale;   
    if (x < 23) return (midY + 8 * scale) - ((x-18)/5)*43 * scale; 
    if (x < 28) return (midY - 35 * scale) + ((x-23)/5)*47 * scale; 
    if (x < 32) return (midY + 12 * scale) - ((x-28)/4)*12 * scale; 
    if (x < 42) return midY; 
    if (x < 52) return midY - ((x-42)/10)*6 * scale; 
    if (x < 62) return (midY - 6 * scale) + ((x-52)/10)*6 * scale; 
    return midY;
}

let ekgAnimationId;

function initEKGCanvasEngine() {
    updateEKGColors(); 

    function drawMonitor(canvasId, configIndex) {
        const canvas = document.getElementById(canvasId);
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const config = monitorsConfig[configIndex];
        const currentTheme = document.documentElement.getAttribute('data-theme');
        
        let w = canvas.width;
        let h = canvas.height;
        let midY = h / 2;
        if(config.py === 0) config.py = midY;

        ctx.clearRect(config.px, 0, Math.max(20, config.speed * 5), h);

        let nextPx = config.px + config.speed;
        let nextPy = midY;

        if(ekgState === 'asystole') {
            nextPy = midY; 
        } else {
            const beatWidth = 65; 
            const interval = ekgState === 'tachycardia' ? (40 + Math.random() * 20) : (120 + Math.random() * 80);

            if (config.px >= config.nextBeat && config.px < config.nextBeat + beatWidth) {
                nextPy = getHeartbeatY(config.px - config.nextBeat, midY, ekgState);
            } else {
                nextPy = midY + (Math.sin(config.px / 15) * 1.2); 
                if (config.px >= config.nextBeat + beatWidth) {
                    config.nextBeat = config.px + interval;
                }
                if(config.nextBeat < config.px) {
                    config.nextBeat = config.px + interval/2;
                }
            }
        }

        ctx.beginPath();
        ctx.moveTo(config.px, config.py);
        ctx.lineTo(nextPx, nextPy);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = config.lineColor;
        
        if(currentTheme !== 'light') {
            ctx.shadowBlur = 8;
            ctx.shadowColor = config.glowColor;
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.stroke();

        config.px = nextPx;
        config.py = nextPy;

        if (config.px >= w) {
            config.px = 0;
            config.nextBeat = 20 + Math.random() * 40; 
            ctx.clearRect(0, 0, 20, h); 
        }
    }

    function drawAll() {
        if (!document.getElementById('ekg-canvas-1')) {
            cancelAnimationFrame(ekgAnimationId);
            return;
        }
        drawMonitor('ekg-canvas-1', 0);
        drawMonitor('ekg-canvas-2', 1);
        drawMonitor('ekg-canvas-3', 2);
        ekgAnimationId = requestAnimationFrame(drawAll);
    }
    
    cancelAnimationFrame(ekgAnimationId);
    drawAll();
}
