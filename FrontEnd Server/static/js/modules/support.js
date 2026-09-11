// ================= Support =================
// Tickets go to the backend (SupportTickets table), not localStorage.

import { $ } from "./dom.js";
import { API_BASE } from "./config.js";

let supportBound = false;

function showSupportToast(message) {
  const toastEl = $("supportToast");
  const bodyEl = $("supportToastBody");
  if (bodyEl) bodyEl.textContent = message;

  if (!toastEl || typeof bootstrap === "undefined") {
    alert(message);
    return;
  }

  const t = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2200 });
  t.show();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function bindSupportEventsIfPossible() {
  if (supportBound) return;

  const form = $("supportForm");
  const btnClear = $("btnSupportClear");
  const btnEmail = $("btnSupportEmail");

  if (!form || !btnClear || !btnEmail) return;

  supportBound = true;

  const $name = $("supportName");
  const $email = $("supportEmail");
  const $topic = $("supportTopic");
  const $msg = $("supportMsg");
  const $hint = $("supportHint");

  const SUPPORT_EMAIL = "soporte@tjhotels.com";

  function setHint(txt) {
    if ($hint) $hint.textContent = txt || "";
  }

  btnEmail.addEventListener("click", () => {
    const subject = encodeURIComponent("Soporte TJ Hotels");
    const body = encodeURIComponent("Hola, necesito ayuda con...");
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  });

  btnClear.addEventListener("click", () => {
    if ($name) $name.value = "";
    if ($email) $email.value = "";
    if ($topic) $topic.value = "General";
    if ($msg) $msg.value = "";
    setHint("");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = ($name?.value || "").trim();
    const email = ($email?.value || "").trim();
    const topic = ($topic?.value || "General").trim();
    const msg = ($msg?.value || "").trim();

    if (name.length < 2) {
      setHint("Enter your name (at least 2 characters).");
      return;
    }
    if (!isValidEmail(email)) {
      setHint("Enter a valid email.");
      return;
    }
    if (msg.length < 10) {
      setHint("Describe your message (at least 10 characters).");
      return;
    }

    setHint("");

    // Disable the button so a slow network does not file the ticket twice
    const btnSubmit = form.querySelector('[type="submit"]');
    if (btnSubmit) btnSubmit.disabled = true;
    setHint("Sending...");

    try {
      const res = await fetch(`${API_BASE}/support`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message: msg }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 0) {
        setHint(data.errorMessage || "Could not send your message. Try again.");
        return;
      }

      setHint("");
      showSupportToast("Message sent. Thanks, we will contact you soon.");
      if ($msg) $msg.value = "";
    } catch (err) {
      console.error("Support:", err);
      setHint("Could not reach the server. Check your connection.");
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  });
}
