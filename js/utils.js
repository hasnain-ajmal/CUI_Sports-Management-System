// utils.js
// Small helper functions used by many pages.

// closure: every call of the returned function gives the next id
export function createIdGenerator(start = 1) {
    let id = start;
    return () => id++;
}

// biggest id in a list, 0 for an empty list
export function maxId(list) {
    return list.reduce((max, item) => Math.max(max, item.id), 0);
}

// creates an element with a class and text
// we always use textContent (not innerHTML) so user input can never run as HTML
export function el(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== "") {
        element.textContent = text;
    }
    return element;
}

// removes all children of an element
export function clear(element) {
    while (element.firstChild) {
        element.firstChild.remove();
    }
}

// adds options to a dropdown; labelOf decides what text each option shows
export function fillSelect(select, list, labelOf, firstText = "") {
    clear(select);
    if (firstText) {
        select.append(new Option(firstText, ""));
    }
    list.forEach(item => select.append(new Option(labelOf(item), item.id)));
}

// "2026-10-25" -> "Sun, 25 Oct 2026"
export function formatDate(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return isoDate;
    }
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// "15:30" -> "3:30 PM"
export function formatTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const suffix = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// today's date as "YYYY-MM-DD" in local time
export function todayISO() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

// "male" -> "Men", "female" -> "Women"
export function genderLabel(gender) {
    return gender === "female" ? "Women" : "Men";
}

// matches sorted by date and time, on a copy so the original array is not changed
export function sortByDate(matches, newestFirst = false) {
    const sorted = [...matches].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    return newestFirst ? sorted.reverse() : sorted;
}

// shows a message in a box on the page (used when the data cannot be loaded)
export function showPageError(box, error) {
    box.textContent = `Could not load the data: ${error.message}. Open the project with Live Server, not by double-clicking the file.`;
    box.classList.remove("hidden", "d-none");
}

// "09:30" -> 570 minutes after midnight, and back again
export function toMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

export function fromMinutes(total) {
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// all time slots of a ground or court, e.g. open 09:00, close 13:00, 120 min -> ["09:00", "11:00"]
export function buildSlots(resource) {
    const slots = [];
    const close = toMinutes(resource.closeTime);
    for (let start = toMinutes(resource.openTime); start + resource.slotMinutes <= close; start += resource.slotMinutes) {
        slots.push(fromMinutes(start));
    }
    return slots;
}

// random password for a new coordinator account, e.g. "k7Rm2xQp9a"
// crypto.getRandomValues gives better random numbers than Math.random
export function generatePassword(length = 10) {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const numbers = crypto.getRandomValues(new Uint32Array(length));
    let password = "";
    numbers.forEach(number => {
        password += characters[number % characters.length];
    });
    // make sure it has at least one digit
    return /\d/.test(password) ? password : `${password.slice(0, -1)}7`;
}
