import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer as createProbeServer } from "node:net";
import { scryptSync } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

const testEmail = "admin-test@example.test";
const testPassword = "temporary-test-password";
const salt = "00112233445566778899aabbccddeeff";
const passwordHash = scryptSync(testPassword, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");

async function findAvailablePort() {
    const probe = createProbeServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const address = probe.address();
    await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    return address.port;
}

async function waitForServer(url, child) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error("Admin API server exited during startup.");
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch (error) {
            await delay(50);
        }
    }
    throw new Error("Admin API server did not become ready.");
}

test("server-backed admin login, session, logout, and static-file boundaries", async () => {
    const port = await findAvailablePort();
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ["server.mjs"], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            HOST: "127.0.0.1",
            PORT: String(port),
            NODE_ENV: "test",
            ADMIN_EMAIL: testEmail,
            ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${salt}$${passwordHash}`
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { stderr += chunk; });

    try {
        await waitForServer(`${origin}/`, child);

        const login = async (email, password, requestOrigin = origin) => fetch(`${origin}/api/admin/login`, {
            method: "POST",
            headers: {
                Origin: requestOrigin,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        assert.equal((await login(testEmail, testPassword, "")).status, 403);
        assert.equal((await login(testEmail, testPassword, "https://attacker.example")).status, 403);
        assert.equal((await login(testEmail, "wrong-password")).status, 401);

        const loginResponse = await login(testEmail.toUpperCase(), testPassword);
        assert.equal(loginResponse.status, 200);
        const loginBody = await loginResponse.json();
        assert.equal(loginBody.user.role, "ADMIN");
        const setCookie = loginResponse.headers.get("set-cookie");
        assert.match(setCookie, /HttpOnly/i);
        assert.match(setCookie, /SameSite=Strict/i);
        assert.doesNotMatch(JSON.stringify(loginBody), new RegExp(testPassword));

        const cookie = setCookie.split(";")[0];
        const sessionResponse = await fetch(`${origin}/api/admin/session`, { headers: { Cookie: cookie } });
        assert.equal(sessionResponse.status, 200);
        assert.equal((await sessionResponse.json()).user.email, testEmail);
        assert.equal((await fetch(`${origin}/pages/admin.html`, { headers: { Cookie: cookie } })).status, 200);

        const logoutResponse = await fetch(`${origin}/api/admin/logout`, {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie },
            body: "{}"
        });
        assert.equal(logoutResponse.status, 200);
        assert.equal((await fetch(`${origin}/api/admin/session`, { headers: { Cookie: cookie } })).status, 401);

        for (let attempt = 0; attempt < 5; attempt += 1) {
            assert.equal((await login("blocked-test@example.test", "wrong-password")).status, 401);
        }
        assert.equal((await login("blocked-test@example.test", "wrong-password")).status, 429);

        assert.equal((await fetch(`${origin}/pages/login.html`)).status, 200);
        const adminPageResponse = await fetch(`${origin}/pages/admin.html`, { redirect: "manual" });
        assert.equal(adminPageResponse.status, 302);
        assert.equal(adminPageResponse.headers.get("location"), "/pages/login.html");
        assert.equal((await fetch(`${origin}/pages/%61dmin.html`, { redirect: "manual" })).status, 302);
        assert.equal((await fetch(`${origin}/pages/Admin.html`, { redirect: "manual" })).status, 302);
        assert.equal((await fetch(`${origin}/server.mjs`)).status, 404);
        assert.equal((await fetch(`${origin}/.env`)).status, 404);
    } finally {
        child.kill();
        await once(child, "exit");
        if (stderr) process.stderr.write(stderr);
    }
});
