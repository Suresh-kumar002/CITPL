(function () {
    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function formatOvers(value) {
        const overs = Number(value);
        return Number.isFinite(overs) ? `${overs.toFixed(1)} ov` : "0.0 ov";
    }

    function renderCustomFeatures(features) {
        const section = document.getElementById("dashboardFeaturesSection");
        const list = document.getElementById("dashboardFeaturesList");
        if (!section || !list) return;

        const publishedFeatures = (Array.isArray(features) ? features : [])
            .filter(feature => feature.isPublished)
            .sort((first, second) => String(second.createdAt || "").localeCompare(String(first.createdAt || "")));
        list.replaceChildren();
        section.classList.toggle("d-none", publishedFeatures.length === 0);

        publishedFeatures.forEach(feature => {
            const column = document.createElement("div");
            column.className = "col-md-6 col-xl-4";
            const card = document.createElement("article");
            card.className = "card border-0 shadow-sm rounded-4 h-100 overflow-hidden";

            if (feature.imageData) {
                const image = document.createElement("img");
                image.src = feature.imageData;
                image.alt = feature.imageAlt || "";
                image.className = "card-img-top";
                image.style.maxHeight = "220px";
                image.style.objectFit = "cover";
                card.append(image);
            }

            const body = document.createElement("div");
            body.className = "card-body p-4";
            if (feature.category) {
                const category = document.createElement("span");
                category.className = "badge rounded-pill text-bg-primary mb-2";
                category.textContent = feature.category;
                body.append(category);
            }
            const title = document.createElement("h3");
            title.className = "h5 card-title fw-bold";
            title.textContent = feature.title;
            const description = document.createElement("p");
            description.className = "card-text text-secondary mb-0";
            description.textContent = feature.description;
            body.append(title, description);

            if (feature.linkLabel && feature.linkUrl) {
                const link = document.createElement("a");
                link.href = feature.linkUrl;
                link.className = "btn btn-outline-primary btn-sm mt-3";
                link.textContent = feature.linkLabel;
                if (/^https:\/\//i.test(feature.linkUrl)) {
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                }
                body.append(link);
            }

            card.append(body);
            column.append(card);
            list.append(column);
        });
    }

    function renderDashboard() {
        const db = window.citplDB && window.citplDB.db;
        if (!db) return;

        renderCustomFeatures(db.customFeatures);
        const teams = Array.isArray(db.teams) ? db.teams : [];
        const players = Array.isArray(db.players) ? db.players : [];
        const matches = Array.isArray(db.matches) ? db.matches : [];
        const approvedPlayers = players.filter(player => player.status === "APPROVED");
        const liveMatch = db.liveMatch || {};
        const isMatchLive = ["LIVE", "IN_PROGRESS"].includes(String(liveMatch.status || "").toUpperCase());
        let scoreState = null;
        try {
            scoreState = JSON.parse(localStorage.getItem("CITPL_SCORE") || "null");
        } catch (error) {
            console.error("Unable to read cached CITPL live score.", error);
        }
        const scoreIsLive = !!(scoreState && scoreState.match && !scoreState.match.isComplete);
        const seasonStatus = String((db.season && db.season.status) || "REGISTRATION")
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/\b\w/g, letter => letter.toUpperCase());

        setText("dashboardSeasonStatus", seasonStatus);
        setText("dashboardSeasonStatusChip", seasonStatus);
        setText("dashboardTeamCount", String(teams.length));
        setText("dashboardPlayerCount", String(approvedPlayers.length));
        setText("dashboardMatchCount", String(matches.length));
        setText("dashboardLiveCount", isMatchLive || scoreIsLive ? "1 live" : "No live match");

        const liveContent = document.getElementById("dashboardLiveContent");
        const liveBadge = document.getElementById("dashboardLiveBadge");
        if (!liveContent) return;

        if (isMatchLive || scoreIsLive) {
            if (liveBadge) {
                liveBadge.className = "badge rounded-pill text-bg-danger";
                liveBadge.innerHTML = '<span class="live-pulse me-1"></span> LIVE NOW';
            }

            const teamA = liveMatch.teamA || {};
            const teamB = liveMatch.teamB || {};
            const score = document.createElement("div");
            score.className = "dashboard-match-score";
            score.textContent = scoreState
                ? `${Number(scoreState.innings.runs) || 0}/${Number(scoreState.innings.wickets) || 0}`
                : `${Number(teamA.runs) || 0}/${Number(teamA.wickets) || 0}`;

            const innings = document.createElement("div");
            innings.className = "dashboard-match-meta";
            if (scoreState) {
                const balls = Number(scoreState.innings.balls) || 0;
                const overs = `${Math.floor(balls / 6)}.${balls % 6} ov`;
                innings.textContent = `${scoreState.innings.battingTeam || "Batting team"} · ${overs}`;
            } else {
                innings.textContent = `${teamA.name || "Team A"} · ${formatOvers(teamA.overs)}`;
            }

            const opponent = document.createElement("div");
            opponent.className = "dashboard-team-line";
            const opponentName = document.createElement("strong");
            opponentName.textContent = scoreState
                ? `${scoreState.match.hostTeam || "Host"} vs ${scoreState.match.visitorTeam || "Visitor"}`
                : (teamB.name || "Team B");
            const opponentScore = document.createElement("span");
            opponentScore.className = "text-secondary fw-bold";
            opponentScore.textContent = scoreState
                ? (scoreState.innings.target ? `Target ${scoreState.innings.target}` : `Innings ${scoreState.innings.inningNumber || 1}`)
                : `${Number(teamB.runs) || 0}/${Number(teamB.wickets) || 0} · ${formatOvers(teamB.overs)}`;
            opponent.append(opponentName, opponentScore);

            liveContent.replaceChildren(score, innings, opponent);
        } else {
            if (liveBadge) {
                liveBadge.className = "badge rounded-pill text-bg-light text-secondary";
                liveBadge.textContent = "MATCH CENTER";
            }
            const empty = document.createElement("div");
            empty.className = "dashboard-empty";
            empty.textContent = matches.length
                ? "No match is live right now. Check the schedule for fixtures and updates."
                : "Live score updates will appear here when the league starts a match.";
            liveContent.replaceChildren(empty);
        }

        const auctionState = db.auctionState || {};
        const auctionStatus = String(auctionState.status || "NOT_STARTED").replaceAll("_", " ");
        setText("dashboardAuctionStatus", auctionStatus === "LIVE" ? "Auction is live" : `Auction ${auctionStatus.toLowerCase()}`);

        const user = window.citplDB.getCurrentUser();
        const welcome = document.getElementById("dashboardWelcome");
        if (welcome) welcome.textContent = user ? `Welcome back, ${user.name || "CITPL member"}` : "Welcome to CITPL 2026";

        const news = document.querySelector("#marqueeText");
        if (news) {
            const tickerItems = [
                `CITPL 2026 · ${seasonStatus}`,
                `${teams.length} teams`,
                `${approvedPlayers.length} approved players`,
                `${matches.length} scheduled matches`,
                isMatchLive || scoreIsLive ? "Live score is available now" : "Follow match updates and team standings"
            ];
            news.innerHTML = tickerItems.map(item => `<span>${item}</span> •`).join(" ");
        }
    }

    function init() {
        renderDashboard();
        if (window.citplDB && typeof window.citplDB.subscribe === "function") {
            window.citplDB.subscribe(renderDashboard);
        }
        window.addEventListener("storage", event => {
            if (event.key === "CITPL_SCORE" || event.key === "CITPL_DATABASE_STORE_2026") renderDashboard();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
