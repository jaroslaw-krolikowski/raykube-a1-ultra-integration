/*
 * Raykube Lock card, shipped with the tuya_local_ble integration.
 *
 * Tile: only the button locks / unlocks (unlocks when locked, locks
 * otherwise); unlocking needs a second tap to confirm. A tap anywhere else
 * opens a panel with lock/unlock, battery, the time and source of the last
 * change, settings, calibration and recent history.
 *
 * Locking is always possible: while an unlock is on its way the button
 * locks. "Locking…" / "Unlocking…" stay until the lock reports its state;
 * when it does not, the card says so instead of showing the commanded state.
 * Unlocking waits 30 s after any command (countdown on the button).
 * Calibration (tuya_local_ble.calibrate) asks for confirmation, warns what it
 * does and is available once every 2 minutes.
 *
 *   type: custom:raykube-lock-card
 *   entity: lock.raykube_a1_ultra_d9f494_zamek
 *   name: Drzwi wejściowe                          # optional
 *   arming_entity: input_boolean.zamek_uzbrojony   # optional
 *   confirm_unlock: true                           # optional, false = unlock on first tap
 *
 * Related entities of the same device are found by translation key; any of
 * them can be overridden with battery_entity, auto_lock_entity,
 * auto_lock_time_entity, mute_entity, refresh_entity, signal_entity.
 *
 * Chip: a small name + state badge for floor plans (picture-elements) and
 * compact dashboards. A tap opens the same details panel; it never locks or
 * unlocks by itself.
 *
 *   type: custom:raykube-lock-chip
 *   entity: lock.raykube_a1_ultra_d9f494_zamek
 *   name: Drzwi                                    # optional
 *
 * Look follows shadcn/ui; icons are Lucide (https://lucide.dev, ISC license).
 */

const CARD_VERSION = "1.7.0";
const HOLD_MS = 500;
const CONFIRM_MS = 4000;
const PENDING_TIMEOUT_MS = 20000;

const STRINGS = {
  pl: {
    locked: "Zamknięty",
    unlocked: "Otwarty",
    locking: "Zamykanie…",
    unlocking: "Otwieranie…",
    jammed: "Zablokowany mechanizm",
    open: "Otwarty",
    opening: "Otwieranie…",
    unavailable: "Niedostępny",
    unknown: "Stan nieznany",
    lock: "Zamknij",
    unlock: "Otwórz",
    confirm_unlock: "Potwierdź otwarcie",
    confirm_short: "Potwierdź",
    tap_hint: "Dotknij, aby zobaczyć szczegóły",
    battery: "Bateria",
    battery_high: "Wysoki",
    battery_normal: "Średni",
    battery_medium: "Średni",
    battery_low: "Niski",
    battery_poweroff: "Wyczerpana",
    signal: "Sygnał",
    auto_lock: "Automatyczne zamykanie",
    stat_auto_lock: "Zamykanie",
    stat_arming: "Uzbrojenie",
    auto_lock_after: "Zamknij po",
    seconds: "s",
    mute: "Wyciszenie",
    arming: "Tryb uzbrojenia",
    refresh: "Stan zamka",
    refresh_action: "Odśwież",
    calibrate: "Kalibracja",
    calibrate_action: "Uruchom",
    confirm_calibrate: "Potwierdź",
    calibrate_warning: "Kalibracja porusza ryglem i zapamiętuje jego skrajne położenia, a zamek może się na końcu zamknąć. Uruchamiaj ją tylko przy drzwiach i potem sprawdź, czy zamykanie i otwieranie działają we właściwą stronę.",
    wait: "Za {s} s",
    unconfirmed_lock: "Zamek nie potwierdził zamknięcia. Pokazany stan zgłosił zamek wcześniej. Sprawdź na miejscu.",
    unconfirmed_unlock: "Zamek nie potwierdził otwarcia. Pokazany stan zgłosił zamek wcześniej. Sprawdź na miejscu.",
    unconfirmed_short: "niepotwierdzone",
    settings: "Ustawienia",
    history: "Ostatnie zdarzenia",
    no_history: "Brak zdarzeń z ostatnich 48 h",
    source_ha: "z Home Assistant",
    source_automation: "automatyzacja",
    source_device: "na zamku",
    on: "Wł.",
    off: "Wył.",
    unknown_value: "Nieznany",
    settings_unknown: "Zamek nie przesłał jeszcze ustawień. Naciśnij Odśwież.",
    close: "Zamknij panel",
    more: "Szczegóły",
    just_now: "przed chwilą",
    now: "teraz",
  },
  en: {
    locked: "Locked",
    unlocked: "Unlocked",
    locking: "Locking…",
    unlocking: "Unlocking…",
    jammed: "Jammed",
    open: "Open",
    opening: "Opening…",
    unavailable: "Unavailable",
    unknown: "Unknown",
    lock: "Lock",
    unlock: "Unlock",
    confirm_unlock: "Confirm unlock",
    confirm_short: "Confirm",
    tap_hint: "Tap for details",
    battery: "Battery",
    battery_high: "High",
    battery_normal: "Medium",
    battery_medium: "Medium",
    battery_low: "Low",
    battery_poweroff: "Empty",
    signal: "Signal",
    auto_lock: "Auto lock",
    stat_auto_lock: "Auto lock",
    stat_arming: "Arming",
    auto_lock_after: "Lock after",
    seconds: "s",
    mute: "Mute",
    arming: "Arming mode",
    refresh: "Lock status",
    refresh_action: "Refresh",
    calibrate: "Calibration",
    calibrate_action: "Start",
    confirm_calibrate: "Confirm",
    calibrate_warning: "Calibration moves the bolt and stores its end positions, and the lock may end up locked. Start it only at the door, then check that locking and unlocking turn the right way.",
    wait: "In {s} s",
    unconfirmed_lock: "The lock did not confirm locking. The state shown is the one the lock reported before. Check on site.",
    unconfirmed_unlock: "The lock did not confirm unlocking. The state shown is the one the lock reported before. Check on site.",
    unconfirmed_short: "unconfirmed",
    settings: "Settings",
    history: "Recent events",
    no_history: "No events in the last 48 h",
    source_ha: "from Home Assistant",
    source_automation: "automation",
    source_device: "at the lock",
    on: "On",
    off: "Off",
    unknown_value: "Unknown",
    settings_unknown: "The lock has not reported its settings yet. Press Refresh.",
    close: "Close panel",
    more: "Details",
    just_now: "just now",
    now: "now",
  },
};

