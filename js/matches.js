(function () {
    function addTextElement(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = text;
        parent.append(element);
        return element;
    }

    function statusStyle(status) {
        switch (String(status || "").toUpperCase()) {
            case "LIVE": return { badge: "bg-danger", border: "border-danger border-2" };
            case "COMPLETED": return { badge: "bg-success", border: "border-success" };
            case "ABANDONED":
            case "CANCELLED": return { badge: "bg-secondary", border: "border-secondary" };
            default: return { badge: "bg-primary", border: "border-0" };
        }
    }

    function formatMatchTime(value) {
        if (!value) return "Date and time to be announced";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    }

    function renderMatches() {
        const container = document.getElementById("matchesList");
        const db = window.citplDB && window.citplDB.db;
        if (!container || !db) return;

        const teamsById = new Map((db.teams || []).map(team => [team.id, team.name]));
        const matches = [...(db.matches || [])].sort((a, b) => {
            const aTime = a.scheduledTime ? new Date(a.scheduledTime).getTime() : Infinity;
            const bTime = b.scheduledTime ? new Date(b.scheduledTime).getTime() : Infinity;
            return aTime - bTime || Number(a.matchNumber) - Number(b.matchNumber);
        });
        container.replaceChildren();

        if (matches.length === 0) {
            const emptyColumn = document.createElement("div");
            emptyColumn.className = "col-12";
            const emptyCard = document.createElement("div");
            emptyCard.className = "card border-0 shadow-sm rounded-4 p-5 text-center";
            addTextElement(emptyCard, "h5", "fw-bold text-secondary", "No matches have been scheduled yet.");
            addTextElement(emptyCard, "p", "text-muted mb-0", "The tournament schedule will appear here when the admin publishes fixtures.");
            emptyColumn.append(emptyCard);
            container.append(emptyColumn);
            return;
        }

        matches.forEach(match => {
            const teamA = teamsById.get(match.teamAId) || "Team to be announced";
            const teamB = teamsById.get(match.teamBId) || "Team to be announced";
            const status = String(match.status || "SCHEDULED").toUpperCase();
            const style = statusStyle(status);
            const column = document.createElement("div");
            column.className = "col-lg-6";

            const card = document.createElement("article");
            card.className = `card shadow-sm ${style.border} rounded-4 p-4 h-100`;
            const header = document.createElement("div");
            header.className = "d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3";
            const badge = addTextElement(header, "span", `badge ${style.badge} rounded-pill px-3 py-2`, `MATCH #${match.matchNumber} · ${status.replaceAll("_", " ")}`);
            if (status === "LIVE") {
                badge.prepend(Object.assign(document.createElement("span"), { className: "live-pulse me-1" }));
            }
            addTextElement(header, "small", "text-muted", formatMatchTime(match.scheduledTime));

            const matchup = document.createElement("div");
            matchup.className = "row align-items-center text-center";
            addTextElement(matchup, "div", "col-5 fw-bold fs-5 text-primary", teamA);
            addTextElement(matchup, "div", "col-2 fw-bold text-muted", "VS");
            addTextElement(matchup, "div", "col-5 fw-bold fs-5 text-secondary", teamB);

            const details = document.createElement("div");
            details.className = "text-center mt-3 pt-3 border-top";
            addTextElement(details, "div", "small text-muted mb-2", `${match.oversLimit || 10} overs${match.venue ? ` · ${match.venue}` : ""}`);
            if (match.result) {
                addTextElement(details, "p", "fw-bold text-success mb-2", match.result);
            } else if (status === "COMPLETED") {
                addTextElement(details, "p", "text-muted mb-2", "Result to be updated by admin.");
            } else if (status === "SCHEDULED") {
                addTextElement(details, "p", "text-muted mb-2", "Fixture published by the league admin.");
            }
            if (status === "LIVE") {
                const liveLink = document.createElement("a");
                liveLink.href = "live.html";
                liveLink.className = "btn btn-outline-danger btn-sm rounded-pill";
                liveLink.textContent = "View live scoreboard";
                details.append(liveLink);
            }

            card.append(header, matchup, details);
            column.append(card);
            container.append(column);
        });
    }

    function init() {
        renderMatches();
        if (window.citplDB && typeof window.citplDB.subscribe === "function") {
            window.citplDB.subscribe(renderMatches);
        }
        window.addEventListener("storage", event => {
            if (event.key === "CITPL_DATABASE_STORE_2026") renderMatches();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
