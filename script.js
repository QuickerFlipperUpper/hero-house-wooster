(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const navToggle = doc.getElementById("navToggle");
  const siteNav = doc.getElementById("siteNav");

  if (navToggle && siteNav) {
    const closeNav = () => {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
      siteNav.classList.remove("is-open");
    };

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
      siteNav.classList.toggle("is-open", !isOpen);
    });

    siteNav.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement && window.matchMedia("(max-width: 720px)").matches) {
        closeNav();
      }
    });

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && siteNav.classList.contains("is-open")) {
        closeNav();
        navToggle.focus();
      }
    });
  }

  const menuItems = Array.from(doc.querySelectorAll("[data-menu-item]"));
  const menuGroups = Array.from(doc.querySelectorAll("[data-menu-group]"));
  const filterButtons = Array.from(doc.querySelectorAll("[data-menu-filter]"));
  const sizeButtons = Array.from(doc.querySelectorAll("[data-size-option]"));
  const searchInput = doc.getElementById("menuSearch");
  const clearSearch = doc.getElementById("clearSearch");
  const menuStatus = doc.getElementById("menuStatus");
  const menuEmpty = doc.getElementById("menuEmpty");
  const resetMenu = doc.getElementById("resetMenu");
  const allowedCategories = new Set(["all", "steaks", "heroes", "salads", "sides", "drinks"]);
  const allowedSizes = new Set(["small", "medium", "large"]);
  const params = new URLSearchParams(window.location.search);

  const state = {
    category: allowedCategories.has(params.get("menu")) ? params.get("menu") : "all",
    query: params.get("q") || "",
    size: allowedSizes.has(params.get("size")) ? params.get("size") : "small",
  };

  if (searchInput) searchInput.value = state.query;

  function updateUrl() {
    const next = new URL(window.location.href);
    if (state.category === "all") next.searchParams.delete("menu");
    else next.searchParams.set("menu", state.category);
    if (state.query) next.searchParams.set("q", state.query);
    else next.searchParams.delete("q");
    if (state.size === "small") next.searchParams.delete("size");
    else next.searchParams.set("size", state.size);
    window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
  }

  function updateSize() {
    sizeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.sizeOption === state.size));
    });

    doc.querySelectorAll("[data-size-price]").forEach((price) => {
      const selected = price.dataset.sizePrice === state.size;
      price.hidden = !selected;
      price.classList.toggle("is-selected", selected);
    });
  }

  function updateMenu() {
    const normalizedQuery = state.query.trim().toLocaleLowerCase();
    let visibleCount = 0;

    menuItems.forEach((item) => {
      const categoryMatches = state.category === "all" || item.dataset.category === state.category;
      const text = `${item.dataset.search || ""} ${item.querySelector("h4")?.textContent || ""} ${item.querySelector("p")?.textContent || ""}`.toLocaleLowerCase();
      const searchMatches = !normalizedQuery || text.includes(normalizedQuery);
      const show = categoryMatches && searchMatches;
      item.hidden = !show;
      if (show) visibleCount += 1;
    });

    menuGroups.forEach((group) => {
      const cards = group.querySelectorAll("[data-menu-item]");
      const hasVisible = Array.from(cards).some((item) => !item.hidden);
      group.hidden = !hasVisible;
    });

    filterButtons.forEach((button) => {
      const selected = button.dataset.menuFilter === state.category;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (clearSearch) clearSearch.hidden = !state.query;
    if (menuEmpty) menuEmpty.hidden = visibleCount > 0;
    if (menuStatus) {
      const label = visibleCount === 1 ? "1 menu item" : `${visibleCount} menu items`;
      menuStatus.textContent = `${label} shown${state.query ? ` for ${state.query}` : ""}.`;
    }

    updateUrl();
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.menuFilter || "all";
      updateMenu();
    });
  });

  sizeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.size = button.dataset.sizeOption || "small";
      updateSize();
      updateUrl();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      updateMenu();
    });
  }

  if (clearSearch && searchInput) {
    clearSearch.addEventListener("click", () => {
      state.query = "";
      searchInput.value = "";
      updateMenu();
      searchInput.focus();
    });
  }

  if (resetMenu && searchInput) {
    resetMenu.addEventListener("click", () => {
      state.category = "all";
      state.query = "";
      searchInput.value = "";
      updateMenu();
      searchInput.focus();
    });
  }

  const printMenu = doc.getElementById("printMenu");
  if (printMenu) {
    printMenu.addEventListener("click", () => {
      const oldState = { category: state.category, query: state.query };
      state.category = "all";
      state.query = "";
      if (searchInput) searchInput.value = "";
      updateMenu();

      const restoreMenu = () => {
        state.category = oldState.category;
        state.query = oldState.query;
        if (searchInput) searchInput.value = oldState.query;
        updateMenu();
        window.removeEventListener("afterprint", restoreMenu);
      };

      window.addEventListener("afterprint", restoreMenu);
      window.print();
    });
  }

  const schedule = new Map([
    ["Tuesday", { open: 11, close: 21 }],
    ["Wednesday", { open: 11, close: 21 }],
    ["Thursday", { open: 11, close: 21 }],
    ["Friday", { open: 11, close: 21 }],
    ["Saturday", { open: 11, close: 21 }],
  ]);
  const week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function localParts(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  }

  function formatHour(hour) {
    const suffix = hour >= 12 ? "pm" : "am";
    const twelveHour = hour % 12 || 12;
    return `${twelveHour} ${suffix}`;
  }

  function getOpenStatus(now = new Date()) {
    const current = localParts(now);
    const hour = Number(current.hour);
    const minute = Number(current.minute);
    const todayHours = schedule.get(current.weekday);

    if (todayHours && (hour > todayHours.open || (hour === todayHours.open && minute >= 0)) && hour < todayHours.close) {
      return `Open now · closes at ${formatHour(todayHours.close)} ET`;
    }

    if (todayHours && hour < todayHours.open) {
      return `Opens today at ${formatHour(todayHours.open)} ET`;
    }

    const todayIndex = week.indexOf(current.weekday);
    for (let offset = 1; offset <= 7; offset += 1) {
      const nextDay = week[(todayIndex + offset) % week.length];
      const hours = schedule.get(nextDay);
      if (hours) return `Closed now · opens ${nextDay} at ${formatHour(hours.open)} ET`;
    }
    return "Check Facebook for today’s hours";
  }

  const openStatus = doc.getElementById("openStatus");
  const hoursStatus = doc.getElementById("hoursStatus");
  const updateOpenStatus = () => {
    const text = getOpenStatus();
    if (openStatus) openStatus.textContent = text;
    if (hoursStatus) hoursStatus.textContent = text;
  };

  updateSize();
  updateMenu();
  updateOpenStatus();
  window.setInterval(updateOpenStatus, 60_000);

  const year = doc.getElementById("currentYear");
  if (year) year.textContent = String(new Date().getFullYear());
})();
