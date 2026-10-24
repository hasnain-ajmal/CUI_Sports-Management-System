// home.js
// Home page: statistics, live matches, upcoming matches, latest results and announcements.

import { loadData } from "./store.js";
import { el, clear, formatDate, sortByDate, showPageError } from "./utils.js";
import { matchCard, emptyMessage } from "./components.js";
import { enableProfiles } from "./profile.js";

// draws the four statistic cards
function renderStats(data) {
    const completed = data.matches.filter(match => match.status === "completed").length;
    const activeSports = data.sports.filter(sport => sport.active).length;

    // array of [label, value, page to open] turned into clickable cards with forEach
    const stats = [
        ["Active sports", activeSports, "teams.html"],
        ["Departments", data.departments.length, "teams.html#coordinators"],
        ["Teams", data.teams.length, "teams.html"],
        ["Players", data.players.length, "teams.html#players"],
        ["Matches played", `${completed} / ${data.matches.length}`, "matches.html"]
    ];

    const box = document.getElementById("stats");
    clear(box);
    stats.forEach(([label, value, link]) => {
        const card = el("a", "stat-card stat-card-button");
        card.href = link;
        card.append(el("span", "block text-3xl font-extrabold text-[#0b1f3a]", String(value)), el("span", "block text-sm text-slate-500 mt-1", `${label} →`));
        box.append(card);
    });
}

// shows up to "limit" match cards in a box, or a message if there are none
function renderMatches(boxId, matches, data, emptyText, limit) {
    const box = document.getElementById(boxId);
    clear(box);
    if (matches.length === 0) {
        box.append(emptyMessage(emptyText));
        return;
    }
    matches.slice(0, limit).forEach(match => box.append(matchCard(match, data)));
}

// pinned announcements first, then the newest
function renderAnnouncements(announcements) {
    const box = document.getElementById("announcementList");
    clear(box);

    const sorted = [...announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
    if (sorted.length === 0) {
        box.append(emptyMessage("No announcements yet."));
        return;
    }

    sorted.forEach(item => {
        const card = el("article", `bg-white rounded-xl shadow-sm border p-5 ${item.pinned ? "border-emerald-300" : "border-slate-200"}`);
        const top = el("div", "flex items-center justify-between gap-2 mb-2");
        const date = el("time", "text-xs text-slate-500", `${formatDate(item.date)} · ${item.author || "Sports Office"}`);
        date.dateTime = item.date;
        top.append(el("h3", "font-semibold text-lg", item.title), item.pinned ? el("span", "text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5", "Pinned") : el("span"));
        card.append(top, date, el("p", "text-slate-600 mt-2", item.body));
        box.append(card);
    });
}

async function init() {
    try {
        const data = await loadData();
        enableProfiles(() => data);

        renderStats(data);

        const byDate = sortByDate(data.matches);
        renderMatches("liveList", byDate.filter(match => match.status === "live"), data, "No match is live right now.", 3);
        renderMatches("upcomingList", byDate.filter(match => match.status === "upcoming"), data, "No upcoming matches.", 4);
        renderMatches("resultsList", sortByDate(data.matches, true).filter(match => match.status === "completed"), data, "No results yet.", 4);
        renderAnnouncements(data.announcements);
    } catch (error) {
        showPageError(document.getElementById("pageError"), error);
    }
}

init();
