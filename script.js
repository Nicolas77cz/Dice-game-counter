// ==========================================
// 1. STAV A GLOBÁLNÍ PROMĚNNÉ
// ==========================================
let players = JSON.parse(localStorage.getItem('dice_players')) || [];
let history = [];
let activeIndex = 0;
let botDifficulty = 'normal'; // Výchozí obtížnost bota

let settings = JSON.parse(localStorage.getItem('dice_settings')) || {
    target: 10000,
    entryLimit: 350,
    turnLimit: 350,
    zilch: false,
    sync: true
};

// ==========================================
// 2. NASTAVENÍ A SYNCHRONIZACE
// ==========================================
function toggleSync() {
    const syncCheckbox = document.getElementById('syncLimits');
    settings.sync = syncCheckbox.checked;
    
    const turnInput = document.getElementById('turnLimit');
    if (settings.sync) {
        turnInput.disabled = true;
        turnInput.value = document.getElementById('entryLimit').value;
    } else {
        turnInput.disabled = false;
    }
    updateSettings();
}

function updateSettings() {
    settings.target = parseInt(document.getElementById('targetScore').value);
    settings.entryLimit = parseInt(document.getElementById('entryLimit').value);
    settings.zilch = document.getElementById('zilchMode').checked;
    
    const turnInput = document.getElementById('turnLimit');
    if (settings.sync) {
        settings.turnLimit = settings.entryLimit;
        turnInput.value = settings.entryLimit;
    } else {
        settings.turnLimit = parseInt(turnInput.value);
    }

    // Logická pojistka
    if (settings.entryLimit < settings.turnLimit) {
        settings.entryLimit = settings.turnLimit;
        document.getElementById('entryLimit').value = settings.turnLimit;
    }

    localStorage.setItem('dice_settings', JSON.stringify(settings));
    updateRulesText();
    render();
}

// ==========================================
// 3. SPRÁVA HRÁČŮ
// ==========================================
function addNewPlayer(isBot) {
    const nameInput = document.getElementById('newName');
    const name = nameInput.value.trim();
    if (name) {
        players.push({ 
            id: Date.now(), 
            name: name, 
            score: 0, 
            zeros: 0, 
            active: true, 
            isBot: isBot 
        });
        nameInput.value = "";
        vibrate();
        save();
    }
}

function deletePlayer(id) {
    if(confirm("Opravdu smazat hráče?")) {
        players = players.filter(p => p.id !== id);
        if (activeIndex >= players.filter(p => p.active).length) activeIndex = 0;
        save();
    }
}

function renamePlayer(id) {
    const p = players.find(p => p.id === id);
    const newName = prompt("Zadej nové jméno:", p.name);
    if (newName) {
        p.name = newName;
        save();
    }
}

function toggleActive(id) {
    const p = players.find(p => p.id === id);
    if (p) {
        p.active = !p.active;
        activeIndex = 0;
        save();
    }
}

// ==========================================
// 4. JÁDRO HERNÍ LOGIKY
// ==========================================
function submitTurn() {
    const input = document.getElementById('mainInput');
    const val = parseInt(input.value);
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length === 0) return;

    const p = activeOnes[activeIndex];
    const currentLimit = (p.score === 0) ? settings.entryLimit : settings.turnLimit;

    if (isNaN(val) || val < currentLimit || val % 50 !== 0) { 
        alert(`Neplatný hod! Minimální zápis: ${currentLimit}, násobek 50.`); 
        return; 
    }
    processMove(val);
    input.value = "";
}

function submitZero() { processMove(0); }

function nextPlayer() {
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length > 0) {
        activeIndex = (activeIndex + 1) % activeOnes.length;
        render();
        checkBotTurn();
    }
}

