// store.js
// Loads the data from the JSON files the first time, then keeps it in localStorage
// so that changes made in the admin panel also show on the public pages.

const STORAGE_KEY = "usms-data";

// raise this number when the shape of the JSON data changes, so old saved data is replaced
const DATA_VERSION = 4;

// every JSON file in the data folder
const FILES = ["sports", "departments", "teams", "players", "matches", "announcements", "settings", "resources", "users"];

// default settings, used if settings.json is missing
const defaultSettings = { season: "Sports Week", university: "COMSATS University Islamabad", pointsWin: 2, pointsDraw: 1, pointsLoss: 0 };

// reads saved data from localStorage, returns null if nothing is saved or it is broken
function readSaved() {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (!text) {
            return null;
        }
        return JSON.parse(text);
    } catch (error) {
        // broken JSON in storage, so we start again from the files
        return null;
    }
}

// fetches all JSON files at the same time with Promise.all
async function loadFromFiles() {
    const responses = await Promise.all(FILES.map(name => fetch(`data/${name}.json`)));

    // fetch does not fail on 404, so we check response.ok ourselves
    responses.forEach(response => {
        if (!response.ok) {
            throw new Error(`Could not load ${response.url} (HTTP ${response.status})`);
        }
    });

    const values = await Promise.all(responses.map(response => response.json()));

    // turn the two arrays into one object: { sports: [...], teams: [...], ... }
    const data = {};
    FILES.forEach((name, index) => {
        data[name] = values[index];
    });
    return data;
}

// main function every page calls first
export async function loadData() {
    const saved = readSaved();
    if (saved && saved.version === DATA_VERSION) {
        return { ...saved, settings: { ...defaultSettings, ...saved.settings } };
    }
    const data = await loadFromFiles();
    data.version = DATA_VERSION;
    data.settings = { ...defaultSettings, ...data.settings };
    saveData(data);
    return data;
}

// saves the whole data object as one JSON string
export function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        return false;
    }
}

// removes saved changes, so the next load uses the JSON files again
export function resetData() {
    localStorage.removeItem(STORAGE_KEY);
}

// finds one item by id in any list
export function findById(list, id) {
    return list.find(item => item.id === Number(id));
}

// key used to remember who is logged in (only for this browser tab)
export const SESSION_KEY = "usms-user";

// the logged-in user, or null; read again from the data so a deleted account loses access
export function currentUser(data) {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id ? findById(data.users, id) || null : null;
}

// returns the name of an item, or a dash if it was not found
export function nameOf(list, id) {
    const item = findById(list, id);
    return item ? item.name : "—";
}
