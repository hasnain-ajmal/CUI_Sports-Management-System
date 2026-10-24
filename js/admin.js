// admin.js
// One dashboard for two kinds of user:
//   - the admin (sports office) can manage everything;
//   - a coordinator can manage only their own department. A student coordinator manages
//     only their own gender's teams; the faculty coordinator manages both men's and women's teams.
// Every change is saved to localStorage, so the public pages show it straight away.

import { loadData, saveData, resetData, findById, nameOf, currentUser, SESSION_KEY } from "./store.js";
import {
    el, clear, fillSelect, formatDate, formatTime, genderLabel, todayISO, sortByDate,
    createIdGenerator, maxId, showPageError, buildSlots, generatePassword
} from "./utils.js";
import {
    validateDepartment, validateCoordinator, validateSport, validateResource, validateTeam,
    validatePlayer, validateMatch, validateResult, validateAnnouncement
} from "./validators.js";
import { enableProfiles, playerLink, teamLink } from "./profile.js";

let data = null;
let user = null;        // the logged-in user
let isAdmin = false;

// one id generator (closure) per list, starting after the biggest id already used
const nextId = {};
const LISTS = ["departments", "sports", "teams", "players", "matches", "announcements", "resources", "users"];

// ---------- who is allowed to do what ----------

// can the logged-in user manage something of this department and gender?
function canManage(departmentId, gender) {
    if (isAdmin) {
        return true;
    }
    if (Number(departmentId) !== user.departmentId) {
        return false;
    }
    // faculty coordinator: both genders; student coordinator: only their own
    return user.type === "faculty" || gender === user.gender;
}

function myTeams() {
    return data.teams.filter(team => canManage(team.departmentId, team.gender));
}

function myPlayers() {
    return data.players.filter(player => canManage(player.departmentId, player.gender));
}

// a match is "mine" when one of my teams plays in it
function isMyMatch(match) {
    const ids = myTeams().map(team => team.id);
    return ids.includes(match.teamA) || ids.includes(match.teamB);
}

// the categories this user may choose in the forms
function allowedGenders() {
    return isAdmin || user.type === "faculty" ? ["male", "female"] : [user.gender];
}

// e.g. "Faculty coordinator" or "Student coordinator (male)"
function roleLabel(person) {
    if (person.role === "admin") {
        return "Admin";
    }
    return person.type === "faculty" ? "Faculty coordinator" : `Student coordinator (${person.gender})`;
}

function managesLabel(person) {
    return person.type === "faculty" ? "Men's and women's teams" : `${genderLabel(person.gender)}'s teams`;
}

// ---------- small helpers ----------

function notify(text, success = true) {
    const toast = document.getElementById("toast");
    document.getElementById("toastText").textContent = text;
    toast.classList.toggle("text-bg-success", success);
    toast.classList.toggle("text-bg-danger", !success);
    if (typeof bootstrap !== "undefined") {
        bootstrap.Toast.getOrCreateInstance(toast).show();
    }
}

// reads every field of a form into an object, with spaces trimmed
function readForm(form) {
    const fields = {};
    for (const [name, value] of new FormData(form)) {
        fields[name] = value.trim();
    }
    return fields;
}

// writes each error under its field and adds Bootstrap's red border
function showErrors(form, errors) {
    form.querySelectorAll("[data-error-for]").forEach(box => {
        const field = box.dataset.errorFor;
        box.textContent = errors[field] || "";
        const input = form.elements[field];
        if (input && input.classList) {
            input.classList.toggle("is-invalid", Boolean(errors[field]));
        }
    });
    const firstWrong = form.elements[Object.keys(errors)[0]];
    if (firstWrong && firstWrong.focus) {
        firstWrong.focus();
    }
    return Object.keys(errors).length === 0;
}

function saveAndRender(message) {
    if (!saveData(data)) {
        notify("Could not save the change in this browser.", false);
        return;
    }
    renderAll();
    notify(message);
}

// a small button in a table; one listener for the whole page handles all of them
function actionButton(label, action, id, style = "btn-outline-danger") {
    const button = el("button", `btn btn-sm ${style} ms-1`, label);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
}

// one table row; values can be text or elements, the last cell holds the buttons
function tableRow(values, buttons) {
    const tr = el("tr");
    values.forEach(value => {
        const td = el("td");
        if (value instanceof Node) {
            td.append(value);
        } else {
            td.textContent = String(value);
        }
        tr.append(td);
    });
    const actions = el("td", "text-end text-nowrap");
    if (buttons.length === 0) {
        actions.append(el("span", "text-secondary small", "View only"));
    }
    actions.append(...buttons);
    tr.append(actions);
    return tr;
}

function emptyRow(tbody, columns, text) {
    const tr = el("tr");
    const td = el("td", "text-center text-secondary py-4", text);
    td.colSpan = columns;
    tr.append(td);
    tbody.append(tr);
}

