// ==========================================
// 1. STAV A GLOBÁLNÍ PROMĚNNÉ
// ==========================================
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
    const diffSelect = document.getElementById('botDifficultySelect'); // Přidáme do HTML
    const name = nameInput.value.trim();
    
    if (name) {
        players.push({ 
            id: Date.now(), 
            name: name, 
            score: 0, 
            zeros: 0, 
            active: true, 
            isBot: isBot,
            difficulty: isBot ? diffSelect.value : 'normal', 
            finished: false,
            finishTime: null
        });
        nameInput.value = "";
        vibrate();
        save();
    }
}

function deletePlayer(id) {
    if(confirm("Opravdu smazat hráče?")) {
        players = players.filter(p => p.id !== id);
        const playing = players.filter(p => p.active && !p.finished);
        if (activeIndex >= playing.length) activeIndex = 0;
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
        p.finished = false;
        activeIndex = 0;
        save();
    }
}

function changeBotDifficulty(id) {
    const p = players.find(p => p.id === id);
    if (!p || !p.isBot) return;

    const levels = ['conservative', 'normal', 'crazy'];
    const currentIdx = levels.indexOf(p.difficulty);
    
    // Jednoduchý přepínač: každé kliknutí posune obtížnost dál
    const nextIdx = (currentIdx + 1) % levels.length;
    p.difficulty = levels[nextIdx];
    
    vibrate();
    save();
}
// ==========================================
// 4. JÁDRO HERNÍ LOGIKY
// ==========================================
function submitTurn() {
    const input = document.getElementById('mainInput');
    const val = parseInt(input.value);
    const playing = players.filter(p => p.active && !p.finished);
    if (playing.length === 0) return;

    const p = playing[activeIndex];
    const currentLimit = (p.score === 0) ? settings.entryLimit : settings.turnLimit;

    if (isNaN(val) || val < currentLimit || val % 50 !== 0) { 
        alert(`Neplatný hod! Minimální zápis: ${currentLimit}, násobek 50.`); 
        return; 
    }
    processMove(val);
    input.value = "";
}

function submitZero() { processMove(0); }

function processMove(points) {
    let playing = players.filter(p => p.active && !p.finished);
    if (playing.length === 0) return;
    
    const p = playing[activeIndex];
    history.push(JSON.parse(JSON.stringify(players)));

    if (points === 0) {
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
            p.finished = true;
            p.finishTime = Date.now();
            alert("VÍTĚZSTVÍ! " + p.name + " dosáhl cíle a končí.");
        } else {
            p.score = potentialScore;
        }
    }
    
    vibrate();
    
    playing = players.filter(p => p.active && !p.finished);
    const totalActive = players.filter(p => p.active).length;

    if ((totalActive > 1 && playing.length <= 1) || (totalActive === 1 && playing.length === 0)) {
        if (playing.length === 1) {
            playing[0].finished = true;
            playing[0].finishTime = Date.now() + 1;
        }
        save();
        showFinalResults();
    } else {
        activeIndex = (activeIndex + (p.finished ? 0 : 1)) % playing.length;
        save();
        setTimeout(checkBotTurn, 1000);
    }
}

