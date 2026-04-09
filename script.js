// ==========================================
// 1. STAV A GLOBÁLNÍ PROMĚNNÉ
// ==========================================
let players = JSON.parse(localStorage.getItem('dice_players')) || [];
let history = [];
let activeIndex = 0;
let rollLog = JSON.parse(localStorage.getItem('dice_roll_log')) || [];
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
    if (!syncCheckbox) return;
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
    const targetInput = document.getElementById('targetScore');
    const entryInput = document.getElementById('entryLimit');
    const zilchCheck = document.getElementById('zilchMode');
    const turnInput = document.getElementById('turnLimit');

    if (targetInput) settings.target = parseInt(targetInput.value);
    if (entryInput) settings.entryLimit = parseInt(entryInput.value);
    if (zilchCheck) settings.zilch = zilchCheck.checked;
    
    if (settings.sync) {
        settings.turnLimit = settings.entryLimit;
        if (turnInput) turnInput.value = settings.entryLimit;
    } else if (turnInput) {
        settings.turnLimit = parseInt(turnInput.value);
    }

    if (settings.entryLimit < settings.turnLimit) {
        settings.entryLimit = settings.turnLimit;
        if (entryInput) entryInput.value = settings.turnLimit;
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
    const diffSelect = document.getElementById('botDifficultySelect');
    const name = nameInput.value.trim();
    
    if (name) {
        players.push({ 
            id: Date.now(), 
            name: name, 
            score: 0, 
            zeros: 0, 
            active: true, 
            isBot: isBot,
            difficulty: isBot ? (diffSelect ? diffSelect.value : 'normal') : 'normal',
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

function changeBotDifficulty(id) {
    const p = players.find(p => p.id === id);
    if (!p || !p.isBot) return;

    const levels = ['conservative', 'normal', 'crazy'];
    const currentIdx = levels.indexOf(p.difficulty);
    const nextIdx = (currentIdx + 1) % levels.length;
    p.difficulty = levels[nextIdx];
    
    vibrate();
    save();
}

function toggleActive(id) {
    const p = players.find(p => p.id === id);
    if (p) {
        p.active = !p.active;
        p.finished = false;
        save();
    }
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
    logRoll(p.name, points);
    history.push(JSON.parse(JSON.stringify(players)));

    if (points === 0) {
        p.zeros++;
        if (p.zeros >= 3) {
            alert((p.isBot ? "🤖 " : "") + p.name + " padá na 0 (3x KIKS).");
            p.score = 0; 
            p.zeros = 0;
        }
    } else {
        p.zeros = 0;
        let potentialScore = p.score + points;

        if (potentialScore > settings.target) {
            if (settings.zilch) {
                p.score = Math.max(0, p.score - points);
                alert(`PŘEHOZENO! Odečítáme ${points}.`);
            } else {
                alert("Přehozeno! Bodování se nezapisuje.");
            }
        } else if (potentialScore === settings.target) {
            p.score = potentialScore;
            p.finished = true;
            p.finishTime = Date.now();
            alert("VÍTĚZSTVÍ! " + p.name + " dosáhl cíle.");
        } else {
            p.score = potentialScore;
        }
    }
    
    vibrate();
    save();

    playing = players.filter(p => p.active && !p.finished);
    const totalActiveCount = players.filter(p => p.active).length;

    if ((totalActiveCount > 1 && playing.length <= 1) || (totalActiveCount === 1 && playing.length === 0)) {
        if (playing.length === 1) {
            playing[0].finished = true;
            playing[0].finishTime = Date.now() + 1;
        }
        showFinalResults();
    } else {
        activeIndex = (activeIndex + (p.finished ? 0 : 1)) % playing.length;
        render();
        setTimeout(checkBotTurn, 1000);
    }
}

// ==========================================
// 5. BOT LOGIKA
// ==========================================
function checkBotTurn() {
    const playing = players.filter(p => p.active && !p.finished);
    if (playing.length === 0) return;

    const p = playing[activeIndex];
    if (p && p.isBot) {
        const display = document.getElementById('currentPlayerDisplay');
        if (display) display.innerText = `🤖 ${p.name} (${p.difficulty}) hází...`;

        setTimeout(() => {
            const points = simulateBotTurn(p);
            if (points === 0) {
                if (display) display.innerText = `🤖 ${p.name}: KIKS!`;
                setTimeout(() => processMove(0), 1200);
            } else {
                processMove(points);
            }
        }, 1000);
    }
}

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

    while (true) {
        if (bot.zeros === 2 && turnPoints >= currentLimit) return turnPoints;

        let kiksChance = (diceCount <= 3 ? 0.25 : 0.1) * d.kiksMod;
        if (diceCount === 1) kiksChance = 0.45 * d.kiksMod;
        if (bot.zeros === 2) kiksChance *= 1.5;

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

        if (settings.zilch && (bot.score + turnPoints + throwGain > settings.target)) {
            return turnPoints >= currentLimit ? turnPoints : 0;
        }

        turnPoints += throwGain;
        diceCount -= usedDice;
        if (diceCount <= 0) diceCount = 6;

        if (turnPoints < currentLimit) continue;
        if (turnPoints >= currentLimit * d.riskLimit) return turnPoints;
        if (Math.random() < d.stopChance || diceCount < 3) return turnPoints;
    }
}

// ==========================================
// 6. TÉMATA
// ==========================================
function toggleTheme() {
    vibrate();
    const themeLink = document.getElementById('themeLink');
    const themeBtn = document.getElementById('themeBtn');
    
    if (themeLink.getAttribute('href').includes('dark')) {
        themeLink.setAttribute('href', 'style-light.css');
        if (themeBtn) themeBtn.innerText = "🌙 Tmavý režim";
        localStorage.setItem('diceTheme', 'light');
    } else {
        themeLink.setAttribute('href', 'style-dark.css');
        if (themeBtn) themeBtn.innerText = "☀️ Světlý režim";
        localStorage.setItem('diceTheme', 'dark');
    }
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('diceTheme') || 'dark';
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

// ==========================================
// 7. POMOCNÉ FUNKCE A UI
// ==========================================
function logRoll(playerName, points) {
    rollLog.push({
        time: new Date().toLocaleTimeString(),
        name: playerName,
        points: points
    });
    // Udržíme jen posledních 100 hodů, aby se nezahltila paměť
    if (rollLog.length > 100) rollLog.shift();
    localStorage.setItem('dice_roll_log', JSON.stringify(rollLog));
}
function render() {
    const body = document.getElementById('scoreBody');
    const lib = document.getElementById('playerLibrary');
    const playing = players.filter(p => p.active && !p.finished);
    
    if (lib) {
        lib.innerHTML = players.map(p => `
            <div class="library-item ${p.active ? 'active' : ''} ${p.finished ? 'finished' : ''}">
                <span onclick="toggleActive(${p.id})" style="cursor:pointer">
                    ${p.isBot ? '🤖' : '👤'} <b>${p.name}</b>
                </span>
                ${p.isBot ? `<button class="diff-btn" onclick="changeBotDifficulty(${p.id})">${p.difficulty.toUpperCase()}</button>` : ''}
                <span class="edit-btn" onclick="renamePlayer(${p.id})">✏️</span>
                <span class="edit-btn" onclick="deletePlayer(${p.id})" style="color:red">🗑️</span>
            </div>
        `).join('');
    }

    if (body) {
        body.innerHTML = "";
        playing.forEach((p, index) => {
            const isCurrent = index === activeIndex;
            if (isCurrent) {
                const display = document.getElementById('currentPlayerDisplay');
                if (display) display.innerText = "Na řadě: " + p.name;
            }
            const row = document.createElement('tr');
            if (isCurrent) row.className = "current-turn";
            row.innerHTML = `<td>${isCurrent ? '➔ ' : ''}${p.name}</td><td>${p.score}</td><td>${p.zeros}/3</td>`;
            body.appendChild(row);
        });
    }

    const panel = document.getElementById('playPanel');
    if (panel) panel.style.display = playing.length ? 'block' : 'none';
    
    // Synchronizace inputů v nastavení
    const tInput = document.getElementById('targetScore');
    const eInput = document.getElementById('entryLimit');
    const tuInput = document.getElementById('turnLimit');
    const zCheck = document.getElementById('zilchMode');
    const sCheck = document.getElementById('syncLimits');

    if (tInput) tInput.value = settings.target;
    if (eInput) eInput.value = settings.entryLimit;
    if (tuInput) {
        tuInput.value = settings.turnLimit;
        tuInput.disabled = settings.sync;
    }
    if (zCheck) zCheck.checked = settings.zilch;
    if (sCheck) sCheck.checked = settings.sync;
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
    if (content) {
        content.innerHTML = `<h2 style="color:var(--accent); text-align:center;">🏆 Konečné pořadí</h2>${resultsHtml}
        <button onclick="resetScores(); closeRules();" style="width:100%; margin-top:20px; padding:10px; background:var(--accent); border:none; color:white; border-radius:5px; cursor:pointer;">Nová hra</button>`;
        openRules();
    }
}

function save() {
    localStorage.setItem('dice_players', JSON.stringify(players));
    render();
}
function showRollHistory() {
    const content = document.getElementById('rulesContent');
    if (!content) return;

    let tableHtml = `
        <h2 style="color:var(--accent); text-align:center;">📜 Historie zápisů</h2>
        <div style="max-height: 400px; overflow-y: auto;">
            <table style="width:100%; border-collapse: collapse; color: white;">
                <thead style="position: sticky; top: 0; background: var(--bg-dark);">
                    <tr style="border-bottom: 2px solid var(--accent);">
                        <th style="text-align:left; padding: 8px;">Čas</th>
                        <th style="text-align:left; padding: 8px;">Hráč</th>
                        <th style="text-align:right; padding: 8px;">Body</th>
                    </tr>
                </thead>
                <tbody>
    `;

    [...rollLog].reverse().forEach(log => {
        tableHtml += `
            <tr style="border-bottom: 1px solid #444;">
                <td style="padding: 8px; font-size: 0.8em; color: #aaa;">${log.time}</td>
                <td style="padding: 8px;">${log.name}</td>
                <td style="padding: 8px; text-align:right; font-weight:bold; color:${log.points === 0 ? 'red' : 'inherit'}">
                    ${log.points}
                </td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table></div>`;
    
    if (rollLog.length === 0) tableHtml = "<p style='text-align:center; color: #aaa;'>Zatím žádné hody.</p>";
    
    content.innerHTML = tableHtml;
    openRules();
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
    } catch (e) { content.innerHTML = "Pravidla se nepodařilo načíst (zkontrolujte rules.json)."; }
}

function vibrate() { if (navigator.vibrate) navigator.vibrate(40); }
function openRules() { const m = document.getElementById('rulesModal'); if(m) m.style.display = 'block'; }
function closeRules() { const m = document.getElementById('rulesModal'); if(m) m.style.display = 'none'; }

// ==========================================
// 8. INICIALIZACE
// ==========================================
applySavedTheme();
updateRulesText();
render();
