"use strict";

const $ = selector => document.querySelector(selector);
let allTickets = [];
let selectedId = null;
let roiRevision = 0;

const labels = { high: "Высокий", medium: "Средний", low: "Низкий" };
const statuses = { new: "Новое", in_progress: "В работе", resolved: "Решено" };

function safe(text) {
  return String(text ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function displayMessage(message, err = false, target = "#form-feedback") {
  const el = $(target);
  if (!el) return;
  el.hidden = false;
  el.classList.toggle("error", err);
  el.textContent = message;
}

async function request(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

function renderTable() {
  const filter = $("#filter").value;
  const tickets = allTickets.filter(item => filter === "all" || item.priority === filter);
  $("#ticket-rows").innerHTML = tickets.length
    ? tickets.map(item => `
      <tr>
        <td title="${safe(item.text)}">${safe(item.text.length > 75 ? item.text.slice(0, 75) + "…" : item.text)}</td>
        <td>${safe(item.category_label)}</td>
        <td><span class="pill pill-${safe(item.priority)}">${safe(labels[item.priority] || "—")}</span></td>
        <td>${safe(item.owner)}</td>
        <td><span class="pill status-pill">${safe(statuses[item.status] || item.status || "—")}</span></td>
        <td><button type="button" class="action-more" data-ticket="${Number(item.id)}" aria-label="Подробнее об обращении №${Number(item.id)}">↗</button></td>
      </tr>`).join("")
    : '<tr><td colspan="6" class="empty">Нет обращений с выбранным приоритетом.</td></tr>';
}

function renderAudit(events) {
  const root = $("#audit-events");
  if (!root) return;
  if (!Array.isArray(events) || !events.length) {
    root.innerHTML = '<div class="audit-empty">Событий пока нет.</div>';
    return;
  }
  root.innerHTML = events.map(event => {
    const details = event.details || {};
    let summary = "";
    if (event.event_type === "ticket.created") {
      summary = `${details.category || "general"} · ${details.priority || "—"} · ${details.source || "—"}`;
    } else if (event.event_type === "ticket.status_changed") {
      summary = `${details.from || "—"} → ${details.to || "—"}`;
    } else if (event.event_type === "batch.created" || event.event_type === "demo.seeded") {
      summary = `${Number(details.count || 0)} обращений`;
    }
    return `
      <div class="audit-event">
        <span class="audit-dot"></span>
        <div>
          <strong>${safe(event.event_type)}</strong>
          <small>${safe(summary)}</small>
        </div>
        <time>${safe(new Date(event.created_at).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }))}</time>
      </div>`;
  }).join("");
}

function showDetail(id) {
  const ticket = allTickets.find(item => item.id === id);
  if (!ticket) return;
  selectedId = id;
  const detail = $("#ticket-detail");
  detail.hidden = false;
  detail.innerHTML = `
    <h3>Обращение №${Number(ticket.id)} · ${safe(ticket.category_label)}</h3>
    <p><strong>Сообщение:</strong> ${safe(ticket.text)}</p>
    <p><strong>Рекомендованное действие:</strong> ${safe(ticket.action)}</p>
    <p><strong>Режим:</strong> ${safe(ticket.handling_mode)} · <strong>Обработчик:</strong> ${safe(ticket.provider_used)}</p>
    <p><strong>Почему:</strong></p>
    <ul>${(Array.isArray(ticket.reasons) ? ticket.reasons : []).map(reason => `<li>${safe(reason)}</li>`).join("")}</ul>
    <div class="detail-actions">
      <button type="button" data-status="in_progress">В работу</button>
      <button type="button" data-status="resolved">Решено</button>
      <button type="button" class="close-detail">Закрыть</button>
    </div>`;
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function updateRoi() {
  const revision = ++roiRevision;
  const minutes = Number($("#roi-minutes").value);
  const rate = Number($("#roi-rate").value);
  if (!Number.isFinite(minutes) || !Number.isFinite(rate) || minutes < 0 || rate < 0) return;
  try {
    const result = await request("/api/roi", {
      method: "POST",
      body: JSON.stringify({ minutes_saved_per_ticket: minutes, hourly_cost_rub: rate })
    });
    if (revision !== roiRevision) return;
    $("#roi-value").textContent = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0
    }).format(result.potential_labor_value_rub);
  } catch {
    if (revision === roiRevision) $("#roi-value").textContent = "—";
  }
}

async function load() {
  try {
    const [tickets, stats, config, audit] = await Promise.all([
      request("/api/tickets"),
      request("/api/stats"),
      request("/api/config"),
      request("/api/audit?limit=10")
    ]);
    allTickets = tickets;
    $("#stat-total").textContent = stats.total;
    $("#stat-urgent").textContent = stats.urgent;
    $("#stat-time").textContent = stats.minutes_saved_assumption;
    $("#stat-cost").textContent = Number(stats.api_cost_usd).toFixed(4);
    $("#queue-count").textContent = stats.total;
    $("#mode-chip").textContent = config.mode.toUpperCase();
    $("#config-status").textContent = config.remote_ready ? "Подключён внешний LLM API" : "Локальная обработка активна";
    $("#use-llm").disabled = !config.remote_ready;

    const statusTitle = $("#server-status-title");
    const statusSubtitle = $("#server-status-subtitle");
    if (config.remote_ready) {
      statusTitle.textContent = "Внешний LLM разрешён";
      statusSubtitle.textContent = "Маскированный текст может отправляться API";
    } else {
      statusTitle.textContent = "Локальный режим";
      statusSubtitle.textContent = "Внешние модели не вызываются";
    }

    renderTable();
    renderAudit(audit);
    await updateRoi();
  } catch (error) {
    displayMessage(`Не удалось загрузить данные: ${error.message}`, true);
  }
}

function batchLines() {
  return $("#batch-input").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function updateBatchCounter() {
  const lines = batchLines();
  const counter = $("#batch-counter");
  counter.textContent = `${lines.length} / 50`;
  counter.classList.toggle("over-limit", lines.length > 50);
}

$("#analyze-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("#analyze-button");
  button.disabled = true;
  try {
    const payload = {
      text: $("#ticket-text").value,
      source: $("#source").value,
      use_llm: $("#use-llm").checked
    };
    const ticket = await request("/api/tickets", { method: "POST", body: JSON.stringify(payload) });
    $("#ticket-text").value = "";
    displayMessage(`Обращение №${ticket.id} классифицировано: ${ticket.category_label} → ${ticket.owner}. Решение требует проверки сотрудником.`);
    await load();
    showDetail(ticket.id);
  } catch (error) {
    displayMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#batch-button").addEventListener("click", async () => {
  const button = $("#batch-button");
  const lines = batchLines();
  if (!lines.length) {
    displayMessage("Добавьте хотя бы одно обращение.", true, "#batch-feedback");
    return;
  }
  if (lines.length > 50) {
    displayMessage("За один запуск можно обработать не более 50 обращений.", true, "#batch-feedback");
    return;
  }
  button.disabled = true;
  try {
    const source = $("#batch-source").value;
    const result = await request("/api/tickets/batch", {
      method: "POST",
      body: JSON.stringify({ items: lines.map(text => ({ text, source, use_llm: false })) })
    });
    $("#batch-input").value = "";
    updateBatchCounter();
    displayMessage(`Пакет обработан: ${result.created} обращений добавлено в очередь.`, false, "#batch-feedback");
    await load();
  } catch (error) {
    displayMessage(error.message, true, "#batch-feedback");
  } finally {
    button.disabled = false;
  }
});

$("#demo-button").addEventListener("click", async () => {
  try {
    const result = await request("/api/demo/seed", { method: "POST" });
    displayMessage(result.created ? `Загружено ${result.created} демонстрационных обращений.` : result.message);
    await load();
  } catch (error) {
    displayMessage(error.message, true);
  }
});

$("#audit-refresh").addEventListener("click", async () => {
  try {
    renderAudit(await request("/api/audit?limit=10"));
  } catch (error) {
    displayMessage(`Не удалось обновить журнал: ${error.message}`, true);
  }
});

$("#batch-input").addEventListener("input", updateBatchCounter);
$("#filter").addEventListener("change", renderTable);

$("#ticket-rows").addEventListener("click", event => {
  const button = event.target.closest("[data-ticket]");
  if (button) showDetail(Number(button.dataset.ticket));
});

$("#ticket-detail").addEventListener("click", async event => {
  if (event.target.closest(".close-detail")) {
    selectedId = null;
    $("#ticket-detail").hidden = true;
    return;
  }
  const button = event.target.closest("[data-status]");
  if (!button || !selectedId) return;
  try {
    await request(`/api/tickets/${selectedId}/status?status=${encodeURIComponent(button.dataset.status)}`, { method: "PATCH" });
    await load();
    showDetail(selectedId);
  } catch (error) {
    displayMessage(error.message, true);
  }
});

for (const key of ["#roi-minutes", "#roi-rate"]) {
  $(key).addEventListener("input", updateRoi);
}

for (const item of document.querySelectorAll(".nav-item")) {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(node => node.classList.remove("active"));
    item.classList.add("active");
  });
}

updateBatchCounter();
load();