// Translation keys of the integration's entities (entity description keys).
const RELATED_KEYS = {
  battery: "battery_state",
  auto_lock: "automatic_lock",
  auto_lock_time: "auto_lock_time",
  mute: "mute",
  refresh: "refresh_status",
  signal: "signal_strength",
};

// Lucide icons (https://lucide.dev), ISC license.
const LUCIDE = {
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "lock-open": '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  "triangle-alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  "circle-help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  "chevron-up": '<path d="m18 15-6-6-6 6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "battery-full": '<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/><line x1="14" x2="14" y1="11" y2="13"/>',
  "battery-medium": '<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/>',
  "battery-low": '<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/>',
  battery: '<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  "shield-check": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  "volume-x": '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  "refresh-cw": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  bluetooth: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  "key-round": '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
};

function icon(name, size = 16, cls = "") {
  return `<svg class="lucide ${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${LUCIDE[name] || ""}</svg>`;
}

const BATTERY_ICONS = {
  high: "battery-full",
  normal: "battery-medium",
  medium: "battery-medium",
  low: "battery-low",
  poweroff: "battery",
};

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function strings(hass) {
  const lang = (hass?.locale?.language || hass?.language || uiLanguage()).split("-")[0];
  return STRINGS[lang] || STRINGS.en;
}

/** Language of the HA frontend where no hass object is passed in (card picker, editor). */
function uiLanguage() {
  return (document.documentElement.lang || navigator.language || "en").split("-")[0];
}

const EDITOR_LABELS = {
  pl: {
    entity: "Zamek",
    name: "Nazwa",
    arming_entity: "Pomocnik trybu uzbrojenia",
    confirm_unlock: "Potwierdzaj otwarcie drugim stuknięciem",
  },
  en: {
    entity: "Lock",
    name: "Name",
    arming_entity: "Arming mode helper",
    confirm_unlock: "Confirm unlocking with a second tap",
  },
};

const CHIP_DESCRIPTIONS = {
  pl: "Mała plakietka z nazwą i stanem zamka, np. na rzut mieszkania; dotknięcie pokazuje szczegóły.",
  en: "A small badge with the lock name and state, e.g. on a floor plan; a tap shows details.",
};

const CARD_DESCRIPTIONS = {
  pl: "Przycisk zamyka lub otwiera zamek (otwarcie z potwierdzeniem); dotknięcie kafelka pokazuje szczegóły i ustawienia.",
  en: "The button locks or unlocks (unlocking asks for confirmation); a tap on the tile shows details and settings.",
};

function relativeTime(hass, iso, style = "long") {
  if (!iso) return "";
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (Math.abs(seconds) < 45) return strings(hass).just_now;
  const lang = (hass?.locale?.language || "en").split("-")[0];
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style });
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(seconds) >= size || unit === "minute") {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return "";
}

/** Compact age for the tile: "15 min", "2 godz.", "3 dni". */
function shortAge(hass, iso) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 45) return strings(hass).now;
  const lang = (hass?.locale?.language || "en").split("-")[0];
  const [unit, size] = seconds >= 86400 ? ["day", 86400] : seconds >= 3600 ? ["hour", 3600] : ["minute", 60];
  return new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "short" })
    .format(Math.round(seconds / size));
}

