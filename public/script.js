import { certifications } from "./src/data.js";

// ===============================
// MOBILE MENU
// ===============================

const menuBtn = document.getElementById("menuBtn");
const navbar = document.getElementById("navbar");

if (menuBtn && navbar) {
    menuBtn.addEventListener("click", function () {
        navbar.classList.toggle("active");
    });

    const navLinks = document.querySelectorAll("#navbar a");

    navLinks.forEach(function (link) {
        link.addEventListener("click", function () {
            navbar.classList.remove("active");
        });
    });
}


// ===============================
// ACTIVE NAV STATE
// ===============================

const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll("#navbar a");

function updateActiveNav() {
    const scrollY = window.scrollY + 140;

    sections.forEach((section) => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute("id");

        if (scrollY >= top && scrollY < top + height) {
            navLinks.forEach((link) => {
                link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
            });
        }
    });
}

window.addEventListener("scroll", updateActiveNav);
updateActiveNav();


// ===============================
// REVEAL ANIMATIONS
// ===============================

function renderCertifications() {
    const certificateGrid = document.getElementById("certificateGrid");

    if (!certificateGrid) {
        throw new Error("The certifications grid could not be found.");
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const newestFirst = [...certifications].sort((first, second) => {
        const getStartDate = (certification) => {
            const [period, year] = certification.year.split(" ");
            const startMonth = period.split("–")[0];
            return Number(year) * 12 + monthOrder.indexOf(startMonth);
        };

        return getStartDate(second) - getStartDate(first);
    });

    newestFirst.forEach((certification) => {
        const card = document.createElement("article");
        card.className = "certificate-card nptel-certificate";

        const title = document.createElement("h3");
        title.textContent = certification.course;
        card.append(title);

        const institution = document.createElement("p");
        institution.className = "certificate-institution";
        institution.textContent = certification.institution;
        card.append(institution);

        const details = document.createElement("dl");
        details.className = "certificate-details";

        [["Period", certification.year], ["Score", certification.score]].forEach(([label, value]) => {
            const detail = document.createElement("div");
            const term = document.createElement("dt");
            term.textContent = label;
            const description = document.createElement("dd");
            description.textContent = value;
            detail.append(term, description);
            details.append(detail);
        });

        card.append(details);

        if (certification.badge) {
            const badge = document.createElement("span");
            badge.className = "certificate-badge";
            badge.textContent = certification.badge;
            card.append(badge);
        }

        const link = document.createElement("a");
        link.className = "certificate-link";
        link.href = certification.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "View certificate (PDF)";
        card.append(link);

        certificateGrid.append(card);
    });
}

renderCertifications();

const certificatePreview = document.getElementById("certificatePreview");
const certificatePreviewFrame = document.getElementById("certificatePreviewFrame");
const certificatePreviewTitle = document.getElementById("certificatePreviewTitle");
const certificatePreviewClose = document.getElementById("certificatePreviewClose");
let certificatePreviewTrigger = null;

if (certificatePreview && certificatePreviewFrame && certificatePreviewTitle && certificatePreviewClose) {
    document.querySelectorAll(".certificate-link").forEach((link) => {
        link.addEventListener("click", (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            event.preventDefault();
            certificatePreviewTrigger = link;
            certificatePreviewTitle.textContent = `${link.closest(".certificate-card").querySelector("h3").textContent} certificate`;
            certificatePreviewFrame.src = link.href;
            certificatePreviewFrame.title = `${certificatePreviewTitle.textContent} preview`;
            certificatePreview.showModal();
            certificatePreviewClose.focus();
        });
    });

    certificatePreviewClose.addEventListener("click", () => certificatePreview.close());
    certificatePreview.addEventListener("click", (event) => {
        if (event.target === certificatePreview) {
            certificatePreview.close();
        }
    });
    certificatePreview.addEventListener("close", () => {
        certificatePreviewFrame.removeAttribute("src");
        certificatePreviewTrigger?.focus();
    });
}

const revealElements = document.querySelectorAll(
    ".about-card, .about-details, .timeline-card, .skill-card, .project-card, .certificate-card, .contact-info, .contact-form, .hero-card"
);

revealElements.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.transitionDelay = `${index * 80}ms`;
});

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    },
    { threshold: 0.12 }
);

