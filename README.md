# University Sports Management System — Midterm Project

**CSC336 Web Technologies Lab · COMSATS University Islamabad**
Muhammad Hasnain Ajmal (FA24-BSE-055) · Muhammad Sohail (FA24-BSE-105)

This is the front end of our semester project. It covers what we have studied up to Lab 7:
HTML5, CSS, Tailwind, Bootstrap and JavaScript (ES6 modules, DOM, events, regex validation, JSON, fetch).
In the later labs the same project gets Express, MongoDB and React.

---

## How to run

1. Open the `midterm-project` folder in VS Code.
2. Right-click `index.html` → **Open with Live Server**.
3. Log in on the Login page with one of the demo accounts:

| Account | Username | Password |
| --- | --- | --- |
| Admin (sports office) | `admin` | `Admin@123` |
| CS faculty coordinator | `cs.faculty` | `Coord@123` |
| CS male student coordinator | `cs.student.m` | `Coord@123` |
| CS female student coordinator | `cs.student.f` | `Coord@123` |

Every department has the same three accounts (`ee.faculty`, `ms.student.f`, …). New coordinators get a random password made by the admin.

Live Server is needed because the project uses ES modules and `fetch`. Both are blocked when you
double-click the HTML file (it opens as `file://`, not `http://`). Internet is needed for the Tailwind and Bootstrap CDNs.

---

## Pages

| Page | Who uses it | Framework | What it does |
| --- | --- | --- | --- |
| `index.html` | Everyone | Tailwind | Statistics, live match, upcoming matches, latest results, announcements |
| `matches.html` | Everyone | Tailwind | All matches with filters (sport, men/women, status) and team search |
| `standings.html` | Everyone | Tailwind | Points table per sport, plus the overall department table (sports week champion) |
| `teams.html` | Everyone | Tailwind | Teams, player search, the three sports coordinators of every department |
| `login.html` | Admin and coordinators | Bootstrap | One login page for all staff |
| `admin.html` | Admin and coordinators | Bootstrap | Dashboard. The admin sees everything; a coordinator sees a portal limited to their own department |

**Click any player or team name** (on any page, including the admin panel) to open their full record:
played / won / drawn / lost, player of the match awards and every match with its score. This is `js/profile.js`,
built with the HTML `<dialog>` element so the same code works on the Tailwind and the Bootstrap pages.

**Why two frameworks?** The assignment asks for both. Tailwind is used for the public site, Bootstrap for
the admin area. They are never mixed on the same page because their class names can clash.

---

## Folder structure

```
sports-management-midterm/
├── index.html, matches.html, standings.html, teams.html   public pages (Tailwind)
├── login.html, admin.html                                 admin pages (Bootstrap)
├── css/style.css            our own CSS: variables, grid, flexbox, media queries, hover/focus
├── data/                    starting data as JSON files
│   ├── sports.json, departments.json, teams.json, players.json
│   ├── matches.json, announcements.json, settings.json
│   ├── resources.json       grounds, courts and tables with opening hours and slot length
│   └── users.json           admin and coordinator accounts
└── js/
    ├── store.js             loads JSON with fetch + Promise.all, saves to localStorage
    ├── utils.js             helpers: el(), formatDate(), createIdGenerator() closure...
    ├── validators.js        regular expressions + one validate function per form
    ├── standings.js         points table logic (filter, map, reduce, sort)
    ├── scheduling.js        time rules on grounds, free slots, round robin and the league planner
    ├── components.js        builds match cards with createElement
    ├── profile.js           player / team record pop-up (<dialog>), opened by clicking a name
    ├── nav.js               mobile menu, active link
    ├── home.js, matches.js, standings-page.js, teams.js       one file per public page
    ├── login.js             login form
    └── admin.js             dashboard: roles, coordinator logins, grounds and slots, forms, tables, delete rules
```

---

## How the data flows

1. The first time a page opens, `store.js` fetches all JSON files **at the same time** with `Promise.all`.
2. It checks `response.ok` (fetch does not fail on a 404 by itself).
3. The data is saved in `localStorage` as one JSON string (`JSON.stringify`).
4. Next time, it is read back from `localStorage` (`JSON.parse` inside `try/catch`).
5. When the admin adds a team or enters a result, `admin.js` changes the data and saves it again.
   The public pages read the same `localStorage`, so the change shows there immediately.
6. **Reset demo data** in the admin sidebar clears `localStorage`, so the JSON files load again.

---

## How matches work

1. **Grounds and slots.** The admin adds every ground, court and table (Main Cricket Ground, Badminton Court 1, 2, 3,
   Table Tennis Table 1, 2, 3 …) with a category, the sports played there, opening and closing time and the length of one slot.
   *Grounds & slots* shows, for any date, which slots are free (green) and booked (red).
2. **Scheduling one match.** The admin or a coordinator picks sport, men/women and the two teams (if no team exists, the
   dropdown says so). Only grounds that suit that sport are offered. After choosing a date, the form shows that ground's free
   start times as buttons; you can click one or **type any start time**, and the box under it says at once whether it is free,
   booked by another match, or outside opening hours. A match on a ground lasts one slot length, so overlapping times are refused.
