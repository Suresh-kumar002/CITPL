import { createServer } from "node:http";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { readFile, readFileSync, stat } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const rootDirectory = process.cwd();
const sessionCookieName = "citpl_admin_session";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const mimeTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".csv", "text/csv; charset=utf-8"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
    [".svg", "image/svg+xml"],
    [".ico", "image/x-icon"],
    [".txt", "text/plain; charset=utf-8"]
]);
const allowedDirectories = new Set(["assets", "css", "data", "images", "js", "pages"]);
function loadEnvironmentFile() {
    let content;
    try {
        content = readFileSync(resolve(rootDirectory, ".env"), "utf8");
    } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
    }

    content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || match[1] in process.env) return;
        let value = match[2];
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
    });
}

loadEnvironmentFile();

function sendJson(response, statusCode, body, additionalHeaders = {}) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...additionalHeaders
    });
    response.end(JSON.stringify(body));
}

function parseCookies(header = "") {
    return new Map(header.split(";").map(part => {
        const separator = part.indexOf("=");
        if (separator === -1) return ["", ""];
        return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }));
}

function clearExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(token);
    }
}

function getSession(request) {
    clearExpiredSessions();
    const token = parseCookies(request.headers.cookie).get(sessionCookieName);
    if (!token) return null;
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) return null;
    return { token, ...session };
}

function isSameOriginRequest(request) {
    const origin = request.headers.origin;
    if (!origin) return false;
    const expectedOrigin = process.env.APP_ORIGIN ||
        `${request.headers["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http")}://${request.headers.host}`;
    return origin === expectedOrigin;
}

function parsePasswordHash(value) {
    const parts = String(value || "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return null;
    const [algorithm, nValue, rValue, pValue, salt, hashHex] = parts;
    const N = Number(nValue);
    const r = Number(rValue);
    const p = Number(pValue);
    if (
        !Number.isInteger(N) || N < 16384 || N > 131072 || (N & (N - 1)) !== 0 ||
        !Number.isInteger(r) || r < 1 || r > 16 ||
        !Number.isInteger(p) || p < 1 || p > 4 ||
        !/^[a-f0-9]{32}$/i.test(salt) ||
        !/^[a-f0-9]{128}$/i.test(hashHex)
    ) return null;
    return { algorithm, N, r, p, salt, hash: Buffer.from(hashHex, "hex") };
}

async function verifyPassword(password, encodedHash) {
    const parsed = parsePasswordHash(encodedHash);
    if (!parsed) return false;
    let derived;
    try {
        derived = await scrypt(password, parsed.salt, parsed.hash.length, {
            N: parsed.N,
            r: parsed.r,
            p: parsed.p,
            maxmem: 256 * 1024 * 1024
        });
    } catch (error) {
        console.error("Admin password verification failed.", error);
        return false;
    }
    return timingSafeEqual(Buffer.from(derived), parsed.hash);
}

async function readJsonBody(request, maximumBytes = 4096) {
    let body = "";
    for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body, "utf8") > maximumBytes) {
            const error = new Error("Request body is too large.");
            error.statusCode = 413;
            throw error;
        }
    }
    try {
        return JSON.parse(body);
    } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        throw error;
    }
}

function checkLoginRateLimit(key) {
    const now = Date.now();
    const attempts = loginAttempts.get(key);
    if (!attempts || now - attempts.startedAt >= 15 * 60 * 1000) {
        loginAttempts.set(key, { startedAt: now, count: 0 });
        return true;
    }
    return attempts.count < 5;
}

function recordLoginFailure(key) {
    const attempts = loginAttempts.get(key);
    if (attempts) attempts.count += 1;
    if (loginAttempts.size > 10000) {
        const cutoff = Date.now() - 15 * 60 * 1000;
        for (const [attemptKey, attempt] of loginAttempts) {
            if (attempt.startedAt < cutoff) loginAttempts.delete(attemptKey);
        }
    }
}

function getClientAddress(request) {
    return request.socket.remoteAddress || "unknown";
}

