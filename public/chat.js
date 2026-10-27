const toggle = document.getElementById("chat-toggle");
const chat = document.getElementById("chat");
const closeBtn = document.getElementById("chat-close");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const list = document.getElementById("chat-messages");

const history = [];

function setOpen(open) {
  chat.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) input.focus();
}

toggle.addEventListener("click", () => setOpen(chat.hidden));
closeBtn.addEventListener("click", () => setOpen(false));
document.querySelectorAll("[data-open-chat]").forEach((el) => el.addEventListener("click", () => setOpen(true)));

function addMessage(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage("user", text);
  history.push({ role: "user", content: text });

  const pending = addMessage("assistant pending", "Digitando…");
  form.querySelector("button").disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao enviar mensagem.");
    pending.className = "msg assistant";
    pending.textContent = data.reply;
    history.push({ role: "assistant", content: data.reply });
  } catch (err) {
    pending.className = "msg error";
    pending.textContent = err.message;
    history.pop(); // permite reenviar a mesma pergunta
  } finally {
    form.querySelector("button").disabled = false;
    input.focus();
  }
});
