// matches.js
// Matches page: list of all matches with sport, category, status and team-name filters.

import { loadData, nameOf } from "./store.js";
import { clear, fillSelect, sortByDate, showPageError } from "./utils.js";
import { matchCard, emptyMessage } from "./components.js";
import { enableProfiles } from "./profile.js";

const sportSelect = document.getElementById("filterSport");
const genderSelect = document.getElementById("filterGender");
const statusSelect = document.getElementById("filterStatus");
const searchInput = document.getElementById("search");
const list = document.getElementById("matchList");
const countText = document.getElementById("matchCount");

let data = null;

// returns only the matches that pass every filter
function filteredMatches() {
    const sportId = Number(sportSelect.value);
    const gender = genderSelect.value;
    const status = statusSelect.value;
    const text = searchInput.value.trim().toLowerCase();

    return data.matches.filter(match => {
        const teamNames = `${nameOf(data.teams, match.teamA)} ${nameOf(data.teams, match.teamB)}`.toLowerCase();
        return (!sportId || match.sportId === sportId) &&
            (!gender || match.gender === gender) &&
            (!status || match.status === status) &&
            (!text || teamNames.includes(text));
    });
}

function render() {
    const matches = sortByDate(filteredMatches());
    clear(list);
    countText.textContent = `Showing ${matches.length} of ${data.matches.length} matches`;

    if (matches.length === 0) {
        list.append(emptyMessage("No match fits these filters."));
        return;
    }
    matches.forEach(match => list.append(matchCard(match, data)));
}

async function init() {
    try {
        data = await loadData();
        enableProfiles(() => data);
        fillSelect(sportSelect, data.sports, sport => sport.name, "All sports");

        // the home page links here with ?status=upcoming, so we read it from the URL
        const params = new URLSearchParams(location.search);
        if (["upcoming", "live", "completed"].includes(params.get("status"))) {
            statusSelect.value = params.get("status");
        }

        // one "input" listener on the form handles all four filters (event bubbling)
        document.getElementById("filterForm").addEventListener("input", render);
        document.getElementById("filterForm").addEventListener("submit", event => event.preventDefault());
        render();
    } catch (error) {
        showPageError(document.getElementById("pageError"), error);
    }
}

init();
