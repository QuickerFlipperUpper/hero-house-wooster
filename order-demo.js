(() => {
  "use strict";

  // This is an isolated sales demonstration. It has no network or payment path.
  const CART_KEY = "hero-house-demo-cart-v1";
  const TICKET_KEY = "hero-house-demo-ticket-v1";
  const MAX_QUANTITY = 25;
  const MAX_LINES = 40;
  const MAX_NOTE_LENGTH = 160;
  const catalog = new Map();
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const pickupOptions = [
    { value: "soon", label: "Next available", detail: "Example: 20–30 minutes" },
    { value: "later30", label: "In 30 minutes", detail: "Illustrative scheduled pickup" },
    { value: "later45", label: "In 45 minutes", detail: "Illustrative scheduled pickup" },
  ];
  let cart = [];
  let fulfillment = "window";
  let pickup = "soon";
  let view = "cart";
  let editing = null;
  let ticket = null;
  let lastFocus = null;
  let toastTimer;

  const dollars = (cents) => money.format(cents / 100);
  const text = (value) => String(value || "").trim();
  const centsFrom = (value) => {
    const match = text(value).match(/^\$(\d+)\.(\d{2})$/);
    if (!match) return null;
    const cents = Number(match[1]) * 100 + Number(match[2]);
    return Number.isSafeInteger(cents) && cents > 0 && cents < 100_000 ? cents : null;
  };
  const keyFor = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const shortNote = (value) => typeof value === "string" ? value.trim().slice(0, MAX_NOTE_LENGTH) : "";
  const element = (tag, className, content, attributes = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = String(content);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    return node;
  };
  const button = (label, className, handler, attributes = {}) => {
    const node = element("button", className, label, { type: "button", ...attributes });
    node.addEventListener("click", handler);
    return node;
  };
  const link = (label, href, className) => element("a", className, label, { href });
  const fieldLabel = (label, id) => element("label", "od-field-label", label, { for: id });

  function readCatalog() {
    document.querySelectorAll("[data-menu-item]").forEach((card) => {
      const name = text(card.querySelector("h4")?.textContent);
      if (!name) return;
      const variants = [];
      card.querySelectorAll("[data-size-price]").forEach((price) => {
        const cents = centsFrom(price.querySelector("strong")?.textContent);
        if (cents !== null) variants.push({
          key: price.dataset.sizePrice,
          label: text(price.querySelector("small")?.textContent),
          cents,
        });
      });
      if (!variants.length) {
        const singlePrice = card.querySelector(".menu-card__single-price");
        const prices = text(singlePrice?.querySelector("strong")?.textContent).split("·").map(text);
        const labels = text(singlePrice?.querySelector("span")?.textContent).split("·").map(text);
        prices.forEach((price, index) => {
          const cents = centsFrom(price);
          if (cents !== null) variants.push({ key: `option-${index}`, label: labels[index] || "Regular", cents });
        });
      }
      if (!variants.length) return;
      const item = {
        id: `${card.dataset.category}-${keyFor(name)}`,
        name,
        category: card.dataset.category,
        description: text(card.querySelector("p")?.textContent),
        variants,
        card,
      };
      catalog.set(item.id, item);
    });
  }

  function choicesFor(item) {
    if (item.name === "Soft Drinks") {
      // These choices are read from the visible menu description, not priced add-ons.
      return item.description.replace(/\.$/, "").replace(/,? and /g, ", ").split(",").map(text).filter(Boolean);
    }
    if (item.category === "salads") {
      const footnote = item.card.closest("[data-menu-group]")?.querySelector(".menu-group__footnote");
      return text(footnote?.textContent).replace(/^Dressings listed:\s*/i, "").replace(/\.$/, "").replace(/,? and /g, ", ").split(",").map(text).filter(Boolean);
    }
    return [];
  }

  function preferredVariant(item) {
    const selectedSize = document.querySelector('[data-size-option][aria-pressed="true"]')?.dataset.sizeOption;
    return item.variants.find((variant) => variant.key === selectedSize) || item.variants[0];
  }

  function safeLoad(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || "null"); }
    catch { return null; }
  }
  function safeStore(key, data) {
    try { window.localStorage.setItem(key, JSON.stringify(data)); }
    catch { /* The demonstration still works with memory when storage is denied. */ }
  }
  function safeRemove(key) {
    try { window.localStorage.removeItem(key); }
    catch { /* No persistent state to remove. */ }
  }

  function validCartLine(candidate, index) {
    if (!candidate || typeof candidate !== "object") return null;
    const item = catalog.get(candidate.itemId);
    const variant = item?.variants.find((entry) => entry.key === candidate.variantKey);
    if (!item || !variant || !Number.isInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > MAX_QUANTITY) return null;
    const allowedChoices = choicesFor(item);
    return {
      id: `line-${Date.now()}-${index}`,
      itemId: item.id,
      variantKey: variant.key,
      quantity: candidate.quantity,
      note: shortNote(candidate.note),
      choice: allowedChoices.includes(candidate.choice) ? candidate.choice : "",
    };
  }

  function loadCart() {
    const stored = safeLoad(CART_KEY);
    if (!stored || stored.version !== 1) return;
    if (Array.isArray(stored.items)) cart = stored.items.slice(0, MAX_LINES).map(validCartLine).filter(Boolean);
    fulfillment = stored.fulfillment === "counter" ? "counter" : "window";
    pickup = pickupOptions.some((option) => option.value === stored.pickup) ? stored.pickup : "soon";
  }
  function validatedTicket(candidate) {
    if (!candidate || candidate.version !== 1 || candidate.demo !== true || !Array.isArray(candidate.items) || !candidate.items.length || candidate.items.length > MAX_LINES) return null;
    if (typeof candidate.reference !== "string" || !/^DEMO-\d{4}$/.test(candidate.reference)) return null;
    if (typeof candidate.createdAt !== "string" || !Number.isFinite(Date.parse(candidate.createdAt))) return null;
    const items = [];
    for (const saved of candidate.items) {
      if (!saved || typeof saved !== "object") return null;
      const item = Array.from(catalog.values()).find((entry) => entry.name === saved.name);
      const variant = item?.variants.find((entry) => entry.label === saved.variant && entry.cents === saved.unitCents);
      if (!item || !variant || !Number.isInteger(saved.quantity) || saved.quantity < 1 || saved.quantity > MAX_QUANTITY) return null;
      items.push({ name: item.name, variant: variant.label, quantity: saved.quantity, unitCents: variant.cents, note: shortNote(saved.note), choice: choicesFor(item).includes(saved.choice) ? saved.choice : "" });
    }
    const option = pickupOptions.find((entry) => entry.value === candidate.pickup) || pickupOptions[0];
    return {
      version: 1,
      demo: true,
      reference: candidate.reference,
      createdAt: candidate.createdAt,
      fulfillment: candidate.fulfillment === "counter" ? "counter" : "window",
      pickup: option.value,
      pickupLabel: `${option.label} · ${option.detail}`,
      status: ["received", "preparing", "ready"].includes(candidate.status) ? candidate.status : "received",
      subtotalCents: items.reduce((sum, entry) => sum + entry.unitCents * entry.quantity, 0),
      items,
    };
  }
  function saveCart() { safeStore(CART_KEY, { version: 1, items: cart, fulfillment, pickup }); }
  function lineDetails(line) {
    const item = catalog.get(line.itemId);
    const variant = item.variants.find((entry) => entry.key === line.variantKey);
    return { item, variant, total: variant.cents * line.quantity };
  }
  const subtotal = () => cart.reduce((sum, line) => sum + lineDetails(line).total, 0);
  const count = () => cart.reduce((sum, line) => sum + line.quantity, 0);

  const dialog = element("dialog", "od-dialog", null, {
    "aria-labelledby": "od-title",
    "aria-describedby": "od-demo-notice",
  });
  const shell = element("div", "od-shell");
  const header = element("header", "od-header");
  const heading = element("div", "od-header__identity");
  heading.append(element("span", "od-eyebrow", "HERO HOUSE · WOOSTER"), element("h2", "od-title", "Your pickup order", { id: "od-title" }));
  const closeButton = button("×", "od-close", close, { "aria-label": "Close ordering demo" });
  header.append(heading, closeButton);
  const notice = element("p", "od-demo-notice", "INTERACTIVE DEMO · No payment. No order is sent to the shop.", { id: "od-demo-notice" });
  const body = element("div", "od-body");
  shell.append(header, notice, body);
  dialog.append(shell);
  const toast = element("div", "od-toast", "", { role: "status", "aria-live": "polite", "aria-atomic": "true" });
  // Keep feedback inside the modal top layer, where it remains accessible.
  shell.append(toast);
  const launcher = button("", "od-launcher", () => open(), { "aria-haspopup": "dialog", "aria-label": "Open online pickup ordering demo" });
  const launcherIcon = element("span", "od-launcher__icon", "✦", { "aria-hidden": "true" });
  const launcherCopy = element("span", "od-launcher__copy");
  const launcherTitle = element("strong", "", "Try online ordering");
  const launcherDetail = element("span", "", "Demo · pickup at the window");
  const launcherCount = element("span", "od-launcher__count", "0", { "aria-hidden": "true" });
  launcherCopy.append(launcherTitle, launcherDetail);
  launcher.append(launcherIcon, launcherCopy, launcherCount);

  function announce(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }
  function updateLauncher() {
    const units = count();
    launcherTitle.textContent = units ? "Review demo order" : "Try online ordering";
    launcherDetail.textContent = units ? `${units} ${units === 1 ? "item" : "items"} · ${dollars(subtotal())} subtotal` : "Demo · pickup at the window";
    launcherCount.textContent = String(units);
    launcherCount.hidden = units === 0;
    launcher.setAttribute("aria-label", units ? `Review demo order: ${units} items, ${dollars(subtotal())} menu subtotal` : "Try online pickup ordering demo");
    document.querySelectorAll("[data-order-count]").forEach((node) => { node.textContent = String(units); });
  }
  function changeCart() {
    saveCart();
    updateLauncher();
  }

  function progress(active) {
    const list = element("ol", "od-progress", null, { "aria-label": "Demo order progress" });
    ["Choose your food", "Review pickup", "See the kitchen ticket"].forEach((label, index) => {
      const step = element("li", `od-progress__step${index === active ? " is-current" : ""}`);
      if (index === active) step.setAttribute("aria-current", "step");
      step.append(element("span", "od-progress__number", index + 1), element("span", "", label));
      list.append(step);
    });
    return list;
  }

  function open(trigger) {
    lastFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    view = "cart";
    render();
    if (!dialog.open) dialog.showModal();
    body.querySelector("[data-initial-focus]")?.focus();
  }
  function close() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("od-modal-open");
    if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });

  function showConfig(itemId, lineId, trigger) {
    const item = catalog.get(itemId);
    if (!item) return;
    if (!dialog.open) lastFocus = trigger || document.activeElement;
    editing = lineId ? cart.find((line) => line.id === lineId) : null;
    view = "customize";
    renderConfig(item);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("od-modal-open");
    body.querySelector("[data-initial-focus]")?.focus();
  }

  function render() {
    body.replaceChildren();
    dialog.scrollTop = 0;
    document.documentElement.classList.add("od-modal-open");
    if (view === "confirmation" && ticket) renderConfirmation();
    else renderCart();
  }

  function renderConfig(item) {
    body.replaceChildren(progress(0));
    dialog.scrollTop = 0;
    document.getElementById("od-title").textContent = editing ? "Make it yours" : "Build your demo order";
    const back = button("← Back to your order", "od-text-button", () => { view = "cart"; render(); });
    const layout = element("div", "od-config-layout");
    const form = element("form", "od-config-form");
    const name = element("h3", "od-item-heading", item.name);
    const description = element("p", "od-description", item.description);
    form.append(back, name, description);

    const selected = editing ? item.variants.find((variant) => variant.key === editing.variantKey) : preferredVariant(item);
    const sizes = element("fieldset", "od-options");
    sizes.append(element("legend", "od-field-label", item.category === "drinks" ? "Choose a drink size" : item.variants.length > 1 ? "Choose your hero size" : "Menu portion"));
    const sizeGrid = element("div", "od-size-options");
    item.variants.forEach((variant) => {
      const label = element("label", "od-size-option");
      const input = element("input", "", null, { type: "radio", name: "variant", value: variant.key, required: "", ...(variant.key === selected.key ? { "data-initial-focus": "" } : {}) });
      input.checked = variant.key === selected.key;
      const visual = element("span", "od-size-option__visual");
      visual.append(element("strong", "", variant.label), element("span", "", dollars(variant.cents)));
      label.append(input, visual);
      sizeGrid.append(label);
    });
    sizes.append(sizeGrid);
    if (item.category === "heroes" && item.variants.length < 3) sizes.append(element("p", "od-field-help", "Only the priced sizes on the preview menu are available in this demo."));
    form.append(sizes);

    const choices = choicesFor(item);
    if (choices.length) {
      const id = "od-choice";
      const wrapper = element("div", "od-field");
      const select = element("select", "od-select", null, { name: "choice", id });
      select.append(element("option", "", "Choose at pickup / no preference", { value: "" }));
      choices.forEach((choice) => select.append(element("option", "", choice, { value: choice })));
      select.value = editing?.choice || "";
      wrapper.append(fieldLabel(item.category === "drinks" ? "Choose your drink" : "Dressing preference", id), select);
      form.append(wrapper);
    }

    const notes = element("div", "od-field");
    const noteInput = element("textarea", "od-textarea", null, { id: "od-note", name: "note", rows: "2", maxlength: MAX_NOTE_LENGTH, placeholder: "For example: no onions", "aria-describedby": "od-note-help" });
    noteInput.value = editing?.note || "";
    notes.append(fieldLabel("Special request (optional)", "od-note"), noteInput, element("p", "od-field-help", "Requests need shop approval. Priced extras and allergen options are not configured in this demo.", { id: "od-note-help" }));
    form.append(notes);

    const quantityField = element("div", "od-config-quantity");
    const qty = element("input", "od-quantity-input", null, { id: "od-quantity", name: "quantity", type: "number", min: "1", max: MAX_QUANTITY, step: "1", value: editing?.quantity || 1, inputmode: "numeric" });
    quantityField.append(fieldLabel("Quantity", "od-quantity"), qty);
    const submit = element("button", "od-primary", "", { type: "submit" });
    const totalLabel = element("strong", "");
    submit.append(element("span", "", editing ? "Update demo order" : "Add to demo order"), totalLabel);
    const updateConfigPrice = () => {
      const chosen = item.variants.find((variant) => variant.key === form.elements.variant.value) || selected;
      const quantity = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(qty.value) || 1)));
      totalLabel.textContent = dollars(chosen.cents * quantity);
    };
    form.addEventListener("change", updateConfigPrice);
    qty.addEventListener("input", updateConfigPrice);
    updateConfigPrice();
    const submitRow = element("div", "od-submit-row");
    submitRow.append(quantityField, submit);
    form.append(submitRow);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const variantKey = form.elements.variant.value;
      const variant = item.variants.find((entry) => entry.key === variantKey);
      const quantity = Number(qty.value);
      if (!variant || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return;
      const note = shortNote(noteInput.value);
      const choice = choices.includes(form.elements.choice?.value) ? form.elements.choice.value : "";
      const match = cart.find((line) => line.itemId === item.id && line.variantKey === variant.key && line.note === note && line.choice === choice && line.id !== editing?.id);
      if (!editing && match && match.quantity + quantity <= MAX_QUANTITY) match.quantity += quantity;
      else if (editing) Object.assign(editing, { variantKey, quantity, note, choice });
      else {
        if (cart.length >= MAX_LINES) { announce("This demo supports up to 40 different items. Remove an item before adding another."); return; }
        cart.push({ id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, itemId: item.id, variantKey, quantity, note, choice });
      }
      const wasEditing = Boolean(editing);
      editing = null;
      changeCart();
      view = "cart";
      render();
      body.querySelector("[data-initial-focus]")?.focus();
      announce(`${item.name} ${wasEditing ? "updated" : "added"} in your demo order.`);
    });

    const aside = element("aside", "od-window-card");
    aside.append(element("span", "od-window-card__mark", "H", { "aria-hidden": "true" }), element("p", "od-eyebrow", "PICKUP MADE SIMPLE"), element("h3", "", "Your hero. Your pickup."));
    aside.append(element("p", "", "Choose your food here. Review the details. Pick up at the drive-through window or inside the shop."));
    const steps = element("ol", "od-mini-steps");
    ["Build a clear, itemized order", "Choose your pickup preference", "See a sample kitchen ticket"].forEach((step) => steps.append(element("li", "", step)));
    aside.append(steps, element("p", "od-window-card__fine", "This preview demonstrates the customer experience. Live orders require owner approval and an ordering service."));
    layout.append(form, aside);
    body.append(layout);
  }

  function renderCart() {
    document.getElementById("od-title").textContent = "Your pickup order";
    body.append(progress(cart.length ? 1 : 0));
    const layout = element("div", "od-cart-layout");
    const contents = element("section", "od-cart-content", null, { "aria-label": "Demo cart items" });
    if (!cart.length) renderEmpty(contents);
    else {
      const headingRow = element("div", "od-cart-content__heading");
      headingRow.append(element("h3", "", "In your bag"), button("Add more food ↗", "od-text-button", browseMenu, { "data-initial-focus": "" }));
      contents.append(headingRow);
      const list = element("ul", "od-cart-list");
      cart.forEach((line) => list.append(cartRow(line)));
      contents.append(list);
      renderSuggestions(contents);
    }
    const review = checkoutSummary();
    layout.append(contents, review);
    body.append(layout);
    const footer = element("div", "od-owner-link");
    footer.append(element("span", "", "Show the business case behind this experience."), link("Owner preview & profit scenarios ↗", "owner.html", "od-text-link"));
    body.append(footer);
  }

  function browseMenu() {
    close();
    const menu = document.getElementById("menu");
    menu?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function renderEmpty(container) {
    const empty = element("div", "od-empty");
    empty.append(element("span", "od-empty__mark", "✦", { "aria-hidden": "true" }), element("h3", "", "Start with something good."), element("p", "", "Try a complete pickup order using the shop’s preview menu. Your order stays in this browser."));
    const favorites = element("div", "od-favorites");
    ["Cheese Steak Deluxe", "Meatball Supreme", "Italian Combo"].forEach((name) => {
      const item = Array.from(catalog.values()).find((entry) => entry.name === name);
      if (!item) return;
      const variant = preferredVariant(item);
      const pick = button("", "od-favorite", () => showConfig(item.id));
      pick.append(element("span", "", item.name), element("strong", "", `${variant.label} · ${dollars(variant.cents)}`), element("span", "od-favorite__arrow", "+", { "aria-hidden": "true" }));
      favorites.append(pick);
    });
    empty.append(favorites, button("Explore the full menu →", "od-secondary", browseMenu, { "data-initial-focus": "" }));
    if (ticket) empty.append(button("View the last demo ticket", "od-text-button", () => { view = "confirmation"; render(); }));
    container.append(empty);
  }

  function cartRow(line) {
    const { item, variant, total } = lineDetails(line);
    const row = element("li", "od-cart-line");
    const top = element("div", "od-cart-line__top");
    top.append(element("h4", "", item.name), element("strong", "od-price", dollars(total)));
    const detail = element("p", "od-cart-line__details", `${variant.label} · ${dollars(variant.cents)} each${line.choice ? ` · ${line.choice}` : ""}`);
    row.append(top, detail);
    if (line.note) row.append(element("p", "od-cart-line__note", `Request: ${line.note}`));
    const controls = element("div", "od-cart-line__controls");
    const quantity = element("div", "od-quantity-stepper", null, { role: "group", "aria-label": `Quantity for ${item.name}` });
    const setQuantity = (next, focusAction) => {
      line.quantity = Math.max(1, Math.min(MAX_QUANTITY, next));
      changeCart();
      render();
      const preferred = body.querySelector(`[data-line-focus="${line.id}-${focusAction}"]`);
      const alternative = body.querySelector(`[data-line-focus="${line.id}-${focusAction === "minus" ? "plus" : "minus"}"]`);
      (preferred?.disabled ? alternative : preferred)?.focus();
      announce(`${item.name}: ${line.quantity} ${line.quantity === 1 ? "item" : "items"}. Demo menu subtotal ${dollars(subtotal())}.`);
    };
    const minus = button("−", "", () => setQuantity(line.quantity - 1, "minus"), { "aria-label": `Decrease ${item.name} quantity`, "data-line-focus": `${line.id}-minus` });
    minus.disabled = line.quantity === 1;
    const amount = element("span", "", line.quantity, { "aria-label": `${line.quantity} ${line.quantity === 1 ? "item" : "items"}` });
    const plus = button("+", "", () => setQuantity(line.quantity + 1, "plus"), { "aria-label": `Increase ${item.name} quantity`, "data-line-focus": `${line.id}-plus` });
    plus.disabled = line.quantity === MAX_QUANTITY;
    quantity.append(minus, amount, plus);
    const edit = button("Edit", "od-text-button", () => showConfig(item.id, line.id));
    const remove = button("Remove", "od-text-button od-text-button--muted", () => {
      cart = cart.filter((entry) => entry.id !== line.id);
      changeCart();
      render();
      body.querySelector("[data-initial-focus]")?.focus();
      announce(`${item.name} removed from your demo order.`);
    }, { "aria-label": `Remove ${item.name} from the demo order` });
    controls.append(quantity, edit, remove);
    row.append(controls);
    return row;
  }

  function renderSuggestions(container) {
    const candidates = ["French Fries", "Soft Drinks"].map((name) => Array.from(catalog.values()).find((entry) => entry.name === name)).filter(Boolean);
    const suggestions = candidates.filter((item) => !cart.some((line) => line.itemId === item.id));
    if (!suggestions.length) return;
    const section = element("section", "od-suggestions", null, { "aria-label": "Optional sides and drinks" });
    section.append(element("span", "od-eyebrow", "A GOOD PAIRING"), element("h4", "", "Make it a full meal."));
    const options = element("div", "od-suggestions__items");
    suggestions.forEach((item) => {
      const variant = item.variants[0];
      const add = button("", "od-suggestion", () => showConfig(item.id));
      add.append(element("span", "", item.name), element("strong", "", `${item.variants.length > 1 ? `${variant.label} · ` : ""}${dollars(variant.cents)}`), element("span", "od-suggestion__plus", "+", { "aria-hidden": "true" }));
      options.append(add);
    });
    section.append(options, element("p", "od-field-help", "Optional menu additions at the listed prices. No bundle discount is implied."));
    container.append(section);
  }

  function checkoutSummary() {
    const summary = element("section", "od-summary", null, { "aria-label": "Demo pickup details and subtotal" });
    const topline = element("div", "od-summary__topline");
    topline.append(element("span", "od-eyebrow", "PICKUP AT HERO HOUSE"), element("span", "od-demo-stamp", "DEMO"));
    summary.append(topline, element("h3", "", "Order ahead. Pick up your way."));
    const method = element("fieldset", "od-options od-fulfillment");
    method.append(element("legend", "od-field-label", "Where would you pick up?"));
    [
      { value: "window", name: "Drive-through window", detail: "Collect without leaving your car" },
      { value: "counter", name: "Inside the shop", detail: "Collect at the counter" },
    ].forEach((option) => {
      const label = element("label", "od-pickup-option");
      const input = element("input", "", null, { type: "radio", name: "fulfillment", value: option.value });
      input.checked = fulfillment === option.value;
      input.addEventListener("change", () => { fulfillment = option.value; saveCart(); });
      const copy = element("span", "");
      copy.append(element("strong", "", option.name), element("small", "", option.detail));
      label.append(input, copy);
      method.append(label);
    });
    summary.append(method);
    const timing = element("div", "od-field");
    const select = element("select", "od-select", null, { id: "od-pickup-time", name: "pickup-time", "aria-describedby": "od-time-help" });
    pickupOptions.forEach((option) => select.append(element("option", "", `${option.label} · ${option.detail}`, { value: option.value })));
    select.value = pickup;
    select.addEventListener("change", () => { pickup = select.value; saveCart(); });
    timing.append(fieldLabel("Illustrative pickup time", "od-pickup-time"), select, element("p", "od-field-help", "Example times only. The shop would set actual availability and confirm when to arrive. A pickup time does not guarantee no queue.", { id: "od-time-help" }));
    summary.append(timing);
    const totals = element("dl", "od-totals");
    const line = element("div", "od-totals__main");
    line.append(element("dt", "", "Menu subtotal"), element("dd", "", dollars(subtotal())));
    totals.append(line);
    summary.append(totals, element("p", "od-summary__fine", "Menu prices need owner confirmation. Tax, payment fees, tips, and priced extras are not calculated in this demo."));
    const checkout = button("", "od-primary od-checkout", createTicket);
    checkout.disabled = !cart.length;
    checkout.append(element("span", "", "Place demo order"), element("span", "", "→", { "aria-hidden": "true" }));
    summary.append(checkout, element("p", "od-summary__safe", "No charge · No order sent · No personal details"));
    return summary;
  }

  function createTicket() {
    if (!cart.length) return;
    const option = pickupOptions.find((entry) => entry.value === pickup) || pickupOptions[0];
    ticket = {
      version: 1,
      demo: true,
      reference: `DEMO-${String(Date.now()).slice(-4)}`,
      createdAt: new Date().toISOString(),
      fulfillment,
      pickup,
      pickupLabel: `${option.label} · ${option.detail}`,
      status: "received",
      subtotalCents: subtotal(),
      items: cart.map((line) => {
        const { item, variant } = lineDetails(line);
        return { name: item.name, variant: variant.label, quantity: line.quantity, unitCents: variant.cents, note: line.note, choice: line.choice };
      }),
    };
    persistTicket();
    cart = [];
    safeRemove(CART_KEY);
    updateLauncher();
    view = "confirmation";
    render();
    body.querySelector("[data-initial-focus]")?.focus();
    announce("Demo order created in this browser. Nothing was sent to Hero House.");
  }

  function persistTicket() {
    safeStore(TICKET_KEY, ticket);
    window.dispatchEvent(new CustomEvent("hero-house-demo-ticket", { detail: ticket }));
  }

  function renderConfirmation() {
    document.getElementById("od-title").textContent = "From your order to the kitchen";
    body.append(progress(2));
    const layout = element("div", "od-confirm-layout");
    const copy = element("section", "od-confirm-copy");
    copy.append(element("span", "od-confirm-mark", "✓", { "aria-hidden": "true" }), element("p", "od-eyebrow", "DEMO ORDER CREATED"), element("h3", "", ticket.fulfillment === "window" ? "See you at the window." : "See you at the counter."), element("p", "od-description", "This is a simulated confirmation. Your food has not been ordered or prepared, and no message has been sent."));
    const pickupInfo = element("div", "od-confirm-pickup");
    pickupInfo.append(element("span", "od-field-label", "Your demo pickup preference"), element("strong", "", ticket.fulfillment === "window" ? "Drive-through window" : "Inside / counter pickup"), element("p", "", ticket.pickupLabel));
    copy.append(pickupInfo);
    const journey = element("ol", "od-journey");
    [
      "The customer reviews the order before placing it.",
      "The kitchen receives a clear ticket and pickup preference.",
      ticket.fulfillment === "window" ? "Staff stages the order for collection at the drive-through window." : "Staff stages the order for collection at the counter.",
    ].forEach((step) => journey.append(element("li", "", step)));
    copy.append(journey);
    copy.append(element("p", "od-field-help", ticket.fulfillment === "window" ? "In a live window pickup: wait for the shop’s ready confirmation, arrive for the agreed time, and give your order name or code at the window. Stay in your car; actual queue procedures need shop approval." : "In a live counter pickup: wait for the shop’s ready confirmation, then provide your order name or code when collecting inside."));
    const actions = element("div", "od-confirm-actions");
    actions.append(link("Explore the owner business case ↗", "owner.html", "od-primary"), button("Build another demo order", "od-secondary", () => { view = "cart"; render(); body.querySelector("[data-initial-focus]")?.focus(); }));
    copy.append(actions, element("p", "od-field-help", "In a live setup, staff would approve pickup availability and send real confirmations. The controls here only change this sample ticket."));

    const kitchen = element("section", "od-kitchen", null, { "aria-label": "Sample kitchen workflow" });
    const ticketPaper = element("article", "od-ticket", null, { "aria-label": "Itemized demo kitchen ticket" });
    const brand = element("div", "od-ticket__brand");
    brand.append(element("strong", "", "HERO HOUSE"), element("span", "", "141 N. Bever St. · Wooster, OH"), element("b", "od-ticket__demo", "SIMULATED KITCHEN TICKET"));
    const reference = element("div", "od-ticket__reference");
    reference.append(element("span", "", ticket.reference), element("span", "", `${ticket.items.reduce((sum, entry) => sum + entry.quantity, 0)} items`));
    const type = element("div", "od-ticket__pickup", ticket.fulfillment === "window" ? "DRIVE-THROUGH WINDOW" : "COUNTER PICKUP");
    const time = element("p", "od-ticket__time", `EXAMPLE PICKUP: ${ticket.pickupLabel}`);
    ticketPaper.append(brand, reference, type, time);
    const items = element("ul", "od-ticket__items");
    ticket.items.forEach((item) => {
      const row = element("li", "od-ticket__item");
      const line = element("div", "od-ticket__item-main");
      line.append(element("strong", "", `${item.quantity} × ${item.name}`), element("strong", "", dollars(item.unitCents * item.quantity)));
      row.append(line, element("p", "", `${item.variant}${item.choice ? ` · ${item.choice}` : ""}`));
      if (item.note) row.append(element("p", "od-ticket__request", `REQUEST: ${item.note}`));
      items.append(row);
    });
    const total = element("div", "od-ticket__subtotal");
    total.append(element("span", "", "MENU SUBTOTAL"), element("strong", "", dollars(ticket.subtotalCents)));
    const statusText = ticket.status === "ready" ? (ticket.fulfillment === "window" ? "DEMO: READY FOR WINDOW" : "DEMO: READY FOR COUNTER") : ticket.status === "preparing" ? "DEMO: PREPARING" : "DEMO: RECEIVED";
    ticketPaper.append(items, total, element("div", `od-ticket__status is-${ticket.status}`, statusText, { role: "status", "aria-live": "polite" }), element("p", "od-ticket__foot", "No live order · no payment collected\nTax and fees not calculated"));
    kitchen.append(ticketPaper);
    const controls = element("div", "od-kitchen-controls");
    controls.append(element("p", "od-field-label", "Try the staff workflow"));
    const buttons = element("div", "od-kitchen-controls__buttons", null, { role: "group", "aria-label": "Simulate kitchen status" });
    [
      { value: "received", label: "Received" },
      { value: "preparing", label: "Preparing" },
      { value: "ready", label: "Ready for pickup" },
    ].forEach((option) => {
      const control = button(option.label, "od-status-button", () => {
        ticket.status = option.value;
        persistTicket();
        render();
        body.querySelector(`[data-demo-status="${option.value}"]`)?.focus();
        announce(`Sample kitchen ticket marked ${option.label.toLowerCase()}. No order or notification was sent.`);
      }, { "aria-pressed": String(ticket.status === option.value), "data-demo-status": option.value, ...(option.value === "preparing" ? { "data-initial-focus": "" } : {}) });
      buttons.append(control);
    });
    controls.append(buttons, element("p", "od-field-help", "Simulated status only. No customer notification is sent."));
    kitchen.append(controls);
    layout.append(copy, kitchen);
    body.append(layout);
  }

  function attachMenuControls() {
    catalog.forEach((item) => {
      const add = button("", "od-menu-add", (event) => showConfig(item.id, null, event.currentTarget), { "aria-haspopup": "dialog" });
      add.append(element("span", "", "Add to demo order"), element("strong", "od-menu-add__price", ""));
      item.card.append(add);
      item.addControl = add;
    });
    const updatePrices = () => catalog.forEach((item) => {
      const variant = preferredVariant(item);
      item.addControl.querySelector(".od-menu-add__price").textContent = `+ ${dollars(variant.cents)}`;
      item.addControl.setAttribute("aria-label", `Configure ${item.name}, ${variant.label}, ${dollars(variant.cents)}, for a demo order`);
    });
    updatePrices();
    const observer = new MutationObserver(updatePrices);
    document.querySelectorAll("[data-size-option]").forEach((size) => observer.observe(size, { attributes: true, attributeFilter: ["aria-pressed"] }));
  }

  readCatalog();
  if (!catalog.size) return;
  loadCart();
  ticket = validatedTicket(safeLoad(TICKET_KEY));
  document.body.append(dialog, launcher);
  attachMenuControls();
  updateLauncher();
  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest("[data-open-order]") : null;
    if (!trigger) return;
    event.preventDefault();
    const siteNav = document.getElementById("siteNav");
    const navToggle = document.getElementById("navToggle");
    if (siteNav?.classList.contains("is-open")) {
      siteNav.classList.remove("is-open");
      navToggle?.setAttribute("aria-expanded", "false");
      navToggle?.setAttribute("aria-label", "Open navigation");
    }
    open(trigger);
  });
  window.HeroHouseOrder = Object.freeze({
    open,
    getDemoTicket: () => ticket ? JSON.parse(JSON.stringify(ticket)) : null,
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== TICKET_KEY) return;
    const refreshed = validatedTicket(safeLoad(TICKET_KEY));
    if (refreshed && ticket?.reference === refreshed.reference) {
      ticket = refreshed;
      if (dialog.open && view === "confirmation") render();
    }
  });
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#order-demo") open();
  });
  if (window.location.hash === "#order-demo") window.setTimeout(() => open(), 0);
})();
