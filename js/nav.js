// nav.js
// Navbar behaviour for the public pages (loaded as a normal script with defer).

const menuButton = document.getElementById("menuButton");
const menu = document.getElementById("menu");

// opens and closes the menu on small screens
menuButton.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("hidden") === false;
    menuButton.setAttribute("aria-expanded", String(isOpen));
});

// highlights the link of the page we are on
const currentPage = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".nav-link-public").forEach(link => {
    if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }
});

// if someone is logged in, the Login link becomes Dashboard
const authLink = document.getElementById("authLink");
if (sessionStorage.getItem("usms-user")) {
    authLink.textContent = "Dashboard";
    authLink.href = "admin.html";
}
