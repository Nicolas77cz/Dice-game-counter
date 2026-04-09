// --- STAV A NASTAVENÍ ---
let players = JSON.parse(localStorage.getItem('dice_players')) || [];
let history = [];
let activeIndex = 0;
let settings = JSON.parse(localStorage.getItem('dice_settings')) || {
    target: 10000,
    entryLimit: 350,
    turnLimit: 350,
    zilch: false,
    sync: true
};

// --- NASTAVENÍ A SYNCHRONIZACE ---
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

    // Logická pojistka: Vstupní limit nemůže být nižší než limit kola
    if (settings.entryLimit < settings.turnLimit) {
        settings.entryLimit = settings.turnLimit;
        document.getElementById('entryLimit').value = settings.turnLimit;
    }

    localStorage.setItem('dice_settings', JSON.stringify(settings));
    updateRulesText();
    render();
}

// --- LOGIKA HRÁČŮ ---
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
    p.active = !p.active;
    activeIndex = 0;
    save();
}

// --- LOGIKA HRY ---
function nextPlayer() {
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length > 0) {
        activeIndex = (activeIndex + 1) % activeOnes.length;
        render();
        setTimeout(checkBotTurn, 1000);
    }
}

function submitTurn() {
    const input = document.getElementById('mainInput');
    const val = parseInt(input.value);
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length === 0) return;

    const p = activeOnes[activeIndex];
    // Určení aktuálního limitu podle toho, zda už hráč "vstoupil" do hry
    const currentLimit = (p.score === 0) ? settings.entryLimit : settings.turnLimit;

    if (isNaN(val) || val < currentLimit || val % 50 !== 0) { 
        alert(`Neplatný hod! Minimální zápis pro vás je ${currentLimit} a musí být násobek 50.`); 
        return; 
    }
    processMove(val);
    input.value = "";
}

function submitZero() { processMove(0); }

function processMove(points) {
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length === 0) return;
    
    const p = activeOnes[activeIndex];
    history.push(JSON.parse(JSON.stringify(players)));

    if (points === 0) {
        p.zeros++;
        if (p.zeros >= 3) {
            alert("3x KIKS! " + p.name + " padá na 0 bodů.");
            p.score = 0; p.zeros = 0;
        }
    } else {
        p.zeros = 0;
        let potentialScore = p.score + points;

        if (potentialScore > settings.target) {
            if (settings.zilch) {
                // LOGIKA ODEČTU: Pokud přehodí, body se odečtou od aktuálního stavu
                p.score = Math.max(0, p.score - points);
                alert(`PŘEHOZENO! V režimu ZILCH se ${points} bodů odečítá. Aktuálně: ${p.score}`);
            } else {
                // Klasický mód: prostě se nepřičte nic a hráč čeká na další kolo
                alert("Přehozeno! Bodování se nezapisuje.");
            }
        } else if (potentialScore === settings.target) {
            p.score = potentialScore;
            alert("VÍTĚZSTVÍ! Hráč " + p.name + " dosáhl cíle!");
        } else {
            p.score = potentialScore;
        }
    }
    
    vibrate();
    activeIndex = (activeIndex + 1) % activeOnes.length;
    save();
    setTimeout(checkBotTurn, 1000);
}
    
    vibrate();
    activeIndex = (activeIndex + 1) % activeOnes.length;
    save();
    setTimeout(checkBotTurn, 1000);
}

function checkBotTurn() {
    const activeOnes = players.filter(p => p.active);
    if (activeOnes.length === 0) return;
    
    const nextP = activeOnes[activeIndex];
    if (nextP && nextP.isBot) {
        const currentLimit = (nextP.score === 0) ? settings.entryLimit : settings.turnLimit;
        let botRoll;

        // Inteligentnější simulace hodu BOTa
        if (Math.random() < 0.18) {
            botRoll = 0; // Kiks
        } else {
            // Hod v násobcích 50, který dává smysl
            const randomBonus = Math.floor(Math.random() * 8) * 50;
            botRoll = currentLimit + randomBonus;
        }
        
        alert(`BOT ${nextP.name} hází: ${botRoll === 0 ? "KIKS" : botRoll}`);
        processMove(botRoll);
    }
}

// --- POMOCNÉ FUNKCE ---
function render() {
    // Synchronizace prvků nastavení
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
            <span class="edit-btn" style="color:red" onclick="deletePlayer(${p.id})">🗑️</span>
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

async function updateRulesText() {
    const content = document.getElementById('rulesContent');
    if (!content) return;

    try {
        const response = await fetch('rules.json');
        const d = await response.json();

        content.innerHTML = `
            <div style="margin-bottom:15px; border-bottom:1px solid var(--accent); padding-bottom:10px;">
                <b>Bodování:</b><br>
                • ${d.scoring.singles}<br>
                • ${d.scoring.sets}<br>
                • ${d.scoring.straights}<br>
                • ${d.scoring.kiks}
            </div>
            <div style="margin-bottom:15px;">
                <b>Vysvětlení limitů:</b><br>
                • <b>Vstup (${settings.entryLimit}):</b> ${d.limits_info.entry}<br>
                • <b>Kolo (${settings.turnLimit}):</b> ${d.limits_info.turn}<br>
                • <b>ZILCH:</b> ${d.limits_info.zilch}
            </div>
            <div style="font-size: 0.8rem; opacity: 0.8;">
                ${d.features.bot}<br>
                ${d.features.management}
            </div>
        `;
    } catch (e) {
        content.innerHTML = "Pravidla se nepodařilo načíst.";
    }
}
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
    } else {
        themeLink.setAttribute('href', 'style-dark.css');
        if (themeBtn) themeBtn.innerText = "☀️ Světlý režim";
    }
}

function vibrate() { if (navigator.vibrate) navigator.vibrate(40); }
function openRules() { document.getElementById('rulesModal').style.display = 'block'; }
function closeRules() { document.getElementById('rulesModal').style.display = 'none'; }
function undoLastMove() { if (history.length > 0) { players = history.pop(); save(); } }

// Spuštění při načtení
applySavedTheme();
updateRulesText();
render();