revealElements.forEach((element) => revealObserver.observe(element));


// ===============================
// GITHUB PROJECTS
// ===============================

async function requestPortfolioApi(path, options = {}) {
    const urls = [path];
    const localApiUrl = `http://localhost:3000${path}`;
    if (window.location.origin !== "http://localhost:3000") {
        urls.push(localApiUrl);
    }

    let lastError;
    for (const url of urls) {
        try {
            const response = await fetch(url, options);
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                return response;
            }
            lastError = new Error(
                `The server at ${url} returned a non-JSON response (${response.status}).`
            );
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(
        lastError instanceof TypeError
            ? "Could not reach the portfolio API. Run `npm start` from D:\\portfolio and open http://localhost:3000."
            : "The portfolio API route was not found. Run `npm start` from D:\\portfolio and open http://localhost:3000."
    );
}

const projectsGrid = document.getElementById("projectsGrid");
const projectsStatus = document.getElementById("projectsStatus");
const projectSearch = document.getElementById("projectSearch");
const projectLanguage = document.getElementById("projectLanguage");

if (projectsGrid && projectsStatus && projectSearch && projectLanguage) {
    let repositories = [];

    function setProjectsStatus(message, isError = false, showRetry = false) {
        projectsStatus.replaceChildren();
        projectsStatus.classList.toggle("is-error", isError);

        if (showRetry) {
            projectsStatus.append(document.createTextNode(`${message} `));
            const retryButton = document.createElement("button");
            retryButton.className = "project-retry";
            retryButton.type = "button";
            retryButton.textContent = "Try again";
            retryButton.addEventListener("click", loadRepositories);
            projectsStatus.append(retryButton);
            return;
        }

        if (!isError && message.startsWith("Loading")) {
            const spinner = document.createElement("span");
            spinner.className = "project-spinner";
            spinner.setAttribute("aria-hidden", "true");
            projectsStatus.append(spinner);
        }

        projectsStatus.append(document.createTextNode(message));
    }

    function createProjectCard(repository, index) {
        const card = document.createElement("a");
        card.className = "project-card";
        card.href = repository.html_url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.style.setProperty("--project-index", Math.min(index, 10));
        card.setAttribute("aria-label", `Open ${repository.name} on GitHub`);

        const number = document.createElement("span");
        number.className = "project-number";
        number.textContent = "GITHUB REPOSITORY";
        card.append(number);

        const title = document.createElement("h3");
        title.textContent = repository.name;
        card.append(title);

        const description = document.createElement("p");
        description.className = "project-card-summary";
        description.textContent = repository.description || "No description provided.";
        card.append(description);

        const languages = document.createElement("div");
        languages.className = "tech-tags";
        const language = document.createElement("span");
        language.textContent = repository.language || "Language not specified";
        languages.append(language);
        card.append(languages);

        const stats = document.createElement("div");
        stats.className = "project-card-stats";

        const stars = document.createElement("span");
        stars.textContent = `★ ${repository.stargazers_count.toLocaleString()} stars`;
        stats.append(stars);

        const updated = document.createElement("span");
        updated.textContent = `Updated ${new Date(repository.updated_at).toLocaleDateString()}`;
        stats.append(updated);
        card.append(stats);

        const linkLabel = document.createElement("span");
        linkLabel.className = "project-card-link";
        linkLabel.textContent = "View on GitHub ↗";
        card.append(linkLabel);

        return card;
    }

    function renderRepositories() {
        const query = projectSearch.value.trim().toLocaleLowerCase();
        const selectedLanguage = projectLanguage.value;
        const filteredRepositories = repositories.filter((repository) => {
            const searchableText = [
                repository.name,
                repository.description || "",
                repository.language || ""
            ].join(" ").toLocaleLowerCase();

            return searchableText.includes(query)
                && (!selectedLanguage || repository.language === selectedLanguage);
        });

        projectsGrid.replaceChildren();
        filteredRepositories.forEach((repository, index) => {
            projectsGrid.append(createProjectCard(repository, index));
        });

        projectsGrid.setAttribute("aria-busy", "false");
        if (filteredRepositories.length === 0) {
            const emptyState = document.createElement("p");
            emptyState.className = "project-empty";
            emptyState.textContent = repositories.length
                ? "No repositories match your search. Try another name or language."
                : "There are no public repositories to display yet.";
            projectsGrid.append(emptyState);
        }

        setProjectsStatus(
            `Showing ${filteredRepositories.length} of ${repositories.length} public repositories.`
        );
    }

    async function fetchRepositories() {
        const response = await requestPortfolioApi("/api/github/repositories", {
            headers: { Accept: "application/json" }
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(
                result.message || `The portfolio API returned an error (${response.status}).`
            );
        }

        if (!Array.isArray(result)) {
            throw new Error("The portfolio API returned an unexpected repository list.");
        }
        return result;
    }

    async function loadRepositories() {
        projectsGrid.setAttribute("aria-busy", "true");
        projectsGrid.replaceChildren();
        setProjectsStatus("Loading public repositories from GitHub...");

        try {
            const result = await fetchRepositories();

            repositories = result.filter((repository) => {
                if (!repository || typeof repository.name !== "string") {
                    return false;
                }

                try {
                    const url = new URL(repository.html_url);
                    return url.protocol === "https:" && url.hostname === "github.com";
                } catch {
                    return false;
                }
            });

            const languages = [...new Set(
                repositories
                    .map((repository) => repository.language)
                    .filter((language) => typeof language === "string" && language.length > 0)
            )].sort((first, second) => first.localeCompare(second));

            projectLanguage.replaceChildren();
            const allLanguages = document.createElement("option");
            allLanguages.value = "";
            allLanguages.textContent = "All languages";
            projectLanguage.append(allLanguages);

            languages.forEach((language) => {
                const option = document.createElement("option");
                option.value = language;
                option.textContent = language;
                projectLanguage.append(option);
            });

            renderRepositories();
        } catch (error) {
            console.error("Unable to load GitHub repositories:", error);
            projectsGrid.setAttribute("aria-busy", "false");
            setProjectsStatus(
                error instanceof Error
                    ? `Unable to load GitHub repositories. ${error.message}`
                    : "Unable to load GitHub repositories. Please try again later.",
                true,
                true
            );
        }
    }

    projectSearch.addEventListener("input", renderRepositories);
    projectLanguage.addEventListener("change", renderRepositories);
    loadRepositories();
}


// ===============================
// THEME TOGGLE
// ===============================

const themeToggle = document.getElementById("themeToggle");

function applyTheme(isLightTheme) {
    document.body.classList.toggle("light-theme", isLightTheme);

    if (themeToggle) {
        themeToggle.textContent = isLightTheme ? "☀️" : "🌙";
        themeToggle.setAttribute(
            "aria-label",
            isLightTheme ? "Switch to dark mode" : "Switch to light mode"
        );
    }

    localStorage.setItem("portfolio-theme", isLightTheme ? "light" : "dark");
}

if (themeToggle) {
    const savedTheme = localStorage.getItem("portfolio-theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const isLightTheme = savedTheme ? savedTheme === "light" : prefersLight;

    applyTheme(isLightTheme);

    themeToggle.addEventListener("click", function () {
        const shouldUseLightTheme = !document.body.classList.contains("light-theme");
        applyTheme(shouldUseLightTheme);
    });
}


// ===============================
// CONTACT FORM
// ===============================

const contactForm = document.getElementById("contactForm");

if (contactForm) {
    const formStatus = document.getElementById("formStatus");
    const sendButton = contactForm.querySelector('button[type="submit"]');

    contactForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const subject = document.getElementById("subject").value.trim();
        const message = document.getElementById("message").value.trim();

        if (!name || !email || !message) {
            formStatus.innerText = "❌ Please fill in all required fields.";
            return;
        }

        formStatus.innerText = "Sending message...";
        sendButton.disabled = true;

        try {
            const response = await requestPortfolioApi("/api/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    subject,
                    message
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                formStatus.innerText = "✅ Message sent successfully!";
                contactForm.reset();
            } else {
                formStatus.innerText = "❌ " + (result.message || "Unable to send your message. Please try again.");
            }
        } catch (error) {
            console.error(error);
            formStatus.innerText = `❌ ${error.message || "Unable to send your message. Please try again."}`;
        } finally {
            sendButton.disabled = false;
        }
    });
}


// ===============================
// FOOTER YEAR
// ===============================

const yearElement = document.getElementById("year");
if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}