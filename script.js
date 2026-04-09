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
        setTimeout(checkBotTurn, 1000); // TADY BYLA CHYBA - FUNKCE MUSÍ EXISTOVAT
    }
}

// ==========================================
// 5. BOT LOGIKA (OPRAVENÁ)
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
            throwGain = usedDice * (Math.
