const state = {
  manifest: null,
  selectedService: null,
  selectedServiceId: "",
  currentDate: new Date(),
  scrollY: 0,
  serviceMenuHistoryOpen: false
};

const servicePicker = document.getElementById("servicePicker");
const serviceTrigger = document.getElementById("serviceTrigger");
const serviceTriggerText = document.getElementById("serviceTriggerText");
const serviceMenu = document.getElementById("serviceMenu");
const emptyState = document.getElementById("emptyState");
const calendarArea = document.getElementById("calendarArea");
const serviceSummary = document.getElementById("serviceSummary");
const monthControls = document.querySelector(".month-controls");
const monthLabel = document.getElementById("monthLabel");
const daysGrid = document.getElementById("daysGrid");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalDate = document.getElementById("modalDate");
const modalTitle = document.getElementById("modalTitle");
const modalScrollHint = document.getElementById("modalScrollHint");
const modalActivities = document.getElementById("modalActivities");

const monthFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric"
});

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

function loadJson(path) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("GET", path, true);
    request.overrideMimeType("application/json");
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText));
        } catch (error) {
          reject(new Error(`No se pudo interpretar ${path}`));
        }
      } else {
        reject(new Error(`No se pudo cargar ${path}`));
      }
    };
    request.onerror = () => reject(new Error(`No se pudo cargar ${path}`));
    request.send();
  });
}

function init() {
  loadJson("config/servicios.json")
    .then((manifest) => {
      state.manifest = manifest;
      populateServices();
      renderBlankState();
    })
    .catch((error) => {
      emptyState.innerHTML = `
        <h2>No se pudo cargar la configuración</h2>
        <p>${error.message}. Si abriste el HTML directo desde el archivo, usá un servidor local para permitir la lectura de JSON.</p>
      `;
    });
}

function populateServices() {
  serviceMenu.innerHTML = "";
  serviceMenu.appendChild(createServiceOption({
    id: "",
    nombre: "Seleccioná un servicio"
  }));

  state.manifest.servicios.forEach((service) => {
    serviceMenu.appendChild(createServiceOption(service));
  });
}

function createServiceOption(service) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "select-option";
  option.setAttribute("role", "option");
  option.dataset.value = service.id;
  option.innerHTML = `<span>${service.nombre}</span><span class="select-check" aria-hidden="true"></span>`;
  option.addEventListener("click", () => {
    chooseService(service.id, service.nombre);
  });
  return option;
}

function chooseService(serviceId, serviceName) {
  state.selectedServiceId = serviceId;
  serviceTriggerText.textContent = serviceName;
  serviceTrigger.blur();
  closeServiceMenu({ replaceHistory: true });
  updateServiceOptions();

  selectService(serviceId).catch((error) => {
    emptyState.hidden = false;
    calendarArea.hidden = true;
    emptyState.innerHTML = `<h2>Error al abrir el servicio</h2><p>${error.message}</p>`;
  });
}

function updateServiceOptions() {
  serviceMenu.querySelectorAll(".select-option").forEach((option) => {
    const isSelected = option.dataset.value === state.selectedServiceId;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
    option.querySelector(".select-check").textContent = isSelected && option.dataset.value ? "✓" : "";
  });
}

function toggleServiceMenu() {
  if (serviceMenu.hidden) {
    openServiceMenu();
  } else {
    closeServiceMenu();
  }
}

function openServiceMenu() {
  if (isMobileViewport() && !state.serviceMenuHistoryOpen) {
    try {
      history.pushState({ ui: "service-menu" }, "", window.location.href);
      state.serviceMenuHistoryOpen = true;
    } catch (error) {
      state.serviceMenuHistoryOpen = false;
    }
  }

  serviceMenu.hidden = false;
  servicePicker.classList.add("is-open");
  serviceTrigger.setAttribute("aria-expanded", "true");
  updateServiceOptions();
}

function closeServiceMenu(options = {}) {
  const { fromPopState = false } = options;
  const { replaceHistory = false } = options;

  if (serviceMenu.hidden) {
    return;
  }

  serviceMenu.hidden = true;
  servicePicker.classList.remove("is-open");
  serviceTrigger.setAttribute("aria-expanded", "false");

  if (fromPopState) {
    state.serviceMenuHistoryOpen = false;
    return;
  }

  if (state.serviceMenuHistoryOpen && isMobileViewport() && history.state && history.state.ui === "service-menu") {
    state.serviceMenuHistoryOpen = false;
    if (replaceHistory) {
      try {
        history.replaceState(null, "", window.location.href);
      } catch (error) {
        // Safari can reject History API calls in some restricted contexts.
      }
    } else {
      history.back();
    }
  }
}

