// ---- SETTINGS: paste your own values ----
const BOT_TOKEN = "8945458529:AAG5juZRoMO3gLMS4-kItwplznLlalfrnLY";   // from @BotFather
const CHAT_ID   = "7479503756"; // from @userinfobot
const WAIT_MINUTES = 5;                      // stop waiting after this long
// -----------------------------------------

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const tiles = document.getElementById("tiles");
const inputs = [...tiles.querySelectorAll("input")];
const btn = document.getElementById("submit");
const msg = document.getElementById("msg");

const tg = (method, body) =>
  fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

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
    const text = (e.clipboardData.getData("text") || "").replace(/[^a-zA-Z]/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    [...text].forEach((c, k) => (inputs[k].value = c));
    inputs[Math.min(text.length, 5)].focus();
  });
});

function showWarn(text) { msg.innerHTML = `<span class="warn"></span>`; msg.firstChild.textContent = text; }

function resetBoxes() {
  inputs.forEach((i) => (i.value = ""));
  btn.disabled = false;
  inputs[0].focus();
}

btn.addEventListener("click", async () => {
  const letters = inputs.map((i) => i.value.trim());
  if (letters.some((l) => !l)) return showWarn("Fill in all six letters.");

  const word = letters.join("").toUpperCase();
  const id = Math.random().toString(36).slice(2, 10);
  btn.disabled = true;
  msg.textContent = "Sent. Waiting for a decision…";

  try {
    const sent = await tg("sendMessage", {
      chat_id: CHAT_ID,
      text: `New guess: ${word}\n\nIs it correct?`,
      reply_markup: { inline_keyboard: [[
        { text: "✅ Yes", callback_data: `yes:${id}` },
        { text: "❌ No",  callback_data: `no:${id}` },
      ]] },
    });
    if (!sent.ok) throw new Error(sent.description);
    waitForAnswer(id, word, sent.result.message_id);
  } catch (e) {
    showWarn("Could not reach the bot. Check your settings and try again.");
    btn.disabled = false;
  }
});

function waitForAnswer(id, word, messageId) {
  const deadline = Date.now() + WAIT_MINUTES * 60 * 1000;

  const timer = setInterval(async () => {
    if (Date.now() > deadline) {
      clearInterval(timer);
      showWarn("No answer yet. Try again.");
      return resetBoxes();
    }
    try {
      const res = await tg("getUpdates", { allowed_updates: ["callback_query"], limit: 100 });
      if (!res.ok) return;
      const hit = res.result.map((u) => u.callback_query).find(
        (cq) => cq && cq.data && cq.data.endsWith(":" + id) && String(cq.from.id) === String(CHAT_ID)
      );
      if (!hit) return;

      clearInterval(timer);
      const yes = hit.data.startsWith("yes:");
      tg("answerCallbackQuery", { callback_query_id: hit.id, text: yes ? "Approved" : "Rejected" });
      tg("editMessageText", { chat_id: CHAT_ID, message_id: messageId, text: `${word} — ${yes ? "✅ Approved" : "❌ Rejected"}` });

      if (yes) {
        sessionStorage.setItem("won", "1");
        location.href = "congrats.html";
      } else {
        showWarn("⚠️ Wrong word. Try again.");
        tiles.classList.remove("shake"); void tiles.offsetWidth; tiles.classList.add("shake");
        resetBoxes();
      }
    } catch {}
  }, 2000);
}
