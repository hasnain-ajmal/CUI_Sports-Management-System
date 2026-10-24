// profile.js
// Clicking a player or team name (anywhere it is shown as a link) opens a pop-up with
// that person's or team's full record. Works on the Tailwind pages and the Bootstrap admin page,
// because it uses the HTML <dialog> element and our own CSS classes from style.css.

import { el, clear, formatDate, genderLabel } from "./utils.js";
import { findById, nameOf } from "./store.js";
import { teamHistory, resultFor } from "./standings.js";

// a button that looks like a link; the data attribute tells us what to open
export function playerLink(player) {
    const button = el("button", "name-link", player.name);
    button.type = "button";
    button.dataset.playerId = player.id;
    button.title = `Open ${player.name}'s record`;
    return button;
}

export function teamLink(team) {
    const button = el("button", "name-link", team.name);
    button.type = "button";
    button.dataset.teamId = team.id;
    button.title = `Open ${team.name}'s record`;
    return button;
}

// row of numbers like Played 3 · Won 2 · Drawn 0 · Lost 1
function statBoxes(pairs) {
    const box = el("div", "profile-stats");
    pairs.forEach(([label, value]) => {
        const item = el("div", "profile-stat");
        item.append(el("strong", "", String(value)), el("span", "", label));
        box.append(item);
    });
    return box;
}

// one line per match, seen from the side of teamId
function matchList(matches, teamId, data, starPlayerId = null) {
    const list = el("ul", "profile-matches");
    if (matches.length === 0) {
        list.append(el("li", "profile-empty", "No matches scheduled yet."));
    }
    matches.forEach(match => {
        const opponentId = match.teamA === teamId ? match.teamB : match.teamA;
        const opponent = findById(data.teams, opponentId);
        const li = el("li");

        const left = el("div");
        left.append(el("span", "profile-date", formatDate(match.date)));
        const vs = el("span", "", "vs ");
        vs.append(opponent ? teamLink(opponent) : el("span", "", "—"));
        left.append(vs);
        if (starPlayerId && match.playerOfMatch === starPlayerId) {
            left.append(el("span", "profile-award", "Player of the match"));
        }

        const right = el("div", "profile-result");
        if (match.status === "upcoming") {
            right.append(el("span", "badge-status badge-upcoming", "upcoming"));
        } else {
            const ownScore = match.teamA === teamId ? match.scoreA : match.scoreB;
            const otherScore = match.teamA === teamId ? match.scoreB : match.scoreA;
            right.append(el("span", "profile-score", `${ownScore} – ${otherScore}`));
            if (match.status === "live") {
                right.append(el("span", "badge-status badge-live", "live"));
            } else {
                const result = resultFor(match, teamId);
                right.append(el("span", `form-dot form-${result}`, result));
            }
        }
        li.append(left, right);
        list.append(li);
    });
    return list;
}

// builds the player's record
function playerProfile(player, data, showPrivate) {
    const team = findById(data.teams, player.teamId);
    const box = el("div");
    const sub = `${team ? team.name : "No team"} · ${nameOf(data.departments, player.departmentId)}`;
    box.append(el("p", "profile-sub", sub));
    if (showPrivate) {
        box.append(el("p", "profile-sub", `Registration no.: ${player.regNo}`));
    }

    if (!team) {
        box.append(el("p", "profile-empty", "This player is not in a team yet."));
        return box;
    }

    const history = teamHistory(team.id, data);
    // count how many times this player was chosen as player of the match
    const awards = data.matches.filter(match => match.playerOfMatch === player.id).length;
    box.append(statBoxes([
        ["Played", history.played], ["Won", history.won], ["Drawn", history.drawn], ["Lost", history.lost], ["Player of match", awards]
    ]));

    box.append(el("h3", "profile-heading", "Matches"));
    box.append(matchList(history.matches, team.id, data, player.id));
    box.append(el("p", "profile-note", "Played / won / lost are the matches of the player's team. Individual runs and goals will be added in the full version."));
    return box;
}

// builds the team's record
function teamProfile(team, data) {
    const history = teamHistory(team.id, data);
    const players = data.players.filter(player => player.teamId === team.id);
    const box = el("div");
    box.append(el("p", "profile-sub", `${nameOf(data.departments, team.departmentId)} · ${nameOf(data.sports, team.sportId)} · ${genderLabel(team.gender)}`));
    box.append(el("p", "profile-sub", `Captain: ${team.captain}`));
    box.append(statBoxes([
        ["Played", history.played], ["Won", history.won], ["Drawn", history.drawn], ["Lost", history.lost], ["Points", history.points]
    ]));

    box.append(el("h3", "profile-heading", `Players (${players.length})`));
    const list = el("ul", "profile-players");
    if (players.length === 0) {
        list.append(el("li", "profile-empty", "No players added yet."));
    }
    players.forEach(player => {
        const li = el("li");
        li.append(playerLink(player), el("span", "", player.role));
        list.append(li);
    });
    box.append(list);

    box.append(el("h3", "profile-heading", "Matches"));
    box.append(matchList(history.matches, team.id, data));
    return box;
}

// creates the <dialog> once and listens for clicks on any player or team link on the page
// getData is a function so the admin page always shows the latest data after changes
export function enableProfiles(getData, options = {}) {
    const dialog = el("dialog", "profile-dialog");
    dialog.setAttribute("aria-labelledby", "profileTitle");
    const bar = el("div", "profile-bar");
    const title = el("h2", "profile-title");
    title.id = "profileTitle";
    const close = el("button", "profile-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => dialog.close());
    bar.append(title, close);
    const body = el("div");
    dialog.append(bar, body);
    document.body.append(dialog);

    // clicking the dark area outside the box closes it
    dialog.addEventListener("click", event => {
        if (event.target === dialog) {
            dialog.close();
        }
    });

    // one listener for the whole page (event delegation)
    document.addEventListener("click", event => {
        const link = event.target.closest("[data-player-id], [data-team-id]");
        if (!link) {
            return;
        }
        const data = getData();
        clear(body);
        if (link.dataset.playerId) {
            const player = findById(data.players, link.dataset.playerId);
            if (!player) {
                return;
            }
            title.textContent = `${player.name} · ${player.role}`;
            body.append(playerProfile(player, data, options.showPrivate));
        } else {
            const team = findById(data.teams, link.dataset.teamId);
            if (!team) {
                return;
            }
            title.textContent = team.name;
            body.append(teamProfile(team, data));
        }
        if (!dialog.open) {
            dialog.showModal();
        }
        dialog.scrollTop = 0;
    });
}
