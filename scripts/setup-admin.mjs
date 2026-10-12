import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const parameters = { N: 16384, r: 8, p: 1, keyLength: 64 };

function readHidden(prompt) {
    return new Promise((resolve, reject) => {
        if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
            reject(new Error("Run this setup command in an interactive terminal."));
            return;
        }

        const stdin = process.stdin;
        let value = "";
        process.stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", function onData(buffer) {
            for (const character of buffer.toString("utf8")) {
                if (character === "\u0003") {
                    stdin.setRawMode(false);
                    stdin.removeListener("data", onData);
                    stdin.pause();
                    reject(new Error("Setup cancelled."));
                    return;
                }
                if (character === "\r" || character === "\n") {
                    stdin.removeListener("data", onData);
                    stdin.setRawMode(false);
                    stdin.pause();
                    process.stdout.write("\n");
                    resolve(value);
                    return;
                }
                if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
                else if (character >= " ") value += character;
            }
        });
    });
}

try {
    const email = (await readHidden("Admin email: ")).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid admin email address.");
    }

    const password = await readHidden("Admin password (input hidden): ");
    if (password.length < 12 || password.length > 256) {
        throw new Error("Admin password must contain 12 to 256 characters.");
    }
    const confirmation = await readHidden("Confirm admin password: ");
    if (password !== confirmation) throw new Error("Passwords do not match.");

    const salt = randomBytes(16).toString("hex");
    const derivedKey = await scrypt(password, salt, parameters.keyLength, {
        N: parameters.N,
        r: parameters.r,
        p: parameters.p
    });
    const hash = [
        "scrypt",
        parameters.N,
        parameters.r,
        parameters.p,
        salt,
        Buffer.from(derivedKey).toString("hex")
    ].join("$");

    process.stdout.write("\nAdd these lines to your private .env file (never commit it):\n");
    process.stdout.write(`ADMIN_EMAIL=${email}\n`);
    process.stdout.write(`ADMIN_PASSWORD_HASH=${hash}\n`);
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