function renderBlankState() {
  state.selectedService = null;
  state.selectedServiceId = "";
  serviceTriggerText.textContent = "Seleccioná un servicio";
  updateServiceOptions();
  emptyState.hidden = false;
  calendarArea.hidden = true;
  monthLabel.textContent = "Calendario";
  daysGrid.innerHTML = "";
  serviceSummary.innerHTML = "";
}

function selectService(serviceId) {
  if (!serviceId) {
    renderBlankState();
    return Promise.resolve();
  }

  const serviceEntry = state.manifest.servicios.find((service) => service.id === serviceId);
  return loadJson(serviceEntry.config).then((serviceData) => {
    state.selectedService = serviceData;

    const firstActivity = serviceData.actividades
      .reduce((dates, activity) => dates.concat(activity.fechas), [])
      .map((date) => new Date(`${date.dia}T12:00:00`))
      .sort((a, b) => a - b)[0];

    if (firstActivity) {
      state.currentDate = new Date(firstActivity.getFullYear(), firstActivity.getMonth(), 1);
    }

    emptyState.hidden = true;
    calendarArea.hidden = false;
    renderCalendar();
    scrollToCalendarOnMobile();
  });
}

function scrollToCalendarOnMobile() {
  if (!isMobileViewport() || !calendarArea || !monthControls) {
    return;
  }

  const scrollingElement = document.scrollingElement || document.documentElement;
  const targetTop = Math.max(
    0,
    monthControls.getBoundingClientRect().top + window.scrollY - 16
  );

  window.setTimeout(() => {
    scrollingElement.scrollTop = targetTop;
  }, 120);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

window.addEventListener("popstate", () => {
  if (!serviceMenu.hidden) {
    closeServiceMenu({ fromPopState: true });
  }
});

window.addEventListener("pageshow", () => {
  if (history.state && history.state.ui === "service-menu" && serviceMenu.hidden) {
    history.replaceState(null, "", window.location.href);
    state.serviceMenuHistoryOpen = false;
  }
});

function renderCalendar() {
  const service = state.selectedService;
  if (!service) return;

  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const eventMap = buildEventMap(service);

  monthLabel.textContent = capitalize(monthFormatter.format(state.currentDate));
  serviceSummary.innerHTML = `
    <div>
      <h2>${service.nombre}</h2>
      <p>${service.descripcion}</p>
    </div>
    <div class="legend"><span class="legend-dot"></span><span>Días con actividades</span></div>
  `;

  daysGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const cellDay = index - startDay + 1;
    const isCurrentMonth = cellDay > 0 && cellDay <= daysInMonth;
    const displayedDay = isCurrentMonth
      ? cellDay
      : cellDay <= 0
        ? previousMonthDays + cellDay
        : cellDay - daysInMonth;

    const dateKey = isCurrentMonth ? toDateKey(year, month, cellDay) : "";
    const events = eventMap.get(dateKey) || [];
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = `day${isCurrentMonth ? "" : " is-muted"}${events.length ? " has-events" : ""}`;
    dayButton.innerHTML = buildDayContent(displayedDay, events);

    if (events.length) {
      dayButton.addEventListener("click", () => openDayModal(dateKey, events));
    }

    daysGrid.appendChild(dayButton);
  }
}

function buildEventMap(service) {
  const map = new Map();

  service.actividades.forEach((activity) => {
    activity.fechas.forEach((eventDate) => {
      const event = {
        servicio: service.nombre,
        actividad: activity.nombre,
        horario: eventDate.horario,
        lugar: eventDate.lugar,
        nota: eventDate.nota,
        contactos: eventDate.contactos
      };

      if (!map.has(eventDate.dia)) {
        map.set(eventDate.dia, []);
      }

      map.get(eventDate.dia).push(event);
    });
  });

  map.forEach((events) => {
    events.sort((a, b) => a.horario.localeCompare(b.horario));
  });

  return map;
}

