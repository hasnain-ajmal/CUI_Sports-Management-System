// standings.js
// Calculates the points table from the completed match results.

// works out the result of one match for one team: "W", "L" or "D"
export function resultFor(match, teamId) {
    if (match.scoreA === match.scoreB) {
        return "D";
    }
    const teamAWon = match.scoreA > match.scoreB;
    const isTeamA = match.teamA === teamId;
    return teamAWon === isTeamA ? "W" : "L";
}

// returns one row per team, sorted by points, then score difference, then name
export function computeStandings(teams, matches, settings) {
    // only completed matches of these teams count
    const teamIds = teams.map(team => team.id);
    const played = matches.filter(match =>
        match.status === "completed" && teamIds.includes(match.teamA) && teamIds.includes(match.teamB)
    );

    const rows = teams.map(team => {
        const teamMatches = played.filter(match => match.teamA === team.id || match.teamB === team.id);
        const results = teamMatches.map(match => resultFor(match, team.id));

        const won = results.filter(result => result === "W").length;
        const drawn = results.filter(result => result === "D").length;
        const lost = results.filter(result => result === "L").length;

        // score for and against, using reduce
        const scoreFor = teamMatches.reduce((sum, match) => sum + (match.teamA === team.id ? match.scoreA : match.scoreB), 0);
        const scoreAgainst = teamMatches.reduce((sum, match) => sum + (match.teamA === team.id ? match.scoreB : match.scoreA), 0);

        return {
            teamId: team.id,
            name: team.name,
            played: teamMatches.length,
            won,
            drawn,
            lost,
            scoreFor,
            scoreAgainst,
            difference: scoreFor - scoreAgainst,
            points: won * settings.pointsWin + drawn * settings.pointsDraw + lost * settings.pointsLoss,
            form: results.slice(-5)
        };
    });

    // sort on a copy so the rows array keeps the original team order
    return [...rows].sort((a, b) =>
        b.points - a.points || b.difference - a.difference || a.name.localeCompare(b.name)
    );
}

// full history of one team: every match (oldest first) and its win / draw / loss record
export function teamHistory(teamId, data) {
    const id = Number(teamId);
    const matches = data.matches
        .filter(match => match.teamA === id || match.teamB === id)
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    const results = matches.filter(match => match.status === "completed").map(match => resultFor(match, id));
    const won = results.filter(result => result === "W").length;
    const drawn = results.filter(result => result === "D").length;
    const lost = results.filter(result => result === "L").length;
    return {
        matches,
        played: results.length,
        won,
        drawn,
        lost,
        points: won * data.settings.pointsWin + drawn * data.settings.pointsDraw + lost * data.settings.pointsLoss
    };
}

// overall sports week table: adds up the results of every team (all sports, men and women) of each department
export function computeDepartmentTable(data) {
    const rows = data.departments.map(dept => {
        const teamIds = data.teams.filter(team => team.departmentId === dept.id).map(team => team.id);
        // reduce adds the record of each team into one total for the department
        const total = teamIds.reduce((sum, teamId) => {
            const history = teamHistory(teamId, data);
            return {
                played: sum.played + history.played,
                won: sum.won + history.won,
                drawn: sum.drawn + history.drawn,
                lost: sum.lost + history.lost,
                points: sum.points + history.points
            };
        }, { played: 0, won: 0, drawn: 0, lost: 0, points: 0 });
        return { departmentId: dept.id, name: dept.name, code: dept.code, teams: teamIds.length, ...total };
    });
    return [...rows].sort((a, b) => b.points - a.points || b.won - a.won || a.name.localeCompare(b.name));
}