function processMove(points) {
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length === 0) return;
    
    const p = activeOnes[activeIndex];
    history.push(JSON.parse(JSON.stringify(players)));

    if (points === 0) {
        // 1. ZPRACOVÁNÍ KIKSU
        p.zeros++;
        if (p.zeros >= 3) {
            const msg = p.isBot ? `🤖 BOT ${p.name} dal 3. KIKS a padá na nulu!` : `3x KIKS! ${p.name} padá na 0 bodů.`;
            alert(msg);
            p.score = 0; 
            p.zeros = 0;
        }
    } else {
        p.zeros = 0;
        let potentialScore = p.score + points;

        if (potentialScore > settings.target) {
            if (settings.zilch) {
                p.score = Math.max(0, p.score - points);
                alert(`PŘEHOZENO! Odečítáme ${points}. Aktuálně: ${p.score}`);
            } else {
                alert("Přehozeno! Bodování se nezapisuje.");
            }
        } else if (potentialScore === settings.target) {
            p.score = potentialScore;
            alert("VÍTĚZSTVÍ! " + p.name + " vyhrává!");
        } else {
            p.score = potentialScore;
        }
    }
    
    vibrate();
    save(); // save volá render
    
    // Posun na dalšího hráče
    activeIndex = (activeIndex + 1) % activeOnes.length;
    render();
    
    // Kontrola, zda po posunu není na řadě bot
    setTimeout(checkBotTurn, 1000);
}

// ==========================================
// 5. BOT LOGIKA (OSOBNOSTI A SIMULACE)
// ==========================================
function checkBotTurn() {
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length === 0) return;

    const p = activeOnes[activeIndex];
    if (p && p.isBot) {
        // Vizuální indikace, že Bot "přemýšlí"
        document.getElementById('currentPlayerDisplay').innerText = `🤖 ${p.name} hází...`;

        setTimeout(() => {
            const points = simulateBotTurn();
            
            if (points === 0) {
                // Pokud Bot hodil KIKS, dáme o tom vědět v UI
                document.getElementById('currentPlayerDisplay').innerText = `🤖 ${p.name}: KIKS! (0 bodů)`;
                
                // Krátká pauza, aby si hráč stihl přečíst "KIKS", než se přepne hráč
                setTimeout(() => processMove(0), 1500);
            } else {
                processMove(points);
            }
        }, 1000);
    }
}

function simulateBotTurn() {
    let turnPoints = 0;
    let diceCount = 6;
    let stop = false;

    const diffs = {
        'conservative': { kiksMod: 0.8, riskLimit: 1.2, stopChance: 0.8 },
        'normal':       { kiksMod: 1.0, riskLimit: 1.5, stopChance: 0.6 },
        'crazy':        { kiksMod: 1.3, riskLimit: 2.5, stopChance: 0.3 }
    };
    
    const d = diffs[botDifficulty] || diffs['normal'];

    while (!stop) {
        let kiksChance = (diceCount <= 3 ? 0.2 : 0.1) * d.kiksMod;
        if (diceCount === 1) kiksChance = 0.4 * d.kiksMod;

        if (Math.random() < kiksChance) return 0;

        let throwGain = 0;
        let usedDice = 0;
        let roll = Math.random();

        if (roll < 0.03) { 
            throwGain = (diceCount === 6) ? 2000 : 1800;
            usedDice = diceCount; 
        } else if (roll < 0.15) {
            let count = Math.min(diceCount, Math.floor(Math.random() * 4 + 3));
            let value = Math.floor(Math.random() * 6 + 1);
            let baseValue = (value === 1) ? 1000 : value * 100;
            throwGain = baseValue + (baseValue * (count - 3)); 
            usedDice = count;
        } else {
            usedDice = Math.min(diceCount, Math.floor(Math.random() * 2 + 1));
            throwGain = usedDice * (Math.random() > 0.5 ? 100 : 50);
        }

        turnPoints += throwGain;
        diceCount -= usedDice;
        if (diceCount <= 0) diceCount = 6;

        if (turnPoints >= settings.turnLimit * d.riskLimit) {
            stop = true;
        } else if (turnPoints >= settings.turnLimit) {
            if (Math.random() < d.stopChance || diceCount < 3) stop = true;
        }
    }
    return turnPoints;
}

