// ---- SETTINGS: paste your own values ----
const BOT_TOKEN = "PASTE_BOT_TOKEN_HERE";   // from @BotFather
const CHAT_ID   = "PASTE_YOUR_CHAT_ID_HERE"; // from @userinfobot
const WAIT_MINUTES = 5;                      // stop waiting after this long
// -----------------------------------------

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const tiles = document.getElementById("tiles");
const inputs = [...tiles.querySelectorAll("input")];
const btn = document.getElementById("submit");
const msg = document.getElementById("msg");
const nameInput = document.getElementById("name");

const tg = (method, body) =>
  fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

// Remember where the update queue is now, so we only react to new button presses.
let offset;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ready = (async () => {
  try {
    const r = await tg("getUpdates", { offset: -1, timeout: 0, allowed_updates: ["callback_query"] });
    const last = r.result && r.result[r.result.length - 1];
    if (last) offset = last.update_id + 1;
  } catch {}
})();

// Name field: letters only, max 10
nameInput.addEventListener("input", () => {
  nameInput.value = nameInput.value.replace(/[^a-zA-Z]/g, "").slice(0, 10);
});
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") inputs[0].focus(); });

// Letter boxes: auto-advance, backspace, Enter, paste
inputs.forEach((el, i) => {
  el.addEventListener("input", () => {
    el.value = el.value.replace(/[^a-zA-Z]/g, "").slice(0, 1);
    if (el.value && inputs[i + 1]) inputs[i + 1].focus();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !el.value && inputs[i - 1]) inputs[i - 1].focus();
    if (e.key === "Enter") btn.click();
  });
  el.addEventListener("paste", (e) => {
    const text = (e.clipboardData.getData("text") || "").replace(/[^a-zA-Z]/g, "").slice(0, 4);
    if (!text) return;
    e.preventDefault();
    [...text].forEach((c, k) => (inputs[k].value = c));
    inputs[Math.min(text.length, 3)].focus();
  });
});

function showWarn(text) { msg.innerHTML = `<span class="warn"></span>`; msg.firstChild.textContent = text; }

function resetBoxes() {
  inputs.forEach((i) => (i.value = ""));
  btn.disabled = false;
  inputs[0].focus();
}

btn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) return showWarn("Enter your name.");
  const letters = inputs.map((i) => i.value.trim());
  if (letters.some((l) => !l)) return showWarn("Fill in all four letters.");

  const word = letters.join("").toUpperCase();
  const id = Math.random().toString(36).slice(2, 10);
  btn.disabled = true;
  msg.textContent = "Sent. Waiting for a decision…";

  try {
    await ready;
    const sent = await tg("sendMessage", {
      chat_id: CHAT_ID,
      text: `Name: ${name}\nGuess: ${word}\n\nIs it correct?`,
      reply_markup: { inline_keyboard: [[
        { text: "✅ Yes", callback_data: `yes:${id}` },
        { text: "❌ No",  callback_data: `no:${id}` },
      ]] },
    });
    if (!sent.ok) throw new Error(sent.description);
    waitForAnswer(id, name, word, sent.result.message_id);
  } catch (e) {
    showWarn("Could not reach the bot. Check your settings and try again.");
    btn.disabled = false;
  }
});

// Long polling: Telegram holds the request open and replies the instant you tap a button.
async function waitForAnswer(id, name, word, messageId) {
  const deadline = Date.now() + WAIT_MINUTES * 60 * 1000;

  while (Date.now() < deadline) {
    let res;
    try {
      res = await tg("getUpdates", { offset, timeout: 25, allowed_updates: ["callback_query"] });
    } catch { await sleep(500); continue; }
    if (!res.ok) { await sleep(300); continue; }

    for (const u of res.result) {
      offset = u.update_id + 1;
      const cq = u.callback_query;
      if (!cq || !cq.data || !cq.data.endsWith(":" + id) || String(cq.from.id) !== String(CHAT_ID)) continue;

      const yes = cq.data.startsWith("yes:");
      if (yes) sessionStorage.setItem("won", "1");
      tg("answerCallbackQuery", { callback_query_id: cq.id, text: yes ? "Approved" : "Rejected" });
      tg("editMessageText", { chat_id: CHAT_ID, message_id: messageId, text: `${name}: ${word} — ${yes ? "✅ Approved" : "❌ Rejected"}` });

      if (yes) { location.href = "congrats.html"; return; }
      showWarn("⚠️ Wrong word. Try again.");
      tiles.classList.remove("shake"); void tiles.offsetWidth; tiles.classList.add("shake");
      resetBoxes();
      return;
    }
  }
  showWarn("No answer yet. Try again.");
  resetBoxes();
}
