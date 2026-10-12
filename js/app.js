/* =====================================================
   CITPL - MAIN UI ENGINE & SMARTLIB AI CHATBOT INTERACTOR
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    initClockAndStatus();
    initMarqueeControls();
    initChatbot();
    updateUserRoleUI();
});

function initMarqueeControls() {
    const marquee = document.getElementById("marqueeText");
    const icon = document.getElementById("playPauseIcon");
    if (!marquee || !icon) return;

    marquee.style.animationPlayState = "running";
    marqueePaused = false;
    icon.className = "fas fa-pause";
}

// 1. Clock & League Status Indicator
function initClockAndStatus() {
    const statusPill = document.getElementById("globalLibraryStatus");
    if (statusPill) {
        statusPill.innerHTML = `<i class="fas fa-circle me-1 text-success" style="font-size: 8px;"></i> CITPL 2026: Season Active`;
    }
}

// 2. Marquee Ticker Pause / Play
let marqueePaused = false;
function toggleMarquee() {
    const marquee = document.getElementById("marqueeText");
    const icon = document.getElementById("playPauseIcon");
    if (!marquee || !icon) return;

    if (marqueePaused) {
        marquee.style.animationPlayState = "running";
        icon.className = "fas fa-pause";
        marqueePaused = false;
    } else {
        marquee.style.animationPlayState = "paused";
        icon.className = "fas fa-play";
        marqueePaused = true;
    }
}

// 3. Smart AI Chatbot Integration
function initChatbot() {
    const chatBtn = document.getElementById("chatBtn");
    const chatWindow = document.getElementById("chatWindow");
    const chatTooltip = document.getElementById("chatTooltip");

    if (chatBtn && chatWindow) {
        chatBtn.addEventListener("click", function () {
            chatWindow.classList.toggle("active");
            if (chatTooltip) chatTooltip.style.display = "none";
        });
    }
}

function handleEnter(e) {
    if (e.key === "Enter") sendMessage();
}

function sendMessage() {
    const chatInput = document.getElementById("chatInput");
    const chatBody = document.getElementById("chatBody");
    if (!chatInput || !chatBody) return;

    const query = chatInput.value.trim();
    if (!query) return;

    // Append User Message
    appendChatBubble("user", query);
    chatInput.value = "";

    // Show Loading
    const loadingId = "load-" + Date.now();
    appendChatBubble("bot", "Thinking...", loadingId);

    setTimeout(() => {
        const loadingElem = document.getElementById(loadingId);
        if (loadingElem) loadingElem.remove();

        // Bot Smart Answers
        const reply = generateAIResponse(query);
        appendChatBubble("bot", reply);
    }, 600);
}

function appendChatBubble(sender, text, id = null) {
    const chatBody = document.getElementById("chatBody");
    if (!chatBody) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `msg msg-${sender}`;
    msgDiv.innerText = text;
    if (id) msgDiv.id = id;

    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function generateAIResponse(q) {
    const lower = q.toLowerCase();
    if (lower.includes("live") || lower.includes("score")) {
        return "🔴 Live Score: CIT Warriors (87/4, 9.2 ov) vs Tech Titans (120/6). Target: 121 runs. Need 34 runs from 4.4 overs!";
    } else if (lower.includes("auction") || lower.includes("bid")) {
        return "🔨 Current Lot #14 is Live! Karan Patel (All-Rounder) is on the table. Highest Bid: ₹1,600 by Cyber Strikers.";
    } else if (lower.includes("register") || lower.includes("fee")) {
        return "📝 Player Registration is ₹50. Fill your college details, upload ₹50 payment transaction ID, and get verified by Admin!";
    } else if (lower.includes("captain") || lower.includes("team")) {
        return "🏏 4 Teams in CITPL 2026: CIT Warriors, Tech Titans, Cyber Strikers, and Royals Abu Road. Starting purse is ₹10,000 per team.";
    } else if (lower.includes("points") || lower.includes("table")) {
        return "📊 CIT Warriors currently leads the points table with 6 Points (NRR +1.25). Tech Titans is 2nd with 4 Points!";
    } else {
        return "Welcome to CIT Premier League AI Assistant! You can ask me about Live Scores, Auction Bids, Player Registrations, Fixtures, or Points Table.";
    }
}

// Role Switcher & Dynamic Auth UI Engine
function updateUserRoleUI() {
    renderAuthUI();
}

window.addEventListener("citpl:auth-changed", updateUserRoleUI);

function renderAuthUI() {
    if (!window.citplDB || typeof window.citplDB.getCurrentUser !== "function") {
        toggleAdminPortals(false);
        return;
    }
    const currentUser = window.citplDB.getCurrentUser();
    
    // Show/hide admin portals dropdown in navbar
    const isAdmin = currentUser && window.citplDB.normalizeRole(currentUser.role) === "ADMIN";
    toggleAdminPortals(isAdmin);

    // Top Bar Auth Area
    const topBarAuthContainer = document.getElementById("topBarAuthContainer");
    if (topBarAuthContainer) {
        if (currentUser) {
            topBarAuthContainer.innerHTML = `
                <div class="dropdown d-inline-block">
                    <button class="btn btn-sm btn-dark dropdown-toggle rounded-pill px-3" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-user-circle text-warning me-1"></i> ${currentUser.name}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                        <li><a class="dropdown-item fw-semibold" href="#" onclick="showPlayerDashboard(); return false;"><i class="fas fa-id-card text-primary me-2"></i> My Player Pass</a></li>
                        ${isAdmin ? '<li><a class="dropdown-item fw-semibold text-danger" href="pages/admin.html"><i class="fas fa-user-shield me-2"></i> Admin Panel</a></li>' : ''}
                        ${isAdmin ? '<li><a class="dropdown-item fw-semibold text-info" href="pages/scorekeeper.html"><i class="fas fa-edit me-2"></i> Scorekeeper</a></li>' : ''}
                        ${currentUser.role === 'TEAM_OWNER' ? '<li><a class="dropdown-item fw-semibold text-warning" href="pages/auction.html"><i class="fas fa-gavel me-2"></i> Auction Room</a></li>' : ''}
                        ${currentUser.role === 'TEAM_OWNER' ? '<li><a class="dropdown-item fw-semibold text-primary" href="pages/captain.html"><i class="fas fa-crown me-2"></i> Captain Portal</a></li>' : ''}
                        ${currentUser.role === 'SCOREKEEPER' ? '<li><a class="dropdown-item fw-semibold text-info" href="pages/scorekeeper.html"><i class="fas fa-edit me-2"></i> Scorekeeper</a></li>' : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger fw-semibold" href="#" onclick="logoutUser(); return false;"><i class="fas fa-sign-out-alt me-2"></i> Sign Out</a></li>
                    </ul>
                </div>
            `;
        } else {
            const isSubpage = window.location.pathname.includes('/pages/');
            const loginPath = isSubpage ? 'login.html' : 'pages/login.html';
            const regPath = isSubpage ? 'register.html' : 'pages/register.html';
            topBarAuthContainer.innerHTML = `
                <a href="${loginPath}" class="btn btn-sm btn-outline-light rounded-pill px-3 fw-bold me-1"><i class="fas fa-sign-in-alt me-1"></i> Log In</a>
                <a href="${regPath}" class="btn btn-sm btn-warning rounded-pill px-3 fw-bold text-dark"><i class="fas fa-user-plus me-1"></i> Register (₹50)</a>
            `;
        }
    }

    // Role Badge
    const roleBadge = document.getElementById("currentUserRoleBadge");
    if (roleBadge) {
        if (!currentUser) {
            roleBadge.innerText = "Guest User";
        } else {
            roleBadge.innerText = `${currentUser.name} (${currentUser.role})`;
        }
    }
}

function toggleAdminPortals(show) {
    const adminDropdown = document.getElementById("adminPortalsDropdown");
    if (adminDropdown) {
        if (show) {
            adminDropdown.classList.remove("d-none");
        } else {
            adminDropdown.classList.add("d-none");
        }
    }
}

async function handleUserLoginSubmit(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById("userEmailInput");
    const passInput = document.getElementById("userPassInput");
    const alertDiv = document.getElementById("loginAlert");

    if (!emailInput || !passInput) return;
    const email = emailInput.value.trim();
    const pass = passInput.value.trim();

    if (!email || !pass) {
        if (alertDiv) {
            alertDiv.className = "alert alert-warning";
            alertDiv.innerText = "Please enter both email and password.";
            alertDiv.classList.remove("d-none");
        }
        return;
    }

    if (!window.citplDB) return;
    const isAdminSignIn = document.getElementById("adminSignInToggle")?.checked;
    let res;
    if (isAdminSignIn) {
        res = await window.citplDB.loginAdminServer(email, pass);
    } else {
        res = window.citplDB.login(email, pass);
    }

    if (res.success) {
        if (alertDiv) {
            alertDiv.className = "alert alert-success";
            alertDiv.innerText = "Login successful! Redirecting...";
            alertDiv.classList.remove("d-none");
        }
        setTimeout(() => {
            const isSubpage = window.location.pathname.includes('/pages/');
            const role = window.citplDB.normalizeRole(res.user.role);
            if (role === "ADMIN") {
                window.location.replace(isSubpage ? "admin.html" : "pages/admin.html");
            } else if (role === "TEAM_OWNER") {
                window.location.replace(isSubpage ? "auction.html" : "pages/auction.html");
            } else if (role === "SCOREKEEPER") {
                window.location.replace(isSubpage ? "scorekeeper.html" : "pages/scorekeeper.html");
            } else {
                window.location.replace(isSubpage ? "../index.html" : "index.html");
            }
        }, 600);
    } else {
        if (alertDiv) {
            alertDiv.className = "alert alert-danger";
            alertDiv.innerText = res.message || "Invalid credentials!";
            alertDiv.classList.remove("d-none");
        }
    }
}

function handleRegistrationSubmit(e) {
    if (e) e.preventDefault();
    const name = document.getElementById("regName")?.value.trim();
    const mobile = document.getElementById("regMobile")?.value.trim();
    const email = document.getElementById("regEmail")?.value.trim();
    const password = document.getElementById("regPass")?.value.trim();
    const branch = document.getElementById("regBranch")?.value;
    const sem = document.getElementById("regSem")?.value;
    const role = document.getElementById("regRole")?.value;
    const category = document.getElementById("regCategory")?.value;
    const txnId = document.getElementById("regTxnId")?.value.trim();

    if (!name || !mobile || !email || !password || !txnId) {
        alert("Please fill all required fields including UPI Reference Transaction ID.");
        return;
    }

    if (!window.citplDB) return;
    const newPlayer = window.citplDB.registerPlayer({
        name, mobile, email, password, branch, sem, role, category, transactionId: txnId
    });

    // Auto login
    window.citplDB.login(email, password);

    const alertBox = document.getElementById("regSuccessAlert");
    if (alertBox) {
        document.getElementById("assignedRegId").innerText = newPlayer.registrationId;
        alertBox.classList.remove("d-none");
        alertBox.scrollIntoView({ behavior: "smooth" });
    } else {
        alert(`Registration successful! Your Player Pass ID is ${newPlayer.registrationId}. Payment reference submitted.`);
    }

    renderAuthUI();
}

async function logoutUser() {
    if (window.citplDB && window.citplDB.isAdminRole(window.citplDB.getCurrentUser())) {
        const result = await window.citplDB.logoutAdminServer();
        if (!result.success) console.error(result.message);
    } else if (window.citplDB && typeof window.citplDB.setCurrentUser === "function") {
        window.citplDB.setCurrentUser(null);
    }
    renderAuthUI();
    alert("Logged out successfully.");
    const isSubpage = window.location.pathname.includes('/pages/');
    window.location.href = isSubpage ? "../index.html" : "index.html";
}

function showPlayerDashboard() {
    if (!window.citplDB) return;
    const user = window.citplDB.getCurrentUser();
    if (!user) {
        alert("Please log in to view your Player Pass!");
        return;
    }

    const player = (window.citplDB.db.players || []).find(p => p.email && p.email.toLowerCase() === user.email.toLowerCase()) || {
        registrationId: user.regId || "REG2026-101",
        name: user.name,
        email: user.email,
        branch: "CSE",
        sem: "4th",
        role: "ALL_ROUNDER",
        status: "APPROVED",
        paymentVerified: true,
        teamId: "t1",
        auctionPrice: 1600
    };

    const team = (window.citplDB.db.teams || []).find(t => t.id === player.teamId);

    const modalHtml = `
        <div class="modal fade" id="playerDashboardModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                    <div class="modal-header bg-dark text-white p-4">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width:50px; height:50px; font-size:1.5rem; font-weight:800;">
                                ${player.name ? player.name.charAt(0) : 'P'}
                            </div>
                            <div>
                                <h5 class="modal-title fw-bold text-white mb-0">${player.name}</h5>
                                <small class="text-info"><i class="fas fa-id-badge me-1"></i> Pass ID: ${player.registrationId}</small>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4 bg-light">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-3 p-3 h-100 bg-white">
                                    <h6 class="fw-bold text-primary mb-3"><i class="fas fa-user-tag me-2"></i> Player Details</h6>
                                    <div class="mb-2"><strong>Email:</strong> ${player.email}</div>
                                    <div class="mb-2"><strong>Mobile:</strong> ${player.mobile || '9414200619'}</div>
                                    <div class="mb-2"><strong>Branch & Sem:</strong> ${player.branch || 'CSE'} - ${player.sem || '4th'} Sem</div>
                                    <div class="mb-2"><strong>Playing Role:</strong> <span class="badge bg-primary px-3 py-1">${player.role}</span></div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-3 p-3 h-100 bg-white">
                                    <h6 class="fw-bold text-primary mb-3"><i class="fas fa-shield-alt me-2"></i> Tournament Status</h6>
                                    <div class="mb-2">
                                        <strong>Fee Status (₹50):</strong> 
                                        ${player.paymentVerified || player.status === 'APPROVED' ? 
                                            '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i> Paid & Verified</span>' : 
                                            '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i> Pending Verification</span>'}
                                    </div>
                                    <div class="mb-2">
                                        <strong>Assigned Squad:</strong> 
                                        ${team ? `<span class="badge bg-dark text-warning fs-6 px-3 py-1"><i class="fas fa-tshirt me-1"></i> ${team.name}</span>` : '<span class="badge bg-secondary">Unallocated / In Auction Pool</span>'}
                                    </div>
                                    ${player.auctionPrice ? `<div class="mb-2"><strong>Auction Price:</strong> <span class="text-success fw-bold fs-5">₹${player.auctionPrice}</span></div>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-white border-0 px-4 py-3">
                        <button type="button" class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById("playerDashboardModal");
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modalObj = new bootstrap.Modal(document.getElementById("playerDashboardModal"));
    modalObj.show();
}
