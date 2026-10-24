// standings-page.js
// Standings page: builds the points table for the chosen sport and category.

import { loadData, findById } from "./store.js";
import { el, clear, fillSelect, genderLabel, showPageError } from "./utils.js";
import { computeStandings, computeDepartmentTable } from "./standings.js";
import { enableProfiles, teamLink } from "./profile.js";

const sportSelect = document.getElementById("standingSport");
const genderSelect = document.getElementById("standingGender");
const tbody = document.getElementById("standingBody");

let data = null;

// one table cell
function cell(text, className = "p-3 text-center") {
    return el("td", className, String(text));
}

// team name cell; the name is a link that opens the team's record
function teamCell(teamId) {
    const td = el("td", "p-3 font-medium text-left whitespace-nowrap");
    td.append(teamLink(findById(data.teams, teamId)));
    return td;
}

// overall table of departments (all sports, men and women)
function renderDepartmentTable() {
    const rows = computeDepartmentTable(data);
    const body = document.getElementById("deptStandingBody");
    clear(body);
    rows.forEach((row, index) => {
        const tr = el("tr", `border-t border-slate-100 ${index === 0 && row.points > 0 ? "bg-amber-50" : ""}`);
        tr.append(
            cell(index + 1, "p-3 font-semibold"),
            cell(`${row.name} (${row.code})`, "p-3 font-medium text-left"),
            cell(row.teams), cell(row.played), cell(row.won), cell(row.drawn), cell(row.lost),
            cell(row.points, "p-3 text-center font-bold text-[#0b1f3a]")
        );
        body.append(tr);
    });

    // show the leader only if at least one match has been played
    const champion = document.getElementById("champion");
    if (rows.length > 0 && rows[0].points > 0) {
        champion.textContent = `Leading department: ${rows[0].name} with ${rows[0].points} points`;
        champion.classList.remove("hidden");
    }
}

function render() {
    const sportId = Number(sportSelect.value);
    const gender = genderSelect.value;
    const option = sportSelect.options[sportSelect.selectedIndex];
    const sportName = option ? option.text : "";
    document.getElementById("tableTitle").textContent = `${sportName} · ${genderLabel(gender)}`;

    const teams = data.teams.filter(team => team.sportId === sportId && team.gender === gender);
    const rows = computeStandings(teams, data.matches, data.settings);

    clear(tbody);
    if (rows.length === 0) {
        const tr = el("tr");
        const td = cell("No teams in this category yet.", "p-6 text-center text-slate-500");
        td.colSpan = 11;
        tr.append(td);
        tbody.append(tr);
        return;
    }

    rows.forEach((row, index) => {
        // the top team gets a light green background
        const tr = el("tr", `border-t border-slate-100 ${index === 0 && row.points > 0 ? "bg-emerald-50" : ""}`);

        const form = el("td", "p-3");
        row.form.forEach(result => form.append(el("span", `form-dot form-${result}`, result)));
        if (row.form.length === 0) {
            form.textContent = "—";
        }

        const difference = row.difference > 0 ? `+${row.difference}` : row.difference;
        tr.append(
            cell(index + 1, "p-3 font-semibold"),
            teamCell(row.teamId),
            cell(row.played), cell(row.won), cell(row.drawn), cell(row.lost),
            cell(row.scoreFor), cell(row.scoreAgainst), cell(difference),
            cell(row.points, "p-3 text-center font-bold text-[#0b1f3a]"),
            form
        );
        tbody.append(tr);
    });
}

async function init() {
    try {
        data = await loadData();
        const { pointsWin, pointsDraw, pointsLoss } = data.settings;
        document.getElementById("pointsRule").textContent =
            `Win = ${pointsWin} points, draw = ${pointsDraw}, loss = ${pointsLoss}. Teams with equal points are ranked by score difference. "For" means runs, goals or points, depending on the sport.`;

        // only team sports that actually have teams
        const sportsWithTeams = data.sports.filter(sport => data.teams.some(team => team.sportId === sport.id));
        fillSelect(sportSelect, sportsWithTeams, sport => sport.name);

        sportSelect.addEventListener("change", render);
        genderSelect.addEventListener("change", render);
        render();
        renderDepartmentTable();
        enableProfiles(() => data);
    } catch (error) {
        showPageError(document.getElementById("pageError"), error);
    }
}

init();
