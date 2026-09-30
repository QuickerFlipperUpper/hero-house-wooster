/* The owner calculator deliberately models only incremental sales and costs.
   Existing pickup sales are a baseline; channel migration never counts as new revenue. */
(function () {
  "use strict";

  function calculateOpportunity(input) {
    const migrated = input.base * input.days * input.share / 100;
    const addedOrders = input.newOrders * input.days;
    const newBaseSales = addedOrders * input.ticket;
    const addOnSales = (migrated + addedOrders) * input.lift;
    const revenue = newBaseSales + addOnSales;
    const variableCosts = revenue * input.cost / 100;
    const onlineRate = input.onlineRate / 100;
    const posRate = input.posRate / 100;
    const onlineFeePerOrder = (input.ticket + input.lift) * onlineRate + input.onlineFixed;
    const formerFeePerOrder = input.ticket * posRate + input.posFixed;
    const migratedFeeDifference = migrated * (onlineFeePerOrder - formerFeePerOrder);
    const newOrderFees = addedOrders * onlineFeePerOrder;
    const processingChange = migratedFeeDifference + newOrderFees;
    const contribution = revenue - variableCosts - processingChange - input.monthly;
    const allocation = input.setup / input.months;
    const afterSetup = contribution - allocation;
    const migratedContribution = migrated * input.lift * (1 - input.cost / 100) - migratedFeeDifference;
    const perAddedOrder = (input.ticket + input.lift) * (1 - input.cost / 100 - onlineRate) - input.onlineFixed;
    const deficit = input.monthly + allocation - migratedContribution;
    const breakEven = deficit <= 0 ? 0 : (perAddedOrder > 0 && input.days > 0 ? deficit / (input.days * perAddedOrder) : null);
    return {
      migrated, addedOrders, newBaseSales, addOnSales, revenue, variableCosts,
      processingChange, migratedFeeDifference, newOrderFees, contribution,
      allocation, afterSetup, perAddedOrder, breakEven,
      payback: input.setup === 0 ? 0 : contribution > 0 ? input.setup / contribution : null,
      hoursFreed: migrated * input.minutes / 60
    };
  }

  // Expose the pure calculation for meaningful arithmetic checks without a DOM.
  if (typeof module !== "undefined" && module.exports) module.exports = { calculateOpportunity };
  if (typeof document === "undefined") return;

  const defaults = Object.freeze({base:30, days:22, ticket:15, share:25, newOrders:1, lift:0.75, cost:40, minutes:2, posRate:2.9, posFixed:0.30, onlineRate:2.9, onlineFixed:0.30, monthly:49, setup:1200, months:12});
  const presets = {
    zero: {...defaults, newOrders:0, lift:0},
    conservative: {...defaults},
    illustrative: {...defaults, share:40, newOrders:3, lift:1.5}
  };
  const scenarioNames = {zero:"Zero growth example · not a forecast",conservative:"Conservative example · not a forecast",illustrative:"Higher activity example · not a forecast",custom:"Your edited assumptions · not a forecast"};
  const form = document.getElementById("opportunity-form");
  const storageKey = "hero-house-opportunity-v1";
  const currency = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0});
  const preciseCurrency = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2});
  const number = new Intl.NumberFormat("en-US", {maximumFractionDigits:1});
  let activeScenario = "conservative";
  let announcementTimer;
  const setText = (id, value) => { document.getElementById(id).textContent = value; };
  function safeRead(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }
  function safeWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* The calculator still works when storage is disabled. */ } }

  function readInputs() {
    const values = {};
    const invalid = [];
    for (const [name] of Object.entries(defaults)) {
      const field = form.elements.namedItem(name);
      const raw = field.value.trim();
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value) || value < Number(field.min) || value > Number(field.max)) {
        invalid.push(field.closest("label").childNodes[0].textContent.trim());
        field.setAttribute("aria-invalid", "true");
      } else {
        field.removeAttribute("aria-invalid");
        values[name] = value;
      }
    }
    setText("input-errors", invalid.length ? `Enter a value within the shown limits for: ${invalid.join(", ")}. Results show the last complete set of inputs.` : "");
    return invalid.length ? null : values;
  }

  function renderResults(values, announce = false) {
    const result = calculateOpportunity(values);
    setText("scenario-label", scenarioNames[activeScenario]);
    setText("monthly-contribution", currency.format(result.contribution));
    setText("mobile-contribution", currency.format(result.contribution));
    document.getElementById("monthly-contribution").classList.toggle("is-negative", result.contribution < 0);
    setText("new-base-sales", currency.format(result.newBaseSales));
    setText("addon-sales", currency.format(result.addOnSales));
    setText("additional-revenue", currency.format(result.revenue));
    setText("variable-cost-result", `−${currency.format(result.variableCosts)}`);
    setText("processing-cost-result", `${result.processingChange < 0 ? "+" : "−"}${currency.format(Math.abs(result.processingChange))}`);
    setText("monthly-cost-result", `−${currency.format(values.monthly)}`);
    setText("after-setup", currency.format(result.afterSetup));
    setText("setup-allocation", `${currency.format(values.setup)} ÷ ${number.format(values.months)} months = ${preciseCurrency.format(result.allocation)}/month`);
    setText("payback", result.payback === null ? "Not recovered" : result.payback === 0 ? "No setup cost" : `${number.format(result.payback)} months`);
    setText("break-even", result.breakEven === null ? "No viable threshold" : `${number.format(Math.ceil(result.breakEven * 10) / 10)} / day`);
    setText("hours-freed", `${number.format(result.hoursFreed)} hours`);
    const insight = values.newOrders === 0 && values.lift === 0
      ? "This scenario adds no sales. Moving existing orders online creates no new base revenue; only a processing difference and service/setup costs change the cash case. Staff attention may still be freed."
      : result.afterSetup > 0
        ? `${number.format(result.addedOrders)} genuinely new monthly orders and ${currency.format(result.addOnSales)} in extra add-ons produce a positive example after the chosen setup allocation. Measure these assumptions in a pilot before relying on them.`
        : "At these assumptions, the added contribution does not cover monthly service and setup allocation. Adjust the actual costs, measure add-on sales, and test whether sufficient new demand exists.";
    setText("scenario-insight", insight);
    document.querySelectorAll("[data-preset]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.preset === activeScenario)));
    if (announce) {
      clearTimeout(announcementTimer);
      announcementTimer = setTimeout(() => setText("calculator-announcement", `Estimated additional monthly contribution ${currency.format(result.contribution)}. After setup allocation ${currency.format(result.afterSetup)}.`), 450);
    }
    safeWrite(storageKey, {version:1, values, scenario:activeScenario});
  }

  function fillValues(values) {
    Object.keys(defaults).forEach(name => { form.elements.namedItem(name).value = String(values[name]); });
  }
  const saved = safeRead(storageKey);
  if (saved && saved.version === 1 && saved.values && Object.keys(defaults).every(key => typeof saved.values[key] === "number" && Number.isFinite(saved.values[key]))) {
    fillValues(saved.values);
    activeScenario = Object.hasOwn(scenarioNames,saved.scenario) ? saved.scenario : "custom";
    const values = readInputs();
    if (values) renderResults(values);
    else { fillValues(defaults); activeScenario = "conservative"; renderResults(readInputs()); }
  } else renderResults(defaults);
  form.addEventListener("submit", event => event.preventDefault());
  form.addEventListener("input", () => { activeScenario = "custom"; const values = readInputs(); if (values) renderResults(values, true); });
  document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => {
    activeScenario = button.dataset.preset; fillValues(presets[activeScenario]); renderResults(readInputs(), true);
  }));
  document.getElementById("print-pitch").addEventListener("click", () => window.print());

  const ticketStorage = "hero-house-demo-ticket-v1";
  const sampleTicket = {version:1, reference:"DEMO-1042", createdAt:new Date().toISOString(), fulfillment:"window", pickup:"soon", pickupLabel:"Illustrative pickup time", status:"received", subtotalCents:2075, items:[{name:"Cheese Steak",variant:"10″",quantity:1,unitCents:1275,note:"Sample: no onions",choice:""},{name:"French Fries",variant:"Side",quantity:1,unitCents:550,note:"",choice:""},{name:"Soft Drinks",variant:"16 oz",quantity:1,unitCents:250,note:"",choice:""}],demo:true};
  let displayedTicket;
  let usingSample = true;
  function isValidTicket(ticket) {
    return !!ticket && ticket.version === 1 && ticket.demo === true &&
      typeof ticket.reference === "string" && /^DEMO-[A-Z0-9-]{1,30}$/i.test(ticket.reference) &&
      ["window","counter"].includes(ticket.fulfillment) && ["soon","later30","later45"].includes(ticket.pickup) &&
      ["received","preparing","ready"].includes(ticket.status) &&
      typeof ticket.pickupLabel === "string" && ticket.pickupLabel.length <= 160 &&
      Number.isInteger(ticket.subtotalCents) && ticket.subtotalCents >= 0 && ticket.subtotalCents <= 10000000 &&
      Array.isArray(ticket.items) && ticket.items.length > 0 && ticket.items.length <= 100 &&
      ticket.items.every(item => item && typeof item.name === "string" && item.name.length <= 160 &&
        typeof item.variant === "string" && item.variant.length <= 160 && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100 &&
        Number.isInteger(item.unitCents) && item.unitCents >= 0 && item.unitCents <= 1000000 &&
        typeof item.note === "string" && item.note.length <= 1000 && (item.choice == null || (typeof item.choice === "string" && item.choice.length <= 160))) &&
      ticket.items.reduce((total,item) => total + item.quantity * item.unitCents,0) === ticket.subtotalCents;
  }
  function renderTicket(ticket, sample) {
    displayedTicket = ticket; usingSample = sample;
    setText("ticket-source", sample ? "Illustrative sample · no order sent" : "Your browser demo · no order sent");
    setText("ticket-fulfillment", ticket.fulfillment === "window" ? "Drive-through window" : "Counter pickup");
    setText("ticket-heading", ticket.reference);
    setText("ticket-time", ticket.pickupLabel);
    setText("ticket-status", ticket.status[0].toUpperCase() + ticket.status.slice(1));
    document.getElementById("ticket-status").dataset.state = ticket.status;
    const list = document.getElementById("ticket-items");
    list.replaceChildren();
    ticket.items.forEach(item => {
      const li = document.createElement("li");
      const line = document.createElement("div"); line.className = "ticket-line";
      const title = document.createElement("span"); title.textContent = `${item.quantity} × ${item.name}`;
      const amount = document.createElement("small"); amount.textContent = preciseCurrency.format(item.unitCents * item.quantity / 100);
      line.append(title, amount); li.append(line);
      const detail = document.createElement("p"); detail.className = "ticket-item-detail";
      detail.textContent = [item.variant, item.choice, item.note].filter(Boolean).join(" · ");
      li.append(detail); list.append(li);
    });
    setText("ticket-total", preciseCurrency.format(ticket.subtotalCents / 100));
    setText("ticket-footnote", sample ? "Sample prices and choices demonstrate a ticket, not an approved menu." : "Saved in this browser for demonstration. No payment, staff notification, or real pickup reservation.");
    document.querySelectorAll("[data-status]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.status === ticket.status)));
  }
  const storedTicket = safeRead(ticketStorage);
  renderTicket(isValidTicket(storedTicket) ? storedTicket : sampleTicket, !isValidTicket(storedTicket));
  document.querySelectorAll("[data-status]").forEach(button => button.addEventListener("click", () => {
    const next = {...displayedTicket, status:button.dataset.status};
    renderTicket(next,usingSample);
    if (!usingSample) safeWrite(ticketStorage,next);
    setText("ticket-announcement", `Demo order ${next.reference} marked ${next.status}. This is a browser simulation.`);
  }));
  window.addEventListener("storage", event => {
    if (event.key !== ticketStorage) return;
    const ticket = safeRead(ticketStorage);
    if (isValidTicket(ticket)) renderTicket(ticket,false);
  });
  window.addEventListener("hero-house-demo-ticket", event => {
    const ticket = event.detail;
    if (isValidTicket(ticket)) renderTicket(ticket,false);
  });
}());
