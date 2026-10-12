/* =====================================================
   CITPL - LOCAL DATA ENGINE
   All data stored in localStorage + exportable as CSV.
   This is not a Firebase connection.
   ===================================================== */

(function () {
const firebaseConfig = {
    apiKey: "AIzaSyB2uPhFR33nYWZ1sp6zngpikPuwRyztK1c",
    authDomain: "citpl-f6154.firebaseapp.com",
    projectId: "citpl-f6154",
    storageBucket: "citpl-f6154.firebasestorage.app",
    messagingSenderId: "105999478032",
    appId: "1:105999478032:web:168a0e08b8ea4141f00995"
};
window.firebaseConfig = firebaseConfig;

const defaultInitialData = {
    season: {
        id: "season_2026",
        name: "CIT Premier League 2026",
        year: 2026,
        status: "REGISTRATION",
        registrationFee: 50,
        startingPurse: 10000,
        maxSquadSize: 15,
        defaultOvers: 10
    },

    settings: {
        leagueName: "CIT Premier League 2026",
        registrationFee: 50,
        teamPurse: 10000,
        maxSquadSize: 15,
        minSquadSize: 11,
        defaultOvers: 10,
        auctionTimerSeconds: 15,
        defaultBidIncrement: 100,
        timerExtensionSeconds: 10,
        allowPlayerSelfRegistration: true
    },

    notifications: [],
    auditLogs: [
        {
            id: "a1",
            action: "SEASON_INITIALIZED",
            actor: "system",
            detail: "CITPL 2026 platform initialized. Ready for registrations.",
            timestamp: new Date().toISOString()
        }
    ],

    users: [],

    // Teams: Empty - Admin will create teams
    teams: [],

    // Matches: Empty - Admin will schedule matches
    matches: [],

    customFeatures: [],

    // Players: Empty - Players register themselves
    players: [],

    pendingTransfers: [],

    auctionState: {
        status: "NOT_STARTED",
        currentLot: 0,
        currentPlayerId: null,
        currentBid: 0,
        highestTeamId: null,
        lastBidTeamId: null,
        lastBidTeamName: "Auction House",
        lastBidAmount: 0,
        lastBidTime: null,
        bidIncrement: 100,
        bidDeadline: null,
        workflowVersion: 2,
        timerSeconds: 15,
        bidsHistory: []
    },

    // Live Match: Empty - Admin starts matches
    liveMatch: {
        id: null,
        matchNumber: 0,
        teamA: { id: null, name: "", runs: 0, wickets: 0, overs: 0 },
        teamB: { id: null, name: "", runs: 0, wickets: 0, overs: 0 },
        currentInnings: 1,
        target: 0,
        status: "NOT_STARTED",
        assignedScorekeeper: null,
        isLockedByAdmin: true,

        striker: { id: null, name: "", runs: 0, balls: 0, fours: 0, sixes: 0 },
        nonStriker: { id: null, name: "", runs: 0, balls: 0, fours: 0, sixes: 0 },
        bowler: { id: null, name: "", overs: 0, maidens: 0, runsConceded: 0, wickets: 0, economy: 0 },

        innings1Scorecard: {
            teamName: "",
            total: "",
            batting: [],
            bowling: [],
            extras: "",
            fow: ""
        },

        lastOverBalls: [],
        recentBalls: []
    }
};

class CITPLFirebaseEngine {
    constructor() {
        this.storageKey = "CITPL_DATABASE_STORE_2026";
        this.listeners = [];
        this.serverAdminUser = null;
        window.addEventListener("storage", event => {
            if (event.key !== this.storageKey || !event.newValue) return;
            try {
                this.db = JSON.parse(event.newValue);
                this.notifyListeners();
            } catch (error) {
                console.error("Unable to sync data from another tab.", error);
            }
        });
        this.initData();
        this.adminAuthReady = this.restoreAdminSession();
    }

    initData() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            this.db = JSON.parse(JSON.stringify(defaultInitialData));
            this.save();
        } else {
            try {
                this.db = JSON.parse(stored);
            } catch (e) {
                this.db = JSON.parse(JSON.stringify(defaultInitialData));
                this.save();
            }
        }
        this.db.settings = { ...defaultInitialData.settings, ...(this.db.settings || {}) };
        if (!this.db.auctionState) this.db.auctionState = { ...defaultInitialData.auctionState };
        if (!Array.isArray(this.db.customFeatures)) this.db.customFeatures = [];
        this.db.users = (this.db.users || []).filter(user => this.normalizeRole(user.role) !== "ADMIN");
        sessionStorage.removeItem("CITPL_ADMIN_SESSION");
        const currentUser = this.getCurrentUser();
        if (currentUser && this.normalizeRole(currentUser.role) === "ADMIN") {
            this.setCurrentUser(null);
        }
        this.save();
    }

    normalizeRole(role) {
        const normalized = (role || "").toUpperCase();
        const roleAliasMap = {
            SUPER_ADMIN: "ADMIN",
            AUCTION_ADMIN: "ADMIN",
            CAPTAIN: "TEAM_OWNER",
            PLAYER: "PLAYER",
            PUBLIC: "PUBLIC"
        };
        return roleAliasMap[normalized] || normalized || "PUBLIC";
    }

    isAdminRole(user) {
        return Boolean(
            this.serverAdminUser &&
            this.serverAdminUser.email &&
            user &&
            user.email &&
            this.normalizeRole(user.role) === "ADMIN" &&
            user.email.toLowerCase() === this.serverAdminUser.email.toLowerCase()
        );
    }

    save() {
        if (!this.db) this.db = JSON.parse(JSON.stringify(defaultInitialData));
        if (!this.db.settings) this.db.settings = defaultInitialData.settings;
        if (!this.db.notifications) this.db.notifications = [];
        if (!this.db.auditLogs) this.db.auditLogs = [];
        if (!this.db.pendingTransfers) this.db.pendingTransfers = [];
        if (!this.db.players) this.db.players = [];
        if (!this.db.teams) this.db.teams = [];
        if (!this.db.matches) this.db.matches = [];
        if (!Array.isArray(this.db.customFeatures)) this.db.customFeatures = [];
        localStorage.setItem(this.storageKey, JSON.stringify(this.db));
        this.notifyListeners();
        // Sync CSV timestamp
        if (window.csvManager) {
            window.csvManager.syncToLocalStorage(this.db);
        }
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        if (!this.listeners) this.listeners = [];
        this.listeners.forEach(cb => cb(this.db));
    }

    // AUTH
    login(email, password) {
        const cleanEmail = (email || "").trim().toLowerCase();
        const cleanPass = (password || "").trim();

        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail && u.password === cleanPass);
        if (user) {
            if (this.normalizeRole(user.role) === "ADMIN") {
                return { success: false, message: "Admin sign-in must use the server-verified admin login." };
            }
            const safeUser = { ...user };
            delete safeUser.password;
            this.setCurrentUser(safeUser);
            const redirectMap = {
                ADMIN: "admin.html",
                TEAM_OWNER: "auction.html",
                SCOREKEEPER: "scorekeeper.html",
                PLAYER: "index.html"
            };
            return { success: true, user: safeUser, redirect: redirectMap[user.role] || "index.html" };
        }
        
        // Check in players array as fallback
        const player = (this.db.players || []).find(p => p.email && p.email.toLowerCase() === cleanEmail && p.password === cleanPass);
        if (player) {
            const playerUser = {
                id: player.id,
                name: player.name,
                email: player.email,
                role: "PLAYER",
                regId: player.registrationId
            };
            this.setCurrentUser(playerUser);
            return { success: true, user: playerUser, redirect: "index.html" };
        }

        return { success: false, message: "Invalid email or password!" };
    }

    async loginAdminServer(email, password) {
        let response;
        try {
            response = await fetch("/api/admin/login", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
        } catch (error) {
            return {
                success: false,
                message: "Admin login needs the CITPL server. Open this site from the deployed server or run npm start."
            };
        }

        let result;
        try {
            result = await response.json();
        } catch (error) {
            return {
                success: false,
                message: "This page is not connected to the CITPL admin server. Start it with `npm start`, then open http://localhost:3000/pages/login.html."
            };
        }
        if (!response.ok || !result.success || !result.user || result.user.role !== "ADMIN") {
            return { success: false, message: result.message || "Admin sign-in failed." };
        }

        this.serverAdminUser = { ...result.user };
        this.setCurrentUser(this.serverAdminUser);
        window.dispatchEvent(new Event("citpl:auth-changed"));
        return { success: true, user: { ...this.serverAdminUser } };
    }

    async restoreAdminSession() {
        if (this.serverAdminUser && this.isAdminRole(this.serverAdminUser)) return true;

        let response;
        try {
            response = await fetch("/api/admin/session", { credentials: "same-origin" });
        } catch (error) {
            return false;
        }
        if (response.status === 401) return false;
        if (!response.ok) {
            console.error(`Admin session verification failed with status ${response.status}.`);
            return false;
        }

        let result;
        try {
            result = await response.json();
        } catch (error) {
            return false;
        }
        if (!result.success || !result.user || result.user.role !== "ADMIN" || !result.user.email) return false;

        this.serverAdminUser = { ...result.user };
        sessionStorage.setItem("CITPL_CURRENT_USER", JSON.stringify(this.serverAdminUser));
        this.notifyListeners();
        window.dispatchEvent(new Event("citpl:auth-changed"));
        return true;
    }

    async logoutAdminServer() {
        let response;
        try {
            response = await fetch("/api/admin/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: "{}"
            });
        } catch (error) {
            return { success: false, message: "Could not contact the server to close the admin session." };
        }
        if (!response.ok) {
            return { success: false, message: "The server could not close the admin session." };
        }

        this.serverAdminUser = null;
        sessionStorage.removeItem("CITPL_CURRENT_USER");
        localStorage.removeItem("CITPL_CURRENT_USER");
        this.notifyListeners();
        return { success: true };
    }

    getCurrentUser() {
        if (this.serverAdminUser) return { ...this.serverAdminUser };
        let storedUser = sessionStorage.getItem("CITPL_CURRENT_USER");
        if (!storedUser) {
            storedUser = localStorage.getItem("CITPL_CURRENT_USER");
            if (storedUser) {
                sessionStorage.setItem("CITPL_CURRENT_USER", storedUser);
                localStorage.removeItem("CITPL_CURRENT_USER");
            }
        }
        if (!storedUser) return null;

        try {
            const parsed = JSON.parse(storedUser);
            if (!parsed || !parsed.email) return null;
            if (Object.prototype.hasOwnProperty.call(parsed, "password")) {
                delete parsed.password;
                sessionStorage.setItem("CITPL_CURRENT_USER", JSON.stringify(parsed));
            }
            return parsed;
        } catch (error) {
            sessionStorage.removeItem("CITPL_CURRENT_USER");
            return null;
        }
    }

    setCurrentUser(user) {
        if (!user) {
            this.serverAdminUser = null;
            sessionStorage.removeItem("CITPL_CURRENT_USER");
            localStorage.removeItem("CITPL_CURRENT_USER");
            this.notifyListeners();
            return;
        }
        if (this.normalizeRole(user.role) === "ADMIN" && !this.isAdminRole(user)) return;
        const safeUser = { ...user };
        delete safeUser.password;
        sessionStorage.setItem("CITPL_CURRENT_USER", JSON.stringify(safeUser));
        localStorage.removeItem("CITPL_CURRENT_USER");
        this.notifyListeners();
    }

    // ADMIN EXCLUSIVE SCOREKEEPER PERMISSION ASSIGNMENT
    assignScorekeeperToMatch(matchId, scorekeeperEmail, scorekeeperPassword) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin/Super Admin can assign scorekeepers!" };
        }
        const cleanEmail = (scorekeeperEmail || "").trim().toLowerCase();
        const cleanPass = (scorekeeperPassword || "").trim();
        if (!cleanPass) {
            return { success: false, message: "Scorekeeper account provisioning requires Firebase Authentication." };
        }

        if (this.db.liveMatch) {
            this.db.liveMatch.assignedScorekeeper = cleanEmail;
        }

        // Register or update in users collection for login
        if (!this.db.users) this.db.users = [];
        const userIdx = this.db.users.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail);
        const skUser = {
            id: "u_sk_" + Date.now(),
            name: "Match Scorekeeper (" + cleanEmail.split('@')[0] + ")",
            email: cleanEmail,
            password: cleanPass,
            role: "SCOREKEEPER",
            assignedMatch: matchId,
            createdAt: new Date().toISOString()
        };
        if (userIdx >= 0) {
            this.db.users[userIdx].password = cleanPass;
            this.db.users[userIdx].role = "SCOREKEEPER";
            this.db.users[userIdx].assignedMatch = matchId;
        } else {
            this.db.users.push(skUser);
        }

        this.db.auditLogs = this.db.auditLogs || [];
        this.db.auditLogs.unshift({
            id: `a${Date.now()}`,
            action: "SCOREKEEPER_ASSIGNED",
            actor: currentUser.email,
            detail: `Assigned scorekeeper ${cleanEmail} to match ${matchId}`,
            timestamp: new Date().toISOString()
        });
        this.save();
        return { success: true, message: `Scorekeeper permission set for ${cleanEmail}.` };
    }

    toggleMatchLockByAdmin(matchId, isLocked) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can lock/unlock match scoring!" };
        }
        if (this.db.liveMatch) {
            this.db.liveMatch.isLockedByAdmin = isLocked;
        }
        this.db.auditLogs = this.db.auditLogs || [];
        this.db.auditLogs.unshift({
            id: `a${Date.now()}`,
            action: "MATCH_LOCK_TOGGLED",
            actor: currentUser.email,
            detail: `Match ${matchId} ${isLocked ? 'locked' : 'unlocked'} by admin`,
            timestamp: new Date().toISOString()
        });
        this.save();
        return { success: true, message: `Match scoring ${isLocked ? 'LOCKED' : 'UNLOCKED'} by Admin!` };
    }

    // AUTHORIZATION CHECK FOR SCOREKEEPER
    canUserUpdateScore() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            return { allowed: false, reason: "Please log in first to access scoring." };
        }
        if (this.isAdminRole(currentUser)) return { allowed: true };
        if (!this.db.liveMatch) return { allowed: false, reason: "No live match available." };
        if (this.db.liveMatch.isLockedByAdmin) return { allowed: false, reason: "Match scoring is currently LOCKED by Admin!" };
        if (currentUser.email.toLowerCase() === (this.db.liveMatch.assignedScorekeeper || "").toLowerCase()) {
            return { allowed: true };
        }
        return { allowed: false, reason: "You are not assigned as the Official Scorekeeper for this match. Contact the league administrator." };
    }

    // BALL-BY-BALL RECORDING ENGINE
    recordBall(run, isExtra = false, extraType = "", isWicket = false, wicketType = "") {
        const auth = this.canUserUpdateScore();
        if (!auth.allowed) {
            return { success: false, message: auth.reason };
        }

        const match = this.db.liveMatch;
        if (!match || !match.id) return { success: false, message: "No active match to score." };

        let runsToAdd = run;
        let isLegalBall = true;
        let batRuns = run;
        let extraRuns = 0;

        if (isExtra) {
            if (extraType === "WD" || extraType === "NB") {
                isLegalBall = false;
                extraRuns = 1;
                runsToAdd += 1;
                if(extraType === "WD") { batRuns = 0; extraRuns += run; }
                if(extraType === "NB") { batRuns = run; }
            }
            if (extraType === "BYE" || extraType === "LB") {
                batRuns = 0;
                extraRuns = run;
            }
        }

        let oversInt = Math.floor(match.teamA.overs);
        let ballsInOver = Math.round((match.teamA.overs - oversInt) * 10);
        
        if (isLegalBall) {
            ballsInOver += 1;
            if (ballsInOver >= 6) {
                oversInt += 1;
                ballsInOver = 0;
            }
            match.teamA.overs = oversInt + (ballsInOver / 10);
        }

        match.teamA.runs += runsToAdd;
        if (isWicket) match.teamA.wickets += 1;

        if (match.striker) {
            match.striker.runs += batRuns;
            if (isLegalBall || extraType === "NB") {
                match.striker.balls += 1;
            }
            if (batRuns === 4) match.striker.fours += 1;
            if (batRuns === 6) match.striker.sixes += 1;
        }

        if (match.bowler) {
            if (isLegalBall) {
                let bowBalls = Math.round((match.bowler.overs - Math.floor(match.bowler.overs)) * 10) + 1;
                let bowOvers = Math.floor(match.bowler.overs);
                if (bowBalls >= 6) { bowOvers += 1; bowBalls = 0; }
                match.bowler.overs = bowOvers + (bowBalls / 10);
            }
            match.bowler.runsConceded += runsToAdd;
            if (isWicket && !["Run Out", "Retired Hurt", "Obstructing the Field"].includes(wicketType)) {
                match.bowler.wickets += 1;
            }
        }

        let shouldRotate = false;
        if (run % 2 !== 0) shouldRotate = true;
        if (isLegalBall && ballsInOver === 0) shouldRotate = !shouldRotate;

        if (shouldRotate && match.striker && match.nonStriker) {
            let temp = match.striker;
            match.striker = match.nonStriker;
            match.nonStriker = temp;
        }

        const eventType = isWicket ? "WICKET" : batRuns === 6 ? "SIX" : batRuns === 4 ? "FOUR" : isExtra ? extraType : "RUNS";
        const eventText = isWicket ? `OUT! ${wicketType}` : batRuns === 6 ? `SIX!` : batRuns === 4 ? `FOUR!` : `${runsToAdd} run(s)`;

        if (!match.recentBalls) match.recentBalls = [];
        match.recentBalls.unshift({
            over: match.teamA.overs.toFixed(1),
            type: eventType,
            event: `${eventText}`,
            bowler: match.bowler ? match.bowler.name : '',
            striker: match.striker ? match.striker.name : ''
        });
        if(match.recentBalls.length > 20) match.recentBalls.pop();

        if(!match.history) match.history = [];
        match.history.push(JSON.parse(JSON.stringify(match)));

        this.save();
        return { success: true, message: "Ball recorded successfully." };
    }

    // TEAMS & AUCTION - Admin creates teams
    createTeamByAdmin(teamName, shortName, ownerName, ownerEmail, ownerPassword, startingPurse = 10000) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin/Super Admin can create teams!" };
        }

        if (!this.db.teams) this.db.teams = [];
        const teamId = "t" + (this.db.teams.length + 1) + "_" + Date.now();
        const userId = "u_owner_" + Date.now();

        const newTeam = {
            id: teamId,
            name: teamName,
            shortName: shortName.toUpperCase(),
            ownerName: ownerName,
            ownerEmail: ownerEmail,
            startingPurse: parseInt(startingPurse),
            remainingPurse: parseInt(startingPurse),
            totalSpent: 0,
            squadCount: 0,
            points: 0,
            wins: 0,
            losses: 0,
            nrr: "0.00",
            createdAt: new Date().toISOString()
        };

        const newOwner = {
            id: userId,
            name: `${ownerName} (${teamName} Owner)`,
            email: ownerEmail,
            password: ownerPassword || "",
            role: "TEAM_OWNER",
            teamId: teamId,
            createdAt: new Date().toISOString()
        };

        this.db.teams.push(newTeam);
        if (!this.db.users) this.db.users = [];
        this.db.users.push(newOwner);
        
        this.db.auditLogs = this.db.auditLogs || [];
        this.db.auditLogs.unshift({
            id: `a${Date.now()}`,
            action: "TEAM_CREATED",
            actor: currentUser.email,
            detail: `Team "${teamName}" created with owner ${ownerName} (${ownerEmail}). Purse: ₹${startingPurse}`,
            timestamp: new Date().toISOString()
        });

        this.save();
        return { success: true, message: `Team ${teamName} and Owner Account created!`, team: newTeam };
    }

    recordAdminMatchAction(action, detail, currentUser) {
        if (!this.db.auditLogs) this.db.auditLogs = [];
        this.db.auditLogs.unshift({
            id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            action,
            actor: currentUser.email,
            detail,
            timestamp: new Date().toISOString()
        });
    }

    validateAdminMatch(matchData, existingMatchId = null) {
        const matchNumber = Number(matchData.matchNumber);
        const oversLimit = Number(matchData.oversLimit);
        const teamA = (this.db.teams || []).find(team => team.id === matchData.teamAId);
        const teamB = (this.db.teams || []).find(team => team.id === matchData.teamBId);
        const statuses = ["SCHEDULED", "LIVE", "COMPLETED", "ABANDONED", "CANCELLED"];

        if (!Number.isInteger(matchNumber) || matchNumber < 1) {
            return { success: false, message: "Enter a valid match number." };
        }
        if ((this.db.matches || []).some(match =>
            Number(match.matchNumber) === matchNumber && match.id !== existingMatchId
        )) {
            return { success: false, message: `Match #${matchNumber} already exists.` };
        }
        if (!teamA || !teamB || teamA.id === teamB.id) {
            return { success: false, message: "Select two different registered teams." };
        }
        if (!Number.isFinite(oversLimit) || oversLimit < 1 || oversLimit > 50) {
            return { success: false, message: "Overs must be between 1 and 50." };
        }
        if (!statuses.includes(String(matchData.status || "").toUpperCase())) {
            return { success: false, message: "Select a valid match status." };
        }

        return {
            success: true,
            match: {
                matchNumber,
                teamAId: teamA.id,
                teamBId: teamB.id,
                scheduledTime: String(matchData.scheduledTime || "").trim(),
                venue: String(matchData.venue || "").trim(),
                oversLimit,
                status: String(matchData.status).toUpperCase(),
                result: String(matchData.result || "").trim()
            }
        };
    }

    createMatchByAdmin(matchData) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can create matches." };
        }

        const validation = this.validateAdminMatch(matchData || {});
        if (!validation.success) return validation;

        const match = {
            id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ...validation.match,
            assignedScorekeeper: "",
            isLockedByAdmin: true,
            createdAt: new Date().toISOString()
        };
        this.db.matches.push(match);
        this.recordAdminMatchAction("MATCH_CREATED", `Match #${match.matchNumber} scheduled.`, currentUser);
        this.save();
        return { success: true, message: `Match #${match.matchNumber} created.`, match };
    }

    updateMatchByAdmin(matchId, matchData) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can update matches." };
        }

        const match = (this.db.matches || []).find(item => item.id === matchId);
        if (!match) return { success: false, message: "Match not found." };

        const validation = this.validateAdminMatch(matchData || {}, matchId);
        if (!validation.success) return validation;

        Object.assign(match, validation.match);
        this.recordAdminMatchAction("MATCH_UPDATED", `Match #${match.matchNumber} updated.`, currentUser);
        this.save();
        return { success: true, message: `Match #${match.matchNumber} updated.`, match };
    }

    deleteMatchByAdmin(matchId) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can delete matches." };
        }

        const matchIndex = (this.db.matches || []).findIndex(match => match.id === matchId);
        if (matchIndex === -1) return { success: false, message: "Match not found." };

        const match = this.db.matches[matchIndex];
        if (String(match.status || "").toUpperCase() === "LIVE") {
            return { success: false, message: "A live match cannot be deleted." };
        }
        if ((this.db.scores || []).some(score => score.matchId === matchId)) {
            return { success: false, message: "This match has score records and cannot be deleted." };
        }

        this.db.matches.splice(matchIndex, 1);
        this.recordAdminMatchAction("MATCH_DELETED", `Match #${match.matchNumber} deleted.`, currentUser);
        this.save();
        return { success: true, message: `Match #${match.matchNumber} deleted.` };
    }

    validateAdminFeature(featureData) {
        const title = String(featureData.title || "").trim();
        const category = String(featureData.category || "").trim();
        const description = String(featureData.description || "").trim();
        const imageData = String(featureData.imageData || "");
        const imageAlt = String(featureData.imageAlt || "").trim();
        const linkLabel = String(featureData.linkLabel || "").trim();
        const linkUrl = String(featureData.linkUrl || "").trim();

        if (!title || title.length > 100) {
            return { success: false, message: "Enter a title (up to 100 characters)." };
        }
        if (category.length > 40) {
            return { success: false, message: "Category must be 40 characters or fewer." };
        }
        if (!description || description.length > 2400) {
            return { success: false, message: "Enter a description of up to 2,400 characters." };
        }
        if (imageData && !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(imageData)) {
            return { success: false, message: "Use a valid JPG, PNG, or WebP image." };
        }
        if (imageAlt.length > 160 || linkLabel.length > 40 || linkUrl.length > 500) {
            return { success: false, message: "Image text or link details exceed the allowed length." };
        }
        if (Boolean(linkLabel) !== Boolean(linkUrl)) {
            return { success: false, message: "Enter both a button label and a destination link, or leave both empty." };
        }
        if (linkUrl && !(
            /^https:\/\//i.test(linkUrl) ||
            /^(?!\/\/)(?![a-z][a-z0-9+.-]*:)[\w./?#&=%-]+$/i.test(linkUrl)
        )) {
            return { success: false, message: "Links must use HTTPS or a relative website path." };
        }
        if (imageData && !imageAlt) {
            return { success: false, message: "Add alternative text for the uploaded image." };
        }

        return {
            success: true,
            feature: {
                title,
                category,
                description,
                imageData,
                imageAlt,
                linkLabel,
                linkUrl,
                isPublished: Boolean(featureData.isPublished)
            }
        };
    }

    persistAdminFeatureChange(action, detail, currentUser, rollback) {
        const auditEntry = {
            id: `feature_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            action,
            actor: currentUser.email,
            detail,
            timestamp: new Date().toISOString()
        };
        this.db.auditLogs.unshift(auditEntry);
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.db));
        } catch (error) {
            rollback();
            const auditIndex = (this.db.auditLogs || []).findIndex(entry => entry.id === auditEntry.id);
            if (auditIndex !== -1) this.db.auditLogs.splice(auditIndex, 1);
            const quotaError = error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014);
            return {
                success: false,
                message: quotaError
                    ? "Could not save this feature because browser storage is full. Use a smaller image or free storage space."
                    : `Could not save this feature: ${error && error.message ? error.message : "storage error"}.`
            };
        }
        this.notifyListeners();
        if (window.csvManager) window.csvManager.syncToLocalStorage(this.db);
        return { success: true };
    }

    createAdminFeature(featureData) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can add website features." };
        }
        const validation = this.validateAdminFeature(featureData || {});
        if (!validation.success) return validation;

        const feature = {
            id: `feature_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ...validation.feature,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.db.customFeatures.push(feature);
        const result = this.persistAdminFeatureChange(
            "CUSTOM_FEATURE_CREATED",
            `Website feature "${feature.title}" created.`,
            currentUser,
            () => this.db.customFeatures.splice(this.db.customFeatures.indexOf(feature), 1)
        );
        return result.success ? { ...result, message: "Website feature created.", feature } : result;
    }

    updateAdminFeature(featureId, featureData) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can update website features." };
        }
        const feature = (this.db.customFeatures || []).find(item => item.id === featureId);
        if (!feature) return { success: false, message: "Website feature not found." };
        const validation = this.validateAdminFeature(featureData || {});
        if (!validation.success) return validation;

        const previousValues = { ...feature };
        Object.assign(feature, validation.feature, { updatedAt: new Date().toISOString() });
        const result = this.persistAdminFeatureChange(
            "CUSTOM_FEATURE_UPDATED",
            `Website feature "${feature.title}" updated.`,
            currentUser,
            () => Object.assign(feature, previousValues)
        );
        return result.success ? { ...result, message: "Website feature updated.", feature } : result;
    }

    deleteAdminFeature(featureId) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can delete website features." };
        }
        const featureIndex = (this.db.customFeatures || []).findIndex(item => item.id === featureId);
        if (featureIndex === -1) return { success: false, message: "Website feature not found." };
        const [feature] = this.db.customFeatures.splice(featureIndex, 1);
        const result = this.persistAdminFeatureChange(
            "CUSTOM_FEATURE_DELETED",
            `Website feature "${feature.title}" deleted.`,
            currentUser,
            () => this.db.customFeatures.splice(featureIndex, 0, feature)
        );
        return result.success ? { ...result, message: "Website feature deleted." } : result;
    }

    getNextAuctionPlayer() {
        return (this.db.players || []).find(p => p.teamId === null && p.status === "APPROVED") || null;
    }

    recordAuctionAction(action, detail, teamId = null, amount = null) {
        if (!this.db.auditLogs) this.db.auditLogs = [];
        const user = this.getCurrentUser();
        this.db.auditLogs.unshift({
            id: `auction_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            action,
            actor: user ? user.email : "system",
            detail,
            teamId,
            amount,
            timestamp: new Date().toISOString()
        });
    }

    getAuctionRemainingSeconds() {
        const state = this.db.auctionState;
        if (!state) return 0;
        if (["SOLD", "UNSOLD", "AUCTION_COMPLETE", "NOT_STARTED"].includes(state.status)) return 0;
        if (!state.bidDeadline) return Math.max(0, Number(state.timerSeconds || 0));
        return Math.max(0, Math.ceil((state.bidDeadline - Date.now()) / 1000));
    }

    getNextAuctionBid() {
        const state = this.db.auctionState;
        if (!state) return 0;
        return state.highestTeamId ? state.currentBid + state.bidIncrement : state.currentBid;
    }

    advanceAuctionToNextPlayer() {
        if (!this.isAdminRole()) return { success: false, message: "Only the league admin can advance the auction." };
        const nextPlayer = this.getNextAuctionPlayer();
        const state = this.db.auctionState;

        if (["LIVE", "GOING_ONCE", "GOING_TWICE", "PAUSED"].includes(state.status) && state.currentPlayerId) {
            return { success: false, message: "Mark this player SOLD or UNSOLD before moving to the next lot." };
        }

        state.status = nextPlayer ? "LIVE" : "AUCTION_COMPLETE";
        state.currentPlayerId = nextPlayer ? nextPlayer.id : null;
        state.currentLot = nextPlayer ? (Number(state.currentLot || 0) + 1) : state.currentLot;
        state.currentBid = nextPlayer ? Number(nextPlayer.basePrice || 500) : 0;
        state.highestTeamId = null;
        state.lastBidTeamId = null;
        state.lastBidTeamName = "Auction House";
        state.lastBidAmount = state.currentBid;
        state.lastBidTime = null;
        state.bidIncrement = Number((nextPlayer && nextPlayer.bidIncrement) || this.db.settings.defaultBidIncrement || 100);
        state.timerSeconds = Number(this.db.settings.auctionTimerSeconds || 15);
        state.bidDeadline = nextPlayer ? Date.now() + state.timerSeconds * 1000 : null;
        state.bidsHistory = [];
        this.recordAuctionAction("PLAYER_STARTED", nextPlayer ? `Lot ${state.currentLot}: ${nextPlayer.name} brought on stage.` : "Auction completed.");

        this.save();
        return { success: true, message: nextPlayer ? `Next lot: ${nextPlayer.name}` : "Auction complete." };
    }

    placeBid(amount) {
        const sessionUser = this.getCurrentUser();
        const user = sessionUser && this.db.users.find(u => u.email && u.email.toLowerCase() === sessionUser.email.toLowerCase());
        if (!user || user.role !== "TEAM_OWNER" || user.teamId !== sessionUser.teamId) {
            return { success: false, message: "Only an authenticated team owner can place a bid." };
        }

        const state = this.db.auctionState;
        const player = (this.db.players || []).find(p => p.id === state.currentPlayerId);
        const team = (this.db.teams || []).find(t => t.id === user.teamId);
        if (!team) return { success: false, message: "Your team account is not linked to a valid team." };
        if (!["LIVE", "GOING_ONCE", "GOING_TWICE"].includes(state.status) || !player || player.teamId) return { success: false, message: "There is no active player accepting bids." };
        if (this.getAuctionRemainingSeconds() <= 0) return { success: false, message: "Bidding time has expired. Please wait for the auctioneer." };
        if (state.highestTeamId === team.id) return { success: false, message: "Your team is already the highest bidder." };
        if (Number(amount) !== this.getNextAuctionBid()) return { success: false, message: `Bid changed. The next valid bid is ₹${this.getNextAuctionBid()}.` };
        if (team.squadCount >= this.db.settings.maxSquadSize) return { success: false, message: "Your squad is full." };
        if (team.remainingPurse < Number(amount)) return { success: false, message: `Insufficient purse. Remaining: ₹${team.remainingPurse}.` };

        const now = Date.now();
        state.currentBid = Number(amount);
        state.highestTeamId = team.id;
        state.lastBidTeamId = team.id;
        state.lastBidTeamName = team.name;
        state.lastBidAmount = Number(amount);
        state.lastBidTime = new Date(now).toLocaleTimeString();
        const normalTimer = Number(this.db.settings.auctionTimerSeconds || 15);
        const extension = Number(this.db.settings.timerExtensionSeconds || normalTimer);
        state.timerSeconds = this.getAuctionRemainingSeconds() <= 5 ? extension : normalTimer;
        state.bidDeadline = now + state.timerSeconds * 1000;
        state.status = "LIVE";
        state.bidsHistory.push({
            id: `bid_${now}_${Math.random().toString(36).slice(2, 7)}`,
            teamId: team.id,
            teamName: team.name,
            userId: user.id,
            playerId: player.id,
            amount: Number(amount),
            sequence: state.bidsHistory.length + 1,
            time: new Date(now).toLocaleTimeString(),
            timestamp: new Date(now).toISOString()
        });
        this.recordAuctionAction("BID_ACCEPTED", `${team.name} bid ₹${amount} for ${player.name}.`, team.id, Number(amount));
        this.save();
        return { success: true, message: `Bid of ₹${amount} placed by ${team.name}` };
    }

    markPlayerSold(playerId, teamId, finalPrice) {
        if (!this.isAdminRole()) return { success: false, message: "Only the league admin can confirm a sale." };
        const state = this.db.auctionState;
        const player = (this.db.players || []).find(p => p.id === playerId);
        const team = (this.db.teams || []).find(t => t.id === teamId);
        if (!["LIVE", "GOING_ONCE", "GOING_TWICE"].includes(state.status) || state.currentPlayerId !== playerId || !player || player.teamId) {
            return { success: false, message: "This player is not on the active lot." };
        }
        if (!team || state.highestTeamId !== teamId || Number(finalPrice) !== Number(state.currentBid)) {
            return { success: false, message: "Sale must match the current highest team and bid." };
        }
        if (team.remainingPurse < finalPrice || team.squadCount >= this.db.settings.maxSquadSize) {
            return { success: false, message: "Winning team no longer meets purse or squad requirements." };
        }

        if (player && team) {
            player.teamId = teamId;
            player.auctionPrice = Number(finalPrice);
            player.status = "SOLD";
            player.soldAt = new Date().toISOString();
            team.remainingPurse -= Number(finalPrice);
            team.totalSpent = Number(team.totalSpent || 0) + Number(finalPrice);
            team.squadCount = Number(team.squadCount || 0) + 1;

            const message = `${player.name} sold to ${team.name} for ₹${finalPrice}.`;
            state.status = "SOLD";
            state.currentBid = Number(finalPrice);
            state.bidDeadline = null;
            state.timerSeconds = 0;
            this.recordAuctionAction("PLAYER_SOLD", message, teamId, Number(finalPrice));

            this.save();
            return { success: true, message };
        }
        return { success: false, message: "Player or team not found for sale." };
    }

    markPlayerUnsold() {
        if (!this.isAdminRole()) return { success: false, message: "Only the league admin can mark a player unsold." };
        const state = this.db.auctionState;
        const player = (this.db.players || []).find(p => p.id === state.currentPlayerId);
        if (!["LIVE", "GOING_ONCE", "GOING_TWICE"].includes(state.status) || !player || player.teamId) {
            return { success: false, message: "There is no active player to mark unsold." };
        }
        player.status = "UNSOLD";
        state.status = "UNSOLD";
        state.bidDeadline = null;
        state.timerSeconds = 0;
        this.recordAuctionAction("PLAYER_UNSOLD", `${player.name} marked unsold.`, state.highestTeamId, state.currentBid);
        state.highestTeamId = null;

        this.save();
        return { success: true, message: "Lot declared unsold." };
    }

    setAuctionStatus(status) {
        if (!this.isAdminRole()) return { success: false, message: "Only the league admin can control the auction." };
        const state = this.db.auctionState;
        const allowed = { LIVE: ["PAUSED", "GOING_ONCE", "GOING_TWICE"], PAUSED: ["LIVE"], GOING_ONCE: ["LIVE", "GOING_TWICE"], GOING_TWICE: ["LIVE"] };
        if (!allowed[state.status] || !allowed[state.status].includes(status)) {
            return { success: false, message: `Cannot change auction from ${state.status} to ${status}.` };
        }
        if (status === "PAUSED") {
            state.timerSeconds = this.getAuctionRemainingSeconds();
            state.bidDeadline = null;
        } else if (state.status === "PAUSED" && status === "LIVE") {
            state.bidDeadline = Date.now() + Number(state.timerSeconds || this.db.settings.auctionTimerSeconds) * 1000;
        }
        state.status = status;
        this.recordAuctionAction(`AUCTION_${status}`, `Auction status changed to ${status}.`);
        this.save();
        return { success: true, message: `Auction ${status.toLowerCase().replaceAll("_", " ")}.` };
    }

    deleteTeamByAdmin(teamId) {
        const currentUser = this.getCurrentUser();
        if (!this.isAdminRole(currentUser)) {
            return { success: false, message: "Only Admin can delete teams!" };
        }

        const teamIndex = (this.db.teams || []).findIndex(t => t.id === teamId);
        if (teamIndex === -1) {
            return { success: false, message: "Team not found." };
        }

        const team = this.db.teams[teamIndex];
        this.db.teams.splice(teamIndex, 1);
        this.db.users = (this.db.users || []).filter(u => u.teamId !== teamId && u.email.toLowerCase() !== (team.ownerEmail || "").toLowerCase());
        this.db.players = (this.db.players || []).map(p => p.teamId === teamId ? { ...p, teamId: null, auctionPrice: 0 } : p);
        this.save();
        return { success: true, message: `Team ${team.name} and its owner data were removed.` };
    }

    registerPlayer(playerData) {
        if (!this.db.players) this.db.players = [];
        const newId = "p" + Date.now();
        const newRegId = "REG2026-" + Math.floor(100 + Math.random() * 900);
        const playerPassword = playerData.password || "";
        const player = {
            id: newId,
            registrationId: newRegId,
            name: playerData.name,
            role: playerData.role,
            category: playerData.category || "Category D",
            branch: playerData.branch,
            sem: playerData.sem,
            mobile: playerData.mobile,
            email: playerData.email,
            password: playerPassword,
            photo: playerData.photo || "",
            status: "PENDING",
            paymentVerified: false,
            transactionId: playerData.transactionId || "",
            teamId: null,
            auctionPrice: 0,
            runs: 0,
            wickets: 0,
            matches: 0,
            registeredAt: new Date().toISOString()
        };
        this.db.players.push(player);

        // Sync with users collection for instant login
        if (!this.db.users) this.db.users = [];
        const existingIdx = this.db.users.findIndex(u => u.email && u.email.toLowerCase() === playerData.email.toLowerCase());
        const userObj = {
            id: newId,
            name: playerData.name,
            email: playerData.email,
            password: playerPassword,
            role: "PLAYER",
            regId: newRegId,
            createdAt: new Date().toISOString()
        };
        if (existingIdx >= 0) {
            this.db.users[existingIdx] = userObj;
        } else {
            this.db.users.push(userObj);
        }

        this.save();
        return player;
    }

    approvePlayer(id) {
        const p = (this.db.players || []).find(x => x.id === id);
        if (p) {
            p.status = "APPROVED";
            p.paymentVerified = true;
            this.save();
            return { success: true, message: `${p.name} approved successfully.` };
        }
        return { success: false, message: "Player not found." };
    }

    rejectPlayer(id) {
        const p = (this.db.players || []).find(x => x.id === id);
        if (p) {
            p.status = "REJECTED";
            p.paymentVerified = false;
            this.save();
            return { success: true, message: `${p.name} rejected.` };
        }
        return { success: false, message: "Player not found." };
    }

    // PLAYER TRANSFER / BYE REQUEST (Team Owner requests, Admin approves)
    requestPlayerTransfer(playerId, toTeamId, fee = 0) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return { success: false, message: "Not logged in." };
        const player = (this.db.players || []).find(p => p.id === playerId);
        const fromTeam = player ? (this.db.teams || []).find(t => t.id === player.teamId) : null;
        const toTeam = (this.db.teams || []).find(t => t.id === toTeamId);
        if (!player || !fromTeam || !toTeam) return { success: false, message: "Invalid player or team." };
        if (!this.db.pendingTransfers) this.db.pendingTransfers = [];
        const transfer = {
            id: `tr_${Date.now()}`,
            playerId,
            fromTeamId: fromTeam.id,
            toTeamId,
            fee: Number(fee),
            requestedBy: currentUser.email,
            requestedAt: new Date().toISOString(),
            status: "PENDING"
        };
        this.db.pendingTransfers.push(transfer);
        this.recordAuctionAction("TRANSFER_REQUESTED", `${player.name} transfer from ${fromTeam.name} to ${toTeam.name} requested.`);
        this.save();
        return { success: true, message: `Transfer request submitted. Awaiting admin approval.` };
    }

    approvePlayerTransfer(transferId) {
        if (!this.isAdminRole()) return { success: false, message: "Only admin can approve transfers." };
        if (!this.db.pendingTransfers) this.db.pendingTransfers = [];
        const tr = this.db.pendingTransfers.find(t => t.id === transferId);
        if (!tr) return { success: false, message: "Transfer request not found." };
        const player = (this.db.players || []).find(p => p.id === tr.playerId);
        const fromTeam = (this.db.teams || []).find(t => t.id === tr.fromTeamId);
        const toTeam = (this.db.teams || []).find(t => t.id === tr.toTeamId);
        if (!player || !fromTeam || !toTeam) return { success: false, message: "Player or team data missing." };
        if (toTeam.remainingPurse < tr.fee) return { success: false, message: `${toTeam.name} does not have sufficient purse for this transfer.` };

        player.teamId = toTeam.id;
        player.auctionPrice = tr.fee || player.auctionPrice;
        fromTeam.squadCount = Math.max(0, (fromTeam.squadCount || 1) - 1);
        fromTeam.remainingPurse = (fromTeam.remainingPurse || 0) + tr.fee;
        fromTeam.totalSpent = Math.max(0, (fromTeam.totalSpent || 0) - tr.fee);
        toTeam.squadCount = (toTeam.squadCount || 0) + 1;
        toTeam.remainingPurse = Math.max(0, (toTeam.remainingPurse || 0) - tr.fee);
        toTeam.totalSpent = (toTeam.totalSpent || 0) + tr.fee;

        this.db.pendingTransfers = this.db.pendingTransfers.filter(t => t.id !== transferId);
        this.recordAuctionAction("TRANSFER_APPROVED", `${player.name} transferred from ${fromTeam.name} to ${toTeam.name} for ₹${tr.fee}.`);
        this.save();
        return { success: true, message: `${player.name} transferred to ${toTeam.name} for ₹${tr.fee}.` };
    }

    // CSV EXPORT ALL DATA
    exportAllCSV() {
        if (window.csvManager) {
            window.csvManager.exportAllCSV(this.db);
        }
    }

    // CSV IMPORT PLAYERS
    async importPlayersCSV(file) {
        if (!window.csvManager) return { success: false, message: "CSV Manager not loaded." };
        if (!this.isAdminRole()) return { success: false, message: "Only admin can import data." };
        try {
            const imported = await window.csvManager.importCSV(file);
            imported.forEach(p => {
                if (p.email && !this.db.players.find(ep => ep.email === p.email)) {
                    this.db.players.push(p);
                }
            });
            this.save();
            return { success: true, message: `${imported.length} players imported from CSV.` };
        } catch (err) {
            return { success: false, message: "Error reading CSV file: " + err.message };
        }
    }

    // RESET ALL DATA (Admin only)
    resetAllData() {
        if (!this.isAdminRole()) return { success: false, message: "Only admin can reset data." };
        this.db = JSON.parse(JSON.stringify(defaultInitialData));
        this.save();
        return { success: true, message: "All data has been reset to initial state." };
    }
}

window.citplDB = new CITPLFirebaseEngine();
})();
