(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const roomPath = window.location.pathname.replace(/\/+$/, "") || "/love-room-demo";

  const state = {
    person: "A",
    accessToken: "",
    settings: {},
    todos: [],
    weather: null,
    outfits: null,
    daily: null,
    dailyHistory: [],
    questions: [],
    movieState: null,
    movieMessages: [],
    presence: { A: 0, B: 0, drawing: { A: false, B: false } },
    drawings: [],
    strokes: [],
    drawGuess: null,
    drawGuessStrokes: [],
    anniversaries: { items: [], relationshipStartDate: "" },
    selectedAnniversaryId: localStorage.getItem("love-room-anniversary-id") || "",
    stampbook: null,
    stampbookYear: new Date().getFullYear(),
    stampbookMonth: new Date().getMonth() + 1,
    selectedStampDate: "",
    stampAutoChecked: false,
    publicConfig: {
      persons: {
        A: { name: "Person A", emoji: "💛" },
        B: { name: "Person B", emoji: "🌙" }
      },
      games: {
        vttUrl: "",
        posioUrl: ""
      },
      setup: {
        needsSetup: false,
        roomPath: "/love-room-demo",
        defaults: null
      }
    }
  };

  let socket = null;
  let socketBound = false;
  let appStarted = false;

  const els = {
    gate: $("#gate"),
    gateCard: $("#gate-card"),
    gateOrbits: $("#gate-orbits"),
    gateForm: $("#gate-form"),
    gateBack: $("#gate-back"),
    gatePicked: $("#gate-picked"),
    gatePasscode: $("#gate-passcode"),
    gateError: $("#gate-error"),
    gateTitle: $("#gate-title"),
    setupHint: $("#setup-hint"),
    setupForm: $("#setup-form"),
    setupError: $("#setup-error"),
    setupPersonAName: $("#setup-person-a-name"),
    setupPersonAEmoji: $("#setup-person-a-emoji"),
    setupPersonAPasscode: $("#setup-person-a-passcode"),
    setupCityAName: $("#setup-city-a-name"),
    setupCityATimezone: $("#setup-city-a-timezone"),
    setupCityABirthday: $("#setup-city-a-birthday"),
    setupPersonBName: $("#setup-person-b-name"),
    setupPersonBEmoji: $("#setup-person-b-emoji"),
    setupPersonBPasscode: $("#setup-person-b-passcode"),
    setupCityBName: $("#setup-city-b-name"),
    setupCityBTimezone: $("#setup-city-b-timezone"),
    setupCityBBirthday: $("#setup-city-b-birthday"),
    setupNextMeetingAt: $("#setup-next-meeting-at"),
    setupNextMeetingLocation: $("#setup-next-meeting-location"),
    setupNextMeetingTitle: $("#setup-next-meeting-title"),
    roomSubtitle: $("#room-subtitle"),
    heroTitle: $("#hero-title"),
    heroLine: $("#hero-line"),
    heroDays: $("#hero-days"),
    cityAName: $("#city-a-name"),
    cityAZone: $("#city-a-zone"),
    cityATime: $("#city-a-time"),
    cityADate: $("#city-a-date"),
    cityAWeather: $("#city-a-weather"),
    cityBName: $("#city-b-name"),
    cityBZone: $("#city-b-zone"),
    cityBTime: $("#city-b-time"),
    cityBDate: $("#city-b-date"),
    cityBWeather: $("#city-b-weather"),
    outfitATitle: $("#outfit-a-title"),
    outfitAWeather: $("#outfit-a-weather"),
    outfitAAdvice: $("#outfit-a-advice"),
    outfitAMetrics: $("#outfit-a-metrics"),
    outfitAPicker: $("#outfit-a-picker"),
    outfitBTitle: $("#outfit-b-title"),
    outfitBWeather: $("#outfit-b-weather"),
    outfitBAdvice: $("#outfit-b-advice"),
    outfitBMetrics: $("#outfit-b-metrics"),
    outfitBPicker: $("#outfit-b-picker"),
    smallCalendar: $("#small-calendar"),
    dashboardMeetingTitle: $("#dashboard-meeting-title"),
    dashboardMeetingMeta: $("#dashboard-meeting-meta"),
    dashboardCountdown: $("#dashboard-countdown"),
    dashboardDailyQuestion: $("#dashboard-daily-question"),
    dashboardDailyMeta: $("#dashboard-daily-meta"),
    dashboardDailyAnswers: $("#dashboard-daily-answers"),
    dashboardTodoSummary: $("#dashboard-todo-summary"),
    dashboardTodoMeta: $("#dashboard-todo-meta"),
    dashboardDrawingSummary: $("#dashboard-drawing-summary"),
    dashboardDrawingMeta: $("#dashboard-drawing-meta"),
    countdownTitle: $("#countdown-title"),
    countdownMeta: $("#countdown-meta"),
    countdownMain: $("#countdown-main"),
    anniversaryHint: $("#anniversary-hint"),
    anniversarySelector: $("#anniversary-selector"),
    anniversaryDetail: $("#anniversary-detail"),
    anniversaryForm: $("#anniversary-form"),
    anniversaryTitle: $("#anniversary-title"),
    anniversaryDate: $("#anniversary-date"),
    anniversaryIcon: $("#anniversary-icon"),
    todoForm: $("#todo-form"),
    todoId: $("#todo-id"),
    todoTitle: $("#todo-title"),
    todoType: $("#todo-type"),
    todoNote: $("#todo-note"),
    todoSubmit: $("#todo-submit"),
    todoCancel: $("#todo-cancel"),
    todoList: $("#todo-list"),
    dailyDate: $("#daily-date"),
    dailyStatus: $("#daily-status"),
    dailyQuestion: $("#daily-question"),
    dailyForm: $("#daily-form"),
    dailyAnswer: $("#daily-answer"),
    dailyAnswers: $("#daily-answers"),
    dailyHistory: $("#daily-history"),
    questionForm: $("#question-form"),
    questionText: $("#question-text"),
    questionGenerate: $("#question-generate"),
    questionList: $("#question-list"),
    movieVideo: $("#movie-video"),
    movieTitle: $("#movie-title"),
    moviePresence: $("#movie-presence"),
    movieStatus: $("#movie-status"),
    movieSync: $("#movie-sync"),
    movieRate: $("#movie-rate"),
    movieUrlForm: $("#movie-url-form"),
    movieUrl: $("#movie-url"),
    movieUploadForm: $("#movie-upload-form"),
    movieFile: $("#movie-file"),
    movieUploadStatus: $("#movie-upload-status"),
    movieChat: $("#movie-chat"),
    movieChatForm: $("#movie-chat-form"),
    movieMessage: $("#movie-message"),
    canvas: $("#drawing-canvas"),
    drawingPresence: $("#drawing-presence"),
    drawingPresenceText: $("#drawing-presence-text"),
    brushColor: $("#brush-color"),
    brushSize: $("#brush-size"),
    eraserMode: $("#eraser-mode"),
    undoDrawing: $("#undo-drawing"),
    clearDrawing: $("#clear-drawing"),
    saveDrawingForm: $("#save-drawing-form"),
    drawingTitle: $("#drawing-title"),
    drawingGallery: $("#drawing-gallery"),
    stampbookOpen: $("#stampbook-open"),
    stampbookRoom: $("#stampbook-room"),
    stampbookStatus: $("#stampbook-status"),
    stampbookYear: $("#stampbook-year"),
    stampbookMonth: $("#stampbook-month"),
    stampbookStreak: $("#stampbook-streak"),
    stampbookProgressText: $("#stampbook-progress-text"),
    stampbookBadge: $("#stampbook-badge"),
    stampbookProgressFill: $("#stampbook-progress-fill"),
    stampbookGridTitle: $("#stampbook-grid-title"),
    stampbookGridMeta: $("#stampbook-grid-meta"),
    stampbookGrid: $("#stampbook-grid"),
    stampbookDetail: $("#stampbook-detail"),
    drawGuessOpen: $("#drawguess-open"),
    drawGuessRoom: $("#drawguess-room"),
    drawGuessTitle: $("#drawguess-title"),
    drawGuessStatus: $("#drawguess-status"),
    drawGuessWordBox: $("#drawguess-word-box"),
    drawGuessWord: $("#drawguess-word"),
    drawGuessNewRound: $("#drawguess-new-round"),
    drawGuessPassTurn: $("#drawguess-pass-turn"),
    drawGuessCanvas: $("#drawguess-canvas"),
    drawGuessColor: $("#drawguess-color"),
    drawGuessSize: $("#drawguess-size"),
    drawGuessUndo: $("#drawguess-undo"),
    drawGuessClear: $("#drawguess-clear"),
    drawGuessGuesses: $("#drawguess-guesses"),
    drawGuessGuessForm: $("#drawguess-guess-form"),
    drawGuessGuess: $("#drawguess-guess"),
    settingsForm: $("#settings-form")
  };

  const ctx = els.canvas.getContext("2d");
  const gameCtx = els.drawGuessCanvas.getContext("2d");
  let dpr = window.devicePixelRatio || 1;
  let gameDpr = window.devicePixelRatio || 1;
  let drawing = false;
  let currentStroke = null;
  let gameDrawing = false;
  let currentGameStroke = null;
  let drawingActivityActive = false;
  let drawingActivityTimer = null;
  let applyingMovieState = false;
  let pendingMovieState = null;
  let lastMovieEmitAt = 0;
  let settingsFilled = false;
  let setupFilled = false;
  let anniversarySelectorSignature = "";
  const outfitOptions = ["短袖", "长袖", "卫衣", "毛衣", "薄外套", "厚外套", "裙子", "长裤", "围巾", "雨伞", "防晒"];
  const questionSeedGroups = [
    [
      "今天有没有一个瞬间特别想被抱抱？",
      "如果今晚能一起散步，你想走到哪里？",
      "今天最想让我知道的一件小事是什么？",
      "如果我现在在你身边，你想让我先做什么？",
      "今天有什么东西让你想起我们？"
    ],
    [
      "下次见面第一口想吃什么？",
      "今天你最想听我用什么语气哄你？",
      "如果把今天变成一张合照，背景会是什么？",
      "今天有没有哪句话想留给以后的我们？",
      "如果今晚能一起看电影，你想看什么类型？"
    ],
    [
      "今天最可爱的一秒发生在哪里？",
      "如果我能给你寄一个小东西，你想收到什么？",
      "今天有没有一点点委屈想被我接住？",
      "我们下次一起做哪件小事会让你开心？",
      "今天最适合被亲亲的理由是什么？"
    ]
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function truncateText(value, maxLength = 34) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
  }

  function displayCoordinate(value) {
    const text = String(value || "").trim();
    return text === "0" || text === "0.0" || text === "0.0000" ? "" : text;
  }

  function personProfile(person) {
    const safePerson = person === "B" ? "B" : "A";
    const fallback = safePerson === "B"
      ? { name: "Person B", emoji: "🌙" }
      : { name: "Person A", emoji: "💛" };
    return {
      ...fallback,
      ...(state.publicConfig.persons?.[safePerson] || {})
    };
  }

  function coupleName(person) {
    const profile = personProfile(person);
    return `${profile.emoji} ${profile.name}`.trim();
  }

  function socketEmit(eventName, payload) {
    if (socket?.connected) {
      socket.emit(eventName, payload);
    }
  }

  function sendDrawingActivity(active) {
    const next = Boolean(active);
    window.clearTimeout(drawingActivityTimer);
    if (drawingActivityActive !== next) {
      drawingActivityActive = next;
      socketEmit("drawing:activity", { active: next });
    }
    if (next) {
      drawingActivityTimer = window.setTimeout(() => sendDrawingActivity(false), 8000);
    }
  }

  function labelForPerson(person) {
    if (person === "B") return state.settings.cityBName || "City B";
    return state.settings.cityAName || "City A";
  }

  function cityLabelForPerson(person) {
    return personProfile(person).name;
  }

  function configureGameLink(key, url) {
    const link = $(`[data-game-link="${key}"]`);
    if (!link) return;
    const cleanUrl = String(url || "").trim();
    if (cleanUrl) {
      link.href = cleanUrl;
      link.textContent = "进入";
      link.classList.remove("is-disabled");
      link.removeAttribute("aria-disabled");
      return;
    }
    link.removeAttribute("href");
    link.textContent = "未配置";
    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled", "true");
  }

  function fillSetupForm(force = false) {
    if (setupFilled && !force) return;
    const persons = state.publicConfig.persons || {};
    const defaults = state.publicConfig.setup?.defaults || {};
    if (els.setupPersonAName) els.setupPersonAName.value = persons.A?.name || "Person A";
    if (els.setupPersonAEmoji) els.setupPersonAEmoji.value = persons.A?.emoji || "💛";
    if (els.setupPersonAPasscode) els.setupPersonAPasscode.value = "";
    if (els.setupCityAName) els.setupCityAName.value = defaults.cityAName || "City A";
    if (els.setupCityATimezone) els.setupCityATimezone.value = defaults.cityATimezone || "UTC";
    if (els.setupCityABirthday) els.setupCityABirthday.value = defaults.cityABirthday || "";
    if (els.setupPersonBName) els.setupPersonBName.value = persons.B?.name || "Person B";
    if (els.setupPersonBEmoji) els.setupPersonBEmoji.value = persons.B?.emoji || "🌙";
    if (els.setupPersonBPasscode) els.setupPersonBPasscode.value = "";
    if (els.setupCityBName) els.setupCityBName.value = defaults.cityBName || "City B";
    if (els.setupCityBTimezone) els.setupCityBTimezone.value = defaults.cityBTimezone || "UTC";
    if (els.setupCityBBirthday) els.setupCityBBirthday.value = defaults.cityBBirthday || "";
    if (els.setupNextMeetingAt) els.setupNextMeetingAt.value = defaults.nextMeetingAt ? toDateTimeLocal(defaults.nextMeetingAt) : "";
    if (els.setupNextMeetingLocation) els.setupNextMeetingLocation.value = defaults.nextMeetingLocation || "";
    if (els.setupNextMeetingTitle) els.setupNextMeetingTitle.value = defaults.nextMeetingTitle || "Next Meeting";
    setupFilled = true;
  }

  function renderPublicConfig() {
    const needsSetup = Boolean(state.publicConfig.setup?.needsSetup);
    ["A", "B"].forEach((person) => {
      const button = $(`[data-gate-person="${person}"]`);
      const profile = personProfile(person);
      const emoji = button?.querySelector(".gate-emoji");
      const label = button?.querySelector(".gate-label");
      if (emoji) emoji.textContent = profile.emoji;
      if (label) label.textContent = profile.name;
      if (button) button.setAttribute("aria-label", `${profile.name} 入口`);
    });
    setText(els.gateTitle, needsSetup ? "Set up your room" : "选择你的入口");
    if (els.setupHint) {
      els.setupHint.hidden = !needsSetup;
    }
    if (els.setupForm) {
      els.setupForm.hidden = !needsSetup;
    }
    if (els.gateOrbits) {
      els.gateOrbits.hidden = needsSetup;
    }
    if (els.gateForm && needsSetup) {
      els.gateForm.hidden = true;
    }
    if (needsSetup) {
      fillSetupForm();
    }
    configureGameLink("vtt", state.publicConfig.games?.vttUrl);
    configureGameLink("posio", state.publicConfig.games?.posioUrl);
  }

  async function loadPublicConfig() {
    try {
      const config = await api("/api/public-config");
      state.publicConfig = {
        persons: {
          ...state.publicConfig.persons,
          ...(config.persons || {})
        },
        games: {
          ...state.publicConfig.games,
          ...(config.games || {})
        },
        setup: {
          ...state.publicConfig.setup,
          ...(config.setup || {})
        }
      };
    } catch (error) {
      console.warn("Public config load failed", error);
    }
    renderPublicConfig();
  }

  async function api(url, options = {}) {
    const headers = {
      "X-Love-Room": roomPath,
      ...(options.headers || {})
    };
    if (state.accessToken) {
      headers["X-Love-Room-Access"] = state.accessToken;
    }
    let body = options.body;
    if (options.formData) {
      body = options.formData;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(data?.error || response.statusText);
    }
    return data;
  }

  function reportError(error) {
    console.error(error);
    window.alert(error.message || String(error));
  }

  function setRoute(route) {
    const safeRoute = route || "dashboard";
    $$(".page").forEach((page) => page.classList.toggle("is-active", page.id === `page-${safeRoute}`));
    $$(".tab").forEach((tab) => {
      const isActive = tab.dataset.route === safeRoute;
      tab.classList.toggle("is-active", isActive);
      if (isActive) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
    if (window.location.hash.slice(1) !== safeRoute) {
      history.replaceState(null, "", `#${safeRoute}`);
    }
    if (safeRoute === "drawing") {
      requestAnimationFrame(resizeCanvas);
    }
    if (safeRoute === "games") {
      requestAnimationFrame(resizeDrawGuessCanvas);
      socketEmit("drawguess:request-state");
    }
    if (safeRoute === "dashboard") {
      refreshOverviewData();
      loadOutfits();
    }
  }

  function renderIdentity() {
    $$(".chip[data-person]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.person === state.person);
    });
    els.roomSubtitle.textContent = `${state.settings.cityAName || "City A"} ↔ ${state.settings.cityBName || "City B"}`;
  }

  function formatInTimezone(timeZone, options) {
    try {
      return new Intl.DateTimeFormat("zh-CN", { timeZone, ...options }).format(new Date());
    } catch (_error) {
      return "--";
    }
  }

  function renderClocks() {
    const s = state.settings;
    const cityAZone = s.cityATimezone || "Asia/Shanghai";
    const cityBZone = s.cityBTimezone || "Europe/Rome";
    els.cityAName.textContent = s.cityAName || "City A";
    els.cityAZone.textContent = cityAZone;
    els.cityBName.textContent = s.cityBName || "City B";
    els.cityBZone.textContent = cityBZone;

    els.cityATime.textContent = formatInTimezone(cityAZone, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    els.cityADate.textContent = formatInTimezone(cityAZone, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    });
    els.cityBTime.textContent = formatInTimezone(cityBZone, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    els.cityBDate.textContent = formatInTimezone(cityBZone, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    });
  }

  function renderWeatherLine(element, weather) {
    if (!weather) {
      element.textContent = "天气加载中";
      return;
    }
    if (!weather.ok) {
      element.textContent = "天气暂不可用";
      return;
    }
    const icon = weather.iconUrl
      ? `<img src="${escapeHtml(weather.iconUrl)}" alt="">`
      : `<span class="weather-symbol">${escapeHtml(weather.icon || "○")}</span>`;
    element.innerHTML = `${icon}<span>${escapeHtml(weather.temperature)}°C · ${escapeHtml(weather.condition)}</span>`;
  }

  function renderWeather() {
    renderWeatherLine(els.cityAWeather, state.weather?.places?.[0]);
    renderWeatherLine(els.cityBWeather, state.weather?.places?.[1]);
    renderCarePanels();
  }

  function weatherForPerson(person) {
    return state.weather?.places?.[person === "B" ? 1 : 0] || null;
  }

  function preferenceForPerson(person) {
    const value = person === "B" ? state.settings.cityBColdPreference : state.settings.cityAColdPreference;
    return ["cold", "normal", "hot"].includes(value) ? value : "normal";
  }

  function outfitAdvice(person, weather) {
    if (!weather?.ok) return "天气还没同步好，先按体感来，出门前再看一眼。";
    const feels = Number(weather.feelsLike ?? weather.temperature);
    const uv = Number(weather.uvIndex ?? 0);
    const wind = Number(weather.windSpeed ?? 0);
    const condition = String(weather.condition || "");
    const preference = preferenceForPerson(person);
    let adjusted = feels;
    if (preference === "cold") adjusted -= 2;
    if (preference === "hot") adjusted += 2;

    const pieces = [];
    if (adjusted < 5) pieces.push("厚外套、毛衣和围巾都安排上");
    else if (adjusted < 12) pieces.push("毛衣加外套比较稳");
    else if (adjusted < 18) pieces.push("薄外套或卫衣刚刚好");
    else if (adjusted < 25) pieces.push("长袖、薄衬衫或轻外套都舒服");
    else pieces.push("短袖和透气一点的衣服更舒服");

    if (/雨|阵雨|雷|毛毛/.test(condition)) pieces.push("记得带伞，鞋子别选太怕水的");
    if (wind >= 20) pieces.push("风有点明显，外套比单穿更安心");
    if (uv >= 6) pieces.push("紫外线偏强，防晒也带上");
    if (preference === "cold") pieces.push("你比较怕冷，可以多加一层");
    if (preference === "hot") pieces.push("你比较怕热，别穿得太闷");
    return `${cityLabelForPerson(person)}今天建议：${pieces.join("，")}。`;
  }

  function renderWeatherMetrics(element, weather) {
    if (!element) return;
    if (!weather?.ok) {
      element.innerHTML = `<div class="metric"><span>状态</span><strong>天气同步中</strong></div>`;
      return;
    }
    const uv = weather.uvIndex === null || weather.uvIndex === undefined ? "--" : weather.uvIndex;
    element.innerHTML = `
      <div class="metric"><span>体感</span><strong>${escapeHtml(weather.feelsLike ?? weather.temperature)}°C</strong></div>
      <div class="metric"><span>风速</span><strong>${escapeHtml(weather.windSpeed ?? "--")} km/h</strong></div>
      <div class="metric"><span>UV</span><strong>${escapeHtml(uv)}</strong></div>
      <div class="metric"><span>偏好</span><strong>${preferenceForPerson(element.dataset?.person) === "cold" ? "怕冷" : preferenceForPerson(element.dataset?.person) === "hot" ? "怕热" : "正常"}</strong></div>
    `;
  }

  function renderOutfitPicker(element, person) {
    if (!element) return;
    const picked = new Set(state.outfits?.[person]?.items || []);
    element.innerHTML = outfitOptions.map((item) => `
      <button class="outfit-chip ${picked.has(item) ? "is-picked" : ""}" type="button" data-outfit="${escapeHtml(item)}">${escapeHtml(item)}</button>
    `).join("");
  }

  function renderOutfitCard(person) {
    const isB = person === "B";
    const weather = weatherForPerson(person);
    const title = isB ? els.outfitBTitle : els.outfitATitle;
    const weatherTag = isB ? els.outfitBWeather : els.outfitAWeather;
    const advice = isB ? els.outfitBAdvice : els.outfitAAdvice;
    const metrics = isB ? els.outfitBMetrics : els.outfitAMetrics;
    const picker = isB ? els.outfitBPicker : els.outfitAPicker;
    if (metrics) metrics.dataset.person = person;
    setText(title, `${cityLabelForPerson(person)}穿什么`);
    setText(weatherTag, weather?.ok ? `${weather.temperature}°C · ${weather.condition}` : "天气同步中");
    setText(advice, outfitAdvice(person, weather));
    renderWeatherMetrics(metrics, weather);
    renderOutfitPicker(picker, person);
  }

  function dayDiffFromToday(date) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - start) / 86400000);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function parseDateInput(value) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateOnly(date) {
    if (!date) return "--";
    return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  }

  function nextBirthday(mmdd) {
    const [month, day] = String(mmdd || "").split("-").map(Number);
    if (!month || !day) return null;
    const now = new Date();
    let date = new Date(now.getFullYear(), month - 1, day);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) date = new Date(now.getFullYear() + 1, month - 1, day);
    return date;
  }

  function renderSmallCalendar() {
    const items = [
      { label: `${personProfile("A").name} Birthday`, date: nextBirthday(state.settings.cityABirthday) },
      { label: `${personProfile("B").name} Birthday`, date: nextBirthday(state.settings.cityBBirthday) },
      { label: state.settings.nextMeetingTitle || "下一次见面", date: state.settings.nextMeetingAt ? new Date(state.settings.nextMeetingAt) : null }
    ].filter((item) => item.date && !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date);
    els.smallCalendar.innerHTML = items.map((item) => {
      const days = dayDiffFromToday(item.date);
      return `<div class="calendar-item"><span>${escapeHtml(item.label)}</span><strong>${formatDateOnly(item.date)} · ${days === 0 ? "今天" : `${Math.max(0, days)} 天后`}</strong></div>`;
    }).join("");
  }

  function renderCarePanels() {
    renderOutfitCard("A");
    renderOutfitCard("B");
    renderSmallCalendar();
  }

  function countdownParts() {
    const target = new Date(state.settings.nextMeetingAt || Date.now());
    let total = Math.max(0, target.getTime() - Date.now());
    const days = Math.floor(total / 86400000);
    total -= days * 86400000;
    const hours = Math.floor(total / 3600000);
    total -= hours * 3600000;
    const minutes = Math.floor(total / 60000);
    total -= minutes * 60000;
    const seconds = Math.floor(total / 1000);
    return [
      ["天", days],
      ["小时", hours],
      ["分钟", minutes],
      ["秒", seconds]
    ];
  }

  function renderCountdownInto(element) {
    element.innerHTML = countdownParts().map(([label, value], index) => {
      const shown = index === 0 ? String(value) : String(value).padStart(2, "0");
      return `<div class="timebox"><strong>${shown}</strong><span>${label}</span></div>`;
    }).join("");
  }

  function renderMeeting() {
    const title = state.settings.nextMeetingTitle || `Next Meeting${state.settings.nextMeetingLocation ? `: ${state.settings.nextMeetingLocation}` : ""}`;
    const at = state.settings.nextMeetingAt ? new Date(state.settings.nextMeetingAt) : new Date();
    const meta = `${state.settings.nextMeetingLocation || "To be decided"} · ${at.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    els.dashboardMeetingTitle.textContent = title;
    els.dashboardMeetingMeta.textContent = meta;
    els.countdownTitle.textContent = title;
    els.countdownMeta.textContent = meta;
    renderCountdownInto(els.dashboardCountdown);
    renderCountdownInto(els.countdownMain);
    renderAnniversaries();
    renderOverview();
  }

  function anniversaryDate(item) {
    const date = parseDateInput(item?.date);
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function anniversarySourceLabel(item) {
    if (item?.source === "custom") return "自定义";
    if (item?.source === "birthday") return "生日";
    return "自动纪念日";
  }

  function anniversaryCountdown(item) {
    const date = anniversaryDate(item);
    if (!date) return { status: "unknown", label: "--", detail: "日期不可用", days: 0, hours: 0 };
    const dayDelta = dayDiffFromToday(date);
    if (dayDelta === 0) {
      return { status: "today", label: "今天", detail: `${item.title}就是今天`, days: 0, hours: 0 };
    }
    if (dayDelta > 0) {
      const total = Math.max(0, date.getTime() - Date.now());
      const days = Math.floor(total / 86400000);
      const hours = Math.floor((total - days * 86400000) / 3600000);
      return {
        status: "upcoming",
        label: `${days} 天 ${hours} 小时`,
        detail: `距离${item.title}还有 ${days} 天 ${hours} 小时`,
        days,
        hours
      };
    }
    const pastDays = Math.abs(dayDelta);
    return {
      status: "past",
      label: `已过去 ${pastDays} 天`,
      detail: `距离${item.title}已过去 ${pastDays} 天`,
      days: pastDays,
      hours: 0
    };
  }

  function formatAnniversaryDate(item) {
    const date = anniversaryDate(item);
    if (!date) return "--";
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long"
    });
  }

  function currentAnniversaryItems() {
    return Array.isArray(state.anniversaries?.items) ? state.anniversaries.items : [];
  }

  function ensureSelectedAnniversary(items = currentAnniversaryItems()) {
    if (!items.length) {
      state.selectedAnniversaryId = "";
      return null;
    }
    const existing = items.find((item) => item.id === state.selectedAnniversaryId);
    const picked = existing || items[0];
    state.selectedAnniversaryId = picked.id;
    localStorage.setItem("love-room-anniversary-id", picked.id);
    return picked;
  }

  function renderAnniversaries() {
    if (!els.anniversarySelector || !els.anniversaryDetail) return;
    const items = currentAnniversaryItems();
    const selected = ensureSelectedAnniversary(items);
    const startDate = state.anniversaries?.relationshipStartDate;
    const hint = startDate
      ? `恋爱开始于 ${startDate}，自动纪念日会按这个日期计算。`
      : "还没有设置恋爱开始日期；生日和自定义纪念日可以先用。";
    setText(els.anniversaryHint, hint);

    if (!items.length) {
      anniversarySelectorSignature = "";
      els.anniversarySelector.innerHTML = `<p class="muted">暂无纪念日，先新增一个自定义纪念日。</p>`;
      els.anniversaryDetail.innerHTML = `<p class="muted">保存后会显示对应倒计时。</p>`;
      return;
    }

    const signature = items.map((item) => `${item.id}:${item.title}:${item.date}:${item.icon}`).join("|") + `|${state.selectedAnniversaryId}`;
    if (signature !== anniversarySelectorSignature) {
      anniversarySelectorSignature = signature;
      els.anniversarySelector.innerHTML = items.map((item) => {
        const countdown = anniversaryCountdown(item);
        return `
          <button class="anniversary-card ${item.id === state.selectedAnniversaryId ? "is-active" : ""}" type="button" data-id="${escapeHtml(item.id)}">
            <span class="anniversary-card-icon">${escapeHtml(item.icon || "♡")}</span>
            <span class="anniversary-card-body">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(countdown.label)}</small>
            </span>
          </button>
        `;
      }).join("");
    }

    const countdown = anniversaryCountdown(selected);
    els.anniversaryDetail.innerHTML = `
      <div class="anniversary-detail-icon">${escapeHtml(selected.icon || "♡")}</div>
      <div class="anniversary-detail-copy">
        <span class="tag">${escapeHtml(anniversarySourceLabel(selected))}</span>
        <h3>${escapeHtml(selected.title)}</h3>
        <strong>${escapeHtml(countdown.detail)}</strong>
        <p class="muted">${escapeHtml(formatAnniversaryDate(selected))}</p>
      </div>
      ${selected.editable ? `
        <button class="ghost danger anniversary-delete" type="button" data-id="${Number(selected.rawId || 0)}">删除</button>
      ` : ""}
    `;
  }

  async function loadAnniversaries() {
    try {
      state.anniversaries = await api("/api/anniversaries");
      renderAnniversaries();
    } catch (error) {
      console.warn(error);
      if (els.anniversaryDetail) {
        els.anniversaryDetail.innerHTML = `<p class="muted">纪念日暂时加载失败。</p>`;
      }
    }
  }

  function renderOverview() {
    const cityA = state.settings.cityAName || "City A";
    const cityB = state.settings.cityBName || "City B";
    const zoneA = state.settings.cityATimezone || "Asia/Shanghai";
    const zoneB = state.settings.cityBTimezone || "Europe/Rome";
    const days = countdownParts()[0][1];

    setText(els.heroTitle, `${coupleName("A")} 和 ${coupleName("B")}`);
    setText(els.heroLine, `${cityA} ${formatInTimezone(zoneA, { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false })} · ${cityB} ${formatInTimezone(zoneB, { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false })}`);
    setText(els.heroDays, `${days} 天`);

    if (state.daily?.question?.text) {
      const mineAnswered = Boolean(state.daily.answered?.[state.person]);
      const otherPerson = state.person === "A" ? "B" : "A";
      const otherAnswered = Boolean(state.daily.answered?.[otherPerson]);
      const ownAnswer = state.daily.answers?.[state.person]?.answer;
      setText(els.dashboardDailyQuestion, state.daily.question.text);
      setText(els.dashboardDailyMeta, state.daily.unlocked
        ? ownAnswer
          ? `双方已答 · 你的回答：${truncateText(ownAnswer)}`
          : "双方答案已解锁"
        : mineAnswered
          ? ownAnswer
            ? `你已答 · ${truncateText(ownAnswer)}`
            : `你已答 · 等${labelForPerson(otherPerson)}提交`
          : otherAnswered
            ? `${labelForPerson(otherPerson)}已提交，写下你的答案后解锁`
            : "今天还没有提交自己的答案");
      if (els.dashboardDailyAnswers) {
        els.dashboardDailyAnswers.innerHTML = ["A", "B"].map((person) => {
          const answer = state.daily.answers?.[person]?.answer;
          const answered = Boolean(state.daily.answered?.[person]);
          return `
            <div class="mini-answer ${answer ? "" : "is-muted"}">
              <strong>${coupleName(person)}</strong>
              <span>${answer ? escapeHtml(answer) : answered ? "已提交，等待解锁" : "还没有回答"}</span>
            </div>
          `;
        }).join("");
      }
    } else {
      setText(els.dashboardDailyQuestion, "今天的问题同步中");
      setText(els.dashboardDailyMeta, "进入「今天」页也可以手动提交答案。");
      if (els.dashboardDailyAnswers) {
        els.dashboardDailyAnswers.innerHTML = "";
      }
    }

    const totalTodos = state.todos.length;
    const doneTodos = state.todos.filter((todo) => todo.completed).length;
    const pendingTodo = state.todos.find((todo) => !todo.completed);
    const latestTodo = pendingTodo || state.todos[0];
    setText(els.dashboardTodoSummary, totalTodos ? `${totalTodos - doneTodos} 个进行中 · ${doneTodos} 个完成` : "0 个心愿");
    setText(els.dashboardTodoMeta, latestTodo ? `最近：${truncateText(latestTodo.title, 42)}` : "一起想做的事会在这里慢慢长出来。");
    setText(els.dashboardDrawingSummary, `${state.drawings.length} 张作品`);
    setText(els.dashboardDrawingMeta, state.drawings[0] ? `最近保存：${truncateText(state.drawings[0].title || "共同画板", 42)}` : "保存的画板会留在服务器里。");
  }

  async function refreshOverviewData() {
    try {
      const [daily, todos, drawings] = await Promise.all([
        api("/api/daily"),
        api("/api/todos"),
        api("/api/drawings")
      ]);
      state.daily = daily;
      state.todos = todos;
      state.drawings = drawings;
    } catch (error) {
      console.warn("Overview refresh failed", error);
    }
    renderOverview();
  }

  function toDateTimeLocal(iso) {
    const date = new Date(iso || Date.now());
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function fillSettings(force = false) {
    if (settingsFilled && !force) return;
    const s = state.settings;
    $("#setting-city-a-name").value = s.cityAName || "City A";
    $("#setting-city-a-timezone").value = s.cityATimezone || "UTC";
    $("#setting-city-a-latitude").value = displayCoordinate(s.cityALatitude);
    $("#setting-city-a-longitude").value = displayCoordinate(s.cityALongitude);
    $("#setting-city-a-cold-preference").value = s.cityAColdPreference || "normal";
    $("#setting-city-a-birthday").value = s.cityABirthday || "";
    $("#setting-city-b-name").value = s.cityBName || "City B";
    $("#setting-city-b-timezone").value = s.cityBTimezone || "UTC";
    $("#setting-city-b-latitude").value = displayCoordinate(s.cityBLatitude);
    $("#setting-city-b-longitude").value = displayCoordinate(s.cityBLongitude);
    $("#setting-city-b-cold-preference").value = s.cityBColdPreference || "normal";
    $("#setting-city-b-birthday").value = s.cityBBirthday || "";
    $("#setting-relationship-start-date").value = s.relationshipStartDate || "";
    $("#setting-next-meeting-at").value = toDateTimeLocal(s.nextMeetingAt);
    $("#setting-next-meeting-location").value = s.nextMeetingLocation || "";
    $("#setting-next-meeting-title").value = s.nextMeetingTitle || "Next Meeting";
    settingsFilled = true;
  }

  function renderAllSettingsDriven() {
    renderIdentity();
    renderClocks();
    renderMeeting();
    renderDaily();
    renderMoviePresence();
    renderCarePanels();
    fillSettings();
  }

  async function loadSettings() {
    state.settings = await api("/api/settings");
    renderAllSettingsDriven();
  }

  async function loadWeather() {
    try {
      state.weather = await api("/api/weather");
    } catch (error) {
      state.weather = null;
      console.warn(error);
    }
    renderWeather();
  }

  async function loadOutfits() {
    try {
      state.outfits = await api("/api/outfits");
    } catch (error) {
      state.outfits = null;
      console.warn(error);
    }
    renderCarePanels();
  }

  function resetTodoForm() {
    els.todoId.value = "";
    els.todoTitle.value = "";
    els.todoNote.value = "";
    els.todoType.value = "想一起做的事";
    els.todoSubmit.textContent = "添加";
    els.todoCancel.hidden = true;
  }

  function renderTodos() {
    if (!state.todos.length) {
      els.todoList.innerHTML = `<div class="panel clock-panel muted">还没有心愿。</div>`;
      renderOverview();
      return;
    }
    els.todoList.innerHTML = state.todos.map((todo) => `
      <article class="todo-card ${todo.completed ? "is-done" : ""}" data-id="${todo.id}">
        <input type="checkbox" ${todo.completed ? "checked" : ""} aria-label="完成状态">
        <div class="todo-body">
          <div class="todo-title-row">
            <strong>${escapeHtml(todo.title)}</strong>
            <span class="tag">${escapeHtml(todo.type)}</span>
          </div>
          ${todo.note ? `<p class="todo-note">${escapeHtml(todo.note)}</p>` : ""}
          <p class="muted">${todo.completed ? `完成于 ${formatShortDate(todo.completedAt)}` : `创建于 ${formatShortDate(todo.createdAt)}`}</p>
          <div class="todo-actions">
            <button class="ghost" type="button" data-action="edit">编辑</button>
            <button class="ghost danger" type="button" data-action="delete">删除</button>
          </div>
        </div>
      </article>
    `).join("");
    renderOverview();
  }

  function formatShortDate(iso) {
    if (!iso) return "--";
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async function loadTodos() {
    state.todos = await api("/api/todos");
    renderTodos();
  }

  function renderDaily() {
    const daily = state.daily;
    if (!daily) {
      renderOverview();
      return;
    }

    els.dailyDate.textContent = daily.date;
    els.dailyQuestion.textContent = daily.question.text;
    els.dailyStatus.innerHTML = ["A", "B"].map((person) => `
      <span class="tag">${escapeHtml(labelForPerson(person))} ${daily.answered[person] ? "已答" : "未答"}</span>
    `).join("");

    const own = daily.answers[state.person];
    if (own && document.activeElement !== els.dailyAnswer) {
      els.dailyAnswer.value = own.answer;
    }

    els.dailyAnswers.innerHTML = ["A", "B"].map((person) => {
      const answer = daily.answers[person];
      const isMine = person === state.person;
      if (answer) {
        return `
          <article class="answer-card">
            <strong>${escapeHtml(labelForPerson(person))}${isMine ? " · 我" : ""}</strong>
            <p>${escapeHtml(answer.answer)}</p>
            <small class="muted">${formatShortDate(answer.updatedAt)}</small>
          </article>
        `;
      }
      const lockedText = daily.answered[person] && !daily.unlocked
        ? "已提交，等你提交后解锁"
        : "还没有提交";
      return `
        <article class="answer-card locked">
          <strong>${escapeHtml(labelForPerson(person))}${isMine ? " · 我" : ""}</strong>
          <p>${lockedText}</p>
        </article>
      `;
    }).join("");
    renderOverview();
  }

  function renderDailyHistory() {
    if (!state.dailyHistory.length) {
      els.dailyHistory.innerHTML = `<p class="muted">暂无历史。</p>`;
      return;
    }
    els.dailyHistory.innerHTML = state.dailyHistory.map((item) => {
      const canMakeUpForItem = Boolean(item.canMakeUp);
      return `
        <article class="history-card" data-date="${escapeHtml(item.date)}">
          <strong>${escapeHtml(item.date)} · ${escapeHtml(item.question.text)}</strong>
          <div class="answers-grid">
            ${["A", "B"].map((person) => {
              const answer = item.answers[person];
              const answered = Boolean(item.answered?.[person] || answer);
              const canMakeUp = person === state.person && canMakeUpForItem;
              return `
                <div class="answer-card ${answer ? "" : "locked"}">
                  <strong>${escapeHtml(labelForPerson(person))}${person === state.person ? " · 我" : ""}</strong>
                  <p>${answer ? escapeHtml(answer.answer) : answered ? "已提交，等待双方解锁" : "还没有回答"}</p>
                  ${canMakeUp ? `<button class="ghost make-up-toggle" type="button" data-action="make-up" data-date="${escapeHtml(item.date)}">补答</button>` : ""}
                </div>
              `;
            }).join("")}
          </div>
          ${canMakeUpForItem ? `
            <form class="make-up-form" data-date="${escapeHtml(item.date)}" hidden>
              <textarea rows="3" maxlength="1000" required placeholder="补上这一天的答案"></textarea>
              <button class="primary" type="submit">提交补答</button>
            </form>
          ` : ""}
        </article>
      `;
    }).join("");
  }

  function renderQuestions() {
    if (!state.questions.length) {
      els.questionList.innerHTML = `<p class="muted">可用问题已经空了，生成五题或者自己加几句。</p>`;
      return;
    }
    els.questionList.innerHTML = state.questions.map((question) => `
      <article class="question-row" data-id="${question.id}">
        <p>${escapeHtml(question.text)}</p>
        <div class="question-actions">
          <button class="ghost" type="button" data-action="edit-question">编辑</button>
          <button class="ghost danger" type="button" data-action="delete-question">删除</button>
        </div>
      </article>
    `).join("");
  }

  function stampBadgeLabel(value) {
    if (value === "gold") return "金色章";
    if (value === "diamond") return "钻石章";
    return "普通章";
  }

  function stampBadgeIcon(value) {
    if (value === "gold") return "🏅";
    if (value === "diamond") return "💎";
    return "✉";
  }

  function clampStampMonth(value) {
    const month = Number(value);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  }

  function daysInStampMonth(year, month) {
    return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  }

  function stampDateKey(year, month, day) {
    return `${Number(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function stampMonthEntries(album, month) {
    return (album.entries || []).filter((entry) => Number(String(entry.date).slice(5, 7)) === Number(month));
  }

  function renderStampbookDetail(entry, dateKey) {
    if (!els.stampbookDetail) return;
    if (entry) {
      const badge = stampBadgeLabel(entry.milestone);
      els.stampbookDetail.innerHTML = `
        <div class="stamp-detail-icon ${entry.milestone ? `is-${entry.milestone}` : ""}">${stampBadgeIcon(entry.milestone)}</div>
        <div>
          <p class="eyebrow">${escapeHtml(entry.date)}</p>
          <h3>这一天已经盖章</h3>
          <p class="muted">连续 ${Number(entry.streak || 1)} 天 · ${escapeHtml(badge)}</p>
        </div>
      `;
      return;
    }
    els.stampbookDetail.innerHTML = `
      <div class="stamp-detail-icon is-empty">○</div>
      <div>
        <p class="eyebrow">${escapeHtml(dateKey || "未选择日期")}</p>
        <h3>这一天还没有邮戳</h3>
        <p class="muted">进入盖印册时会自动给今天盖章。</p>
      </div>
    `;
  }

  function renderStampbook() {
    const album = state.stampbook;
    if (!album || !els.stampbookGrid) return;
    state.stampbookYear = Number(album.year || state.stampbookYear);
    state.stampbookMonth = clampStampMonth(state.stampbookMonth || String(album.currentDate || "").slice(5, 7));

    const years = Array.isArray(album.years) && album.years.length
      ? album.years
      : [{ year: state.stampbookYear, count: 0, total: 365, progress: 0 }];
    const hasCurrentOption = years.some((item) => Number(item.year) === Number(album.year));
    const options = hasCurrentOption ? years : [{ year: album.year, count: 0, total: 365, progress: 0 }, ...years];
    if (els.stampbookYear) {
      els.stampbookYear.innerHTML = options.map((item) => `
        <option value="${Number(item.year)}">${Number(item.year)} 年</option>
      `).join("");
      els.stampbookYear.value = String(album.year);
    }
    if (els.stampbookMonth) {
      els.stampbookMonth.innerHTML = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return `<option value="${month}">${month} 月</option>`;
      }).join("");
      els.stampbookMonth.value = String(state.stampbookMonth);
    }

    const todayEntry = (album.entries || []).find((entry) => entry.date === album.currentDate);
    const currentYearOpen = Number(album.year) === Number(album.currentYear);
    const status = todayEntry
      ? `今天已盖章：${labelForPerson(todayEntry.person)}`
      : currentYearOpen ? "今天还没有邮戳" : `${album.year} 年收藏册`;
    const monthTotal = daysInStampMonth(album.year, state.stampbookMonth);
    const monthEntries = stampMonthEntries(album, state.stampbookMonth);
    const monthPercent = monthTotal ? Math.round((monthEntries.length / monthTotal) * 1000) / 10 : 0;
    setText(els.stampbookStatus, status);
    setText(els.stampbookStreak, `${Number(album.currentStreak || 0)} 天`);
    setText(els.stampbookProgressText, `${monthEntries.length} / ${monthTotal}`);
    setText(els.stampbookBadge, stampBadgeLabel(album.currentBadge));
    setText(els.stampbookGridTitle, `${album.year} 年 ${state.stampbookMonth} 月`);
    setText(els.stampbookGridMeta, `本月 ${monthEntries.length} / ${monthTotal} · 全年 ${Number(album.yearProgress?.done || 0)} 枚`);
    if (els.stampbookProgressFill) {
      els.stampbookProgressFill.style.width = `${Math.max(0, Math.min(100, monthPercent))}%`;
    }

    const entriesByDate = new Map((album.entries || []).map((entry) => [entry.date, entry]));
    const currentMonthKey = `${album.year}-${String(state.stampbookMonth).padStart(2, "0")}`;
    const hasSelectedInMonth = state.selectedStampDate?.startsWith(currentMonthKey);
    const latestMonthEntry = monthEntries[monthEntries.length - 1];
    if (!hasSelectedInMonth) {
      state.selectedStampDate = album.currentDate?.startsWith(currentMonthKey)
        ? album.currentDate
        : latestMonthEntry?.date || `${currentMonthKey}-01`;
    }

    const leading = new Date(Date.UTC(Number(album.year), state.stampbookMonth - 1, 1)).getUTCDay();
    const cells = [];
    for (let blank = 0; blank < leading; blank += 1) {
      cells.push(`<span class="stamp-day is-empty" aria-hidden="true"></span>`);
    }
    for (let day = 1; day <= monthTotal; day += 1) {
      const dateKey = stampDateKey(album.year, state.stampbookMonth, day);
      const entry = entriesByDate.get(dateKey);
      const classes = ["stamp-day"];
      if (entry) classes.push("is-stamped");
      if (entry?.milestone === "diamond") classes.push("is-diamond");
      if (entry?.milestone === "gold") classes.push("is-gold");
      if (dateKey === album.currentDate) classes.push("is-today");
      if (dateKey === state.selectedStampDate) classes.push("is-selected");
      const mark = entry ? stampBadgeIcon(entry.milestone) : "";
      const title = entry
        ? `${entry.date} · 已盖章 · 连续 ${entry.streak} 天`
        : dateKey;
      cells.push(`
        <button class="${classes.join(" ")}" type="button" data-date="${dateKey}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
          <span>${day}</span>
          ${mark ? `<strong>${mark}</strong>` : ""}
        </button>
      `);
    }
    els.stampbookGrid.innerHTML = cells.join("");
    renderStampbookDetail(entriesByDate.get(state.selectedStampDate), state.selectedStampDate);
  }

  async function loadStampbook(year = state.stampbookYear) {
    try {
      const album = await api(`/api/stamps?year=${encodeURIComponent(year)}`);
      state.stampbook = album;
      renderStampbook();
    } catch (error) {
      setText(els.stampbookStatus, error.message || "盖印册暂时打不开。");
      console.warn(error);
    }
  }

  async function autoStampToday() {
    if (state.stampAutoChecked) {
      await loadStampbook(state.stampbookYear);
      return;
    }
    state.stampAutoChecked = true;
    setText(els.stampbookStatus, "正在盖今天的邮戳。");
    try {
      const album = await api("/api/stamps/checkin", { method: "POST" });
      state.stampbook = album;
      renderStampbook();
    } catch (error) {
      setText(els.stampbookStatus, error.message || "今天的邮戳没有盖上。");
      console.warn(error);
    }
  }

  function pickGeneratedQuestions() {
    const used = new Set(state.questions.map((question) => question.text));
    const flat = questionSeedGroups.flat().filter((question) => !used.has(question));
    const source = flat.length >= 5 ? flat : questionSeedGroups.flat();
    const picked = [];
    const offset = Math.floor(Math.random() * Math.max(1, source.length));
    for (let index = 0; index < source.length && picked.length < 5; index += 1) {
      const question = source[(offset + index) % source.length];
      if (!picked.includes(question)) picked.push(question);
    }
    return picked;
  }

  async function loadDaily() {
    try {
      state.daily = await api("/api/daily");
    } catch (error) {
      state.daily = null;
      setText(els.dailyQuestion, error.message || "问题库已经用完啦");
      setText(els.dashboardDailyQuestion, error.message || "问题库已经用完啦");
      setText(els.dashboardDailyMeta, "去「问题库」加一个新问题就能继续。");
    }
    renderDaily();
  }

  async function loadDailyHistory() {
    try {
      state.dailyHistory = await api("/api/daily/history");
    } catch (error) {
      state.dailyHistory = [];
      console.warn(error);
    }
    renderDailyHistory();
  }

  async function loadQuestions() {
    state.questions = await api("/api/questions");
    renderQuestions();
  }

  function normalizePresence(presence = {}) {
    return {
      A: Number(presence.A || 0),
      B: Number(presence.B || 0),
      drawing: {
        A: Boolean(presence.drawing?.A),
        B: Boolean(presence.drawing?.B)
      }
    };
  }

  function renderDrawingPresence(presence = state.presence) {
    if (!els.drawingPresence || !els.drawingPresenceText) return;
    const current = normalizePresence(presence);
    const activePeople = ["A", "B"].filter((person) => current.drawing[person]).map(coupleName);
    const onlineText = `当前在线：${coupleName("A")} ${current.A} · ${coupleName("B")} ${current.B}`;
    const drawingText = activePeople.length ? `正在画：${activePeople.join("、")}` : "现在没人落笔";
    els.drawingPresenceText.textContent = `${onlineText} · ${drawingText}`;
    els.drawingPresence.classList.toggle("is-active", activePeople.length > 0);
  }

  function renderMoviePresence(online = null) {
    const current = normalizePresence(online || renderMoviePresence.lastOnline || state.presence);
    state.presence = current;
    renderMoviePresence.lastOnline = current;
    els.moviePresence.textContent = `${labelForPerson("A")} ${current.A || 0} · ${labelForPerson("B")} ${current.B || 0}`;
    renderDrawingPresence(current);
  }

  function renderMovieStatus(text) {
    setText(els.movieStatus, text);
  }

  function sameVideoSource(url) {
    if (!url && !els.movieVideo.getAttribute("src")) return true;
    if (!url) return false;
    return els.movieVideo.currentSrc === new URL(url, window.location.origin).href ||
      els.movieVideo.getAttribute("src") === url;
  }

  function applyMoviePositionAndPlayback(movieState) {
    const video = els.movieVideo;
    const targetPosition = Math.max(0, Number(movieState.position || 0));
    if (Number.isFinite(targetPosition) && Math.abs((video.currentTime || 0) - targetPosition) > 1.25) {
      video.currentTime = targetPosition;
    }
    video.playbackRate = Number(movieState.playbackRate || 1);
    els.movieRate.value = String(video.playbackRate);

    const done = () => {
      window.setTimeout(() => {
        applyingMovieState = false;
      }, 250);
    };

    if (movieState.paused) {
      video.pause();
      done();
    } else {
      video.play().catch(() => {}).finally(done);
    }
  }

  function applyMovieState(movieState) {
    if (!movieState) return;
    state.movieState = movieState;
    els.movieTitle.textContent = movieState.videoName || "还没有选择影片";
    renderMovieStatus(movieState.videoUrl
      ? `${movieState.paused ? "已暂停" : "播放中"} · ${Math.floor(Number(movieState.position || 0))} 秒 · ${Number(movieState.playbackRate || 1)}x`
      : "等待选择影片");

    if (movieState.sourceId && movieState.sourceId === socket?.id) {
      return;
    }

    applyingMovieState = true;
    const video = els.movieVideo;

    if (!movieState.videoUrl) {
      video.removeAttribute("src");
      video.load();
      applyingMovieState = false;
      return;
    }

    if (!sameVideoSource(movieState.videoUrl)) {
      video.src = movieState.videoUrl;
      video.load();
    }

    if (video.readyState >= 1) {
      applyMoviePositionAndPlayback(movieState);
    } else {
      pendingMovieState = movieState;
    }
  }

  function renderMovieMessages() {
    els.movieChat.innerHTML = state.movieMessages.map((message) => `
      <div class="chat-message ${message.author === state.person ? "mine" : ""}">
        <small>${escapeHtml(labelForPerson(message.author))} · ${formatShortDate(message.createdAt)}</small>
        ${escapeHtml(message.message)}
      </div>
    `).join("");
    els.movieChat.scrollTop = els.movieChat.scrollHeight;
  }

  function emitMovieControl() {
    if (applyingMovieState || !els.movieVideo.getAttribute("src")) return;
    const now = Date.now();
    if (now - lastMovieEmitAt < 350) return;
    lastMovieEmitAt = now;
    socketEmit("movie:control", {
      position: els.movieVideo.currentTime || 0,
      paused: els.movieVideo.paused,
      playbackRate: els.movieVideo.playbackRate || 1
    });
  }

  function drawStroke(stroke) {
    if (!stroke?.points?.length) return;
    const width = els.canvas.clientWidth;
    const height = els.canvas.clientHeight;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color || "#e85d75";
    ctx.lineWidth = Number(stroke.size || 5);
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function clearCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderCanvas() {
    clearCanvas();
    state.strokes.forEach((entry) => drawStroke(entry.stroke));
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (els.canvas.width !== width || els.canvas.height !== height) {
      els.canvas.width = width;
      els.canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderCanvas();
  }

  function pointFromEvent(event) {
    const rect = els.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    };
  }

  function canDrawGuess() {
    return Boolean(state.drawGuess?.started && state.drawGuess.drawer === state.person && !state.drawGuess.winner);
  }

  function drawGuessStroke(stroke) {
    if (!stroke?.points?.length) return;
    const width = els.drawGuessCanvas.clientWidth;
    const height = els.drawGuessCanvas.clientHeight;
    gameCtx.save();
    gameCtx.lineCap = "round";
    gameCtx.lineJoin = "round";
    gameCtx.strokeStyle = stroke.color || "#526f93";
    gameCtx.lineWidth = Number(stroke.size || 6);
    gameCtx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) gameCtx.moveTo(x, y);
      else gameCtx.lineTo(x, y);
    });
    gameCtx.stroke();
    gameCtx.restore();
  }

  function clearDrawGuessCanvas() {
    gameCtx.save();
    gameCtx.setTransform(1, 0, 0, 1, 0, 0);
    gameCtx.clearRect(0, 0, els.drawGuessCanvas.width, els.drawGuessCanvas.height);
    gameCtx.restore();
    gameCtx.setTransform(gameDpr, 0, 0, gameDpr, 0, 0);
  }

  function renderDrawGuessCanvas() {
    clearDrawGuessCanvas();
    state.drawGuessStrokes.forEach((entry) => drawGuessStroke(entry.stroke));
  }

  function resizeDrawGuessCanvas() {
    const rect = els.drawGuessCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    gameDpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * gameDpr);
    const height = Math.round(rect.height * gameDpr);
    if (els.drawGuessCanvas.width !== width || els.drawGuessCanvas.height !== height) {
      els.drawGuessCanvas.width = width;
      els.drawGuessCanvas.height = height;
    }
    gameCtx.setTransform(gameDpr, 0, 0, gameDpr, 0, 0);
    renderDrawGuessCanvas();
  }

  function drawGuessPointFromEvent(event) {
    const rect = els.drawGuessCanvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    };
  }

  function renderDrawGuessGuesses() {
    const guesses = state.drawGuess?.guesses || [];
    if (!guesses.length) {
      els.drawGuessGuesses.innerHTML = `<p class="muted">还没有猜词记录。</p>`;
      return;
    }
    els.drawGuessGuesses.innerHTML = guesses.map((guess) => `
      <div class="guess-message ${guess.person === state.person ? "mine" : ""} ${guess.correct ? "is-correct" : ""}">
        <small>${escapeHtml(coupleName(guess.person))} · ${formatShortDate(guess.createdAt)}</small>
        ${guess.correct ? "猜中了：" : ""}${escapeHtml(guess.text)}
      </div>
    `).join("");
    els.drawGuessGuesses.scrollTop = els.drawGuessGuesses.scrollHeight;
  }

  function renderDrawGuess() {
    const game = state.drawGuess;
    const started = Boolean(game?.started);
    const drawer = game?.drawer || state.person;
    const isDrawer = started && drawer === state.person;
    const winner = game?.winner || "";
    const canDraw = canDrawGuess();

    setText(els.drawGuessTitle, started ? `第 ${game.roundNumber || 1} 局` : "等待开局");
    setText(els.drawGuessStatus, !started
      ? "准备好就开一局。"
      : winner
        ? `${coupleName(winner)} 猜中了「${game.word || game.maskedWord || ""}」`
        : isDrawer
          ? "轮到你画，对方正在猜。"
          : `轮到 ${coupleName(drawer)} 画，你来猜。`);

    const wordText = !started
      ? "开一局后这里会出现词语"
      : isDrawer || winner
        ? `词语：${game.word || game.maskedWord}`
        : `提示：${game.maskedWord} · ${game.wordLength || 0} 个字`;
    setText(els.drawGuessWord, wordText);
    els.drawGuessWordBox.classList.toggle("is-revealed", Boolean(started && (isDrawer || winner)));
    els.drawGuessCanvas.classList.toggle("is-readonly", !canDraw);

    [els.drawGuessUndo, els.drawGuessClear].forEach((button) => {
      button.disabled = !canDraw;
    });
    els.drawGuessGuess.disabled = !started || isDrawer || Boolean(winner);
    els.drawGuessGuess.placeholder = !started
      ? "开局后再猜"
      : isDrawer
        ? "这一轮你负责画"
        : winner
          ? "已经猜中啦"
          : "输入你的答案";

    renderDrawGuessGuesses();
    requestAnimationFrame(resizeDrawGuessCanvas);
  }

  function renderDrawings() {
    if (!state.drawings.length) {
      els.drawingGallery.innerHTML = `<p class="muted">暂无保存作品。</p>`;
      renderOverview();
      return;
    }
    els.drawingGallery.innerHTML = state.drawings.map((drawingItem) => `
      <a class="drawing-card" href="${escapeHtml(drawingItem.filePath)}" target="_blank" rel="noreferrer">
        <img src="${escapeHtml(drawingItem.filePath)}" alt="">
        <strong>${escapeHtml(drawingItem.title || "共同画板")}</strong>
        <small class="muted">${formatShortDate(drawingItem.createdAt)}</small>
      </a>
    `).join("");
    renderOverview();
  }

  async function loadDrawings() {
    state.drawings = await api("/api/drawings");
    renderDrawings();
  }

  function exportCanvasPng() {
    const output = document.createElement("canvas");
    output.width = els.canvas.width;
    output.height = els.canvas.height;
    const outputCtx = output.getContext("2d");
    outputCtx.fillStyle = "#ffffff";
    outputCtx.fillRect(0, 0, output.width, output.height);
    outputCtx.drawImage(els.canvas, 0, 0);
    return output.toDataURL("image/png");
  }

  function showGateChoice(person) {
    state.person = asPerson(person);
    setText(els.gateError, "");
    setText(els.gatePicked, coupleName(state.person));
    $$(".gate-person").forEach((button) => {
      button.classList.toggle("is-picked", button.dataset.gatePerson === state.person);
      button.classList.toggle("is-faded", button.dataset.gatePerson !== state.person);
    });
    els.gateCard?.classList.add("is-choosing");
    window.setTimeout(() => {
      if (els.gateOrbits) els.gateOrbits.hidden = true;
      if (els.gateForm) els.gateForm.hidden = false;
      els.gateCard?.classList.remove("is-choosing");
      els.gatePasscode.value = "";
      els.gatePasscode.focus();
    }, 260);
  }

  function resetGateChoice() {
    if (state.publicConfig.setup?.needsSetup) {
      if (els.setupForm) els.setupForm.hidden = false;
      if (els.gateOrbits) els.gateOrbits.hidden = true;
      if (els.gateForm) els.gateForm.hidden = true;
      setText(els.gateError, "");
      return;
    }
    if (els.gateForm) els.gateForm.hidden = true;
    if (els.gateOrbits) els.gateOrbits.hidden = false;
    setText(els.gateError, "");
    $$(".gate-person").forEach((button) => {
      button.classList.remove("is-picked", "is-faded");
    });
  }

  function asPerson(value) {
    return value === "B" ? "B" : "A";
  }

  async function unlockRoom() {
    try {
      const passcode = els.gatePasscode.value.trim();
      if (!passcode) {
        setText(els.gateError, "先输入小房间密码。");
        return;
      }
      const result = await api("/api/unlock", {
        method: "POST",
        body: {
          person: state.person,
          passcode
        }
      });
      state.person = asPerson(result.person);
      state.accessToken = result.accessToken || "";
      await startApp();
    } catch (error) {
      setText(els.gateError, error.message || "密码不对。");
      els.gateCard?.animate([
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(0)" }
      ], { duration: 220, easing: "ease-out" });
    }
  }

  async function submitSetup() {
    try {
      setText(els.setupError, "");
      const body = {
        personAName: els.setupPersonAName.value.trim(),
        personAEmoji: els.setupPersonAEmoji.value.trim(),
        personAPasscode: els.setupPersonAPasscode.value.trim(),
        cityAName: els.setupCityAName.value.trim(),
        cityATimezone: els.setupCityATimezone.value.trim(),
        cityABirthday: els.setupCityABirthday.value.trim(),
        personBName: els.setupPersonBName.value.trim(),
        personBEmoji: els.setupPersonBEmoji.value.trim(),
        personBPasscode: els.setupPersonBPasscode.value.trim(),
        cityBName: els.setupCityBName.value.trim(),
        cityBTimezone: els.setupCityBTimezone.value.trim(),
        cityBBirthday: els.setupCityBBirthday.value.trim(),
        nextMeetingAt: els.setupNextMeetingAt.value ? new Date(els.setupNextMeetingAt.value).toISOString() : "",
        nextMeetingLocation: els.setupNextMeetingLocation.value.trim(),
        nextMeetingTitle: els.setupNextMeetingTitle.value.trim()
      };
      const result = await api("/api/setup", {
        method: "POST",
        body
      });
      state.publicConfig = result.publicConfig || state.publicConfig;
      state.settings = result.settings || state.settings;
      state.person = asPerson(result.person);
      state.accessToken = result.accessToken || "";
      setupFilled = false;
      renderPublicConfig();
      await startApp();
    } catch (error) {
      setText(els.setupError, error.message || "Setup failed.");
    }
  }

  function bindEvents() {
    $$(".gate-person").forEach((button) => {
      button.addEventListener("click", () => showGateChoice(button.dataset.gatePerson));
    });

    els.gateBack?.addEventListener("click", resetGateChoice);

    els.gateForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      unlockRoom();
    });

    els.setupForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitSetup();
    });

    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => setRoute(tab.dataset.route));
    });

    $$(".chip[data-person]").forEach((button) => {
      button.addEventListener("click", async () => {
        renderIdentity();
      });
    });

    els.settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const body = {
          cityAName: $("#setting-city-a-name").value.trim(),
          cityATimezone: $("#setting-city-a-timezone").value.trim(),
          cityALatitude: $("#setting-city-a-latitude").value.trim(),
          cityALongitude: $("#setting-city-a-longitude").value.trim(),
          cityAColdPreference: $("#setting-city-a-cold-preference").value,
          cityABirthday: $("#setting-city-a-birthday").value.trim(),
          cityBName: $("#setting-city-b-name").value.trim(),
          cityBTimezone: $("#setting-city-b-timezone").value.trim(),
          cityBLatitude: $("#setting-city-b-latitude").value.trim(),
          cityBLongitude: $("#setting-city-b-longitude").value.trim(),
          cityBColdPreference: $("#setting-city-b-cold-preference").value,
          cityBBirthday: $("#setting-city-b-birthday").value.trim(),
          relationshipStartDate: $("#setting-relationship-start-date").value,
          nextMeetingAt: new Date($("#setting-next-meeting-at").value).toISOString(),
          nextMeetingLocation: $("#setting-next-meeting-location").value.trim(),
          nextMeetingTitle: $("#setting-next-meeting-title").value.trim()
        };
        state.settings = await api("/api/settings", { method: "PUT", body });
        settingsFilled = false;
        fillSettings(true);
        renderAllSettingsDriven();
        loadAnniversaries();
        loadWeather();
      } catch (error) {
        reportError(error);
      }
    });

    els.anniversarySelector?.addEventListener("click", (event) => {
      const card = event.target.closest(".anniversary-card");
      if (!card) return;
      state.selectedAnniversaryId = card.dataset.id;
      localStorage.setItem("love-room-anniversary-id", state.selectedAnniversaryId);
      renderAnniversaries();
    });

    els.anniversaryForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = els.anniversaryTitle.value.trim();
      const date = els.anniversaryDate.value;
      const icon = els.anniversaryIcon.value.trim() || "♡";
      if (!title || !date) {
        reportError(new Error("先写标题和日期。"));
        return;
      }
      try {
        state.anniversaries = await api("/api/anniversaries", {
          method: "POST",
          body: { title, date, icon }
        });
        const newestCustom = currentAnniversaryItems()
          .filter((item) => item.source === "custom")
          .sort((a, b) => Number(a.rawId || 0) - Number(b.rawId || 0))
          .pop();
        state.selectedAnniversaryId = newestCustom?.id || state.selectedAnniversaryId;
        els.anniversaryTitle.value = "";
        els.anniversaryDate.value = "";
        els.anniversaryIcon.value = "";
        anniversarySelectorSignature = "";
        renderAnniversaries();
      } catch (error) {
        reportError(error);
      }
    });

    els.anniversaryDetail?.addEventListener("click", async (event) => {
      const button = event.target.closest(".anniversary-delete");
      if (!button) return;
      if (!window.confirm("删除这个自定义纪念日？")) return;
      try {
        state.anniversaries = await api(`/api/anniversaries/${button.dataset.id}`, { method: "DELETE" });
        anniversarySelectorSignature = "";
        renderAnniversaries();
      } catch (error) {
        reportError(error);
      }
    });

    [els.outfitAPicker, els.outfitBPicker].forEach((picker) => {
      picker.addEventListener("click", async (event) => {
        const button = event.target.closest(".outfit-chip");
        if (!button) return;
        const person = picker.dataset.person;
        const current = new Set(state.outfits?.[person]?.items || []);
        const item = button.dataset.outfit;
        if (current.has(item)) current.delete(item);
        else current.add(item);
        try {
          state.outfits = await api(`/api/outfits/${person}`, {
            method: "PUT",
            body: { items: Array.from(current) }
          });
          renderCarePanels();
        } catch (error) {
          reportError(error);
        }
      });
    });

    els.todoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const id = els.todoId.value;
        const body = {
          title: els.todoTitle.value.trim(),
          note: els.todoNote.value.trim(),
          type: els.todoType.value
        };
        if (id) {
          await api(`/api/todos/${id}`, { method: "PUT", body });
        } else {
          await api("/api/todos", { method: "POST", body });
        }
        resetTodoForm();
      } catch (error) {
        reportError(error);
      }
    });

    els.todoCancel.addEventListener("click", resetTodoForm);

    els.todoList.addEventListener("click", async (event) => {
      const card = event.target.closest(".todo-card");
      if (!card) return;
      const todo = state.todos.find((item) => item.id === Number(card.dataset.id));
      if (!todo) return;
      const action = event.target.dataset.action;
      try {
        if (action === "edit") {
          els.todoId.value = todo.id;
          els.todoTitle.value = todo.title;
          els.todoNote.value = todo.note || "";
          els.todoType.value = todo.type;
          els.todoSubmit.textContent = "保存";
          els.todoCancel.hidden = false;
          els.todoTitle.focus();
        }
        if (action === "delete" && window.confirm("删除这条心愿？")) {
          await api(`/api/todos/${todo.id}`, { method: "DELETE" });
        }
      } catch (error) {
        reportError(error);
      }
    });

    els.todoList.addEventListener("change", async (event) => {
      if (event.target.type !== "checkbox") return;
      const card = event.target.closest(".todo-card");
      const todo = state.todos.find((item) => item.id === Number(card.dataset.id));
      if (!todo) return;
      try {
        await api(`/api/todos/${todo.id}`, {
          method: "PUT",
          body: { completed: event.target.checked }
        });
      } catch (error) {
        reportError(error);
      }
    });

    els.dailyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        state.daily = await api("/api/daily/answer", {
          method: "POST",
          body: {
            date: state.daily?.date,
            answer: els.dailyAnswer.value.trim()
          }
        });
        renderDaily();
        await loadDailyHistory();
      } catch (error) {
        reportError(error);
      }
    });

    els.dailyHistory.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action='make-up']");
      if (!button) return;
      const card = button.closest(".history-card");
      const form = card?.querySelector(".make-up-form");
      if (!form) return;
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector("textarea")?.focus();
    });

    els.dailyHistory.addEventListener("submit", async (event) => {
      const form = event.target.closest(".make-up-form");
      if (!form) return;
      event.preventDefault();
      const answer = form.querySelector("textarea")?.value.trim();
      if (!answer) return;
      try {
        const date = form.dataset.date;
        const payload = await api("/api/daily/answer", {
          method: "POST",
          body: {
            date,
            answer
          }
        });
        if (date === state.daily?.date) state.daily = payload;
        await Promise.all([loadDaily(), loadDailyHistory()]);
      } catch (error) {
        reportError(error);
      }
    });

    els.questionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const questions = els.questionText.value
          .split(/\r?\n/)
          .map((text) => text.trim())
          .filter(Boolean);
        state.questions = await api("/api/questions", {
          method: "POST",
          body: { questions }
        });
        els.questionText.value = "";
        renderQuestions();
      } catch (error) {
        reportError(error);
      }
    });

    els.questionGenerate.addEventListener("click", () => {
      els.questionText.value = pickGeneratedQuestions().join("\n");
      els.questionText.focus();
    });

    els.questionList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      const row = event.target.closest(".question-row");
      if (!button || !row) return;
      const id = Number(row.dataset.id);
      const question = state.questions.find((item) => item.id === id);
      if (!question) return;
      try {
        if (button.dataset.action === "edit-question") {
          const next = window.prompt("修改这个问题", question.text);
          if (next === null) return;
          state.questions = await api(`/api/questions/${id}`, {
            method: "PUT",
            body: { text: next.trim() }
          });
        } else if (button.dataset.action === "delete-question") {
          if (!window.confirm("删掉这个问题吗？")) return;
          state.questions = await api(`/api/questions/${id}`, { method: "DELETE" });
        }
        renderQuestions();
      } catch (error) {
        reportError(error);
      }
    });

    els.movieVideo.addEventListener("loadedmetadata", () => {
      if (pendingMovieState) {
        const next = pendingMovieState;
        pendingMovieState = null;
        applyMoviePositionAndPlayback(next);
      }
    });
    ["play", "pause", "seeked", "ratechange"].forEach((eventName) => {
      els.movieVideo.addEventListener(eventName, emitMovieControl);
    });

    els.movieRate.addEventListener("change", () => {
      els.movieVideo.playbackRate = Number(els.movieRate.value);
      emitMovieControl();
    });

    els.movieSync.addEventListener("click", () => {
      socketEmit("movie:request-state");
      renderMovieStatus("正在同步进度...");
    });

    els.movieUrlForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/movie/video", {
          method: "POST",
          body: { videoUrl: els.movieUrl.value.trim() }
        });
        els.movieUrl.value = "";
      } catch (error) {
        reportError(error);
      }
    });

    els.movieUploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!els.movieFile.files[0]) return;
      try {
        setText(els.movieUploadStatus, "上传中...");
        const formData = new FormData();
        formData.append("video", els.movieFile.files[0]);
        await api("/api/movie/upload", { method: "POST", formData });
        els.movieFile.value = "";
        setText(els.movieUploadStatus, "上传完成");
      } catch (error) {
        setText(els.movieUploadStatus, "");
        reportError(error);
      }
    });

    els.movieChatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = els.movieMessage.value.trim();
      if (!message) return;
      socketEmit("movie:chat", {
        person: state.person,
        message
      });
      els.movieMessage.value = "";
    });

    els.stampbookOpen.addEventListener("click", async () => {
      setRoute("games");
      els.stampbookRoom?.classList.add("is-open");
      await autoStampToday();
      requestAnimationFrame(() => {
        els.stampbookRoom?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    els.stampbookYear.addEventListener("change", async () => {
      const nextYear = Number(els.stampbookYear.value || state.stampbookYear);
      state.stampbookYear = nextYear;
      await loadStampbook(nextYear);
    });

    els.stampbookMonth.addEventListener("change", () => {
      state.stampbookMonth = clampStampMonth(els.stampbookMonth.value);
      state.selectedStampDate = "";
      renderStampbook();
    });

    els.stampbookGrid.addEventListener("click", (event) => {
      const cell = event.target.closest(".stamp-day");
      if (!cell || !cell.dataset.date) return;
      state.selectedStampDate = cell.dataset.date;
      renderStampbook();
    });

    els.drawGuessOpen.addEventListener("click", () => {
      setRoute("games");
      socketEmit("drawguess:request-state");
      requestAnimationFrame(() => {
        resizeDrawGuessCanvas();
        els.drawGuessRoom.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    els.drawGuessNewRound.addEventListener("click", () => {
      socketEmit("drawguess:new-round", { drawer: state.person });
    });

    els.drawGuessPassTurn.addEventListener("click", () => {
      socketEmit("drawguess:pass-turn");
    });

    els.drawGuessGuessForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = els.drawGuessGuess.value.trim();
      if (!text) return;
      socketEmit("drawguess:guess", { text });
      els.drawGuessGuess.value = "";
    });

    els.drawGuessCanvas.addEventListener("pointerdown", (event) => {
      if (!canDrawGuess()) return;
      event.preventDefault();
      els.drawGuessCanvas.setPointerCapture(event.pointerId);
      gameDrawing = true;
      currentGameStroke = {
        color: els.drawGuessColor.value,
        size: Number(els.drawGuessSize.value),
        points: [drawGuessPointFromEvent(event)]
      };
    });

    els.drawGuessCanvas.addEventListener("pointermove", (event) => {
      if (!gameDrawing || !currentGameStroke || !canDrawGuess()) return;
      event.preventDefault();
      const point = drawGuessPointFromEvent(event);
      const previous = currentGameStroke.points[currentGameStroke.points.length - 1];
      currentGameStroke.points.push(point);
      const preview = {
        ...currentGameStroke,
        points: [previous, point]
      };
      drawGuessStroke(preview);
      socketEmit("drawguess:preview", preview);
    });

    const finishGameStroke = (event) => {
      if (!gameDrawing || !currentGameStroke) return;
      event.preventDefault();
      gameDrawing = false;
      if (currentGameStroke.points.length > 1) {
        socketEmit("drawguess:stroke", currentGameStroke);
      }
      currentGameStroke = null;
    };
    els.drawGuessCanvas.addEventListener("pointerup", finishGameStroke);
    els.drawGuessCanvas.addEventListener("pointercancel", finishGameStroke);
    els.drawGuessCanvas.addEventListener("pointerleave", (event) => {
      if (gameDrawing) finishGameStroke(event);
    });

    els.drawGuessUndo.addEventListener("click", () => socketEmit("drawguess:undo"));
    els.drawGuessClear.addEventListener("click", () => {
      if (window.confirm("清空这一局画布？")) socketEmit("drawguess:clear");
    });

    els.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      els.canvas.setPointerCapture(event.pointerId);
      drawing = true;
      sendDrawingActivity(true);
      currentStroke = {
        tool: els.eraserMode.checked ? "eraser" : "pen",
        color: els.brushColor.value,
        size: Number(els.brushSize.value),
        points: [pointFromEvent(event)]
      };
    });

    els.canvas.addEventListener("pointermove", (event) => {
      if (!drawing || !currentStroke) return;
      event.preventDefault();
      sendDrawingActivity(true);
      const point = pointFromEvent(event);
      const previous = currentStroke.points[currentStroke.points.length - 1];
      currentStroke.points.push(point);
      const preview = {
        ...currentStroke,
        points: [previous, point]
      };
      drawStroke(preview);
      socketEmit("drawing:preview", preview);
    });

    const finishStroke = (event) => {
      if (!drawing || !currentStroke) return;
      event.preventDefault();
      drawing = false;
      if (currentStroke.points.length > 1) {
        socketEmit("drawing:stroke", currentStroke);
      }
      sendDrawingActivity(false);
      currentStroke = null;
    };
    els.canvas.addEventListener("pointerup", finishStroke);
    els.canvas.addEventListener("pointercancel", finishStroke);
    els.canvas.addEventListener("pointerleave", (event) => {
      if (drawing) finishStroke(event);
    });

    els.undoDrawing.addEventListener("click", () => socketEmit("drawing:undo"));
    els.clearDrawing.addEventListener("click", () => {
      if (window.confirm("清空当前画板？")) socketEmit("drawing:clear");
    });

    els.saveDrawingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/drawings", {
          method: "POST",
          body: {
            title: els.drawingTitle.value.trim() || "共同画板",
            dataUrl: exportCanvasPng()
          }
        });
        els.drawingTitle.value = "";
      } catch (error) {
        reportError(error);
      }
    });

    window.addEventListener("resize", () => {
      resizeCanvas();
      resizeDrawGuessCanvas();
    });
    window.addEventListener("hashchange", () => setRoute(window.location.hash.slice(1)));
  }

  function connectSocket() {
    if (socket) return;
    socket = io({
      auth: {
        roomPath,
        person: state.person,
        accessToken: state.accessToken
      }
    });
    bindSocket();
  }

  function bindSocket() {
    if (!socket || socketBound) return;
    socketBound = true;
    socket.on("connect", () => {
      drawingActivityActive = false;
      socketEmit("person:update", state.person);
      socketEmit("movie:request-state");
      socketEmit("drawguess:request-state");
    });

    socket.on("connect_error", (error) => {
      console.warn(error.message);
    });

    socket.on("settings:updated", (settings) => {
      state.settings = settings;
      renderAllSettingsDriven();
      loadWeather();
    });

    socket.on("anniversaries:updated", (payload) => {
      state.anniversaries = payload;
      anniversarySelectorSignature = "";
      renderAnniversaries();
    });

    socket.on("todos:updated", (todos) => {
      state.todos = todos;
      renderTodos();
    });

    socket.on("daily:updated", async (payload) => {
      state.daily = payload;
      renderDaily();
      await loadDailyHistory();
    });

    socket.on("presence:updated", (online) => {
      renderMoviePresence(online);
    });

    socket.on("movie:state", applyMovieState);

    socket.on("movie:messages", (messages) => {
      state.movieMessages = messages;
      renderMovieMessages();
    });

    socket.on("movie:message", (message) => {
      state.movieMessages.push(message);
      renderMovieMessages();
    });

    socket.on("drawing:history", (strokes) => {
      state.strokes = strokes;
      renderCanvas();
    });

    socket.on("drawing:preview", (payload) => {
      if (payload.sourceId === socket?.id) return;
      drawStroke(payload.stroke);
    });

    socket.on("drawing:stroke", (payload) => {
      state.strokes.push({
        id: payload.id,
        stroke: payload.stroke
      });
      if (payload.sourceId !== socket?.id) {
        drawStroke(payload.stroke);
      }
    });

    socket.on("drawings:updated", (drawings) => {
      state.drawings = drawings;
      renderDrawings();
    });

    socket.on("outfits:updated", (outfits) => {
      state.outfits = outfits;
      renderCarePanels();
    });

    socket.on("stamps:updated", (album) => {
      if (Number(album.year) !== Number(state.stampbookYear) && els.stampbookRoom?.classList.contains("is-open")) {
        state.stampbook = album;
        loadStampbook(state.stampbookYear);
        return;
      }
      state.stampbook = album;
      state.stampbookYear = Number(album.year || state.stampbookYear);
      renderStampbook();
    });

    socket.on("drawguess:state", (payload) => {
      state.drawGuess = payload;
      state.drawGuessStrokes = payload.strokes || [];
      renderDrawGuess();
      renderDrawGuessCanvas();
    });

    socket.on("drawguess:preview", (payload) => {
      if (payload.sourceId === socket?.id) return;
      if (payload.roundId && payload.roundId !== state.drawGuess?.roundId) return;
      drawGuessStroke(payload.stroke);
    });

    socket.on("drawguess:stroke", (payload) => {
      if (payload.roundId && payload.roundId !== state.drawGuess?.roundId) return;
      state.drawGuessStrokes.push({
        id: payload.id,
        stroke: payload.stroke
      });
      if (payload.sourceId !== socket?.id) {
        drawGuessStroke(payload.stroke);
      }
    });
  }

  async function startApp() {
    if (appStarted) return;
    appStarted = true;
    document.body.classList.remove("locked");
    connectSocket();
    renderIdentity();
    setRoute(window.location.hash.slice(1) || "dashboard");
    resizeCanvas();
    resizeDrawGuessCanvas();
    try {
      await Promise.all([
        loadSettings(),
        loadTodos(),
        loadDaily(),
        loadDailyHistory(),
        loadQuestions(),
        loadDrawings(),
        loadAnniversaries(),
        loadOutfits()
      ]);
      await loadWeather();
    } catch (error) {
      reportError(error);
    }

    window.setInterval(() => {
      renderClocks();
      renderMeeting();
    }, 1000);
    window.setInterval(loadWeather, 10 * 60 * 1000);
  }

  async function init() {
    await loadPublicConfig();
    bindEvents();
    document.body.classList.add("locked");
    resetGateChoice();
  }

  init();
})();