function clockTime(hass, when) {
  const lang = hass?.locale?.language || "en";
  const date = new Date(when);
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(lang, sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Where a change came from: [label, lucide icon]. */
function changeSource(t, userId, parentId, eventType, domain) {
  if (eventType === "automation_triggered" || domain === "automation" || domain === "script") {
    return [t.source_automation, "bot"];
  }
  if (userId) return [t.source_ha, "smartphone"];
  if (parentId) return [t.source_automation, "bot"];
  return [t.source_device, "key-round"];
}

function lockVisual(state) {
  switch (state) {
    case "locked":
      return { icon: "lock", tone: "locked" };
    case "unlocked":
    case "open":
      return { icon: "lock-open", tone: "unlocked" };
    case "locking":
    case "unlocking":
    case "opening":
      return { icon: "loader", tone: "pending" };
    case "jammed":
      return { icon: "triangle-alert", tone: "alert" };
    default:
      return { icon: "circle-help", tone: "unknown" };
  }
}

/** "on" / "off" state of a switch-like entity, or null when the lock has not reported it. */
function onOff(entity) {
  return entity && (entity.state === "on" || entity.state === "off") ? entity.state : null;
}

function isNumber(entity) {
  return Boolean(entity) && entity.state !== "" && !Number.isNaN(Number(entity.state));
}

/** What a tap on the tile does in this state. */
function toggleTarget(state) {
  return state === "locked" ? "unlock" : "lock";
}

/** Whole seconds until the time in an ISO attribute, 0 when it has passed. */
function secondsUntil(stateObj, attribute) {
  const until = Date.parse(stateObj?.attributes?.[attribute] || "");
  return Number.isNaN(until) ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/** "lock" / "unlock" when the lock did not confirm the last command. */
function unconfirmed(stateObj) {
  const a = stateObj?.attributes;
  return a && a.command_confirmed === false ? a.last_command : null;
}

// shadcn/ui-like tokens mapped onto the Home Assistant theme.
const SHARED_STYLE = `
  :host {
    --rk-background: var(--ha-card-background, var(--card-background-color, #09090b));
    --rk-foreground: var(--primary-text-color, #fafafa);
    --rk-muted: var(--secondary-background-color, #27272a);
    --rk-muted-foreground: var(--secondary-text-color, #a1a1aa);
    --rk-border: var(--divider-color, rgba(255, 255, 255, .1));
    --rk-ring: color-mix(in srgb, var(--rk-foreground) 35%, transparent);
    --rk-locked: #10b981;
    --rk-unlocked: #f59e0b;
    --rk-pending: #3b82f6;
    --rk-alert: #ef4444;
    --rk-unknown: var(--rk-muted-foreground);
    --rk-destructive: #ef4444;
    --rk-radius: 12px;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, ui-sans-serif, system-ui, sans-serif));
    -webkit-font-smoothing: antialiased;
  }
  .tone-locked { --rk-tone: var(--rk-locked); }
  .tone-unlocked { --rk-tone: var(--rk-unlocked); }
  .tone-pending { --rk-tone: var(--rk-pending); }
  .tone-alert { --rk-tone: var(--rk-alert); }
  .tone-unknown { --rk-tone: var(--rk-unknown); }
  .lucide { flex: none; display: block; }
  .spin { animation: rk-spin 1s linear infinite; }
  @keyframes rk-spin { to { transform: rotate(360deg); } }
  .tint {
    display: flex; align-items: center; justify-content: center; flex: none;
    color: var(--rk-tone); background: color-mix(in srgb, var(--rk-tone) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--rk-tone) 22%, transparent);
  }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 36px; padding: 0 14px; border-radius: 8px; white-space: nowrap;
    font: inherit; font-size: 14px; font-weight: 500; line-height: 1; cursor: pointer;
    border: 1px solid transparent; transition: background .15s, color .15s, border-color .15s, opacity .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:focus-visible { outline: 2px solid var(--rk-ring); outline-offset: 2px; }
  .btn:disabled { opacity: .5; pointer-events: none; }
  .btn-default { background: var(--rk-foreground); color: var(--rk-background); }
  .btn-default:hover { opacity: .9; }
  .btn-secondary { background: var(--rk-muted); color: var(--rk-foreground); }
  .btn-secondary:hover { background: color-mix(in srgb, var(--rk-muted) 80%, var(--rk-foreground)); }
  .btn-outline { background: transparent; color: var(--rk-foreground); border-color: var(--rk-border); }
  .btn-outline:hover { background: var(--rk-muted); }
  .btn-ghost { background: transparent; color: var(--rk-muted-foreground); }
  .btn-ghost:hover { background: var(--rk-muted); color: var(--rk-foreground); }
  .btn-destructive { background: var(--rk-destructive); color: #fff; }
  .btn-sm { height: 32px; padding: 0 12px; font-size: 13px; border-radius: 7px; }
  .btn-icon { width: 36px; padding: 0; }
  .btn-lg { height: 44px; font-size: 15px; border-radius: 10px; }
`;

class RaykubeLockCard extends HTMLElement {
  static getStubConfig(hass) {
    const lock = Object.values(hass.entities || {}).find(
      (e) => e.platform === "tuya_local_ble" && e.entity_id.startsWith("lock.")
    );
    return { entity: lock ? lock.entity_id : "", confirm_unlock: true };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "lock" } } },
        { name: "name", selector: { text: {} } },
        { name: "arming_entity", selector: { entity: { domain: "input_boolean" } } },
        { name: "confirm_unlock", selector: { boolean: {} } },
      ],
      computeLabel: (schema) => (EDITOR_LABELS[uiLanguage()] || EDITOR_LABELS.en)[schema.name],
    };
  }

  setConfig(config) {
    if (!config || !config.entity || !String(config.entity).startsWith("lock.")) {
      throw new Error(uiLanguage() === "pl" ? "Podaj encję zamka: entity: lock.…" : "Set a lock entity: entity: lock.…");
    }
    // Unlock confirmation is on unless explicitly turned off.
    this._config = { ...config, confirm_unlock: config.confirm_unlock !== false };
    this._rendered = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._settlePending();
    this._render();
    if (this._panel) this._panel.update(hass, this._related(), this._config, this);
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: 1, min_rows: 1 };
  }

  connectedCallback() {
    if (this._hass && this._config) this._render();
  }

  disconnectedCallback() {
    this._closePanel();
    clearTimeout(this._confirmTimer);
    clearTimeout(this._pendingTimer);
    clearTimeout(this._waitTimer);
  }

  /** Entity ids of the lock's device, by role. */
  _related() {
    const config = this._config;
    const registry = this._hass?.entities || {};
    const deviceId = registry[config.entity]?.device_id;
    const byKey = {};
    if (deviceId) {
      for (const entry of Object.values(registry)) {
        if (entry.device_id === deviceId && entry.translation_key) {
          byKey[entry.translation_key] = entry.entity_id;
        }
      }
    }
    const related = { lock: config.entity, arming: config.arming_entity };
    for (const [role, key] of Object.entries(RELATED_KEYS)) {
      related[role] = config[`${role}_entity`] || byKey[key];
    }
    return related;
  }

  /** Command the lock has not confirmed yet (sent from this card or reported by HA). */
  get pending() {
    if (this._pending) return this._pending.action;
    const state = this._hass?.states[this._config.entity]?.state;
    return state === "locking" ? "lock" : state === "unlocking" ? "unlock" : null;
  }

  _settlePending() {
    if (!this._pending) return;
    const state = this._hass.states[this._config.entity]?.state;
    const done = this._pending.action === "lock" ? state === "locked" : state === "unlocked" || state === "open";
    // Once HA shows locking / unlocking it tracks the command itself.
    const tracked = state === "locking" || state === "unlocking";
    if (done || tracked || state === "jammed" || Date.now() - this._pending.since > PENDING_TIMEOUT_MS) {
      this._pending = null;
      clearTimeout(this._pendingTimer);
    }
  }

  /** Lock or unlock, honouring confirm_unlock. Returns false if waiting for confirmation. */
  command(action, confirmKey = "tile") {
    if (action === "unlock" && this._config.confirm_unlock && this._confirming !== confirmKey) {
      this._confirming = confirmKey;
      clearTimeout(this._confirmTimer);
      this._confirmTimer = setTimeout(() => {
        this._confirming = null;
        this._rerender();
      }, CONFIRM_MS);
      this._rerender();
      return false;
    }
    this._confirming = null;
    clearTimeout(this._confirmTimer);
    this._pending = { action, since: Date.now() };
    clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(() => {
      this._pending = null;
      this._rerender();
    }, PENDING_TIMEOUT_MS);
    this._haptic(action === "unlock" ? "success" : "light");
    const pending = this._pending;
    Promise.resolve(this._hass.callService("lock", action, { entity_id: this._config.entity })).catch(() => {
      // HA shows the error; stop showing the command as on its way.
      if (this._pending === pending) this._pending = null;
      this._rerender();
    });
    this._rerender();
    return true;
  }

  confirming(key) {
    return this._confirming === key;
  }

  _rerender() {
    this._render();
    if (this._panel) this._panel.update(this._hass, this._related(), this._config, this);
  }

  _render() {
    const hass = this._hass;
    const t = strings(hass);
    const stateObj = hass.states[this._config.entity];
    if (!this._rendered) {
      this._rendered = true;
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>
          ${SHARED_STYLE}
          ha-card {
            display: flex; align-items: center; gap: 12px; height: 100%; box-sizing: border-box;
            padding: 8px 8px 8px 10px; cursor: pointer; overflow: hidden;
            border-radius: var(--ha-card-border-radius, var(--rk-radius));
            user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
            touch-action: manipulation; -webkit-tap-highlight-color: transparent;
            transition: transform .12s ease, background .15s ease;
          }
          ha-card:focus-visible { outline: 2px solid var(--rk-ring); outline-offset: 2px; }
          ha-card.pressed { transform: scale(.985); }
          .icon { width: 40px; height: 40px; border-radius: 10px; }
          .text { flex: 1; min-width: 0; }
          .title { display: flex; align-items: center; gap: 6px; min-width: 0; }
          .name {
            font-size: 14px; font-weight: 600; line-height: 20px; color: var(--rk-foreground);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .battery { display: inline-flex; flex: none; color: var(--rk-muted-foreground); }
          .battery.low { color: var(--rk-alert); }
          .meta {
            display: flex; align-items: center; gap: 6px;
            font-size: 12.5px; line-height: 18px; color: var(--rk-muted-foreground);
            white-space: nowrap; overflow: hidden;
          }
          .meta .state { color: var(--rk-tone); font-weight: 500; }
          .meta .sep { opacity: .5; }
          .meta .warn { display: inline-flex; align-items: center; gap: 3px; color: var(--rk-alert); }
          .action { min-width: 92px; }
          /* A tap on the disabled button must not fall through and open the panel. */
          .action:disabled { pointer-events: auto; cursor: default; }
          .more { color: var(--rk-muted-foreground); }
        </style>
        <ha-card tabindex="0" role="button">
          <div class="icon tint"></div>
          <div class="text">
            <div class="title"><span class="name"></span><span class="battery"></span></div>
            <div class="meta"></div>
          </div>
          <button class="btn btn-sm action"></button>
          <button class="btn btn-ghost btn-icon btn-sm more">${icon("chevron-up", 16)}</button>
        </ha-card>`;
      this._bindGestures();
    }

    const root = this.shadowRoot;
    const card = root.querySelector("ha-card");
    const name = this._config.name || stateObj?.attributes?.friendly_name || this._config.entity;
    const state = stateObj ? stateObj.state : "unavailable";
    const pending = this.pending;
    const visual = pending ? { icon: "loader", tone: "pending" } : lockVisual(state);
    card.className = `tone-${visual.tone}`;
    card.setAttribute("aria-label", `${name}: ${t[state] || state}. ${t.tap_hint}`);
    root.querySelector(".icon").innerHTML = icon(visual.icon, 20, visual.icon === "loader" ? "spin" : "");
    root.querySelector(".name").textContent = name;

    const stateText = pending ? t[pending === "lock" ? "locking" : "unlocking"] : t[state] || state;
    const meta = [`<span class="state">${esc(stateText)}</span>`];
    if (stateObj && !pending) meta.push(`<span class="sep">·</span><span>${esc(shortAge(hass, stateObj.last_changed))}</span>`);
    if (!pending && unconfirmed(stateObj)) {
      meta.push(`<span class="sep">·</span><span class="warn">${icon("triangle-alert", 12)}${esc(t.unconfirmed_short)}</span>`);
    }
    root.querySelector(".meta").innerHTML = meta.join("");

    const batteryId = this._related().battery;
    const battery = batteryId ? hass.states[batteryId] : undefined;
    const batteryEl = root.querySelector(".battery");
    // On the tile the battery only shows up as a low-battery warning.
    if (battery && (battery.state === "low" || battery.state === "poweroff")) {
      batteryEl.hidden = false;
      batteryEl.classList.add("low");
      batteryEl.title = `${t.battery}: ${t[`battery_${battery.state}`] || battery.state}`;
      batteryEl.innerHTML = icon(BATTERY_ICONS[battery.state], 14);
    } else {
      batteryEl.hidden = true;
    }

    const action = root.querySelector(".action");
    // While an unlock is on its way the button locks: locking is always possible.
    const target = pending === "unlock" ? "lock" : toggleTarget(state);
    const confirming = this.confirming("tile");
    action.className = `btn btn-sm action ${confirming ? "btn-destructive" : target === "unlock" ? "btn-outline" : "btn-default"}`;
    // No second unlock right after a command; locking never waits.
    const wait = target === "unlock" ? secondsUntil(stateObj, "unlock_blocked_until") : 0;
    clearTimeout(this._waitTimer);
    if (wait > 0) this._waitTimer = setTimeout(() => this._render(), 1000);
    action.disabled = state === "unavailable" || pending === "lock" || wait > 0;
    action.setAttribute("aria-label", confirming ? t.confirm_unlock : t[target]);
    action.innerHTML = pending === "lock"
      ? `${icon("loader", 14, "spin")}<span>${esc(t[pending])}</span>`
      : wait > 0
      ? `${icon("lock-open", 14)}<span>${esc(t.wait.replace("{s}", wait))}</span>`
      : `${icon(target === "unlock" ? "lock-open" : "lock", 14)}<span>${esc(confirming ? t.confirm_short : t[target])}</span>`;
    const more = root.querySelector(".more");
    more.setAttribute("aria-label", t.more);
    more.title = t.more;
  }

  _bindGestures() {
    const card = this.shadowRoot.querySelector("ha-card");
    const more = this.shadowRoot.querySelector(".more");
    const action = this.shadowRoot.querySelector(".action");
    const onButton = (ev) => ev.composedPath().some((n) => n === more || n === action);
    let timer = null;
    let held = false;
    let start = null;

    const cancel = () => {
      clearTimeout(timer);
      timer = null;
      card.classList.remove("pressed");
    };

    card.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || onButton(ev)) return;
      held = false;
      start = { x: ev.clientX, y: ev.clientY };
      card.classList.add("pressed");
      timer = setTimeout(() => {
        held = true;
        card.classList.remove("pressed");
        this._haptic("medium");
        this._openPanel();
      }, HOLD_MS);
    });
    card.addEventListener("pointermove", (ev) => {
      if (start && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 10) {
        cancel();
        start = null;
      }
    });
    card.addEventListener("pointerup", (ev) => {
      if (!start || onButton(ev)) return;
      const wasHeld = held;
      cancel();
      start = null;
      if (!wasHeld) this._openPanel();
    });
    card.addEventListener("pointercancel", () => {
      cancel();
      start = null;
    });
    card.addEventListener("contextmenu", (ev) => ev.preventDefault());
    card.addEventListener("keydown", (ev) => {
      if (ev.composedPath()[0] !== card) return; // the buttons handle their own keys
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this._openPanel();
      }
    });
    more.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._openPanel();
    });
    action.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._tap();
    });
  }

  _tap() {
    const state = this._hass.states[this._config.entity]?.state;
    const pending = this.pending;
    if (!state || state === "unavailable" || pending === "lock") return;
    this.command(pending === "unlock" ? "lock" : toggleTarget(state), "tile");
  }

  _haptic(type) {
    this.dispatchEvent(new CustomEvent("haptic", { detail: type, bubbles: true, composed: true }));
  }

  _openPanel() {
    if (this._panel) return;
    this._panel = document.createElement("raykube-lock-panel");
    this._panel.addEventListener("raykube-close", () => this._closePanel());
    document.body.appendChild(this._panel);
    this._panel.update(this._hass, this._related(), this._config, this);
  }

  _closePanel() {
    if (!this._panel) return;
    this._panel.remove();
    this._panel = null;
  }
}

class RaykubeLockPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._confirm = {};
    this._history = null;
    this._historyFor = null;
    this._onKey = (ev) => {
      if (ev.key === "Escape") this._close();
    };
  }

  connectedCallback() {
    this._openedAt = Date.now();
    document.addEventListener("keydown", this._onKey);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKey);
    Object.values(this._confirm).forEach(clearTimeout);
    clearTimeout(this._cooldownTimer);
  }

  update(hass, related, config, card) {
    this._hass = hass;
    this._related = related;
    this._config = config;
    this._card = card;
    if (!this._built) this._build();
    this._refresh();
    const lock = hass.states[related.lock];
    const key = lock ? lock.last_changed : null;
    if (key !== this._historyFor) {
      this._historyFor = key;
      this._loadHistory();
    }
  }

  _close() {
    this.dispatchEvent(new CustomEvent("raykube-close"));
  }

  _build() {
    this._built = true;
    const t = strings(this._hass);
    this.shadowRoot.innerHTML = `
      <style>
        ${SHARED_STYLE}
        :host {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: flex-end; justify-content: center;
          color: var(--rk-foreground);
        }
        .overlay {
          position: absolute; inset: 0; background: rgba(0, 0, 0, .6);
          backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
          animation: rk-fade .18s ease-out;
        }
        .sheet {
          position: relative; width: 100%; max-width: 440px; max-height: 92vh;
          overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box;
          padding: 8px 20px calc(24px + env(safe-area-inset-bottom));
          background: var(--rk-background); border: 1px solid var(--rk-border); border-bottom: none;
          border-radius: 16px 16px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, .25);
          animation: rk-slide .24s cubic-bezier(.32, .72, 0, 1);
        }
        @media (min-width: 600px) {
          :host { align-items: center; }
          .sheet { border-radius: 16px; border-bottom: 1px solid var(--rk-border); }
        }
        @keyframes rk-fade { from { opacity: 0; } }
        @keyframes rk-slide { from { transform: translateY(48px); opacity: 0; } }
        .grab { width: 36px; height: 4px; margin: 6px auto 12px; border-radius: 99px; background: var(--rk-border); }
        header { display: flex; align-items: flex-start; gap: 12px; }
        header .titles { flex: 1; min-width: 0; padding-top: 4px; }
        .title { font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
        .description { font-size: 13px; color: var(--rk-muted-foreground); margin-top: 2px; }
        .status { display: flex; align-items: center; gap: 14px; margin: 20px 0 16px; }
        .status .tint { width: 56px; height: 56px; border-radius: 14px; }
        .status .state { font-size: 22px; font-weight: 600; letter-spacing: -.02em; }
        .badge {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;
          padding: 2px 8px; border-radius: 99px; border: 1px solid var(--rk-border);
          font-size: 12px; font-weight: 500; color: var(--rk-muted-foreground);
        }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .actions .btn { width: 100%; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 16px; }
        .stat { border: 1px solid var(--rk-border); border-radius: 10px; padding: 10px 12px; }
        .stat .label {
          display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rk-muted-foreground);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .stat .value { font-size: 15px; font-weight: 600; margin-top: 4px; }
        .stat.low .value { color: var(--rk-alert); }
        .section-title {
          display: flex; align-items: center; gap: 8px; margin: 22px 0 8px;
          font-size: 13px; font-weight: 600; color: var(--rk-foreground);
        }
        .section-title .lucide { color: var(--rk-muted-foreground); }
        .group { border: 1px solid var(--rk-border); border-radius: var(--rk-radius); overflow: hidden; }
        .row { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 14px; }
        .row + .row { border-top: 1px solid var(--rk-border); }
        .row .lucide { color: var(--rk-muted-foreground); }
        .row .label { flex: 1; font-size: 14px; font-weight: 500; }
        .input {
          width: 76px; height: 32px; box-sizing: border-box; padding: 0 10px; text-align: right;
          border-radius: 7px; border: 1px solid var(--rk-border); background: transparent;
          color: inherit; font: inherit; font-size: 14px;
        }
        .input:focus { outline: 2px solid var(--rk-ring); outline-offset: 1px; }
        .unit { font-size: 13px; color: var(--rk-muted-foreground); }
        .switch {
          position: relative; flex: none; width: 36px; height: 20px; padding: 0; border-radius: 99px;
          border: 2px solid transparent; cursor: pointer;
          background: color-mix(in srgb, var(--rk-foreground) 18%, transparent);
          transition: background .15s; box-sizing: content-box;
        }
        .switch::after {
          content: ""; position: absolute; top: 0; left: 0; width: 20px; height: 20px; border-radius: 50%;
          background: var(--rk-background); box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .15s;
        }
        .switch[aria-checked=true] { background: var(--rk-foreground); }
        .switch[aria-checked=true]::after { transform: translateX(16px); }
        .switch[aria-checked=mixed] { border: 2px dashed var(--rk-border); background: transparent; }
        .switch[aria-checked=mixed]::after { transform: translateX(8px); background: var(--rk-muted-foreground); opacity: .4; box-shadow: none; }
        .switch:focus-visible { outline: 2px solid var(--rk-ring); outline-offset: 2px; }
        .row.hint { font-size: 13px; color: var(--rk-muted-foreground); padding-top: 10px; padding-bottom: 10px; }
        .row.hint.warn, .badge.warn { color: var(--rk-alert); }
        .event { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
        .event + .event { border-top: 1px solid var(--rk-border); }
        .event .tint { width: 30px; height: 30px; border-radius: 8px; }
        .event .what { flex: 1; min-width: 0; }
        .event .what .s { font-size: 14px; font-weight: 500; }
        .event .src { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--rk-muted-foreground); margin-top: 1px; }
        .event .time { font-size: 12px; color: var(--rk-muted-foreground); font-variant-numeric: tabular-nums; }
        .empty { padding: 16px 14px; font-size: 13px; color: var(--rk-muted-foreground); }
      </style>
      <div class="overlay"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="grab"></div>
        <header>
          <div class="titles"><div class="title"></div><div class="description"></div></div>
          <button class="btn btn-ghost btn-icon" data-act="close" aria-label="${esc(t.close)}" title="${esc(t.close)}">${icon("x", 18)}</button>
        </header>
        <div class="status">
          <div class="tint"></div>
          <div><div class="state"></div><div class="badge"></div></div>
        </div>
        <div class="actions">
          <button class="btn btn-lg" data-act="lock"></button>
          <button class="btn btn-lg" data-act="unlock"></button>
        </div>
        <div class="stats"></div>
        <div class="section-title settings-title">${esc(t.settings)}</div>
        <div class="group settings"></div>
        <div class="section-title">${icon("history", 14)}${esc(t.history)}</div>
        <div class="group history"><div class="empty">…</div></div>
      </div>`;

    const root = this.shadowRoot;
    root.querySelector(".overlay").addEventListener("click", () => {
      // The click that follows the long press lands on the overlay.
      if (Date.now() - this._openedAt > 400) this._close();
    });
    root.addEventListener("click", (ev) => {
      const el = ev.composedPath().find((n) => n.dataset && n.dataset.act);
      if (el) this._act(el.dataset.act);
    });
    root.addEventListener("change", (ev) => {
      const el = ev.composedPath()[0];
      if (el.dataset && el.dataset.act === "auto_lock_time") {
        const value = Number(el.value);
        if (!Number.isNaN(value)) this._call("number", "set_value", this._related.auto_lock_time, { value });
      }
    });
  }

  _call(domain, service, entityId, data = {}) {
    if (!entityId) return;
    this._hass.callService(domain, service, { entity_id: entityId, ...data });
  }

  /** Second tap within CONFIRM_MS confirms a risky action. */
  _confirmed(key) {
    if (this._confirm[key]) {
      clearTimeout(this._confirm[key]);
      delete this._confirm[key];
      this._refresh();
      return true;
    }
    this._confirm[key] = setTimeout(() => {
      delete this._confirm[key];
      this._refresh();
    }, CONFIRM_MS);
    this._refresh();
    return false;
  }

  _act(action) {
    const r = this._related;
    const s = this._hass.states;
    switch (action) {
      case "close":
        this._close();
        break;
      case "lock":
      case "unlock":
        this._card.command(action, "panel");
        break;
      case "auto_lock":
        this._call("switch", s[r.auto_lock]?.state === "on" ? "turn_off" : "turn_on", r.auto_lock);
        break;
      case "mute":
        this._call("switch", s[r.mute]?.state === "on" ? "turn_off" : "turn_on", r.mute);
        break;
      case "arming":
        this._call("input_boolean", s[r.arming]?.state === "on" ? "turn_off" : "turn_on", r.arming);
        break;
      case "refresh":
        this._call("button", "press", r.refresh);
        break;
      case "calibrate":
        if (this._confirmed("calibrate")) this._call("tuya_local_ble", "calibrate", r.lock);
        break;
      default:
        break;
    }
  }

  _refresh() {
    const hass = this._hass;
    const t = strings(hass);
    const r = this._related;
    const root = this.shadowRoot;
    const lock = hass.states[r.lock];
    const state = lock ? lock.state : "unavailable";
    const pending = this._card?.pending;
    const visual = pending ? { icon: "loader", tone: "pending" } : lockVisual(state);
    const name = this._config.name || lock?.attributes?.friendly_name || r.lock;

    root.querySelector(".title").textContent = name;
    root.querySelector(".description").textContent =
      lock?.attributes?.friendly_name && lock.attributes.friendly_name !== name ? lock.attributes.friendly_name : "";
    const status = root.querySelector(".status");
    status.className = `status tone-${visual.tone}`;
    status.querySelector(".tint").innerHTML = icon(visual.icon, 28, visual.icon === "loader" ? "spin" : "");
    status.querySelector(".state").textContent = pending
      ? t[pending === "lock" ? "locking" : "unlocking"] : t[state] || state;
    const badge = status.querySelector(".badge");
    const notConfirmed = !pending && unconfirmed(lock);
    badge.classList.toggle("warn", Boolean(notConfirmed));
    if (notConfirmed) {
      badge.hidden = false;
      badge.innerHTML = `${icon("triangle-alert", 12)}<span>${esc(t[`unconfirmed_${notConfirmed}`] || t.unconfirmed_short)}</span>`;
    } else if (lock) {
      const ctx = lock.context || {};
      const [source, sourceIcon] = changeSource(t, ctx.user_id, ctx.parent_id);
      badge.hidden = false;
      badge.innerHTML = `${icon(sourceIcon, 12)}<span>${esc(source)} · ${esc(relativeTime(hass, lock.last_changed))}</span>`;
    } else {
      badge.hidden = true;
    }

    const unavailable = !lock || state === "unavailable" || Boolean(pending);
    const target = toggleTarget(state);
    const lockBtn = root.querySelector('[data-act="lock"]');
    const unlockBtn = root.querySelector('[data-act="unlock"]');
    // Locking is always possible; it also drops an unlock still on its way.
    lockBtn.disabled = !lock || pending === "lock";
    const unlockWait = secondsUntil(lock, "unlock_blocked_until");
    unlockBtn.disabled = unavailable || unlockWait > 0;
    lockBtn.className = `btn btn-lg ${target === "lock" ? "btn-default" : "btn-outline"}`;
    const confirming = this._card?.confirming("panel");
    unlockBtn.className = `btn btn-lg ${confirming ? "btn-destructive" : target === "unlock" ? "btn-default" : "btn-outline"}`;
    lockBtn.innerHTML = `${icon("lock", 16)}<span>${esc(t.lock)}</span>`;
    const unlockLabel = unlockWait > 0 ? t.wait.replace("{s}", unlockWait) : confirming ? t.confirm_unlock : t.unlock;
    unlockBtn.innerHTML = `${icon("lock-open", 16)}<span>${esc(unlockLabel)}</span>`;

    clearTimeout(this._cooldownTimer);
    if (unlockWait > 0 || secondsUntil(lock, "calibration_blocked_until") > 0) {
      this._cooldownTimer = setTimeout(() => this._refresh(), 1000); // countdown
    }

    // Stats
    const stats = [];
    const battery = r.battery && hass.states[r.battery];
    if (battery) {
      const low = battery.state === "low" || battery.state === "poweroff";
      stats.push([t.battery, BATTERY_ICONS[battery.state] || "battery", t[`battery_${battery.state}`] || battery.state, low]);
    }
    const autoLock = r.auto_lock && hass.states[r.auto_lock];
    const autoTime = r.auto_lock_time && hass.states[r.auto_lock_time];
    if (autoLock) {
      const on = onOff(autoLock);
      stats.push([t.stat_auto_lock, "timer",
        on === "on" ? (isNumber(autoTime) ? `${autoTime.state} ${t.seconds}` : t.on) : on === "off" ? t.off : t.unknown_value]);
    }
    const arming = r.arming && hass.states[r.arming];
    if (arming) {
      stats.push([t.stat_arming, arming.state === "on" ? "shield-check" : "shield", arming.state === "on" ? t.on : t.off]);
    }
    const signal = r.signal && hass.states[r.signal];
    if (signal && !Number.isNaN(Number(signal.state))) {
      stats.push([t.signal, "bluetooth", `${signal.state} dBm`]);
    }
    root.querySelector(".stats").innerHTML = stats.map(([label, ic, value, low]) => `
      <div class="stat ${low ? "low" : ""}"><div class="label">${icon(ic, 14)}${esc(label)}</div>
      <div class="value">${esc(value)}</div></div>`).join("");

    // Settings
    const rows = [];
    let unknown = false;
    const toggle = (act, ic, label, entity) => {
      if (!entity) return;
      const on = onOff(entity);
      if (!on) unknown = true;
      const checked = on === "on" ? "true" : on === "off" ? "false" : "mixed";
      rows.push(`<div class="row">${icon(ic, 18)}<span class="label">${esc(label)}</span>
        <button class="switch" role="switch" aria-checked="${checked}" aria-label="${esc(label)}" data-act="${act}"></button></div>`);
    };
    toggle("arming", "shield", t.arming, arming);
    toggle("auto_lock", "timer", t.auto_lock, autoLock);
    const focused = root.activeElement?.dataset?.act === "auto_lock_time";
    if (autoTime) {
      const a = autoTime.attributes || {};
      const existing = root.querySelector('[data-act="auto_lock_time"]');
      if (!isNumber(autoTime)) unknown = true;
      const value = focused && existing ? existing.value : isNumber(autoTime) ? autoTime.state : "";
      rows.push(`<div class="row">${icon("timer", 18)}<span class="label">${esc(t.auto_lock_after)}</span>
        <input class="input" type="number" inputmode="numeric" data-act="auto_lock_time"
          min="${esc(a.min ?? 1)}" max="${esc(a.max ?? 1800)}" step="${esc(a.step ?? 1)}" value="${esc(value)}" placeholder="—">
        <span class="unit">${esc(t.seconds)}</span></div>`);
    }
    toggle("mute", "volume-x", t.mute, r.mute && hass.states[r.mute]);
    if (r.refresh) {
      rows.push(`<div class="row">${icon("refresh-cw", 18)}<span class="label">${esc(t.refresh)}</span>
        <button class="btn btn-secondary btn-sm" data-act="refresh">${esc(t.refresh_action)}</button></div>`);
    }
    if (hass.entities?.[r.lock]?.platform === "tuya_local_ble") {
      const armed = Boolean(this._confirm.calibrate);
      const wait = secondsUntil(lock, "calibration_blocked_until");
      const label = wait > 0 ? t.wait.replace("{s}", wait) : armed ? t.confirm_calibrate : t.calibrate_action;
      rows.push(`<div class="row">${icon("crosshair", 18)}<span class="label">${esc(t.calibrate)}</span>
        <button class="btn btn-sm ${armed ? "btn-destructive" : "btn-outline"}" data-act="calibrate" ${wait > 0 ? "disabled" : ""}>${esc(label)}</button></div>`);
      if (armed) rows.push(`<div class="row hint warn">${icon("triangle-alert", 18)}<span>${esc(t.calibrate_warning)}</span></div>`);
    }
    if (unknown && r.refresh) rows.push(`<div class="row hint">${icon("circle-help", 18)}<span>${esc(t.settings_unknown)}</span></div>`);
    const settings = root.querySelector(".settings");
    const html = rows.join("");
    if (settings._html !== html && !focused) {
      settings.innerHTML = html;
      settings._html = html;
    }
    settings.hidden = rows.length === 0;
    root.querySelector(".settings-title").hidden = rows.length === 0;

    this._renderHistory();
  }

  async _loadHistory() {
    const hass = this._hass;
    if (!hass.callWS) return;
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 3600 * 1000);
    try {
      const events = await hass.callWS({
        type: "logbook/get_events",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: [this._related.lock],
      });
      this._history = (events || []).filter((e) => e.state).slice(-12).reverse();
    } catch (err) {
      this._history = [];
    }
    this._renderHistory();
  }

  _renderHistory() {
    const t = strings(this._hass);
    const box = this.shadowRoot.querySelector(".history");
    if (this._history === null) return;
    if (!this._history.length) {
      box.innerHTML = `<div class="empty">${esc(t.no_history)}</div>`;
      return;
    }
    box.innerHTML = this._history.map((e) => {
      const visual = lockVisual(e.state);
      const [source, sourceIcon] = changeSource(t, e.context_user_id, null, e.context_event_type, e.context_domain);
      return `<div class="event tone-${visual.tone}">
        <div class="tint">${icon(visual.icon, 15)}</div>
        <div class="what"><div class="s">${esc(t[e.state] || e.state)}</div>
          <div class="src">${icon(sourceIcon, 12)}${esc(source)}</div></div>
        <div class="time">${esc(clockTime(this._hass, e.when * 1000))}</div></div>`;
    }).join("");
  }
}


/** Small name + state badge; a tap opens the details panel. */
class RaykubeLockChip extends RaykubeLockCard {
  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "lock" } } },
        { name: "name", selector: { text: {} } },
        { name: "confirm_unlock", selector: { boolean: {} } },
      ],
      computeLabel: (schema) => (EDITOR_LABELS[uiLanguage()] || EDITOR_LABELS.en)[schema.name],
    };
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: 1, min_columns: 3, min_rows: 1 };
  }

  _render() {
    const hass = this._hass;
    const t = strings(hass);
    const stateObj = hass.states[this._config.entity];
    if (!this._rendered) {
      this._rendered = true;
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>
          ${SHARED_STYLE}
          :host { display: inline-block; max-width: 100%; }
          .chip {
            display: inline-flex; align-items: center; gap: 10px; max-width: 100%; box-sizing: border-box;
            padding: 6px 14px 6px 6px; border-radius: var(--rk-radius); cursor: pointer;
            background: color-mix(in srgb, var(--rk-background) 88%, transparent);
            border: 1px solid color-mix(in srgb, var(--rk-tone) 45%, transparent);
            box-shadow: 0 4px 14px rgba(0, 0, 0, .25);
            -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
            user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
            transition: transform .12s ease, border-color .15s ease;
          }
          .chip:active { transform: scale(.97); }
          .chip:focus-visible { outline: 2px solid var(--rk-ring); outline-offset: 2px; }
          .icon { width: 32px; height: 32px; border-radius: 9px; }
          .text { min-width: 0; line-height: 1.25; }
          .name {
            font-size: 13px; font-weight: 600; color: var(--rk-foreground);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .state { font-size: 12px; font-weight: 500; color: var(--rk-tone); white-space: nowrap; }
        </style>
        <div class="chip" role="button" tabindex="0">
          <div class="icon tint"></div>
          <div class="text"><div class="name"></div><div class="state"></div></div>
        </div>`;
      const chip = this.shadowRoot.querySelector(".chip");
      chip.addEventListener("click", (ev) => {
        ev.stopPropagation(); // picture-elements must not run its own action
        this._haptic("light");
        this._openPanel();
      });
      chip.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._openPanel();
        }
      });
    }

    const chip = this.shadowRoot.querySelector(".chip");
    const name = this._config.name || stateObj?.attributes?.friendly_name || this._config.entity;
    const state = stateObj ? stateObj.state : "unavailable";
    const pending = this.pending;
    const visual = pending ? { icon: "loader", tone: "pending" } : lockVisual(state);
    const stateText = pending ? t[pending === "lock" ? "locking" : "unlocking"] : t[state] || state;
    chip.className = `chip tone-${visual.tone}`;
    chip.setAttribute("aria-label", `${name}: ${stateText}. ${t.tap_hint}`);
    chip.querySelector(".icon").innerHTML = icon(visual.icon, 18, visual.icon === "loader" ? "spin" : "");
    chip.querySelector(".name").textContent = name;
    chip.querySelector(".state").textContent = stateText;
  }
}