function setCount(id, number) {
    document.getElementById(id).textContent = `${number}`;
}

function statusBadge(status) {
    const colours = { upcoming: "text-bg-primary", live: "text-bg-danger", completed: "text-bg-success" };
    return el("span", `badge ${colours[status]}`, status);
}

function matchTitle(match) {
    return `${nameOf(data.teams, match.teamA)} vs ${nameOf(data.teams, match.teamB)}`;
}

// ---------- time slots ----------

// the slots of a ground that are still free on a date (past times of today are not offered)
function freeSlots(resource, date) {
    const booked = data.matches.filter(match => match.resourceId === resource.id && match.date === date).map(match => match.time);
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return buildSlots(resource).filter(slot => !booked.includes(slot) && !(date === todayISO() && slot <= nowTime));
}

// ---------- sections (sidebar and overview cards) ----------

function showSection(name) {
    const section = document.getElementById(name);
    const allowed = section && section.classList.contains("admin-section") &&
        (isAdmin || !document.querySelector(`#sectionNav [data-section="${name}"][data-role="admin"]`));
    if (!allowed) {
        name = "overview";
    }
    document.querySelectorAll(".admin-section").forEach(item => item.classList.toggle("d-none", item.id !== name));
    document.querySelectorAll("#sectionNav .nav-link").forEach(link => {
        const isActive = link.dataset.section === name;
        link.classList.toggle("active", isActive);
        link.setAttribute("aria-current", isActive ? "page" : "false");
    });
    // remember the section in the address bar; some embedded viewers block this, so it is optional
    try {
        history.replaceState(null, "", `#${name}`);
    } catch (error) {
        // ignore: the section is already shown
    }
}

document.addEventListener("click", event => {
    const link = event.target.closest("[data-section]");
    if (!link) {
        return;
    }
    showSection(link.dataset.section);
    // the Upcoming / Live / Completed cards also set the match filter
    if (link.dataset.status !== undefined) {
        document.getElementById("matchStatusFilter").value = link.dataset.status;
        renderMatches();
    }
    // on phones the sidebar sits above the content, so scroll down to the section
    if (window.innerWidth < 768) {
        document.getElementById(link.dataset.section).scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        window.scrollTo(0, 0);
    }
});

// ---------- drawing ----------

function renderOverview() {
    const myMatches = isAdmin ? data.matches : data.matches.filter(isMyMatch);
    const count = status => myMatches.filter(match => match.status === status).length;
    document.getElementById("overviewText").textContent = isAdmin
        ? `${data.settings.season} · ${data.settings.university}`
        : `${nameOf(data.departments, user.departmentId)} · ${managesLabel(user)}`;

    // [label, value, section to open, match status filter]
    const stats = isAdmin
        ? [["Departments", data.departments.length, "departments"], ["Coordinators", data.users.filter(item => item.role === "coordinator").length, "coordinators"],
            ["Teams", data.teams.length, "teams"], ["Players", data.players.length, "players"]]
        : [["My teams", myTeams().length, "teams"], ["My players", myPlayers().length, "players"]];
    stats.push(["Upcoming", count("upcoming"), "matches", "upcoming"], ["Live", count("live"), "matches", "live"], ["Completed", count("completed"), "matches", "completed"]);

    const box = document.getElementById("overviewStats");
    clear(box);
    stats.forEach(([label, value, section, status]) => {
        const card = el("button", "stat-card stat-card-button text-start");
        card.type = "button";
        card.dataset.section = section;
        if (status) {
            card.dataset.status = status;
        }
        card.append(el("span", "d-block fs-2 fw-bold", String(value)), el("span", "d-block text-secondary small", `${label} →`));
        box.append(card);
    });

    const today = todayISO();
    const pending = sortByDate(data.matches.filter(match => match.date < today && match.status !== "completed"));
    const pendingList = document.getElementById("pendingList");
    clear(pendingList);
    if (pending.length === 0) {
        pendingList.append(el("li", "list-group-item text-secondary", "All results are up to date."));
    }
    pending.forEach(match => {
        const li = el("li", "list-group-item d-flex justify-content-between align-items-center gap-2");
        li.append(el("span", "", `${formatDate(match.date)}: ${matchTitle(match)}`), actionButton("Enter result", "result", match.id, "btn-success"));
        pendingList.append(li);
    });

    document.getElementById("nextTitle").textContent = isAdmin ? "Next matches" : "My next matches";
    const next = sortByDate(myMatches.filter(match => match.status !== "completed" && match.date >= today)).slice(0, 5);
    const nextList = document.getElementById("nextList");
    clear(nextList);
    if (next.length === 0) {
        nextList.append(el("li", "list-group-item text-secondary", "No matches scheduled."));
    }
    next.forEach(match => {
        const li = el("li", "list-group-item");
        li.append(
            el("div", "fw-semibold", matchTitle(match)),
            el("div", "small text-secondary", `${formatDate(match.date)}, ${formatTime(match.time)} · ${nameOf(data.resources, match.resourceId)}`)
        );
        nextList.append(li);
    });
}