function buildDayContent(dayNumber, events) {
  const visibleEvents = events.slice(0, 2);
  const eventList = visibleEvents.map((event) => (
    `<span class="event-pill">${event.horario} · ${event.actividad}</span>`
  )).join("");
  const more = events.length > visibleEvents.length
    ? `<span class="more-events">+${events.length - visibleEvents.length} más</span>`
    : "";

  return `
    <span class="day-number">${dayNumber}</span>
    <span class="event-list">${eventList}${more}</span>
  `;
}

function openDayModal(dateKey, events) {
  const date = new Date(`${dateKey}T12:00:00`);
  modalDate.textContent = capitalize(dayFormatter.format(date));
  modalTitle.textContent = `${events.length} actividad${events.length === 1 ? "" : "es"} programada${events.length === 1 ? "" : "s"}`;
  modalActivities.innerHTML = events.map(renderActivity).join("");
  modalScrollHint.hidden = events.length <= 2;
  modalOverlay.classList.toggle("has-scroll-hint", events.length > 2);
  modalOverlay.hidden = false;
  lockBodyScroll();
  closeModal.focus();
}

function renderActivity(event) {
  const contacts = event.contactos.map((contact) => `
    <div class="contact-row">
      <strong>${contact.nombre}</strong>
      <div class="contact-actions">
        <a class="contact-phone" href="tel:${toTelValue(contact.telefono)}">${formatPhoneDisplay(contact.telefono)}</a>
        <a class="contact-whatsapp" href="https://wa.me/${toWhatsAppValue(contact.telefono)}" target="_blank" rel="noreferrer" aria-label="WhatsApp ${contact.nombre}">
          ${whatsAppIcon()}
        </a>
      </div>
    </div>
  `).join("");

  return `
    <section class="activity-card">
      <div class="activity-topline">
        <h3>${event.actividad}</h3>
        <span class="time-badge">Horario ${event.horario}</span>
      </div>
      <p class="activity-meta">${event.lugar}${event.nota ? ` · ${event.nota}` : ""}</p>
      <div class="contacts">${contacts}</div>
    </section>
  `;
}

function closeDayModal() {
  modalOverlay.hidden = true;
  modalOverlay.classList.remove("has-scroll-hint");
  modalScrollHint.hidden = true;
  unlockBodyScroll();
}

function lockBodyScroll() {
  state.scrollY = window.scrollY || window.pageYOffset || 0;
  document.body.classList.add("modal-open");
  document.body.style.position = "fixed";
  document.body.style.top = `-${state.scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  document.body.classList.remove("modal-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, state.scrollY);
}

function moveMonth(direction) {
  state.currentDate = new Date(
    state.currentDate.getFullYear(),
    state.currentDate.getMonth() + direction,
    1
  );
  renderCalendar();
}

function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toTelValue(phone) {
  return phone.replace(/\s/g, "");
}

function toWhatsAppValue(phone) {
  return phone.replace(/\D/g, "");
}

function formatPhoneDisplay(phone) {
  return phone
    .replace(/^\+54\s*9\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function whatsAppIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2a9.9 9.9 0 0 0-8.6 14.8L2 22l5.36-1.4A9.9 9.9 0 0 0 12.02 22h.01A9.99 9.99 0 0 0 22 12.04a9.82 9.82 0 0 0-2.95-7.13Zm-7.02 15.4h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.18.83.85-3.1-.2-.31a8.21 8.21 0 1 1 7.02 3.9Zm4.5-6.15c-.25-.12-1.48-.73-1.7-.81-.23-.08-.4-.12-.56.12-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.39-1.72-.14-.24-.01-.37.11-.49.11-.11.25-.29.37-.43.12-.14.16-.24.25-.4.08-.16.04-.3-.02-.43-.06-.12-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.3-.23.24-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.12.16 1.75 2.67 4.24 3.74.59.26 1.06.42 1.42.54.6.19 1.15.16 1.58.1.48-.07 1.48-.6 1.69-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/>
    </svg>
  `;
}

serviceTrigger.addEventListener("click", toggleServiceMenu);
document.addEventListener("click", (event) => {
  if (!servicePicker.contains(event.target)) {
    closeServiceMenu();
  }
});

prevMonth.addEventListener("click", () => moveMonth(-1));
nextMonth.addEventListener("click", () => moveMonth(1));
closeModal.addEventListener("click", closeDayModal);
modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeDayModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeServiceMenu();
    closeDayModal();
  }
});

init();
