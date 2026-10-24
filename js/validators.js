// validators.js
// One function per form. Each returns an object of errors: { fieldName: "message" }.
// An empty object means the form is valid.

// regular expressions used in the forms
export const patterns = {
    // a name: starts with a letter, then letters, spaces, dots, apostrophes or dashes (3 to 40 characters)
    personName: /^[A-Za-z][A-Za-z .'-]{2,39}$/,
    // COMSATS registration number like FA24-BSE-105 or SP25-BCS-001
    regNo: /^(FA|SP)\d{2}-[A-Z]{3}-\d{3}$/,
    // department code: 2 to 5 capital letters, like CS or MTH
    deptCode: /^[A-Z]{2,5}$/,
    // general title: 3 to 60 characters with at least one letter
    hasLetter: /[A-Za-z]/,
    // 24-hour time from <input type="time">, like 09:00 or 15:30
    time: /^([01]\d|2[0-3]):[0-5]\d$/,
    // date from <input type="date">, like 2026-10-25
    date: /^\d{4}-\d{2}-\d{2}$/,
    // whole number with no sign or decimals
    wholeNumber: /^\d+$/
};

// true when text has the right length and contains a letter
function isTitle(text, min, max) {
    return text.length >= min && text.length <= max && patterns.hasLetter.test(text);
}

export function validateDepartment(fields, departments) {
    const errors = {};
    if (!isTitle(fields.name, 3, 60)) {
        errors.name = "Department name must be 3 to 60 characters.";
    }
    if (!patterns.deptCode.test(fields.code)) {
        errors.code = "Code must be 2 to 5 capital letters, e.g. CS.";
    } else if (departments.some(dept => dept.code === fields.code)) {
        errors.code = "This code is already used by another department.";
    }
    return errors;
}

// a coordinator account. Each department has 3 places:
// one faculty coordinator (male or female) and two student coordinators (one male, one female)
export function validateCoordinator(fields, users) {
    const errors = {};
    if (!fields.departmentId) {
        errors.departmentId = "Choose a department.";
    }
    if (!["faculty", "student"].includes(fields.type)) {
        errors.type = "Choose faculty or student.";
    }
    if (!["male", "female"].includes(fields.gender)) {
        errors.gender = "Choose male or female.";
    }
    if (!patterns.personName.test(fields.name)) {
        errors.name = "Enter a valid name (letters only, 3 to 40 characters).";
    }
    // faculty: one per department; student: one male and one female per department
    const taken = users.some(user =>
        user.role === "coordinator" &&
        user.departmentId === Number(fields.departmentId) &&
        user.type === fields.type &&
        (fields.type === "faculty" || user.gender === fields.gender)
    );
    if (Object.keys(errors).length === 0 && taken) {
        errors.type = fields.type === "faculty"
            ? "This department already has a faculty coordinator. Delete the old account first."
            : `This department already has a ${fields.gender} student coordinator. Delete the old account first.`;
    }
    return errors;
}

// a ground, court or table that matches can be booked on
export function validateResource(fields, sportIds, resources) {
    const errors = {};
    if (!isTitle(fields.name, 3, 40)) {
        errors.name = "Name must be 3 to 40 characters.";
    }
    if (!isTitle(fields.category, 3, 30)) {
        errors.category = "Category must be 3 to 30 characters, e.g. Badminton court.";
    }
    if (sportIds.length === 0) {
        errors.sports = "Tick at least one sport that can be played here.";
    }
    const count = Number(fields.count);
    if (!patterns.wholeNumber.test(fields.count) || count < 1 || count > 10) {
        errors.count = "Add 1 to 10 at a time.";
    }
    if (!patterns.time.test(fields.openTime)) {
        errors.openTime = "Choose an opening time.";
    }
    if (!patterns.time.test(fields.closeTime)) {
        errors.closeTime = "Choose a closing time.";
    } else if (patterns.time.test(fields.openTime) && fields.closeTime <= fields.openTime) {
        errors.closeTime = "Closing time must be after opening time.";
    }
    // names that will be created, e.g. "Badminton Court 1", "Badminton Court 2"
    if (!errors.name && !errors.count) {
        const names = count === 1 ? [fields.name] : Array.from({ length: count }, (_, i) => `${fields.name} ${i + 1}`);
        const existing = names.find(name => resources.some(item => item.name.toLowerCase() === name.toLowerCase()));
        if (existing) {
            errors.name = `"${existing}" already exists.`;
        }
    }
    return errors;
}

export function validateSport(fields, sports) {
    const errors = {};
    if (!isTitle(fields.name, 3, 30)) {
        errors.name = "Sport name must be 3 to 30 characters.";
    } else if (sports.some(sport => sport.name.toLowerCase() === fields.name.toLowerCase())) {
        errors.name = "This sport already exists.";
    }
    if (!["team", "individual"].includes(fields.type)) {
        errors.type = "Choose a sport type.";
    }
    return errors;
}

export function validateTeam(fields, teams) {
    const errors = {};
    if (!fields.departmentId) {
        errors.departmentId = "Choose a department.";
    }
    if (!fields.sportId) {
        errors.sportId = "Choose a sport.";
    }
    if (!["male", "female"].includes(fields.gender)) {
        errors.gender = "Choose men or women.";
    }
    if (!patterns.personName.test(fields.captain)) {
        errors.captain = "Enter the captain's name (letters only, 3 to 40 characters).";
    }
    // a department can have only one team per sport and gender
    const duplicate = teams.some(team =>
        team.departmentId === Number(fields.departmentId) &&
        team.sportId === Number(fields.sportId) &&
        team.gender === fields.gender
    );
    if (Object.keys(errors).length === 0 && duplicate) {
        errors.sportId = "This department already has a team for this sport and gender.";
    }
    return errors;
}

export function validatePlayer(fields, players, teams) {
    const errors = {};
    if (!patterns.personName.test(fields.name)) {
        errors.name = "Enter a valid name (letters only, 3 to 40 characters).";
    }
    if (!patterns.regNo.test(fields.regNo)) {
        errors.regNo = "Use the format FA24-BSE-105.";
    } else if (players.some(player => player.regNo === fields.regNo)) {
        errors.regNo = "A player with this registration number already exists.";
    }
    if (!["male", "female"].includes(fields.gender)) {
        errors.gender = "Choose a gender.";
    }
    if (!fields.departmentId) {
        errors.departmentId = "Choose a department.";
    }
    if (!fields.teamId) {
        errors.teamId = "Choose a team.";
    } else {
        // the team must be from the same department and gender as the player
        const team = teams.find(item => item.id === Number(fields.teamId));
        if (!team || team.departmentId !== Number(fields.departmentId) || team.gender !== fields.gender) {
            errors.teamId = "Choose a team of the player's own department and gender.";
        }
    }
    return errors;
}

// freeSlots: the time slots of the chosen ground that are still empty on the chosen date
export function validateMatch(fields, teams, resources, today, matches, freeSlots) {
    const errors = {};
    if (!fields.sportId) {
        errors.sportId = "Choose a sport.";
    }
    if (!["male", "female"].includes(fields.gender)) {
        errors.gender = "Choose men or women.";
    }
    if (!fields.teamA) {
        errors.teamA = "Choose team A.";
    }
    if (!fields.teamB) {
        errors.teamB = "Choose team B.";
    } else if (fields.teamA === fields.teamB) {
        errors.teamB = "A team cannot play against itself.";
    }
    // both teams must belong to the chosen sport and gender
    const wrongTeam = [fields.teamA, fields.teamB].some(id => {
        const team = teams.find(item => item.id === Number(id));
        return id && (!team || team.sportId !== Number(fields.sportId) || team.gender !== fields.gender);
    });
    if (wrongTeam && !errors.teamA && !errors.teamB) {
        errors.teamB = "Both teams must play this sport in the chosen category.";
    }
    const resource = resources.find(item => item.id === Number(fields.resourceId));
    if (!resource) {
        errors.resourceId = "Choose a ground or court.";
    } else if (!resource.sportIds.includes(Number(fields.sportId))) {
        errors.resourceId = "This sport cannot be played here.";
    }
    if (!patterns.date.test(fields.date)) {
        errors.date = "Choose a date.";
    } else if (fields.date < today) {
        errors.date = "A new match cannot be scheduled in the past.";
    }
    if (!patterns.time.test(fields.time)) {
        errors.time = "Choose a free time slot.";
    } else if (!errors.resourceId && !errors.date && !freeSlots.includes(fields.time)) {
        // the slot is not free any more (someone else booked it)
        errors.time = "This slot is already booked. Choose another one.";
    }

    // a team can play only one match per day (players need rest)
    if (Object.keys(errors).length === 0) {
        const busyTeam = [fields.teamA, fields.teamB].find(id =>
            matches.some(match => match.date === fields.date && (match.teamA === Number(id) || match.teamB === Number(id)))
        );
        if (busyTeam) {
            const team = teams.find(item => item.id === Number(busyTeam));
            errors.date = `${team.name} already has a match on this day. A team plays only one match per day.`;
        }
    }
    return errors;
}

// allowedPlayerIds: players of the two teams, the only ones who can be player of the match
export function validateResult(fields, allowedPlayerIds = []) {
    const errors = {};
    if (fields.playerOfMatch && !allowedPlayerIds.includes(Number(fields.playerOfMatch))) {
        errors.playerOfMatch = "Choose a player from one of the two teams.";
    }
    if (!patterns.wholeNumber.test(fields.scoreA) || Number(fields.scoreA) > 999) {
        errors.scoreA = "Score must be a whole number from 0 to 999.";
    }
    if (!patterns.wholeNumber.test(fields.scoreB) || Number(fields.scoreB) > 999) {
        errors.scoreB = "Score must be a whole number from 0 to 999.";
    }
    if (!["live", "completed"].includes(fields.status)) {
        errors.status = "Choose live or completed.";
    }
    return errors;
}

export function validateAnnouncement(fields) {
    const errors = {};
    if (!isTitle(fields.title, 5, 80)) {
        errors.title = "Title must be 5 to 80 characters.";
    }
    if (fields.body.length < 10 || fields.body.length > 500) {
        errors.body = "Message must be 10 to 500 characters.";
    }
    return errors;
}

export function validateLogin(fields) {
    const errors = {};
    if (fields.username.length < 3) {
        errors.username = "Enter your username.";
    }
    if (fields.password.length < 6) {
        errors.password = "Password must be at least 6 characters.";
    }
    return errors;
}