// name of the coordinator in one place of a department, or a dash
function coordinatorName(deptId, type, gender = null) {
    const person = data.users.find(item =>
        item.role === "coordinator" && item.departmentId === deptId && item.type === type && (!gender || item.gender === gender)
    );
    return person ? person.name : "—";
}

function renderDepartments() {
    const tbody = document.getElementById("departmentBody");
    clear(tbody);
    setCount("departmentCount", data.departments.length);
    if (data.departments.length === 0) {
        emptyRow(tbody, 7, "No departments yet.");
    }
    data.departments.forEach(dept => {
        const teams = data.teams.filter(team => team.departmentId === dept.id).length;
        tbody.append(tableRow([
            dept.name, dept.code, coordinatorName(dept.id, "faculty"),
            coordinatorName(dept.id, "student", "male"), coordinatorName(dept.id, "student", "female"), teams
        ], [actionButton("Delete", "delete", dept.id)]));
    });
}

function renderCoordinators() {
    const tbody = document.getElementById("coordinatorBody");
    const coordinators = data.users
        .filter(item => item.role === "coordinator")
        .sort((a, b) => nameOf(data.departments, a.departmentId).localeCompare(nameOf(data.departments, b.departmentId)) || a.type.localeCompare(b.type));
    clear(tbody);
    setCount("coordinatorCount", coordinators.length);
    if (coordinators.length === 0) {
        emptyRow(tbody, 6, "No coordinators yet.");
    }
    coordinators.forEach(person => {
        const dept = findById(data.departments, person.departmentId);
        tbody.append(tableRow([
            dept ? dept.code : "—", roleLabel(person), person.name, el("code", "", person.username), managesLabel(person)
        ], [
            actionButton("Reset password", "resetpw", person.id, "btn-outline-secondary"),
            actionButton("Delete", "delete", person.id)
        ]));
    });
}

function renderSports() {
    const tbody = document.getElementById("sportBody");
    clear(tbody);
    setCount("sportCount", data.sports.length);
    data.sports.forEach(sport => {
        const teams = data.teams.filter(team => team.sportId === sport.id).length;
        const grounds = data.resources.filter(resource => resource.sportIds.includes(sport.id)).length;
        const status = el("span", `badge ${sport.active ? "text-bg-success" : "text-bg-secondary"}`, sport.active ? "Active" : "Inactive");
        tbody.append(tableRow([sport.name, sport.type, teams, grounds, status], [
            actionButton(sport.active ? "Deactivate" : "Activate", "toggle", sport.id, "btn-outline-secondary"),
            actionButton("Delete", "delete", sport.id)
        ]));
    });
}

function renderResources() {
    const tbody = document.getElementById("resourceBody");
    clear(tbody);
    setCount("resourceCount", data.resources.length);
    if (data.resources.length === 0) {
        emptyRow(tbody, 7, "No grounds yet.");
    }
    data.resources.forEach(resource => {
        const sports = resource.sportIds.map(id => nameOf(data.sports, id)).join(", ");
        const status = el("span", `badge ${resource.active ? "text-bg-success" : "text-bg-secondary"}`, resource.active ? "Open" : "Closed");
        const buttons = isAdmin ? [
            actionButton(resource.active ? "Close" : "Open", "toggle", resource.id, "btn-outline-secondary"),
            actionButton("Delete", "delete", resource.id)
        ] : [];
        tbody.append(tableRow([
            resource.name, resource.category, sports, `${formatTime(resource.openTime)} – ${formatTime(resource.closeTime)}`,
            `${buildSlots(resource).length} × ${resource.slotMinutes} min`, status
        ], buttons));
    });
    renderAvailability();
}

// one row per ground with its free (green) and booked (red) slots for the chosen date
function renderAvailability() {
    const date = document.getElementById("slotDate").value || todayISO();
    const category = document.getElementById("slotCategory").value;
    const box = document.getElementById("availabilityList");
    const resources = data.resources.filter(resource => resource.active && (!category || resource.category === category));

    clear(box);
    if (resources.length === 0) {
        box.append(el("p", "text-secondary mb-0", "No open grounds in this category."));
    }
    resources.forEach(resource => {
        const row = el("div", "slot-row");
        const name = el("div", "slot-name");
        const free = freeSlots(resource, date).length;
        name.append(el("strong", "", resource.name), el("span", "", `${resource.category} · ${free} free`));

        const chips = el("div", "slot-chips");
        buildSlots(resource).forEach(slot => {
            const match = data.matches.find(item => item.resourceId === resource.id && item.date === date && item.time === slot);
            if (match) {
                const chip = el("span", "slot slot-booked", `${formatTime(slot)} · ${nameOf(data.teams, match.teamA).split(" ")[0]} v ${nameOf(data.teams, match.teamB).split(" ")[0]}`);
                chip.title = matchTitle(match);
                chips.append(chip);
            } else {
                chips.append(el("span", "slot slot-free", formatTime(slot)));
            }
        });
        row.append(name, chips);
        box.append(row);
    });
}

