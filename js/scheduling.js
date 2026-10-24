// scheduling.js
// Rules about time on a ground, used by the match form, the "Grounds & slots" page
// and the league scheduler. A match on a ground lasts one slot (resource.slotMinutes).

import { buildSlots, toMinutes, fromMinutes, formatTime } from "./utils.js";

// the match already on this ground that overlaps a match starting at "time", or undefined
export function clashingMatch(resource, date, time, matches) {
    const start = toMinutes(time);
    return matches.find(match =>
        match.resourceId === resource.id &&
        match.date === date &&
        Math.abs(toMinutes(match.time) - start) < resource.slotMinutes
    );
}

// "" when the time is free, otherwise the reason it is not
// now = { date: "2026-10-25", time: "14:05" } so that past times of today are refused
export function timeProblem(resource, date, time, matches, now) {
    const start = toMinutes(time);
    const end = start + resource.slotMinutes;
    if (start < toMinutes(resource.openTime) || end > toMinutes(resource.closeTime)) {
        return `${resource.name} is open ${formatTime(resource.openTime)} – ${formatTime(resource.closeTime)}, and one match takes ${resource.slotMinutes} minutes, so it must start by ${formatTime(fromMinutes(toMinutes(resource.closeTime) - resource.slotMinutes))}.`;
    }
    if (date === now.date && time <= now.time) {
        return "This time has already passed today.";
    }
    const clash = clashingMatch(resource, date, time, matches);
    if (clash) {
        return `Booked: another match starts at ${formatTime(clash.time)} on this ground.`;
    }
    return "";
}

// the standard slots of a ground that are still free on a date
export function freeSlots(resource, date, matches, now) {
    return buildSlots(resource).filter(slot => timeProblem(resource, date, slot, matches, now) === "");
}

// every pair of teams once, arranged in rounds (circle method):
// keep the first team still and rotate the others one place each round
export function roundRobin(teamIds) {
    const list = [...teamIds];
    if (list.length % 2 === 1) {
        list.push(null); // a "bye": the team paired with null rests that round
    }
    const rounds = [];
    for (let round = 0; round < list.length - 1; round++) {
        const pairs = [];
        for (let i = 0; i < list.length / 2; i++) {
            const home = list[i];
            const away = list[list.length - 1 - i];
            if (home !== null && away !== null) {
                pairs.push([home, away]);
            }
        }
        rounds.push(pairs);
        list.splice(1, 0, list.pop()); // rotate everyone except the first team
    }
    return rounds;
}

// every date from start to end, e.g. "2026-10-26" ... "2026-10-30"
export function datesBetween(start, end) {
    const dates = [];
    const day = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (day <= last) {
        dates.push(day.toISOString().slice(0, 10));
        day.setUTCDate(day.getUTCDate() + 1);
    }
    return dates;
}

// plans a league: every team plays every other team once.
// Goes day by day, ground by ground, slot by slot, and puts the next pair whose teams
// are both free that day into the first free slot (a "greedy" schedule).
export function planLeague({ teamIds, resources, startDate, endDate, fromTime, toTime, matches, now }) {
    const queue = roundRobin(teamIds).flat();
    const planned = [];
    // existing matches plus the ones planned so far, so nothing is double booked
    const booked = () => matches.concat(planned);

    for (const date of datesBetween(startDate, endDate)) {
        for (const resource of resources) {
            const slots = buildSlots(resource).filter(slot =>
                slot >= fromTime && toMinutes(slot) + resource.slotMinutes <= toMinutes(toTime)
            );
            for (const slot of slots) {
                if (queue.length === 0) {
                    return { planned, unplaced: [] };
                }
                if (timeProblem(resource, date, slot, booked(), now)) {
                    continue;
                }
                // teams that already play on this day (one match per team per day)
                const busy = booked().filter(match => match.date === date).flatMap(match => [match.teamA, match.teamB]);
                const index = queue.findIndex(([a, b]) => !busy.includes(a) && !busy.includes(b));
                if (index === -1) {
                    continue;
                }
                const [teamA, teamB] = queue.splice(index, 1)[0];
                planned.push({ teamA, teamB, resourceId: resource.id, date, time: slot });
            }
        }
    }
    return { planned, unplaced: queue };
}