if (!customElements.get("raykube-lock-panel")) {
  customElements.define("raykube-lock-panel", RaykubeLockPanel);
}
if (!customElements.get("raykube-lock-card")) {
  customElements.define("raykube-lock-card", RaykubeLockCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "raykube-lock-card",
    name: "Raykube Lock",
    description: CARD_DESCRIPTIONS[uiLanguage()] || CARD_DESCRIPTIONS.en,
    preview: true,
    documentationURL: "https://github.com/jaroslaw-krolikowski/raykube-a1-ultra-integration/blob/master/docs/raykube-a1-ultra.md",
  });
}
if (!customElements.get("raykube-lock-chip")) {
  customElements.define("raykube-lock-chip", RaykubeLockChip);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "raykube-lock-chip",
    name: "Raykube Lock Chip",
    description: CHIP_DESCRIPTIONS[uiLanguage()] || CHIP_DESCRIPTIONS.en,
    preview: true,
    documentationURL: "https://github.com/jaroslaw-krolikowski/raykube-a1-ultra-integration/blob/master/docs/raykube-a1-ultra.md",
  });
  console.info(`%c RAYKUBE-LOCK-CARD %c ${CARD_VERSION} `,
    "color:#fff;background:#10b981;font-weight:700", "color:#10b981");
}