function renderTeams() {
    const tbody = document.getElementById("teamBody");
    const teams = isAdmin ? data.teams : myTeams();
    document.getElementById("teamTableTitle").textContent = isAdmin ? "All teams" : "My teams";
    clear(tbody);
    setCount("teamCount", teams.length);
    if (teams.length === 0) {
        emptyRow(tbody, 7, "No teams yet.");
    }
    teams.forEach(team => {
        const players = data.players.filter(player => player.teamId === team.id).length;
        tbody.append(tableRow([
            teamLink(team), nameOf(data.departments, team.departmentId), nameOf(data.sports, team.sportId),
            genderLabel(team.gender), team.captain, players
        ], [actionButton("Delete", "delete", team.id)]));
    });
}

function renderPlayers() {
    const tbody = document.getElementById("playerBody");
    const text = document.getElementById("playerSearch").value.trim().toLowerCase();
    const players = (isAdmin ? data.players : myPlayers()).filter(player =>
        player.name.toLowerCase().includes(text) || player.regNo.toLowerCase().includes(text)
    );
    clear(tbody);
    setCount("playerCount", players.length);
    if (players.length === 0) {
        emptyRow(tbody, 6, text ? "No player matches your search." : "No players yet.");
    }
    players.forEach(player => {
        const department = findById(data.departments, player.departmentId);
        tbody.append(tableRow([
            playerLink(player), player.regNo, department ? department.code : "—", nameOf(data.teams, player.teamId), player.role
        ], [actionButton("Delete", "delete", player.id)]));
    });
}

// everyone sees the full schedule (to avoid clashes); buttons depend on the role
function renderMatches() {
    const tbody = document.getElementById("matchBody");
    const status = document.getElementById("matchStatusFilter").value;
    const matches = sortByDate(data.matches.filter(match => !status || match.status === status));
    clear(tbody);
    setCount("matchCount", matches.length);
    if (matches.length === 0) {
        emptyRow(tbody, 7, "No matches here.");
    }
    matches.forEach(match => {
        const score = match.status === "upcoming" ? "—" : `${match.scoreA} : ${match.scoreB}`;
        const buttons = [];
        if (isAdmin) {
            buttons.push(actionButton(match.status === "upcoming" ? "Start / result" : "Edit result", "result", match.id, "btn-outline-success"));
        }
        if (isAdmin || (isMyMatch(match) && match.status === "upcoming")) {
            buttons.push(actionButton("Delete", "delete", match.id));
        }
        tbody.append(tableRow([
            el("span", "text-nowrap", `${formatDate(match.date)}, ${formatTime(match.time)}`),
            `${nameOf(data.sports, match.sportId)} (${genderLabel(match.gender)})`,
            matchTitle(match),
            nameOf(data.resources, match.resourceId),
            el("span", "text-nowrap", score),
            statusBadge(match.status)
        ], buttons));
    });
}

function renderAnnouncements() {
    const tbody = document.getElementById("announcementBody");
    const list = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date));
    clear(tbody);
    setCount("announcementCount", list.length);
    if (list.length === 0) {
        emptyRow(tbody, 5, "No announcements yet.");
    }
    list.forEach(item => {
        const buttons = [];
        if (isAdmin) {
            buttons.push(actionButton(item.pinned ? "Unpin" : "Pin", "pin", item.id, "btn-outline-secondary"));
        }
        // coordinators can delete only what they posted
        if (isAdmin || item.postedBy === user.id) {
            buttons.push(actionButton("Delete", "delete", item.id));
        }
        tbody.append(tableRow([formatDate(item.date), item.title, item.author || "Sports Office", item.pinned ? "Yes" : "No"], buttons));
    });
}

// category dropdown for men / women, limited to what this user may choose
function fillGenderSelect(select, maleText, femaleText) {
    clear(select);
    const genders = allowedGenders();
    if (genders.length > 1) {
        select.append(new Option("Choose", ""));
    }
    genders.forEach(gender => select.append(new Option(gender === "male" ? maleText : femaleText, gender)));
}

