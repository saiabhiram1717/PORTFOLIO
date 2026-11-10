const express = require("express");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Vary", "Origin");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Accept, Content-Type");
        if (req.method === "OPTIONS") {
            return res.sendStatus(204);
        }
    }
    next();
});

const staticDir = __dirname;
app.use(express.static(staticDir));

app.get("/", (req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
});

const githubRepositoriesUrl = "https://api.github.com/users/saiabhiram1717/repos?per_page=100&page=1&sort=updated&type=owner";
const githubCacheDurationMs = 10 * 60 * 1000;
const githubToken = process.env.GITHUB_TOKEN?.trim();
let githubRepositoryCache = null;
let githubRepositoryRequest = null;

async function fetchAllGitHubRepositories() {
    const repositories = [];
    let nextURL = githubRepositoriesUrl;

    while (nextURL) {
        const url = new URL(nextURL);
        if (url.protocol !== "https:" || url.hostname !== "api.github.com") {
            throw new Error("GitHub returned an unexpected pagination URL.");
        }

        const headers = {
            Accept: "application/vnd.github+json",
            "User-Agent": "Bandi-Sai-Abhiram-Portfolio",
            "X-GitHub-Api-Version": "2022-11-28"
        };
        if (githubToken) {
            headers.Authorization = `Bearer ${githubToken}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") {
                throw new Error("GitHub API rate limit reached. Set GITHUB_TOKEN in the root .env file and restart the server.");
            }
            throw new Error(`GitHub repository request failed (${response.status}).`);
        }

        const pageRepositories = await response.json();
        if (!Array.isArray(pageRepositories)) {
            throw new Error("GitHub returned an unexpected repository list.");
        }
        repositories.push(...pageRepositories);

        const nextLink = response.headers.get("Link")?.match(/<([^>]+)>;\s*rel="next"/);
        nextURL = nextLink ? nextLink[1] : null;
    }

    return repositories;
}

app.get("/api/github/repositories", async (req, res) => {
    const hasCachedRepositories = githubRepositoryCache !== null;
    const cacheIsFresh = hasCachedRepositories
        && Date.now() - githubRepositoryCache.fetchedAt < githubCacheDurationMs;

    if (cacheIsFresh) {
        res.set("X-Repository-Cache", "HIT");
        return res.json(githubRepositoryCache.repositories);
    }

    if (!githubRepositoryRequest) {
        githubRepositoryRequest = fetchAllGitHubRepositories()
            .then((repositories) => {
                githubRepositoryCache = { repositories, fetchedAt: Date.now() };
                return repositories;
            })
            .finally(() => {
                githubRepositoryRequest = null;
            });
    }

    try {
        const repositories = await githubRepositoryRequest;
        res.set("X-Repository-Cache", "MISS");
        res.json(repositories);
    } catch (error) {
        if (hasCachedRepositories) {
            console.warn("Serving cached GitHub repositories after an update failed:", error.message);
            res.set("X-Repository-Cache", "STALE");
            return res.json(githubRepositoryCache.repositories);
        }

        console.error("Unable to load GitHub repositories:", error);
        res.status(503).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : "Public projects are temporarily unavailable."
        });
    }
});

const emailUser = process.env.EMAIL_USER?.trim();
const emailPass = process.env.EMAIL_PASS?.replace(/\s+/g, "");
const gmailAppPasswordIsValid = /^\S{16}$/.test(emailPass || "");

let transporter = null;

if (emailUser && gmailAppPasswordIsValid) {
    transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
}

app.post("/api/contact", async (req, res) => {
    const { name, email, subject, message } = req.body || {};

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof message !== "string" ||
        (subject !== undefined && typeof subject !== "string")
    ) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid name, email address, and message."
        });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedSubject = (subject || "").replace(/[\r\n]+/g, " ").trim();
    const normalizedMessage = message.trim();

    if (
        !normalizedName ||
        normalizedName.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        normalizedEmail.length > 254 ||
        normalizedSubject.length > 150 ||
        !normalizedMessage ||
        normalizedMessage.length > 10000
    ) {
        return res.status(400).json({
            success: false,
            message: "Please check your details. Messages must be under 10,000 characters."
        });
    }

    if (!transporter) {
        return res.status(500).json({
            success: false,
            message: !emailUser
                ? "Email is not configured. Set EMAIL_USER in D:\\portfolio\\.env and restart the server."
                : "EMAIL_PASS must be a valid 16-character Google App Password (spaces are optional). Create one in your Google Account, update D:\\portfolio\\.env, and restart the server."
        });
    }

    try {
        await transporter.sendMail({
            from: emailUser,
            to: emailUser,
            replyTo: normalizedEmail,
            subject: normalizedSubject || "New Portfolio Message",
            text: `Name: ${normalizedName}\nEmail: ${normalizedEmail}\n\nMessage:\n${normalizedMessage}`
        });

        res.json({
            success: true,
            message: "Message sent successfully!"
        });
    } catch (error) {
        const errorCode = error && typeof error.code === "string" ? error.code : "UNKNOWN";
        const responseCode = error && Number.isInteger(error.responseCode) ? error.responseCode : null;
        console.error("Failed to send contact email:", { code: errorCode, responseCode });

        let errorMessage = `Gmail could not send the message (${errorCode}).`;
        if (errorCode === "EAUTH" || responseCode === 535 || responseCode === 534) {
            errorMessage = "Gmail rejected the credentials. Create a new 16-character Google App Password, update EMAIL_PASS in D:\\portfolio\\.env, and restart the server.";
        } else if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"].includes(errorCode)) {
            errorMessage = `Could not connect to Gmail SMTP (${errorCode}). Check your internet/firewall allows smtp.gmail.com on port 465, then try again.`;
        }

        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
});

app.listen(PORT, () => {
    console.log(`Portfolio running at http://localhost:${PORT}`);
});