3. **League scheduler (admin).** Choose a league name, sport, category, the teams, the grounds, first and last day and the
   daily hours. The system pairs every team with every other team once (round robin, circle method) and puts each match into
   the first free slot, with at most one match per team per day (`planLeague` in `js/scheduling.js`). You see the proposed
   schedule first; matches that don't fit are shown in red with a hint (add days, widen hours, tick more grounds). *Save* adds them all.
4. **Clash rules.** A booked slot can't be booked again, a team plays only one match per day, and new matches can't be put in the past.
   A coordinator's Team A must be one of their own teams.
5. **Status.** Every match is `upcoming` → `live` → `completed`. The admin changes it in the *Start / result* pop-up.
   Live scores show on the home page; only **completed** matches count in the points tables.
6. **Result.** Only the admin types both scores (runs, goals or points, depending on the sport) and can choose a player of the match.
   Higher score wins; equal scores are a draw. Win = 2 points, draw = 1, loss = 0.
7. **Tables.** The sport table ranks teams by points, then score difference. The department table adds up every
   team of a department in every sport, men and women, to find the sports week champion.
8. **Results to enter.** The admin overview lists matches whose date has passed but are not completed yet.

The league scheduler is an inter-department round robin. Knockout brackets and intra-department leagues (teams of sections or batches inside one department) are planned for the MERN version.

## Who can do what

Every department has **three sports coordinators**: one **faculty member** (male or female) who looks after all of the
department's teams, and two **students**: a male one for the men's teams and a female one for the women's teams.

| User | Can do |
| --- | --- |
| Visitor / student (no login) | See matches, live scores, standings, teams, players and their records, coordinators, announcements |
| Admin (sports office) | Everything: departments, coordinators and their logins, sports, grounds and slots, teams, players, matches, **results**, announcements, pinning |
| Faculty coordinator | Own department, men's **and** women's teams: add / delete teams and players (captains), book matches in free slots, post announcements |
| Student coordinator | Own department, **own gender only**: the same as above for the men's or the women's teams |

Coordinators can't add departments, sports or grounds, can't enter results, and can only delete their own upcoming matches and their own announcements.

**Giving a coordinator access.** In *Coordinators*, the admin chooses the department, faculty or student, gender and name.
The system makes a username (e.g. `se.faculty`, `se.student.f`) and a random password, and shows them once in a pop-up with a
ready message to copy and send on WhatsApp or email. *Reset password* makes a new one if it is lost; deleting the account removes access at once.

The role checks run in the browser, so they are not real security. The MERN version moves them to the server and adds a Super Admin, scorers and captains' logins.

---

## Where each lab topic is used (good for the viva)

| Topic | Lab | Where in the project |
| --- | --- | --- |
| Semantic HTML (`header`, `nav`, `main`, `section`, `article`, `footer`, `time`) | 1–2 | All pages |
| Tables with `thead`, `tbody`, `caption`, `scope`, `colspan` | 1 | `standings.html`, admin tables |
| Forms: `fieldset`, `legend`, `label`, `select`, `textarea`, `type="date"/"time"/"number"`, `datalist` | 2 | `admin.html` |
| `<details>` / `<summary>` | 2 | Player list on `teams.html` |
| CSS custom properties, `box-sizing` | 3 | Top of `css/style.css` |
| Flexbox | 4 | Navbar, footer (`.site-footer`) |
| CSS Grid with `auto-fit` + `minmax()` | 4 | Statistic cards (`.stat-grid`) |
| Media queries, `:hover`, `:focus-visible`, transitions, `@keyframes` | 4 | `style.css` (live dot blinks, cards lift on hover) |
| Tailwind utility classes, responsive prefixes (`md:`, `lg:`) | 5 | Public pages |
| Bootstrap grid, cards, forms, tables, **modal**, **toast** | 5 | Login and admin |
| `const`/`let`, template literals, arrow functions, destructuring, spread | 6 | Everywhere |
| Closure | 6 | `createIdGenerator()` in `utils.js` |
| `map`, `filter`, `reduce`, `find`, `some`, sort on a copy `[...arr].sort()` | 6 | `standings.js`, `admin.js` |
| ES6 modules (`import` / `export`, `type="module"`) | 6 | All JS files |
| DOM: `createElement`, `textContent`, `append`, `classList` | 7 | Every render function |
| Events, `preventDefault`, **event delegation** with `closest()` and `data-*` | 7 | One click listener for all admin buttons |
| Regular expressions | 7 | `validators.js` |
| JSON, `fetch`, `async/await`, `Promise.all`, `try/catch` | 7 | `store.js`, `login.js` |
| `localStorage`, `sessionStorage` | 7 | Data in `localStorage`, login in `sessionStorage` |
| `URLSearchParams` | 7 | `matches.html?status=upcoming` link from the home page |
| `<dialog>` with `showModal()` | 2, 7 | Player / team record pop-up (`profile.js`) |

---

## Important code to explain