// ==========================================
// 5. BOT LOGIKA (S INTELIGENCÍ A OSOBNOSTÍ)
// ==========================================
function simulateBotTurn(bot) {
    let turnPoints = 0;
    let diceCount = 6;
    const currentLimit = (bot.score === 0) ? settings.entryLimit : settings.turnLimit;

    const diffs = {
        'conservative': { kiksMod: 0.7, riskLimit: 1.1, stopChance: 0.85 },
        'normal':       { kiksMod: 1.0, riskLimit: 1.4, stopChance: 0.65 },
        'crazy':        { kiksMod: 1.4, riskLimit: 2.2, stopChance: 0.35 }
    };
    const d = diffs[bot.difficulty] || diffs['normal'];

    // Nekonečná smyčka, dokud bot buď nevyhraje, nezkiksne, nebo se nerozhodne přestat
    while (true) {
        // 1. Kontrola paniky ze 3. KIKSU
        if (bot.zeros === 2 && turnPoints >= currentLimit) {
            return turnPoints;
        }

        // 2. Výpočet šance na KIKS
        let kiksChance = (diceCount <= 3 ? 0.25 : 0.1) * d.kiksMod;
        if (diceCount === 1) kiksChance = 0.45 * d.kiksMod;
        if (bot.zeros === 2) kiksChance *= 1.5;

        if (Math.random() < kiksChance) return 0;

        // 3. Simulace hodu
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

        // 4. ZILCH LOGIKA (Pojistka proti přehození)
        if (settings.zilch) {
            if (bot.score + turnPoints + throwGain > settings.target) {
                // Pokud by tento hod způsobil přehození:
                // Máme už splněný limit? Pokud ano, končíme s tím, co jsme měli před tímto hodem.
                // Pokud ne, je to v podstatě KIKS (nemůžeme zapsat nic).
                return turnPoints >= currentLimit ? turnPoints : 0;
            }
        }

        // Přičtení bodů z aktuálního hodu
        turnPoints += throwGain;
        diceCount -= usedDice;
        if (diceCount <= 0) diceCount = 6;

        // 5. ROZHODOVÁNÍ O KONCI TAHU
        // Bot MUSÍ házet dál, pokud nemá limit
        if (turnPoints < currentLimit) {
            continue; // Skočí na začátek while a hází znovu
        }

        // Pokud už má limit, zváží konec podle obtížnosti
        if (turnPoints >= currentLimit * d.riskLimit) {
            return turnPoints; // Má nahráno hodně, končí
        }

        // Náhodné zastavení (stopChance) nebo pokud zbývá málo kostek
        if (Math.random() < d.stopChance || diceCount < 3) {
            return turnPoints;
        }
    }
}

// ==========================================
// 6. POMOCNÉ FUNKCE A UI
// ==========================================
function render() {
    document.getElementById('targetScore').value = settings.target;
    document.getElementById('entryLimit').value = settings.entryLimit;
    document.getElementById('turnLimit').value = settings.turnLimit;
    document.getElementById('zilchMode').checked = settings.zilch;
    document.getElementById('syncLimits').checked = settings.sync;
    document.getElementById('turnLimit').disabled = settings.sync;

    const lib = document.getElementById('playerLibrary');
    const body = document.getElementById('scoreBody');
    const playing = players.filter(p => p.active && !p.finished);
    
    lib.innerHTML = players.map(p => `
    <div class="library-item ${p.active ? 'active' : ''} ${p.finished ? 'finished' : ''}">
        <span onclick="toggleActive(${p.id})">
            ${p.isBot ? '🤖' : '👤'} ${p.name}
        </span>
        ${p.isBot ? `<span class="diff-badge" onclick="changeBotDifficulty(${p.id})">${p.difficulty}</span>` : ''}
        <span class="edit-btn" onclick="renamePlayer(${p.id})">✏️</span>
        <span class="edit-btn" onclick="deletePlayer(${p.id})">🗑️</span>
    </div>
`).join('');

    body.innerHTML = "";
    document.getElementById('playPanel').style.display = playing.length ? 'block' : 'none';

    playing.forEach((p, index) => {
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

function showFinalResults() {
    const results = [...players.filter(p => p.active)].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.score - a.score;
    });

    let resultsHtml = results.map((p, i) => `
        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom:1px solid var(--accent); color: white;">
            <span>${i + 1}. ${p.isBot ? '🤖' : '👤'} ${p.name}</span>
            <b>${p.score} b.</b>
        </div>
    `).join('');

    const content = document.getElementById('rulesContent');
    content.innerHTML = `<h2 style="color:var(--accent); text-align:center;">🏆 Konečné pořadí</h2>${resultsHtml}
    <button onclick="resetScores(); closeRules();" style="width:100%; margin-top:20px; padding:10px; background:var(--accent); border:none; color:white; border-radius:5px; cursor:pointer;">Nová hra</button>`;
    openRules();
}

function save() {
    localStorage.setItem('dice_players', JSON.stringify(players));
    render();
}

function resetScores() {
    players.forEach(p => { p.score = 0; p.zeros = 0; p.finished = false; p.finishTime = null; });
    activeIndex = 0;
    save();
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
