/**
 * The Daily Ledger — a client-side to-do list.
 *
 * Architecture in one paragraph: a single `tasks` array is the
 * source of truth (the "state"). Every user action — add, toggle,
 * edit, delete, filter — mutates that array (or a `currentFilter`
 * variable) and then calls `render()`. `render()` always rebuilds
 * the visible list from scratch based on current state, so the DOM
 * never drifts out of sync with the data. This "state in, DOM out"
 * one-way flow is the same mental model used by frameworks like
 * React, just done by hand with the raw DOM APIs.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------

  /**
   * @typedef {Object} Task
   * @property {string} id        - unique id, used for DOM matching
   * @property {string} text      - the task description
   * @property {boolean} completed
   * @property {number} createdAt - epoch ms, used for stable ordering
   */

  /** @type {Task[]} */
  let tasks = [];

  /** @type {"all" | "active" | "completed"} */
  let currentFilter = "all";

  const STORAGE_KEY = "daily-ledger-tasks-v1";

  // ---------------------------------------------------------
  // PERSISTENCE — localStorage read/write
  //
  // localStorage only stores strings, so state is serialized to
  // JSON on every save and parsed back to objects on load. Both
  // operations are wrapped in try/catch: localStorage can throw
  // (private browsing mode, storage quota exceeded, the user
  // disabling site storage) and a to-do app should degrade to
  // "works for this session only" rather than crash outright.
  // ---------------------------------------------------------

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Could not save tasks to localStorage:", error);
    }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // Defensive check: if storage was tampered with or corrupted,
      // fall back to an empty list rather than letting a malformed
      // value crash every render downstream.
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          typeof item.completed === "boolean"
      );
    } catch (error) {
      console.error("Could not load tasks from localStorage:", error);
      return [];
    }
  }

  // ---------------------------------------------------------
  // ID GENERATION
  // crypto.randomUUID is available in all current browsers, but
  // a tiny fallback keeps this working even in an environment
  // where it's missing (e.g. a very old or locked-down browser).
  // ---------------------------------------------------------

  function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  // ---------------------------------------------------------
  // CRUD OPERATIONS
  // Each function does exactly one state mutation, then persists
  // and re-renders. Keeping save+render at the call site (rather
  // than baking it into each function) is a deliberate choice so
  // each CRUD function is independently testable and readable.
  // ---------------------------------------------------------

  /** CREATE */
  function addTask(text) {
    const trimmed = text.trim();
    if (trimmed === "") return;

    tasks.push({
      id: generateId(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    });
  }

  /** UPDATE (toggle completion) */
  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) task.completed = !task.completed;
  }

  /** UPDATE (edit text) */
  function editTask(id, newText) {
    const trimmed = newText.trim();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    // Editing to an empty string deletes the task instead of saving
    // a blank line item — a blank task isn't a meaningful state, and
    // silently keeping the old text would be a surprising "save" that
    // didn't actually save what the person typed.
    if (trimmed === "") {
      deleteTask(id);
      return;
    }
    task.text = trimmed;
  }

  /** DELETE */
  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
  }

  /** DELETE (bulk) */
  function clearCompleted() {
    tasks = tasks.filter((t) => !t.completed);
  }

  // ---------------------------------------------------------
  // FILTERING (READ, with a view transform)
  // This never mutates `tasks` — it derives a filtered view for
  // rendering, leaving the underlying state untouched no matter
  // which tab is active. Switching filters is therefore always
  // non-destructive.
  // ---------------------------------------------------------

  function getVisibleTasks() {
    if (currentFilter === "active") return tasks.filter((t) => !t.completed);
    if (currentFilter === "completed") return tasks.filter((t) => t.completed);
    return tasks;
  }

  // ---------------------------------------------------------
  // DOM REFERENCES
  // Queried once at startup and reused, rather than re-querying
  // the document on every render.
  // ---------------------------------------------------------

  const form = document.getElementById("new-task-form");
  const input = document.getElementById("new-task-input");
  const list = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const filterBar = document.querySelector(".filter-bar");
  const remainingSummary = document.getElementById("remaining-summary");
  const clearCompletedBtn = document.getElementById("clear-completed");
  const template = document.getElementById("task-template");

  const countEls = {
    all: document.getElementById("count-all"),
    active: document.getElementById("count-active"),
    completed: document.getElementById("count-completed"),
  };

  const tabEls = {
    all: document.getElementById("tab-all"),
    active: document.getElementById("tab-active"),
    completed: document.getElementById("tab-completed"),
  };

  // ---------------------------------------------------------
  // RENDERING
  // render() is the only function that touches the live DOM list.
  // It clears the list and rebuilds it from `getVisibleTasks()`
  // every time, using the <template> element so each row is built
  // via cloneNode rather than innerHTML string-building — that
  // avoids any risk of task text being interpreted as HTML, and
  // keeps element creation type-safe (we're working with real
  // nodes, not strings, the whole way through).
  // ---------------------------------------------------------

  function renderList() {
    const visible = getVisibleTasks();

    // Rebuilding from scratch is simpler and plenty fast for a
    // to-do list's scale (tens to low hundreds of items). A
    // production app with thousands of rows would instead diff
    // and patch the DOM, but that complexity isn't earned here.
    list.innerHTML = "";

    visible.forEach((task) => {
      const fragment = template.content.cloneNode(true);
      const li = fragment.querySelector(".task");
      const checkbox = fragment.querySelector(".task__checkbox");
      const label = fragment.querySelector(".task__label");

      li.dataset.id = task.id;
      li.classList.toggle("is-completed", task.completed);

      checkbox.id = "task-checkbox-" + task.id;
      checkbox.checked = task.completed;

      label.setAttribute("for", checkbox.id);
      label.textContent = task.text;

      list.appendChild(fragment);
    });

    emptyState.hidden = visible.length !== 0;
  }

  function renderCounts() {
    const activeCount = tasks.filter((t) => !t.completed).length;
    const completedCount = tasks.filter((t) => t.completed).length;

    countEls.all.textContent = String(tasks.length);
    countEls.active.textContent = String(activeCount);
    countEls.completed.textContent = String(completedCount);

    remainingSummary.textContent =
      activeCount === 1 ? "1 task remaining" : activeCount + " tasks remaining";

    clearCompletedBtn.disabled = completedCount === 0;
  }

  function renderFilterTabs() {
    Object.keys(tabEls).forEach((key) => {
      const isSelected = key === currentFilter;
      const tab = tabEls[key];
      tab.setAttribute("aria-selected", String(isSelected));
      // Roving tabindex: only the selected tab is reachable via a
      // plain Tab keypress; the others are reachable only via arrow
      // keys once focus is already inside the tablist. This matches
      // how native widgets like <select> behave, and keeps a single
      // Tab press moving past the whole filter group at once.
      tab.setAttribute("tabindex", isSelected ? "0" : "-1");
    });
  }

  function render() {
    renderList();
    renderCounts();
    renderFilterTabs();
  }

  // ---------------------------------------------------------
  // EVENT HANDLING
  //
  // Event delegation: rather than attaching a click/change
  // listener to every individual checkbox/edit/delete button
  // (which would mean re-attaching listeners every time render()
  // rebuilds the list), a single listener sits on the parent
  // <ul>. Every click inside it bubbles up to that one listener,
  // which then inspects event.target to figure out which task
  // and which action was involved. This is the standard pattern
  // for lists whose contents change dynamically.
  // ---------------------------------------------------------

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask(input.value);
    input.value = "";
    input.focus();
    saveTasks();
    render();
  });

  list.addEventListener("click", (event) => {
    const taskEl = event.target.closest(".task");
    if (!taskEl) return;
    const id = taskEl.dataset.id;

    if (event.target.classList.contains("task__delete")) {
      deleteTask(id);
      saveTasks();
      render();
      return;
    }

    if (event.target.classList.contains("task__edit")) {
      beginEdit(taskEl, id);
      return;
    }
  });

  // Checkboxes fire `change`, not `click`, when toggled via
  // keyboard (space bar) as well as mouse — delegating on
  // `change` catches both input methods correctly.
  list.addEventListener("change", (event) => {
    if (!event.target.classList.contains("task__checkbox")) return;
    const taskEl = event.target.closest(".task");
    if (!taskEl) return;
    toggleTask(taskEl.dataset.id);
    saveTasks();
    render();
  });

  /**
   * Swaps a task row into inline-edit mode: the label is hidden
   * and replaced with a text input pre-filled with the current
   * text, focused and selected. Saves on Enter or blur, cancels
   * on Escape.
   */
  function beginEdit(taskEl, id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    taskEl.classList.add("is-editing");

    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "task__edit-input";
    editInput.value = task.text;
    editInput.setAttribute("aria-label", "Edit task text");
    editInput.maxLength = 200;

    const mainEl = taskEl.querySelector(".task__main");
    mainEl.appendChild(editInput);
    editInput.focus();
    editInput.select();

    let finished = false;

    function commit() {
      if (finished) return;
      finished = true;
      editTask(id, editInput.value);
      saveTasks();
      render();
    }

    function cancel() {
      if (finished) return;
      finished = true;
      render(); // re-render discards the in-progress edit, no save
    }

    editInput.addEventListener("blur", commit);
    editInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        editInput.blur(); // triggers commit() via the blur handler above
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
  }

  filterBar.addEventListener("click", (event) => {
    const tab = event.target.closest(".filter-tab");
    if (!tab) return;
    currentFilter = tab.dataset.filter;
    render();
  });

  /**
   * WAI-ARIA Tabs pattern, automatic activation: arrow keys move
   * focus to the adjacent tab AND activate it immediately (rather
   * than requiring a separate Enter/Space press) — this matches
   * the behavior people expect from radio buttons and native
   * <select> dropdowns, which is the closer mental model for a
   * 3-way filter than a content-heavy tabbed interface would be.
   */
  filterBar.addEventListener("keydown", (event) => {
    const currentTab = event.target.closest(".filter-tab");
    if (!currentTab) return;

    const order = ["all", "active", "completed"];
    const currentIndex = order.indexOf(currentTab.dataset.filter);
    if (currentIndex === -1) return;

    let nextIndex = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % order.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + order.length) % order.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = order.length - 1;
    } else {
      return; // not a key this handler cares about
    }

    event.preventDefault(); // stop arrow keys from also scrolling the page
    currentFilter = order[nextIndex];
    render();
    // render() rebuilds aria-selected/tabindex but doesn't move
    // actual keyboard focus, so that's done explicitly here —
    // focus must follow the now-active tab for the roving
    // tabindex pattern to actually be usable.
    tabEls[currentFilter].focus();
  });

  clearCompletedBtn.addEventListener("click", () => {
    clearCompleted();
    saveTasks();
    render();
  });

  // ---------------------------------------------------------
  // STARTUP
  // ---------------------------------------------------------

  tasks = loadTasks();
  render();
})();