// ==========================================
// 6. POMOCNÉ FUNKCE A UI
// ==========================================
function render() {
    // UI Synchronizace nastavení
    document.getElementById('targetScore').value = settings.target;
    document.getElementById('entryLimit').value = settings.entryLimit;
    document.getElementById('turnLimit').value = settings.turnLimit;
    document.getElementById('zilchMode').checked = settings.zilch;
    document.getElementById('syncLimits').checked = settings.sync;
    document.getElementById('turnLimit').disabled = settings.sync;

    const lib = document.getElementById('playerLibrary');
    const body = document.getElementById('scoreBody');
    const activeOnes = players.filter(p => p.active);
    
    lib.innerHTML = players.map(p => `
        <div class="library-item ${p.active ? 'active' : ''}">
            <span onclick="toggleActive(${p.id})">${p.isBot ? '🤖' : '👤'} ${p.name}</span>
            <span class="edit-btn" onclick="renamePlayer(${p.id})">✏️</span>
            <span class="edit-btn" onclick="deletePlayer(${p.id})">🗑️</span>
        </div>
    `).join('');

    body.innerHTML = "";
    document.getElementById('playPanel').style.display = activeOnes.length ? 'block' : 'none';

    activeOnes.forEach((p, index) => {
        const isCurrent = index === activeIndex;
        if (isCurrent) document.getElementById('currentPlayerDisplay').innerText = "Na řadě: " + p.name;
        
        const row = document.createElement('tr');
        if (isCurrent) row.className = "current-turn";
        row.innerHTML = `
            <td>${isCurrent ? '➔ ' : ''}${p.name} ${p.isBot ? '<span class="bot-tag">BOT</span>' : ''}</td>
            <td>${p.score} / ${settings.target}</td>
            <td>${p.zeros}/3</td>
        `;
        body.appendChild(row);
    });
}

function save() {
    localStorage.setItem('dice_players', JSON.stringify(players));
    render();
}

function resetScores() {
    if(confirm("Vynulovat body pro novou hru?")) {
        players.forEach(p => { p.score = 0; p.zeros = 0; });
        activeIndex = 0;
        save();
    }
}

function undoLastMove() {
    if (history.length > 0) {
        players = history.pop();
        save();
    }
}

// ==========================================
// 7. TÉMATA A MODÁLY
// ==========================================
function toggleTheme() {
    vibrate();
    const themeLink = document.getElementById('themeLink');
    const themeBtn = document.getElementById('themeBtn');
    
    if (themeLink.getAttribute('href').includes('dark')) {
        themeLink.setAttribute('href', 'style-light.css');
        themeBtn.innerText = "🌙 Tmavý režim";
        localStorage.setItem('diceTheme', 'light');
    } else {
        themeLink.setAttribute('href', 'style-dark.css');
        themeBtn.innerText = "☀️ Světlý režim";
        localStorage.setItem('diceTheme', 'dark');
    }
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('diceTheme');
    const themeLink = document.getElementById('themeLink');
    const themeBtn = document.getElementById('themeBtn');
    
    if (savedTheme === 'light') {
        themeLink.setAttribute('href', 'style-light.css');
        if (themeBtn) themeBtn.innerText = "🌙 Tmavý režim";
    }
}

async function updateRulesText() {
    const content = document.getElementById('rulesContent');
    if (!content) return;
    try {
        const response = await fetch('rules.json');
        const d = await response.json();
        content.innerHTML = `
            <div style="margin-bottom:15px; border-bottom:1px solid var(--accent); padding-bottom:10px;">
                <b style="color:var(--accent);">Bodování:</b><br>
                • ${d.scoring.singles}<br>• ${d.scoring.sets}<br>• ${d.scoring.straights}<br>• ${d.scoring.kiks}
            </div>
            <div style="margin-bottom:15px; border-bottom:1px solid var(--accent); padding-bottom:10px;">
                <b style="color:var(--accent);">Limity:</b><br>
                • <b>Vstup (${settings.entryLimit}):</b> ${d.limits_info.entry}<br>
                • <b>Kolo (${settings.turnLimit}):</b> ${d.limits_info.turn}
            </div>
            <div>
                <b style="color:var(--accent);">Funkce:</b><br>
                • ${d.features.bot}<br>• ${d.features.management}
            </div>`;
    } catch (e) { content.innerHTML = "Pravidla se nepodařilo načíst."; }
}

function vibrate() { if (navigator.vibrate) navigator.vibrate(40); }
function openRules() { document.getElementById('rulesModal').style.display = 'block'; }
function closeRules() { document.getElementById('rulesModal').style.display = 'none'; }

// ==========================================
// 8. INICIALIZACE
// ==========================================
applySavedTheme();
updateRulesText();
render();
