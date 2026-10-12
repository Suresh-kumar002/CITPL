(function () {
    const excludedPages = new Set([
        "login.html",
        "auction.html",
        "auction-live.html",
        "scorekeeper.html"
    ]);

    function buildMenuLinks(prefix, isSignedIn, role) {
        const links = [
            ["fa-table", "Points table", `${prefix}points-table.html`],
            ["fa-user-ninja", "Players", `${prefix}players.html`],
            ["fa-user-plus", "Register", `${prefix}register.html`]
        ];

        if (role === "TEAM_OWNER" || role === "ADMIN") {
            links.push(["fa-gavel", "Auction room", `${prefix}auction.html`]);
        }
        if (role === "TEAM_OWNER") {
            links.push(["fa-crown", "Captain portal", `${prefix}captain.html`]);
        }
        if (role === "ADMIN") {
            links.push(["fa-user-shield", "Admin dashboard", `${prefix}admin.html`]);
            links.push(["fa-edit", "Scorekeeper", `${prefix}scorekeeper.html`]);
        } else if (role === "SCOREKEEPER") {
            links.push(["fa-edit", "Scorekeeper", `${prefix}scorekeeper.html`]);
        }
        if (!isSignedIn) {
            links.push(["fa-right-to-bracket", "Sign in", `${prefix}login.html`]);
        } else {
            links.push(["fa-right-from-bracket", "Sign out", "#signout"]);
        }

        return links;
    }

    function initAppShell() {
        const pageName = window.location.pathname.split("/").pop().toLowerCase() || "index.html";
        if (excludedPages.has(pageName)) return;

        document.body.classList.add("citpl-app");

        const isSubpage = window.location.pathname.toLowerCase().includes("/pages/");
        const prefix = isSubpage ? "" : "pages/";
        const homeHref = isSubpage ? "../index.html" : "index.html";
        const route = name => `${prefix}${name}.html`;
        const currentUser = window.citplDB && window.citplDB.getCurrentUser
            ? window.citplDB.getCurrentUser()
            : null;
        const role = currentUser && window.citplDB && window.citplDB.normalizeRole
            ? window.citplDB.normalizeRole(currentUser.role)
            : "";
        const activePage = pageName.replace(".html", "");
        const moreActive = ["points-table", "players", "register", "captain", "admin"].includes(activePage);
        const menuLinks = buildMenuLinks(prefix, !!currentUser, role);
        const logoutLink = menuLinks.find(([icon]) => icon === "fa-right-from-bracket");
        if (logoutLink) logoutLink[2] = "#signout";

        const nav = document.createElement("nav");
        nav.className = "citpl-mobile-nav";
        nav.setAttribute("aria-label", "Primary navigation");
        nav.innerHTML = `
            <a href="${homeHref}" class="${activePage === "index" ? "is-active" : ""}"${activePage === "index" ? ' aria-current="page"' : ""}>
                <i class="fas fa-house" aria-hidden="true"></i><span>Home</span>
            </a>
            <a href="${route("live")}" class="${activePage === "live" ? "is-active" : ""}"${activePage === "live" ? ' aria-current="page"' : ""}>
                <i class="fas fa-tower-broadcast" aria-hidden="true"></i><span>Live</span>
            </a>
            <a href="${route("matches")}" class="${activePage === "matches" ? "is-active" : ""}"${activePage === "matches" ? ' aria-current="page"' : ""}>
                <i class="fas fa-calendar-days" aria-hidden="true"></i><span>Matches</span>
            </a>
            <a href="${route("teams")}" class="${activePage === "teams" ? "is-active" : ""}"${activePage === "teams" ? ' aria-current="page"' : ""}>
                <i class="fas fa-shield-halved" aria-hidden="true"></i><span>Teams</span>
            </a>
            <button type="button" class="${moreActive ? "is-active" : ""}" aria-controls="citplMobileMenu" aria-expanded="false">
                <i class="fas fa-ellipsis" aria-hidden="true"></i><span>Explore</span>
            </button>
        `;

        const overlay = document.createElement("div");
        overlay.className = "citpl-mobile-overlay";
        overlay.setAttribute("aria-hidden", "true");

        const menu = document.createElement("section");
        menu.className = "citpl-mobile-menu";
        menu.id = "citplMobileMenu";
        menu.setAttribute("role", "dialog");
        menu.setAttribute("aria-modal", "true");
        menu.setAttribute("aria-hidden", "true");
        menu.setAttribute("inert", "");
        menu.setAttribute("aria-label", "Explore CITPL");
        menu.innerHTML = `
            <div class="citpl-mobile-menu-handle"></div>
            <h2>Explore CITPL</h2>
            <div class="citpl-mobile-menu-grid">
                ${menuLinks.map(([icon, label, href]) => `
                    <a href="${href}"><i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span></a>
                `).join("")}
            </div>
        `;

        const menuButton = nav.querySelector("button");
        const closeMenu = () => {
            menu.classList.remove("is-open");
            menu.setAttribute("aria-hidden", "true");
            menu.setAttribute("inert", "");
            overlay.classList.remove("is-open");
            overlay.setAttribute("aria-hidden", "true");
            menuButton.setAttribute("aria-expanded", "false");
        };
        const openMenu = () => {
            menu.classList.add("is-open");
            menu.setAttribute("aria-hidden", "false");
            menu.removeAttribute("inert");
            overlay.classList.add("is-open");
            overlay.setAttribute("aria-hidden", "false");
            menuButton.setAttribute("aria-expanded", "true");
            const firstLink = menu.querySelector("a");
            if (firstLink) firstLink.focus();
        };

        menuButton.addEventListener("click", () => {
            if (menu.classList.contains("is-open")) closeMenu();
            else openMenu();
        });
        overlay.addEventListener("click", closeMenu);
        menu.addEventListener("click", async event => {
            const target = event.target;
            const link = target instanceof Element ? target.closest('a[href="#signout"]') : null;
            if (!link) return;
            event.preventDefault();
            if (window.citplDB && window.citplDB.isAdminRole(window.citplDB.getCurrentUser())) {
                const result = await window.citplDB.logoutAdminServer();
                if (!result.success) console.error(result.message);
            } else if (window.citplDB && typeof window.citplDB.setCurrentUser === "function") {
                window.citplDB.setCurrentUser(null);
            }
            window.location.replace(homeHref);
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && menu.classList.contains("is-open")) {
                closeMenu();
                menuButton.focus();
            } else if (event.key === "Tab" && menu.classList.contains("is-open")) {
                const focusable = [...menu.querySelectorAll("a[href]")];
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        document.body.append(overlay, menu, nav);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAppShell, { once: true });
    } else {
        initAppShell();
    }
})();