**Closure: id generator** (`utils.js`)
```js
export function createIdGenerator(start = 1) {
    let id = start;          // private variable, only the inner function can see it
    return () => id++;       // every call returns the next id
}
```
In `admin.js` each list gets its own generator starting after its biggest id, so ids never repeat.

**Points table** (`standings.js`): only `completed` matches count. For every team we `filter` its matches,
`map` each match to W/D/L, count with `filter(...).length`, add the scores with `reduce`, and
then sort a copy by points → score difference → name. Win = 2, draw = 1, loss = 0 (set in `settings.json`).

**Event delegation** (`admin.js`): instead of one listener per Delete button, there is **one** click
listener on `<main>`. It finds the clicked button with `event.target.closest("button[data-action]")`,
reads `data-action` and `data-id`, and knows which list from the table's `data-list` attribute. This
also works for rows created later.

**Safe output**: all text from the user is put on the page with `textContent`, never `innerHTML`.
So if someone types `<script>` as a team name, it shows as text and does not run (this prevents XSS).

**Role check** (`admin.js`): every add and delete asks `canManage(departmentId, gender)`. The admin always passes; a
faculty coordinator passes for their department; a student coordinator only for their department **and** gender.
Buttons are hidden for things you can't change, and the check runs again on submit.

**Free slots** (`utils.js` + `admin.js`): `buildSlots(resource)` cuts the opening hours into slots
(09:00–13:00 with 2-hour slots → 09:00, 11:00). `freeSlots()` removes the ones already booked on that date.

**Business rules nobody can break**
- A department can have only **one team per sport per gender** (e.g. only one "CS Cricket (Men)").
- A player can only join a team from **their own department and gender**.
- Both teams in a match must play **that sport in that category**, and a team can't play itself.
- New matches can't be scheduled in the past.
- A slot of a ground can be booked only once, a ground is offered only for the sports played there, and a team plays at most one match a day.
- One faculty coordinator per department, and one male and one female student coordinator.
- Player of the match must belong to one of the two teams.
- You can't delete a department that still has teams, or a team that still has players or matches.

**Regular expressions** (`validators.js`)

| Field | Pattern | Example that passes |
| --- | --- | --- |
| Registration no. | `/^(FA\|SP)\d{2}-[A-Z]{3}-\d{3}$/` | FA24-BSE-105 |
| Person name | `/^[A-Za-z][A-Za-z .'-]{2,39}$/` | Ali Raza |
| Department code | `/^[A-Z]{2,5}$/` | CS, MTH |
| Time | `/^([01]\d\|2[0-3]):[0-5]\d$/` | 15:30 |
| Score | `/^\d+$/` | 152 |

---

## Likely viva questions

**Is this a SaaS?**
No. SaaS (Software as a Service) means software hosted on a server that many customers use over the internet,
usually on a subscription, like Google Workspace or Slack. Our midterm runs completely in the browser: there is no
server, no database and no accounts per customer. The final version (Express + MongoDB, deployed online) will be a
**web application**. It could become a SaaS only if we offered it to many universities, each with their own data and a plan to pay for.

**Is the login secure?**
No, and we know why. It is a front-end demo: the accounts are stored in the browser (`users.json` and `localStorage`) where anyone can read them, and
`sessionStorage` can be edited in DevTools. Real security needs the server: hashed passwords (bcrypt),
sessions or JWT in httpOnly cookies, and checking permissions on the server. That is Labs 10 and 15.

**Why `localStorage` and not a database?**
We have not reached the database labs yet. `localStorage` keeps data after a refresh, but only in that one browser.
Another computer won't see the changes. MongoDB (Lab 11) fixes this.

**Difference between `localStorage` and `sessionStorage`?**
Both store strings per website. `localStorage` stays until it is cleared; `sessionStorage` is deleted when the
tab is closed. We keep the data in `localStorage` and the login in `sessionStorage`, so closing the tab logs the user out.

**How does a coordinator get access?**
The admin creates the coordinator in *Coordinators*. A username and a random password (made with `crypto.getRandomValues`) appear in a pop-up with a message to send. The coordinator logs in on the same login page and sees only their own department.

**Why `Promise.all`?**
It starts all nine fetches together and waits for all of them, which is faster than one after another. If any
one fails, it goes to `catch`, and we show a message on the page.

**Why `[...matches].sort()` and not `matches.sort()`?**
`sort()` changes the original array. Copying first with spread keeps the original order safe.

**`preventDefault()` vs `stopPropagation()`?**
`preventDefault()` stops the browser's default action (the form reloading the page). `stopPropagation()` stops
the event bubbling up to parent elements. We use `preventDefault()` in every form, and we *rely* on bubbling for event delegation.

**Why ES modules?**
Each file has one job (data, validation, standings, page code), variables don't leak into the global scope,
and functions like `formatDate` are written once and imported where needed.

**What happens if JSON loading fails?**
The `catch` block shows a red message on the page telling the user to open it with Live Server.

---

## Next steps (later labs)

Express REST API (Labs 9, 12) → MongoDB with Mongoose (Lab 11) → sessions and middleware (Lab 10) →
React front end (Labs 13–14) → security: bcrypt, validation on the server, helmet (Lab 15).