async function handleApi(request, response, pathname) {
    if (pathname === "/api/admin/session" && request.method === "GET") {
        const session = getSession(request);
        if (!session) return sendJson(response, 401, { success: false, message: "Admin session required." });
        return sendJson(response, 200, {
            success: true,
            user: { name: "League administrator", email: session.email, role: "ADMIN" },
            expiresAt: session.expiresAt
        });
    }

    if (!["POST"].includes(request.method)) {
        return sendJson(response, 405, { success: false, message: "Method not allowed." }, { Allow: "GET, POST" });
    }
    if (!isSameOriginRequest(request)) {
        return sendJson(response, 403, { success: false, message: "Request origin is not allowed." });
    }
    if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        return sendJson(response, 415, { success: false, message: "Use a JSON request body." });
    }

    if (pathname === "/api/admin/login") {
        const body = await readJsonBody(request);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return sendJson(response, 400, { success: false, message: "Request body must be a JSON object." });
        }
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const rateKey = `${getClientAddress(request)}:${email}`;
        clearExpiredSessions();
        if (!checkLoginRateLimit(rateKey)) {
            return sendJson(response, 429, { success: false, message: "Too many attempts. Try again in 15 minutes." });
        }

        const configuredEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const configuredHash = process.env.ADMIN_PASSWORD_HASH || "";
        if (!configuredEmail || !parsePasswordHash(configuredHash)) {
            return sendJson(response, 503, { success: false, message: "Admin authentication is not configured on the server." });
        }

        const emailMatches = email.length <= 254 && email === configuredEmail;
        const passwordMatches = password.length > 0 && password.length <= 256
            ? await verifyPassword(password, configuredHash)
            : false;
        if (!emailMatches || !passwordMatches) {
            recordLoginFailure(rateKey);
            return sendJson(response, 401, { success: false, message: "Invalid email or password." });
        }

        loginAttempts.delete(rateKey);
        const token = randomBytes(32).toString("hex");
        const expiresAt = Date.now() + sessionLifetimeMs;
        sessions.set(token, { email: configuredEmail, expiresAt });
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        return sendJson(response, 200, {
            success: true,
            user: { name: "League administrator", email: configuredEmail, role: "ADMIN" },
            expiresAt
        }, {
            "Set-Cookie": `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionLifetimeMs / 1000)}${secure}`
        });
    }

    if (pathname === "/api/admin/logout") {
        const session = getSession(request);
        if (session) sessions.delete(session.token);
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        return sendJson(response, 200, { success: true }, {
            "Set-Cookie": `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
        });
    }

    return sendJson(response, 404, { success: false, message: "API route not found." });
}

function resolvePublicFile(pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return null;
    }
    if (decoded.includes("\0") || decoded.includes("\\")) return null;
    const segments = decoded.split("/").filter(Boolean);
    if (segments.some(segment => segment === "." || segment === ".." || segment.startsWith("."))) return null;
    if (!segments.length) segments.push("index.html");
    if (segments[0] === "index.html" && segments.length === 1) {
        // Root document.
    } else if (!allowedDirectories.has(segments[0])) {
        return null;
    }

    const filePath = resolve(rootDirectory, ...segments);
    if (!filePath.startsWith(`${rootDirectory}${sep}`) && filePath !== resolve(rootDirectory, "index.html")) return null;
    return filePath;
}

function serveStaticFile(request, response, pathname) {
    const filePath = resolvePublicFile(pathname);
    if (!filePath) return sendJson(response, 404, { success: false, message: "Not found." });

    stat(filePath, (statError, info) => {
        if (statError || !info.isFile()) return sendJson(response, 404, { success: false, message: "Not found." });
        const contentType = mimeTypes.get(extname(filePath).toLowerCase());
        if (!contentType) return sendJson(response, 404, { success: false, message: "Not found." });
        response.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": info.size,
            "Cache-Control": contentType.startsWith("text/html") ? "no-store" : "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "X-Frame-Options": "DENY"
        });
        if (request.method === "HEAD") return response.end();
        readFile(filePath, (readError, content) => {
            if (readError) {
                console.error("Static file read failed.", readError);
                if (!response.headersSent) return sendJson(response, 500, { success: false, message: "Could not read requested file." });
                return response.destroy(readError);
            }
            response.end(content);
        });
    });
}

const server = createServer(async (request, response) => {
    let pathname;
    let decodedPathname;
    try {
        pathname = new URL(request.url, "http://localhost").pathname;
        decodedPathname = decodeURIComponent(pathname).toLowerCase();
    } catch {
        return sendJson(response, 400, { success: false, message: "Invalid request URL." });
    }

    if (pathname.startsWith("/api/")) {
        try {
            await handleApi(request, response, pathname);
        } catch (error) {
            const statusCode = error.statusCode || 500;
            if (statusCode >= 500) console.error("Admin API request failed.", error);
            sendJson(response, statusCode, {
                success: false,
                message: statusCode === 500 ? "The server could not complete the request." : error.message
            });
        }
        return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
        return sendJson(response, 405, { success: false, message: "Method not allowed." }, { Allow: "GET, HEAD" });
    }
    if (decodedPathname === "/pages/admin.html" && !getSession(request)) {
        response.writeHead(302, {
            Location: "/pages/login.html",
            "Cache-Control": "no-store"
        });
        return response.end();
    }
    serveStaticFile(request, response, pathname);
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
}
server.listen(port, host, () => {
    console.log(`CITPL server listening on http://${host}:${port}`);
});
