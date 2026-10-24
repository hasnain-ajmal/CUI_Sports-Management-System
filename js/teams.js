// teams.js
// Teams page: team cards with their players, and the department coordinators table.

import { loadData, nameOf, findById } from "./store.js";
import { el, clear, fillSelect, genderLabel, showPageError } from "./utils.js";
import { emptyMessage } from "./components.js";
import { enableProfiles, playerLink, teamLink } from "./profile.js";

const deptSelect = document.getElementById("teamDept");
const sportSelect = document.getElementById("teamSport");
const genderSelect = document.getElementById("teamGender");
const list = document.getElementById("teamList");

let data = null;

// a card for one team, with a <details> element that opens to show the players
function teamCard(team) {
    const players = data.players.filter(player => player.teamId === team.id);
    const department = findById(data.departments, team.departmentId);

    const card = el("article", "bg-white rounded-xl shadow-sm border border-slate-200 p-5");
    const tag = el("span", `text-xs font-semibold rounded-full px-2 py-0.5 ${team.gender === "female" ? "bg-pink-50 text-pink-700" : "bg-blue-50 text-blue-700"}`, genderLabel(team.gender));
    const header = el("div", "flex items-start justify-between gap-2");
    const title = el("h2", "font-bold text-lg");
    title.append(teamLink(team));
    header.append(title, tag);

    const info = el("p", "text-sm text-slate-500 mt-1", `${department ? department.name : "—"} · ${nameOf(data.sports, team.sportId)}`);
    const captain = el("p", "text-sm mt-3", `Captain: ${team.captain}`);

    const details = el("details", "mt-4 border-t border-slate-100 pt-3");
    details.append(el("summary", "cursor-pointer text-sm font-semibold text-emerald-700", `Players (${players.length})`));

    const ul = el("ul", "mt-2 space-y-1 text-sm");
    if (players.length === 0) {
        ul.append(el("li", "text-slate-500", "No players added yet."));
    }
    players.forEach(player => {
        const li = el("li", "flex justify-between gap-2");
        li.append(playerLink(player), el("span", "text-slate-500", player.role));
        ul.append(li);
    });
    details.append(ul);

    card.append(header, info, captain, details);
    return card;
}

function renderTeams() {
    const deptId = Number(deptSelect.value);
    const sportId = Number(sportSelect.value);
    const gender = genderSelect.value;

    const teams = data.teams.filter(team =>
        (!deptId || team.departmentId === deptId) &&
        (!sportId || team.sportId === sportId) &&
        (!gender || team.gender === gender)
    );

    clear(list);
    if (teams.length === 0) {
        list.append(emptyMessage("No team fits these filters."));
        return;
    }
    teams.forEach(team => list.append(teamCard(team)));
}

// "Find a player" list: every player whose name contains the search text
function renderPlayerSearch() {
    const text = document.getElementById("playerSearch").value.trim().toLowerCase();
    const list = document.getElementById("playerList");
    const players = data.players
        .filter(player => player.name.toLowerCase().includes(text))
        .sort((a, b) => a.name.localeCompare(b.name));

    clear(list);
    if (players.length === 0) {
        list.append(el("li", "text-slate-500", "No player found."));
        return;
    }
    players.forEach(player => {
        const li = el("li", "bg-white border border-slate-200 rounded-lg px-3 py-2 flex justify-between gap-2 text-sm");
        li.append(playerLink(player), el("span", "text-slate-500", nameOf(data.teams, player.teamId)));
        list.append(li);
    });
}

function renderDepartments() {
    const tbody = document.getElementById("deptBody");
    clear(tbody);
    data.departments.forEach(dept => {
        const teamCount = data.teams.filter(team => team.departmentId === dept.id).length;
        const tr = el("tr", "border-t border-slate-100");
        // the three coordinators come from the users list (only names are shown)
        const find = (type, gender) => {
            const person = data.users.find(item => item.role === "coordinator" && item.departmentId === dept.id && item.type === type && (!gender || item.gender === gender));
            return person ? person.name : "—";
        };
        [dept.name, dept.code, find("faculty"), find("student", "male"), find("student", "female"), teamCount].forEach(value => {
            tr.append(el("td", "p-3", String(value)));
        });
        tbody.append(tr);
    });
}

async function init() {
    try {
        data = await loadData();
        fillSelect(deptSelect, data.departments, dept => dept.name, "All departments");
        fillSelect(sportSelect, data.sports, sport => sport.name, "All sports");
        document.getElementById("teamFilter").addEventListener("change", renderTeams);
        renderTeams();
        renderDepartments();
        renderPlayerSearch();
        document.getElementById("playerSearch").addEventListener("input", renderPlayerSearch);
        enableProfiles(() => data);
    } catch (error) {
        showPageError(document.getElementById("pageError"), error);
    }
}

init();
