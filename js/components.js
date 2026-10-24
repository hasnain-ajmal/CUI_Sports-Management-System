// components.js
// Functions that build pieces of the page (cards, badges) with createElement.

import { el, formatDate, formatTime, genderLabel } from "./utils.js";
import { nameOf, findById } from "./store.js";
import { teamLink, playerLink } from "./profile.js";

// coloured badge for upcoming / live / completed
export function statusBadge(status) {
    return el("span", `badge-status badge-${status}`, status);
}

// one row of a match card: team name (clickable) on the left, score on the right
function teamRow(team, score, isWinner) {
    const row = el("div", "flex items-center justify-between gap-3 py-1");
    const name = el("span", `flex-1 ${isWinner ? "winner" : "font-medium text-slate-800"}`);
    name.append(team ? teamLink(team) : el("span", "", "—"));
    row.append(
        name,
        el("span", `text-xl tabular-nums ${isWinner ? "winner" : "font-semibold text-slate-700"}`, score === null ? "–" : String(score))
    );
    return row;
}

// short line under the teams, e.g. "CS Cricket (Men) won by 12"
function resultLine(match, data) {
    if (match.status === "upcoming") {
        return "Not started";
    }
    if (match.status === "live") {
        return "In progress";
    }
    if (match.scoreA === match.scoreB) {
        return "Match drawn";
    }
    const winner = match.scoreA > match.scoreB ? match.teamA : match.teamB;
    const margin = Math.abs(match.scoreA - match.scoreB);
    return `${nameOf(data.teams, winner)} won by ${margin}`;
}

// a full match card
export function matchCard(match, data) {
    const card = el("article", "match-card bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col");

    const top = el("div", "flex items-center justify-between text-xs text-slate-500 mb-3");
    top.append(el("span", "font-semibold uppercase tracking-wide", `${nameOf(data.sports, match.sportId)} · ${genderLabel(match.gender)}${match.league ? ` · ${match.league}` : ""}`), statusBadge(match.status));

    const done = match.status === "completed";
    const aWon = done && match.scoreA > match.scoreB;
    const bWon = done && match.scoreB > match.scoreA;

    const result = el("p", "text-sm mt-2 text-slate-600", resultLine(match, data));

    const info = el("div", "mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1");
    const time = el("time", "", `${formatDate(match.date)}, ${formatTime(match.time)}`);
    time.dateTime = `${match.date}T${match.time}`;
    info.append(time, el("span", "", nameOf(data.resources, match.resourceId)));

    card.append(
        top,
        teamRow(findById(data.teams, match.teamA), match.scoreA, aWon),
        teamRow(findById(data.teams, match.teamB), match.scoreB, bWon),
        result
    );

    // player of the match, if the admin chose one
    const star = findById(data.players, match.playerOfMatch);
    if (star) {
        const line = el("p", "text-xs mt-1 text-amber-700", "Player of the match: ");
        line.append(playerLink(star));
        card.append(line);
    }
    card.append(info);
    return card;
}

// message shown when a list is empty
export function emptyMessage(text) {
    return el("p", "text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center col-span-full", text);
}
