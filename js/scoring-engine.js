// Scoring Engine for Cricket Scorer App
let state = {
    match: {
        hostTeam: 'Royal CIT',
        visitorTeam: 'CIT Worries',
        tossWon: 'host',
        optedTo: 'bat',
        overs: 16,
        isComplete: false
    },
    innings: {
        inningNumber: 1,
        target: 0,
        battingTeam: '',
        runs: 0,
        wickets: 0,
        balls: 0
    },
    batters: [
        { name: '', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, active: true, strike: true },
        { name: '', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, active: true, strike: false }
    ],
    bowlers: [
        { name: '', overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, active: true }
    ],
    extras: { wd: 0, nb: 0, bye: 0, lb: 0 },
    thisOver: [],
    fow: []
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function goToPlayers() {
    state.match.hostTeam = document.getElementById('hostTeam').value;
    state.match.visitorTeam = document.getElementById('visitorTeam').value;
    state.match.tossWon = document.getElementById('tossHost').checked ? 'host' : 'visitor';
    state.match.optedTo = document.getElementById('optBat').checked ? 'bat' : 'bowl';
    state.match.overs = parseInt(document.getElementById('matchOvers').value);
    
    state.innings.battingTeam = (state.match.tossWon === 'host' && state.match.optedTo === 'bat') || 
                                (state.match.tossWon === 'visitor' && state.match.optedTo === 'bowl') 
                                ? state.match.hostTeam : state.match.visitorTeam;
    
    state.innings.inningNumber = 1;
    state.innings.target = 0;
                                
    showScreen('screen-players');
}

function startScoring() {
    state.batters = [
        { name: document.getElementById('strikerName').value, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, active: true, strike: true },
        { name: document.getElementById('nonStrikerName').value, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, active: true, strike: false }
    ];
    state.bowlers = [
        { name: document.getElementById('bowlerName').value, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, active: true }
    ];
    
    document.getElementById('headerMatchName').innerText = `${state.match.hostTeam} v/s ${state.match.visitorTeam}`;
    
    updateUI();
    showScreen('screen-scoring');
    saveState();
}

function updateUI() {
    let inningText = state.innings.inningNumber === 1 ? "1st inning" : "2nd inning";
    let targetText = state.innings.inningNumber === 2 ? ` (Target: ${state.innings.target})` : "";
    document.getElementById('headerInning').innerText = `${state.innings.battingTeam}, ${inningText}${targetText}`;

    // Score
    let overStr = Math.floor(state.innings.balls / 6) + '.' + (state.innings.balls % 6);
    document.getElementById('mainScore').innerText = `${state.innings.runs} - ${state.innings.wickets}`;
    document.getElementById('mainOvers').innerText = `(${overStr})`;
    
    let crr = state.innings.balls === 0 ? "0.00" : (state.innings.runs / (state.innings.balls / 6)).toFixed(2);
    document.getElementById('crrDisplay').innerText = crr;
    
    // Batters
    let bHtml = '';
    state.batters.filter(b => b.active).forEach(b => {
        let sr = b.balls === 0 ? "0.00" : ((b.runs / b.balls) * 100).toFixed(2);
        bHtml += `
            <tr style="background: ${b.strike ? '#e8f5e9' : 'transparent'};">
                <td>${b.name}${b.strike ? '*' : ''}</td>
                <td class="text-center">${b.runs}</td>
                <td class="text-center">${b.balls}</td>
                <td class="text-center">${b.fours}</td>
                <td class="text-center">${b.sixes}</td>
                <td class="text-end">${sr}</td>
            </tr>`;
    });
    document.getElementById('batsmanTable').innerHTML = bHtml;
    
    // Bowler
    let bowHtml = '';
    state.bowlers.filter(b => b.active).forEach(b => {
        let bowOverStr = Math.floor(b.balls / 6) + '.' + (b.balls % 6);
        let er = b.balls === 0 ? "0.00" : (b.runs / (b.balls / 6)).toFixed(2);
        bowHtml += `
            <tr>
                <td>${b.name}</td>
                <td class="text-center">${bowOverStr}</td>
                <td class="text-center">${b.maidens}</td>
                <td class="text-center">${b.runs}</td>
                <td class="text-center">${b.wickets}</td>
                <td class="text-end">${er}</td>
            </tr>`;
    });
    document.getElementById('bowlerTable').innerHTML = bowHtml;
    
    // This over timeline
    let timelineHtml = '';
    state.thisOver.forEach(ball => {
        let cls = '';
        if(ball === 'W') cls = 'bubble-w';
        if(ball == '4') cls = 'bubble-4';
        if(ball == '6') cls = 'bubble-6';
        timelineHtml += `<span class="over-bubble ${cls}">${ball}</span>`;
    });
    document.getElementById('thisOverTimeline').innerHTML = timelineHtml;
}

function addRun(r) {
    if (state.match.isComplete) {
        alert("Match is already complete!");
        return;
    }

    let isWicket = document.getElementById('cbWicket').checked;
    let isWide = document.getElementById('cbWide').checked;
    let isNB = document.getElementById('cbNoBall').checked;
    let isBye = document.getElementById('cbByes').checked;
    let isLegBye = document.getElementById('cbLegByes').checked;
    
    let batRun = (isWide || isBye || isLegBye) ? 0 : r;
    let extraRun = 0;
    if(isWide) extraRun += 1 + r;
    if(isNB) extraRun += 1;
    if(isBye || isLegBye) extraRun += r;
    
    let totalRun = batRun + extraRun;
    
    let striker = state.batters.find(b => b.strike);
    let bowler = state.bowlers.find(b => b.active);
    
    // Update stats
    state.innings.runs += totalRun;
    
    if(!isWide) {
        striker.balls += 1;
        striker.runs += batRun;
        if(batRun == 4) striker.fours += 1;
        if(batRun == 6) striker.sixes += 1;
    }
    
    if(!isWide && !isNB) {
        state.innings.balls += 1;
        bowler.balls += 1;
    }
    
    if(!isBye && !isLegBye) {
        bowler.runs += totalRun;
    }
    
    let bubbleText = '';
    if(isWicket) {
        bubbleText = 'W';
        state.innings.wickets += 1;
        bowler.wickets += 1;
        
        let overStr = Math.floor(state.innings.balls/6) + '.' + (state.innings.balls%6);
        state.fow.push({ name: striker.name, score: state.innings.runs, wkts: state.innings.wickets, over: overStr, bowler: bowler.name });
    } else if(isWide) {
        bubbleText = (r > 0 ? r : '') + 'Wd';
    } else if(isNB) {
        bubbleText = (r > 0 ? r : '') + 'Nb';
    } else {
        bubbleText = r;
    }
    
    state.thisOver.push(bubbleText);
    
    // Strike rotation
    if((batRun % 2) !== 0 && !isWicket) {
        swapBatsman();
    }
    
    // Reset checkboxes
    document.querySelectorAll('.form-check-input').forEach(el => el.checked = false);
    
    // Check if match is won in 2nd inning
    if(state.innings.inningNumber === 2 && state.innings.runs >= state.innings.target) {
        state.match.isComplete = true;
        updateUI();
        saveState();
        setTimeout(() => triggerCelebration(state.innings.battingTeam), 200);
        return;
    }

    if(isWicket) {
        if(state.innings.wickets >= 10) {
            checkInningsComplete();
        } else {
            var modal = new bootstrap.Modal(document.getElementById('wicketModal'));
            modal.show();
        }
    } else {
        if(state.innings.balls >= state.match.overs * 6) {
            checkInningsComplete();
        } else {
            checkOverComplete();
        }
    }
}

function confirmWicket() {
    let striker = state.batters.find(b => b.strike);
    striker.active = false;
    striker.out = true;
    
    let newBat = { 
        name: document.getElementById('newBatsmanName').value, 
        runs: 0, balls: 0, fours: 0, sixes: 0, out: false, active: true, strike: true 
    };
    state.batters.push(newBat);
    
    document.getElementById('newBatsmanName').value = '';
    
    var myModalEl = document.getElementById('wicketModal');
    var modal = bootstrap.Modal.getInstance(myModalEl);
    modal.hide();
    
    if(state.innings.balls >= state.match.overs * 6) {
        checkInningsComplete();
    } else {
        checkOverComplete();
    }
}

function checkOverComplete() {
    let bowler = state.bowlers.find(b => b.active);
    if(bowler.balls > 0 && bowler.balls % 6 === 0) {
        // Over complete
        swapBatsman();
        state.thisOver = [];
        var modal = new bootstrap.Modal(document.getElementById('newBowlerModal'));
        modal.show();
    } else {
        updateUI();
        saveState();
    }
}

function confirmNewBowler() {
    let oldBowler = state.bowlers.find(b => b.active);
    oldBowler.active = false;
    
    let nextName = document.getElementById('nextBowlerName').value;
    let exist = state.bowlers.find(b => b.name === nextName);
    if(exist) {
        exist.active = true;
    } else {
        state.bowlers.push({ name: nextName, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, active: true });
    }
    
    document.getElementById('nextBowlerName').value = '';
    
    var myModalEl = document.getElementById('newBowlerModal');
    var modal = bootstrap.Modal.getInstance(myModalEl);
    modal.hide();
    
    updateUI();
    saveState();
}

function checkInningsComplete() {
    updateUI();
    saveState();
    
    setTimeout(() => {
        if(state.innings.inningNumber === 1) {
            alert(`1st Innings Complete!\nTarget for the next team is ${state.innings.runs + 1}`);
            
            // Setup for 2nd innings
            state.innings.target = state.innings.runs + 1;
            state.innings.inningNumber = 2;
            state.innings.battingTeam = state.innings.battingTeam === state.match.hostTeam ? state.match.visitorTeam : state.match.hostTeam;
            state.innings.runs = 0;
            state.innings.wickets = 0;
            state.innings.balls = 0;
            
            state.batters = [];
            state.bowlers = [];
            state.fow = [];
            state.thisOver = [];
            
            // Clear inputs for players screen
            document.getElementById('strikerName').value = '';
            document.getElementById('nonStrikerName').value = '';
            document.getElementById('bowlerName').value = '';
            
            showScreen('screen-players');
            saveState();
        } else {
            let fieldingTeam = state.innings.battingTeam === state.match.hostTeam ? state.match.visitorTeam : state.match.hostTeam;
            if(state.innings.runs >= state.innings.target) {
                result = state.innings.battingTeam;
            } else if (state.innings.runs === state.innings.target - 1) {
                result = "Tied";
            } else {
                result = fieldingTeam;
            }
            state.match.isComplete = true;
            saveState();
            
            if (result === "Tied") {
                alert(`Match Tied!`);
            } else {
                triggerCelebration(result);
            }
        }
    }, 300);
}

function triggerCelebration(teamName) {
    if (!window.confetti) {
        let script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
        script.onload = () => startCelebrationAnimation(teamName);
        document.head.appendChild(script);
    } else {
        startCelebrationAnimation(teamName);
    }
}
function startCelebrationAnimation(teamName) {
    if(document.getElementById('winnerOverlay')) return;
    var duration = 5 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    var interval = setInterval(function() {
      var timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      var particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    let overlay = document.createElement('div');
    overlay.id = "winnerOverlay";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;";
    let style = document.createElement('style');
    style.innerHTML = `
        @keyframes slideUpFade { 0% { transform: translateY(100vh) scale(0.5); opacity: 0; } 50% { transform: translateY(-10vh) scale(1.1); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; text-shadow: 0 0 30px gold, 0 0 10px white; } }
        .winner-text { font-size: 3.5rem; color: #ffd700; font-weight: 900; text-align: center; animation: slideUpFade 2s cubic-bezier(0.25, 1, 0.5, 1) forwards; padding: 20px; text-transform: uppercase; font-family: sans-serif;}
    `;
    overlay.appendChild(style);
    let text = document.createElement('div');
    text.className = "winner-text";
    text.innerHTML = `🏆<br>${teamName}<br><span style="font-size:2rem; color:white;">WON THE MATCH!</span>`;
    overlay.appendChild(text);
    let closeBtn = document.createElement('button');
    closeBtn.innerText = "Close";
    closeBtn.style.cssText = "margin-top: 30px; padding: 10px 30px; font-size:1.2rem; background: #1e3c72; color:white; border:none; border-radius: 30px; cursor:pointer; opacity:0; transition: opacity 1s;";
    closeBtn.onclick = () => document.body.removeChild(overlay);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    setTimeout(() => { closeBtn.style.opacity = '1'; }, 2000);
}

function swapBatsman() {
    let b1 = state.batters.find(b => b.active && b.strike);
    let b2 = state.batters.find(b => b.active && !b.strike);
    if(b1 && b2) {
        b1.strike = false;
        b2.strike = true;
        updateUI();
        saveState();
    }
}

function saveState() {
    localStorage.setItem('CITPL_SCORE', JSON.stringify(state));
    console.log("State saved to localStorage.");
}