function fillFormSelects() {
    const activeSports = data.sports.filter(sport => sport.active);
    // coordinators can only pick their own department
    const departments = isAdmin ? data.departments : data.departments.filter(dept => dept.id === user.departmentId);
    const firstDept = isAdmin ? "Choose department" : "";

    fillSelect(document.getElementById("coordDepartment"), data.departments, dept => `${dept.name} (${dept.code})`, "Choose department");
    fillSelect(document.getElementById("teamDepartment"), departments, dept => `${dept.name} (${dept.code})`, firstDept);
    fillSelect(document.getElementById("playerDepartment"), departments, dept => `${dept.name} (${dept.code})`, firstDept);
    fillSelect(document.getElementById("teamSportSelect"), activeSports, sport => sport.name, "Choose sport");
    fillSelect(document.getElementById("matchSport"), activeSports, sport => sport.name, "Choose sport");
    fillGenderSelect(document.getElementById("teamGenderSelect"), "Men", "Women");
    fillGenderSelect(document.getElementById("matchGender"), "Men", "Women");
    fillGenderSelect(document.getElementById("playerGender"), "Male", "Female");

    // sports checkboxes in the "Add ground" form
    const sportBox = document.getElementById("resSports");
    clear(sportBox);
    data.sports.forEach(sport => {
        const wrap = el("div", "form-check");
        const input = el("input", "form-check-input");
        input.type = "checkbox";
        input.name = "sports";
        input.value = sport.id;
        input.id = `resSport${sport.id}`;
        const label = el("label", "form-check-label", sport.name);
        label.htmlFor = input.id;
        wrap.append(input, label);
        sportBox.append(wrap);
    });

    // categories already used, without repeats (Set removes duplicates)
    const categories = [...new Set(data.resources.map(resource => resource.category))].sort();
    const datalist = document.getElementById("categoryList");
    clear(datalist);
    categories.forEach(category => datalist.append(new Option(category)));
    const slotCategory = document.getElementById("slotCategory");
    const chosen = slotCategory.value;
    clear(slotCategory);
    slotCategory.append(new Option("All", ""));
    categories.forEach(category => slotCategory.append(new Option(category, category)));
    slotCategory.value = categories.includes(chosen) ? chosen : "";

    fillPlayerTeams();
    fillMatchTeams();
}

// player form: only teams of the chosen department and gender
function fillPlayerTeams() {
    const deptId = Number(document.getElementById("playerDepartment").value);
    const gender = document.getElementById("playerGender").value;
    const teams = data.teams.filter(team => team.departmentId === deptId && team.gender === gender);
    const firstText = deptId && gender ? (teams.length ? "Choose team" : "No team for this department and gender") : "Choose department and gender first";
    fillSelect(document.getElementById("playerTeam"), teams, team => team.name, firstText);
}

// match form: team A must be the user's own team, team B can be any team of the same sport and category
function fillMatchTeams() {
    const sportId = Number(document.getElementById("matchSport").value);
    const gender = document.getElementById("matchGender").value;
    const sameSport = data.teams.filter(team => team.sportId === sportId && team.gender === gender);
    const firstText = sportId && gender ? "Choose team" : "Choose sport and category first";
    fillSelect(document.getElementById("matchTeamA"), sameSport.filter(team => canManage(team.departmentId, team.gender)), team => team.name, firstText);
    fillSelect(document.getElementById("matchTeamB"), sameSport, team => team.name, firstText);

    // grounds where this sport can be played
    const grounds = data.resources.filter(resource => resource.active && resource.sportIds.includes(sportId));
    fillSelect(document.getElementById("matchResource"), grounds, resource => resource.name, sportId ? (grounds.length ? "Choose ground" : "No ground for this sport") : "Choose sport first");
    fillMatchSlots();
}

// free slots of the chosen ground on the chosen date
function fillMatchSlots() {
    const resource = findById(data.resources, document.getElementById("matchResource").value);
    const date = document.getElementById("matchDate").value;
    const select = document.getElementById("matchTime");
    clear(select);
    if (!resource || !date) {
        select.append(new Option("Choose ground and date first", ""));
        return;
    }
    const slots = freeSlots(resource, date);
    select.append(new Option(slots.length ? `Choose (${slots.length} free)` : "No free slot on this day", ""));
    slots.forEach(slot => select.append(new Option(formatTime(slot), slot)));
}

function renderAll() {
    renderOverview();
    if (isAdmin) {
        renderDepartments();
        renderCoordinators();
        renderSports();
    }
    renderResources();
    renderTeams();
    renderPlayers();
    renderMatches();
    renderAnnouncements();
    fillFormSelects();
}

// ---------- login details pop-up ----------

function showCredentials(person, password) {
    const loginPage = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}login.html`;
    document.getElementById("credName").textContent = person.name;
    document.getElementById("credRole").textContent = `${roleLabel(person)}, ${nameOf(data.departments, person.departmentId)}`;
    document.getElementById("credUsername").textContent = person.username;
    document.getElementById("credPassword").textContent = password;
    document.getElementById("credMessage").value =
        `Assalam o Alaikum ${person.name},\nYou are now the ${roleLabel(person).toLowerCase()} of ${nameOf(data.departments, person.departmentId)} for ${data.settings.season}.\nLogin page: ${loginPage}\nUsername: ${person.username}\nPassword: ${password}`;
    document.getElementById("copyStatus").textContent = "";
    if (typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(document.getElementById("credentialsModal")).show();
    }
}

document.getElementById("copyCredentials").addEventListener("click", async () => {
    const box = document.getElementById("credMessage");
    const status = document.getElementById("copyStatus");
    try {
        await navigator.clipboard.writeText(box.value);
        status.textContent = "Copied. Paste it in WhatsApp or email.";
    } catch (error) {
        // some browsers block the clipboard: select the text so the user can press Ctrl+C
        box.select();
        status.textContent = "Text selected. Press Ctrl+C to copy.";
    }
});

// ---------- forms ----------

document.getElementById("departmentForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    fields.code = fields.code.toUpperCase();
    if (!showErrors(form, validateDepartment(fields, data.departments))) {
        return;
    }
    data.departments.push({ id: nextId.departments(), name: fields.name, code: fields.code });
    form.reset();
    saveAndRender(`Department "${fields.name}" added. Now add its coordinators.`);
});

document.getElementById("coordinatorForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    if (!showErrors(form, validateCoordinator(fields, data.users))) {
        return;
    }
    const dept = findById(data.departments, fields.departmentId);
    // username like cs.faculty, cs.student.m or cs.student.f
    const username = fields.type === "faculty" ? `${dept.code.toLowerCase()}.faculty` : `${dept.code.toLowerCase()}.student.${fields.gender[0]}`;
    const password = generatePassword();
    const person = {
        id: nextId.users(),
        username,
        password,
        name: fields.name,
        role: "coordinator",
        type: fields.type,
        gender: fields.gender,
        departmentId: dept.id
    };
    data.users.push(person);
    form.reset();
    saveAndRender(`Login created for ${person.name}.`);
    showCredentials(person, password);
});

document.getElementById("sportForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    if (!showErrors(form, validateSport(fields, data.sports))) {
        return;
    }
    data.sports.push({ id: nextId.sports(), name: fields.name, type: fields.type, active: form.elements.active.checked });
    form.reset();
    saveAndRender(`Sport "${fields.name}" added.`);
});

document.getElementById("resourceForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    const sportIds = [...form.querySelectorAll("input[name=sports]:checked")].map(box => Number(box.value));
    if (!showErrors(form, validateResource(fields, sportIds, data.resources))) {
        return;
    }
    // "How many" = 3 creates "Name 1", "Name 2", "Name 3"
    const count = Number(fields.count);
    for (let i = 1; i <= count; i++) {
        data.resources.push({
            id: nextId.resources(),
            name: count === 1 ? fields.name : `${fields.name} ${i}`,
            category: fields.category,
            sportIds,
            openTime: fields.openTime,
            closeTime: fields.closeTime,
            slotMinutes: Number(fields.slotMinutes),
            active: true
        });
    }
    form.reset();
    saveAndRender(count === 1 ? `"${fields.name}" added.` : `${count} × "${fields.name}" added.`);
});

document.getElementById("teamForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    const errors = validateTeam(fields, data.teams);
    if (!errors.departmentId && !errors.gender && !canManage(fields.departmentId, fields.gender)) {
        errors.departmentId = "You can only add teams for your own department and category.";
    }
    if (!showErrors(form, errors)) {
        return;
    }
    const dept = findById(data.departments, fields.departmentId);
    const sport = findById(data.sports, fields.sportId);
    const team = {
        id: nextId.teams(),
        name: `${dept.code} ${sport.name} (${genderLabel(fields.gender)})`,
        departmentId: dept.id,
        sportId: sport.id,
        gender: fields.gender,
        captain: fields.captain
    };
    data.teams.push(team);
    form.reset();
    saveAndRender(`Team "${team.name}" added.`);
});

document.getElementById("playerForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    fields.regNo = fields.regNo.toUpperCase();
    const errors = validatePlayer(fields, data.players, data.teams);
    if (!errors.departmentId && !errors.gender && !canManage(fields.departmentId, fields.gender)) {
        errors.departmentId = "You can only add players for your own department and category.";
    }
    if (!showErrors(form, errors)) {
        return;
    }
    const player = {
        id: nextId.players(),
        name: fields.name,
        regNo: fields.regNo,
        gender: fields.gender,
        departmentId: Number(fields.departmentId),
        teamId: Number(fields.teamId),
        role: fields.role
    };
    data.players.push(player);
    // a new captain also becomes the team's captain
    if (player.role === "Captain") {
        findById(data.teams, player.teamId).captain = player.name;
    }
    form.reset();
    saveAndRender(`Player "${player.name}" added.`);
});

document.getElementById("matchForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    const resource = findById(data.resources, fields.resourceId);
    const slots = resource && fields.date ? freeSlots(resource, fields.date) : [];
    const errors = validateMatch(fields, data.teams, data.resources, todayISO(), data.matches, slots);
    const teamA = findById(data.teams, fields.teamA);
    if (!errors.teamA && teamA && !canManage(teamA.departmentId, teamA.gender)) {
        errors.teamA = "Team A must be one of your own teams.";
    }
    if (!showErrors(form, errors)) {
        return;
    }
    data.matches.push({
        id: nextId.matches(),
        sportId: Number(fields.sportId),
        gender: fields.gender,
        teamA: Number(fields.teamA),
        teamB: Number(fields.teamB),
        resourceId: resource.id,
        date: fields.date,
        time: fields.time,
        status: "upcoming",
        scoreA: null,
        scoreB: null,
        playerOfMatch: null,
        createdBy: user.id
    });
    form.reset();
    saveAndRender(`Match booked at ${resource.name}, ${formatDate(fields.date)} ${formatTime(fields.time)}.`);
});

document.getElementById("announcementForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const fields = readForm(form);
    if (!showErrors(form, validateAnnouncement(fields))) {
        return;
    }
    const dept = findById(data.departments, user.departmentId);
    data.announcements.push({
        id: nextId.announcements(),
        title: fields.title,
        body: fields.body,
        date: todayISO(),
        pinned: isAdmin && form.elements.pinned.checked,
        author: isAdmin ? "Sports Office" : `${dept.code} ${roleLabel(user).toLowerCase()}`,
        postedBy: user.id
    });
    form.reset();
    document.getElementById("annCount").textContent = "0 / 500";
    saveAndRender("Announcement posted.");
});

// clear old error messages on reset, then refill the dependent dropdowns
document.querySelectorAll("main form").forEach(form => {
    form.addEventListener("reset", () => {
        showErrors(form, {});
        setTimeout(() => {
            fillPlayerTeams();
            fillMatchTeams();
        });
    });
});

// dropdowns that depend on other dropdowns
document.getElementById("playerDepartment").addEventListener("change", fillPlayerTeams);
document.getElementById("playerGender").addEventListener("change", fillPlayerTeams);
document.getElementById("matchSport").addEventListener("change", fillMatchTeams);
document.getElementById("matchGender").addEventListener("change", fillMatchTeams);
document.getElementById("matchResource").addEventListener("change", fillMatchSlots);
document.getElementById("matchDate").addEventListener("change", fillMatchSlots);
document.getElementById("slotDate").addEventListener("change", renderAvailability);
document.getElementById("slotCategory").addEventListener("change", renderAvailability);
document.getElementById("playerSearch").addEventListener("input", renderPlayers);
document.getElementById("matchStatusFilter").addEventListener("change", renderMatches);
document.getElementById("annBody").addEventListener("input", event => {
    document.getElementById("annCount").textContent = `${event.target.value.length} / 500`;
});

// ---------- result pop-up (admin) ----------

const resultForm = document.getElementById("resultForm");

function openResult(matchId) {
    const match = findById(data.matches, matchId);
    resultForm.dataset.matchId = match.id;
    document.getElementById("resultMatchInfo").textContent =
        `${nameOf(data.sports, match.sportId)} (${genderLabel(match.gender)}) · ${formatDate(match.date)} · ${nameOf(data.resources, match.resourceId)}`;
    document.getElementById("scoreALabel").textContent = nameOf(data.teams, match.teamA);
    document.getElementById("scoreBLabel").textContent = nameOf(data.teams, match.teamB);
    resultForm.elements.scoreA.value = match.scoreA === null ? 0 : match.scoreA;
    resultForm.elements.scoreB.value = match.scoreB === null ? 0 : match.scoreB;
    resultForm.elements.status.value = match.status === "completed" ? "completed" : "live";

    // player of the match: only players of the two teams
    const pomSelect = document.getElementById("resultPom");
    const squad = data.players.filter(player => player.teamId === match.teamA || player.teamId === match.teamB);
    fillSelect(pomSelect, squad, player => `${player.name} (${nameOf(data.teams, player.teamId)})`, "Not chosen");
    pomSelect.value = match.playerOfMatch ? String(match.playerOfMatch) : "";
    showErrors(resultForm, {});

    if (typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(document.getElementById("resultModal")).show();
    }
}

resultForm.addEventListener("submit", event => {
    event.preventDefault();
    const fields = readForm(resultForm);
    const match = findById(data.matches, resultForm.dataset.matchId);
    const squadIds = data.players.filter(player => player.teamId === match.teamA || player.teamId === match.teamB).map(player => player.id);
    if (!showErrors(resultForm, validateResult(fields, squadIds))) {
        return;
    }
    match.scoreA = Number(fields.scoreA);
    match.scoreB = Number(fields.scoreB);
    match.status = fields.status;
    match.playerOfMatch = fields.playerOfMatch ? Number(fields.playerOfMatch) : null;
    if (typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(document.getElementById("resultModal")).hide();
    }
    saveAndRender(match.status === "completed" ? "Result saved. The points table is updated." : "Live score updated.");
});

// ---------- table buttons (event delegation) ----------

// a reason why an item cannot be deleted, or "" if it can
function deleteBlocker(listName, id) {
    if (listName === "departments" && data.teams.some(team => team.departmentId === id)) {
        return "This department still has teams. Delete its teams first.";
    }
    if (listName === "departments" && data.users.some(person => person.departmentId === id)) {
        return "This department still has coordinators. Delete their accounts first.";
    }
    if (listName === "sports" && data.teams.some(team => team.sportId === id)) {
        return "Teams still play this sport. Delete those teams first.";
    }
    if (listName === "resources" && data.matches.some(match => match.resourceId === id)) {
        return "Matches are booked here. Close it instead, or delete those matches first.";
    }
    if (listName === "teams" && data.matches.some(match => match.teamA === id || match.teamB === id)) {
        return "This team has matches. Delete its matches first.";
    }
    if (listName === "teams" && data.players.some(player => player.teamId === id)) {
        return "This team still has players. Delete its players first.";
    }
    return "";
}

// is the logged-in user allowed to delete this item? (the buttons are hidden too, but we check again)
function canDelete(listName, item) {
    if (isAdmin) {
        return listName !== "users" || item.role !== "admin";
    }
    if (listName === "teams" || listName === "players") {
        return canManage(item.departmentId, item.gender);
    }
    if (listName === "matches") {
        return isMyMatch(item) && item.status === "upcoming";
    }
    if (listName === "announcements") {
        return item.postedBy === user.id;
    }
    return false;
}

document.querySelector("main").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }
    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const holder = button.closest("[data-list]");
    const listName = holder ? holder.dataset.list : "matches";

    if (action === "result" && isAdmin) {
        openResult(id);
        return;
    }
    if (action === "toggle" && isAdmin) {
        const item = findById(data[listName], id);
        item.active = !item.active;
        saveAndRender(`${item.name} is now ${item.active ? "active" : "closed"}.`);
        return;
    }
    if (action === "pin" && isAdmin) {
        const item = findById(data.announcements, id);
        item.pinned = !item.pinned;
        saveAndRender(item.pinned ? "Announcement pinned." : "Announcement unpinned.");
        return;
    }
    if (action === "resetpw" && isAdmin) {
        const person = findById(data.users, id);
        const password = generatePassword();
        person.password = password;
        saveAndRender(`New password made for ${person.name}.`);
        showCredentials(person, password);
        return;
    }
    if (action === "delete") {
        const item = findById(data[listName], id);
        if (!item || !canDelete(listName, item)) {
            notify("You are not allowed to delete this.", false);
            return;
        }
        const blocker = deleteBlocker(listName, id);
        if (blocker) {
            notify(blocker, false);
            return;
        }
        if (!confirm("Delete this item? This cannot be undone.")) {
            return;
        }
        data[listName] = data[listName].filter(entry => entry.id !== id);
        saveAndRender("Deleted.");
    }
});

// ---------- logout and reset ----------

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.href = "login.html";
});

document.getElementById("resetButton").addEventListener("click", () => {
    if (isAdmin && confirm("Remove all changes and load the original demo data again?")) {
        resetData();
        location.reload();
    }
});

// ---------- start ----------

async function init() {
    ["deptCode", "playerRegNo"].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener("input", () => {
            input.value = input.value.toUpperCase();
        });
    });

    try {
        data = await loadData();
        user = currentUser(data);
        if (!user) {
            // the account was deleted, or the session is old
            sessionStorage.removeItem(SESSION_KEY);
            location.replace("login.html");
            return;
        }
        isAdmin = user.role === "admin";

        // coordinators do not see admin-only buttons, sections and fields
        if (!isAdmin) {
            document.querySelectorAll("[data-role=admin]").forEach(item => item.classList.add("d-none"));
            document.getElementById("nextCol").className = "col-12";
            document.getElementById("portalName").textContent = "Coordinator Portal";
            document.getElementById("portalScope").textContent = `${nameOf(data.departments, user.departmentId)} · ${managesLabel(user)}`;
            document.title = "Coordinator Portal | CUI Sports";
            document.getElementById("teamsText").textContent = `Your department's ${managesLabel(user).toLowerCase()}. Captains are set when you add players.`;
            document.getElementById("matchesText").textContent = "Book a free slot for one of your teams. The full schedule is below so you can see what is already taken.";
        }
        document.getElementById("userName").textContent = `${user.name} (${roleLabel(user)})`;

        LISTS.forEach(name => {
            nextId[name] = createIdGenerator(maxId(data[name]) + 1);
        });
        document.getElementById("matchDate").min = todayISO();
        document.getElementById("slotDate").value = todayISO();

        renderAll();
        enableProfiles(() => data, { showPrivate: true });
        showSection(location.hash.slice(1) || "overview");
    } catch (error) {
        showPageError(document.getElementById("pageError"), error);
    }
}

init();
