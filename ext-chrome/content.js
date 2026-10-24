(function () {
  if (document.getElementById("fc-floating-btn")) return;

  if (!document.body) {
    document.addEventListener("DOMContentLoaded", () => start());
  } else {
    start();
  }

  function start() {
    if (document.getElementById("fc-floating-btn")) return;

    const DEFAULT_NAME = "Gwen";
    let userName = DEFAULT_NAME;
    let darkMode = false;
    let soundOn = true;
    let fontSize = 1; // 0 small, 1 normal, 2 large
    let notes = [];
    let isOpen = false;
    let lastIntent = null;
    let lastTemplate = "";
    let lastLang = "en";

    // ----- Floating button -----
    const btn = document.createElement("button");
    btn.id = "fc-floating-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Open chat");
    btn.textContent = "💬";
    document.body.appendChild(btn);

    // ----- Chatbox -----
    const chatbox = document.createElement("div");
    chatbox.id = "fc-chatbox";
    chatbox.style.display = "none";
    chatbox.innerHTML = `
      <div id="fc-chatbox-header">
        <div id="fc-header-text">
          <span id="fc-title">Chat Everywhere</span>
          <span id="fc-greeting"></span>
        </div>
        <button id="fc-chatbox-close" aria-label="Close chat">✕</button>
      </div>
      <div id="fc-toolbar">
        <button class="fc-tool" id="fc-tool-emoji" title="Emoji">😊</button>
        <button class="fc-tool" id="fc-tool-theme" title="Dark / Light mode">🌙</button>
        <button class="fc-tool" id="fc-tool-font" title="Text size">🔠</button>
        <button class="fc-tool" id="fc-tool-sound" title="Sound on/off">🔔</button>
        <button class="fc-tool" id="fc-tool-search" title="Search chat">🔍</button>
        <button class="fc-tool" id="fc-tool-notes" title="Show notes">📝</button>
        <button class="fc-tool" id="fc-tool-copy" title="Copy chat">📋</button>
        <button class="fc-tool" id="fc-tool-export" title="Export chat (.txt)">💾</button>
        <button class="fc-tool" id="fc-tool-clear" title="Clear chat">🗑️</button>
      </div>
      <div id="fc-search-row" style="display:none">
        <input id="fc-search-input" type="text" placeholder="Search in chat..." autocomplete="off" />
      </div>
      <div id="fc-emoji-panel" style="display:none"></div>
      <div id="fc-chatbox-messages"></div>
      <div id="fc-chatbox-input-row">
        <input id="fc-chatbox-input" type="text" placeholder="Type a message or /help" autocomplete="off" />
        <button id="fc-chatbox-send">Send</button>
      </div>
    `;
    document.body.appendChild(chatbox);

    const messages = chatbox.querySelector("#fc-chatbox-messages");
    const input = chatbox.querySelector("#fc-chatbox-input");
    const sendBtn = chatbox.querySelector("#fc-chatbox-send");
    const closeBtn = chatbox.querySelector("#fc-chatbox-close");
    const greeting = chatbox.querySelector("#fc-greeting");
    const emojiPanel = chatbox.querySelector("#fc-emoji-panel");
    const searchRow = chatbox.querySelector("#fc-search-row");
    const searchInput = chatbox.querySelector("#fc-search-input");

    // ----- Storage -----
    function loadSettings(cb) {
      try {
        chrome.storage.local.get(["fcName", "fcDark", "fcNotes", "fcSound", "fcFont"], (res) => cb(res || {}));
      } catch (e) {
        cb({});
      }
    }
    function saveSettings(obj) {
      try {
        chrome.storage.local.set(obj);
      } catch (e) {}
    }

    // ----- Helpers -----
    function rand(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function timeGreeting() {
      const h = new Date().getHours();
      if (h < 12) return "Good morning";
      if (h < 18) return "Good afternoon";
      return "Good evening";
    }

    function updateGreeting() {
      greeting.textContent = rand(["Hi", "Hello", "Hey"]) + ", " + userName + " 👋";
    }

    function applyTheme() {
      chatbox.classList.toggle("fc-dark", darkMode);
      chatbox.querySelector("#fc-tool-theme").textContent = darkMode ? "☀️" : "🌙";
    }

    function applyFont() {
      chatbox.classList.remove("fc-font-0", "fc-font-1", "fc-font-2");
      chatbox.classList.add("fc-font-" + fontSize);
    }

    function applySound() {
      chatbox.querySelector("#fc-tool-sound").textContent = soundOn ? "🔔" : "🔕";
    }

    function timeNow() {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Tiny beep using Web Audio (no files needed)
        // Tiny beep using Web Audio (only after the user has interacted)
    let audioCtx = null;
    let userInteracted = false;

    ["pointerdown", "keydown"].forEach((evt) => {
      chatbox.addEventListener(evt, () => { userInteracted = true; }, true);
      btn.addEventListener(evt, () => { userInteracted = true; }, true);
    });

    function beep(freq, dur) {
      if (!soundOn || !userInteracted) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!audioCtx) audioCtx = new AC();
        if (audioCtx.state === "suspended") audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq || 660;
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        }, dur || 120);
      } catch (e) {}
    }

    function addMessage(text, sender) {
      const msg = document.createElement("div");
      msg.className = "fc-message " + sender;

      const body = document.createElement("div");
      body.className = "fc-text";
      body.textContent = text;

      const time = document.createElement("div");
      time.className = "fc-time";
      time.textContent = timeNow();

      msg.appendChild(body);
      msg.appendChild(time);
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
      if (sender === "bot") beep(660, 100);
    }

    function welcome() {
      addMessage(
        timeGreeting() + ", " + userName + "! 🎉 Welcome to Chat Everywhere. Type /help to see what I can do.",
        "bot"
      );
    }

    function botReply(text, delay) {
      delay = delay || 400;
      const typing = document.createElement("div");
      typing.className = "fc-message bot fc-typing";
      typing.innerHTML = "<span></span><span></span><span></span>";
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
      setTimeout(() => {
        typing.remove();
        addMessage(text, "bot");
      }, delay);
    }

    function toggleChat() {
      isOpen = !isOpen;
      chatbox.style.display = isOpen ? "flex" : "none";
      if (isOpen) {
        updateGreeting();
        input.focus();
      }
    }

    function closeChat() {
      isOpen = false;
      chatbox.style.display = "none";
    }

    // ----- Tools -----
    function getChatText() {
      return Array.from(messages.querySelectorAll(".fc-message:not(.fc-typing)"))
        .map((m) => {
          const who = m.classList.contains("user") ? userName : "Bot";
          const t = m.querySelector(".fc-text").textContent;
          const time = m.querySelector(".fc-time").textContent;
          return "[" + time + "] " + who + ": " + t;
        })
        .join("\n");
    }

    function copyChat() {
      const text = getChatText();
      if (!text) return botReply("Nothing to copy yet.", 200);
      navigator.clipboard
        .writeText(text)
        .then(() => botReply("Chat copied to clipboard ✅", 200))
        .catch(() => botReply("Couldn't copy. The page may block clipboard access.", 200));
    }

    function exportChat() {
      const text = getChatText();
      if (!text) return botReply("Nothing to export yet.", 200);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chat-everywhere.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function clearChat() {
      messages.innerHTML = "";
      lastIntent = null;
      lastTemplate = "";
      welcome();
    }

    function toggleTheme() {
      darkMode = !darkMode;
      applyTheme();
      saveSettings({ fcDark: darkMode });
    }

    function cycleFont() {
      fontSize = (fontSize + 1) % 3;
      applyFont();
      saveSettings({ fcFont: fontSize });
      botReply("Text size: " + ["Small", "Normal", "Large"][fontSize] + " 🔠", 200);
    }

    function toggleSound() {
      soundOn = !soundOn;
      applySound();
      saveSettings({ fcSound: soundOn });
      if (soundOn) beep(880, 120);
    }

    function toggleSearch() {
      const show = searchRow.style.display === "none";
      searchRow.style.display = show ? "block" : "none";
      if (show) {
        searchInput.focus();
      } else {
        searchInput.value = "";
        filterMessages("");
      }
    }

    function filterMessages(q) {
      q = q.toLowerCase();
      messages.querySelectorAll(".fc-message:not(.fc-typing)").forEach((m) => {
        const t = m.querySelector(".fc-text").textContent.toLowerCase();
        m.style.display = !q || t.includes(q) ? "" : "none";
      });
    }

    function showNotes() {
      if (!notes.length) return botReply("No notes yet. Use /note buy milk 📝");
      botReply("Your notes:\n" + notes.map((n, i) => i + 1 + ". " + n).join("\n"));
    }

    // Emoji picker
    const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😢","😡","👍","👏","🙏","🔥","🎉","❤️","✨","💯","🤝","👋","🍕","☕","😴","🤗","😭","🥳","💜","🌈","🎵","📚","💻","🙌"];
    EMOJIS.forEach((e) => {
      const b = document.createElement("button");
      b.className = "fc-emoji";
      b.type = "button";
      b.textContent = e;
      b.addEventListener("click", () => {
        input.value += e;
        input.focus();
      });
      emojiPanel.appendChild(b);
    });

    function toggleEmoji() {
      emojiPanel.style.display = emojiPanel.style.display === "none" ? "flex" : "none";
    }

    // Calculator (no eval, works on every site)
    function calc(expr) {
      if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
        return "Only numbers and + - * / % ( ) are allowed.";
      }
      const tokens = expr.match(/\d*\.?\d+|[+\-*/%()]/g);
      if (!tokens) return "Invalid calculation.";

      let pos = 0;
      const peek = () => tokens[pos];
      const next = () => tokens[pos++];

      function parseExpr() {
        let v = parseTerm();
        while (peek() === "+" || peek() === "-") {
          const op = next();
          const r = parseTerm();
          v = op === "+" ? v + r : v - r;
        }
        return v;
      }
      function parseTerm() {
        let v = parseFactor();
        while (peek() === "*" || peek() === "/" || peek() === "%") {
          const op = next();
          const r = parseFactor();
          v = op === "*" ? v * r : op === "/" ? v / r : v % r;
        }
        return v;
      }
      function parseFactor() {
        const t = next();
        if (t === "-") return -parseFactor();
        if (t === "+") return parseFactor();
        if (t === "(") {
          const v = parseExpr();
          if (next() !== ")") throw new Error("missing )");
          return v;
        }
        if (t === undefined || isNaN(Number(t))) throw new Error("bad token");
        return Number(t);
      }

      try {
        const result = parseExpr();
        if (pos !== tokens.length || !isFinite(result)) return "Invalid calculation.";
        return expr + " = " + result;
      } catch (e) {
        return "Invalid calculation.";
      }
    }

    const JOKES = [
      "Why do programmers prefer dark mode? Because light attracts bugs 🐛",
      "I told my computer I needed a break, and it froze 🧊",
      "There are 10 types of people: those who understand binary and those who don't.",
      "Why did the developer go broke? He used up all his cache 💸",
    ];

    const QUOTES = [
      "Small steps every day still get you there. 🌱",
      "You don't have to be perfect, just keep going. ✨",
      "Rest if you must, but don't quit. 💜",
      "Today's effort is tomorrow's strength. 💪",
    ];

    function makePassword(len) {
      const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
      const arr = new Uint32Array(len);
      crypto.getRandomValues(arr);
      return Array.from(arr, (n) => chars[n % chars.length]).join("");
    }

    function startTimer(arg) {
      const m = arg.match(/^(\d+)\s*(s|m)?$/i);
      if (!m) return botReply("Usage: /timer 30 (seconds) or /timer 5m (minutes)");
      let secs = parseInt(m[1], 10);
      if ((m[2] || "").toLowerCase() === "m") secs *= 60;
      if (secs < 1 || secs > 3600) return botReply("Pick between 1 second and 60 minutes.");
      botReply("⏱️ Timer set for " + secs + " second(s), " + userName + ".");
      setTimeout(() => {
        addMessage("⏰ Time's up, " + userName + "!", "bot");
        beep(880, 300);
      }, secs * 1000);
    }

    function handleCommand(raw) {
      const parts = raw.slice(1).split(" ");
      const cmd = parts[0];
      const arg = parts.slice(1).join(" ").trim();

      switch (cmd.toLowerCase()) {
        case "help":
          return botReply(
            "Commands:\n" +
              "/help – show this list\n" +
              "/time – current time\n" +
              "/date – today's date\n" +
              "/calc 2+2 – calculator\n" +
              "/roll – roll a dice\n" +
              "/flip – flip a coin\n" +
              "/random 1 100 – random number\n" +
              "/joke – random joke\n" +
              "/quote – motivation\n" +
              "/note <text> – save a note\n" +
              "/notes – show notes\n" +
              "/delnotes – delete all notes\n" +
              "/timer 30 or 5m – countdown\n" +
              "/password 12 – make a password\n" +
              "/upper /lower /reverse <text>\n" +
              "/count <text> – count words\n" +
              "/name <name> – change your name\n" +
              "/clear – clear chat"
          );
        case "time":
          return botReply("It's " + new Date().toLocaleTimeString() + " ⏰");
        case "date":
          return botReply(
            "Today is " +
              new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
              " 📅"
          );
        case "calc":
          return botReply(arg ? calc(arg) : "Usage: /calc 12*(3+4)");
        case "roll":
          return botReply("🎲 You rolled a " + (Math.floor(Math.random() * 6) + 1));
        case "flip":
          return botReply("🪙 " + (Math.random() < 0.5 ? "Heads" : "Tails"));
        case "random": {
          const n = arg.split(/\s+/).map(Number);
          const min = isFinite(n[0]) && arg ? n[0] : 1;
          const max = isFinite(n[1]) ? n[1] : 100;
          const lo = Math.min(min, max);
          const hi = Math.max(min, max);
          return botReply("🎯 " + (Math.floor(Math.random() * (hi - lo + 1)) + lo));
        }
        case "joke":
          return botReply(rand(JOKES));
        case "quote":
          return botReply(rand(QUOTES));
        case "note":
          if (!arg) return botReply("Usage: /note buy milk");
          notes.push(arg.slice(0, 200));
          saveSettings({ fcNotes: notes });
          return botReply("Saved note #" + notes.length + " 📝");
        case "notes":
          return showNotes();
        case "delnotes":
          notes = [];
          saveSettings({ fcNotes: notes });
          return botReply("All notes deleted 🗑️");
        case "timer":
          return startTimer(arg);
        case "password": {
          const len = Math.min(Math.max(parseInt(arg, 10) || 12, 6), 40);
          return botReply("🔐 " + makePassword(len));
        }
        case "upper":
          return botReply(arg ? arg.toUpperCase() : "Usage: /upper hello");
        case "lower":
          return botReply(arg ? arg.toLowerCase() : "Usage: /lower HELLO");
        case "reverse":
          return botReply(arg ? Array.from(arg).reverse().join("") : "Usage: /reverse hello");
        case "count": {
          if (!arg) return botReply("Usage: /count your text here");
          const words = arg.split(/\s+/).filter(Boolean).length;
          return botReply(words + " word(s), " + arg.length + " character(s).");
        }
        case "name":
          if (!arg) return botReply("Usage: /name Gwen");
          userName = arg.slice(0, 30);
          saveSettings({ fcName: userName });
          updateGreeting();
          return botReply("Nice to meet you, " + userName + "! 😊");
        case "clear":
          return clearChat();
        default:
          return botReply('Unknown command "/' + cmd + '". Type /help.');
      }
    }

    // ----- Smart replies -----
    function pick(arr) {
      let r;
      let tries = 0;
      do {
        r = arr[Math.floor(Math.random() * arr.length)];
        tries++;
      } while (arr.length > 1 && r === lastTemplate && tries < 10);
      lastTemplate = r;
      return r;
    }

    // Language detection (English / Bisaya / Tagalog)
    const CEB_WORDS = ["ko","ka","nako","nimo","unsa","naa","wala","gyud","kaayo","ra","na","mao","pila","asa","kinsa","akong","imong","gikapoy","kapoy","maayo","salamat","daghang","ayaw","dili","oo","bitaw","unsaon","nganong","ngano","lagi","jud","pud","sad","atong","amo","gani"];
    const TL_WORDS = ["ako","ikaw","po","naman","hindi","ano","bakit","kasi","mo","akin","iyo","salamat","opo","sige","paalam","kumusta","musta","ikaw","siya","namin","tayo","ba"];

    function detectLang(text) {
      const words = text.toLowerCase().match(/[a-zñ']+/g) || [];
      let ceb = 0;
      let tl = 0;
      words.forEach((w) => {
        if (CEB_WORDS.includes(w)) ceb++;
        if (TL_WORDS.includes(w)) tl++;
      });
      if (ceb === 0 && tl === 0) return lastLang === "ceb" || lastLang === "tl" ? (words.length <= 2 ? lastLang : "en") : "en";
      return ceb >= tl ? "ceb" : "tl";
    }

    // Pronoun reflection so the reply "coincides" with what you typed
    const REFLECT = {
      en: {
        i: "you", "i'm": "you're", im: "you're", "i've": "you've", "i'll": "you'll", "i'd": "you'd",
        my: "your", me: "you", myself: "yourself", mine: "yours", am: "are",
        you: "I", your: "my", "you're": "I'm", yours: "mine",
      },
      ceb: {
        ako: "ikaw", akong: "imong", nako: "nimo", ko: "ka", kanako: "kanimo",
        ikaw: "ako", imong: "akong", nimo: "nako", ka: "ko", kanimo: "kanako",
      },
      tl: {
        ako: "ikaw", akin: "iyo", ko: "mo", ikaw: "ako", iyo: "akin", mo: "ko",
      },
    };

    function reflect(text, lang) {
      const map = REFLECT[lang] || REFLECT.en;
      return text
        .trim()
        .replace(/[.!?]+$/g, "")
        .split(/\s+/)
        .map((w) => {
          const key = w.toLowerCase();
          return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : w;
        })
        .join(" ");
    }

    function mirrorEmoji(text) {
      const found = text.match(/\p{Extended_Pictographic}/gu);
      return found ? " " + found.slice(0, 2).join("") : "";
    }

    function mirrorEnergy(text, reply) {
      const letters = text.replace(/[^A-Za-z]/g, "");
      const allCaps = letters.length >= 4 && letters === letters.toUpperCase();
      if (allCaps) reply = "Whoa, I feel the energy! " + reply;
      if (/!{2,}$/.test(text.trim())) reply = reply.replace(/[.?]$/, "") + "!";
      return reply + mirrorEmoji(text);
    }

    // Order matters: more specific rules come first
    const RULES = [
      {
        intent: "howareyou",
        test: /\b(how are you|how r u|kumusta ka|musta ka|unsa na|kamusta ka)\b/i,
        replies: {
          en: ["I'm doing great, {name}! Thanks for asking 😊 How about you?", "Doing good, {name}! How are you?"],
          ceb: ["Maayo ra ko, {name}! Ikaw, kumusta?", "Okay ra ko, {name}! Ikaw, unsa na?"],
          tl: ["Okay lang ako, {name}! Ikaw, kumusta ka?", "Mabuti naman, {name}! Ikaw?"],
        },
      },
      {
        intent: "whoareyou",
        test: /\b(who are you|what are you|what'?s your name|kinsa ka|sino ka)\b/i,
        replies: {
          en: ["I'm the Chat Everywhere bot 💬, here to keep you company on any website, {name}."],
          ceb: ["Ako ang Chat Everywhere bot 💬, {name}. Naa ra ko diri para mag-uban nimo."],
          tl: ["Ako ang Chat Everywhere bot 💬, {name}. Nandito ako para samahan ka."],
        },
      },
      {
        intent: "myname",
        test: /\b(what'?s my name|who am i|kinsa ko|unsa akong ngalan|ano pangalan ko)\b/i,
        replies: {
          en: ["You're {name}! 😄"],
          ceb: ["Ikaw si {name}! 😄"],
          tl: ["Ikaw si {name}! 😄"],
        },
      },
      {
        intent: "feel_bad",
        test: /\b(sad|tired|stress|stressed|lonely|anxious|bored|not okay|nakapoy|kapoy|gikapoy|nalagot|nasuko|lagot|pagod|malungkot|stressed out|nalolooy|looy)\b/i,
        replies: {
          en: [
            "I'm sorry you're feeling that way, {name}. 💜 Do you want to talk about it?",
            "That sounds tough, {name}. Take a deep breath, I'm here to listen.",
          ],
          ceb: [
            "Kapoy gyud usahay, {name}. Pahulay sa gamay, okay? 💜 Gusto ka ba mag-istorya?",
            "Ayaw kabalaka, {name}. Naa ra ko diri maminaw nimo. 💜",
          ],
          tl: [
            "Pasensya na kung ganyan ang pakiramdam mo, {name}. 💜 Gusto mo bang pag-usapan?",
            "Mahirap yan, {name}. Nandito lang ako makikinig.",
          ],
        },
      },
      {
        intent: "feel_good",
        test: /\b(i'?m (good|fine|great|okay|ok|happy)|maayo ra|okay ra|ok ra|happy ko|nalipay|masaya ako|okay lang ako)\b/i,
        replies: {
          en: ["That's great to hear, {name}! 🎉", "Nice! Glad you're doing well, {name} 😊"],
          ceb: ["Nindot kaayo, {name}! 🎉 Nalipay ko para nimo.", "Maayo kay okay ka, {name} 😊"],
          tl: ["Masaya akong marinig yan, {name}! 🎉", "Buti naman, {name} 😊"],
        },
      },
      {
        intent: "thanks",
        test: /\b(thanks|thank you|salamat|daghang salamat|maraming salamat)\b/i,
        replies: {
          en: ["You're welcome, {name}! 😊", "Anytime, {name}! Always here to help."],
          ceb: ["Walay sapayan, {name}! 😊", "Walay problema, {name}!"],
          tl: ["Walang anuman, {name}! 😊", "Anytime, {name}!"],
        },
      },
      {
        intent: "bye",
        test: /\b(bye|goodbye|see you|ingat|paalam|babay)\b/i,
        replies: {
          en: ["Bye, {name}! Take care! 👋", "See you later, {name}! ✨"],
          ceb: ["Babay, {name}! Ingat! 👋", "Hangtod sa sunod, {name}! ✨"],
          tl: ["Paalam, {name}! Ingat! 👋", "Sige, kita tayo ulit, {name}! ✨"],
        },
      },
      {
        intent: "love",
        test: /\b(i love you|love you|mahal kita|gihigugma ka)\b/i,
        replies: {
          en: ["Aww, thank you {name}! 💜 You're awesome too."],
          ceb: ["Aww, salamat {name}! 💜 Nindot ka pud."],
          tl: ["Aww, salamat {name}! 💜 Ang bait mo rin."],
        },
      },
      {
        intent: "compliment",
        test: /\b(you'?re (great|awesome|smart|cool|nice|funny)|ang galing|nindot)\b/i,
        replies: {
          en: ["Thank you, {name}! You just made my day ✨"],
          ceb: ["Salamat, {name}! Nalipay ko sa imong giingon ✨"],
          tl: ["Salamat, {name}! Napasaya mo ako ✨"],
        },
      },
      {
        intent: "help",
        test: /\b(help|what can you do|commands|tabang)\b/i,
        replies: {
          en: ["Type /help to see all my commands, {name}. I can do math, notes, timers, jokes and more!"],
          ceb: ["I-type ang /help para makita tanan nakong commands, {name}. Kaya nako ang math, notes, timer, joke ug uban pa!"],
          tl: ["I-type ang /help para makita ang lahat ng commands, {name}. Kaya ko ang math, notes, timer at jokes!"],
        },
      },
      {
        intent: "greet",
        test: /\b(hi|hello|hey|hola|yo|good (morning|afternoon|evening)|kumusta|musta|kamusta|uy)\b/i,
        replies: {
          en: [
            "Hello, {name}! 👋 How can I help you today?",
            "Hi {name}! Nice to see you 😊 What's on your mind?",
            "Hey {name}! How's your day going?",
          ],
          ceb: ["Hello, {name}! 👋 Unsa akong matabang nimo karon?", "Hi {name}! Kumusta ka? 😊", "Uy {name}! Unsa na?"],
          tl: ["Hello, {name}! 👋 Ano ang maitutulong ko?", "Hi {name}! Kumusta ka? 😊", "Hey {name}! Kumusta araw mo?"],
        },
      },
    ];

    const FOLLOWUPS = {
      feel_bad: {
        yes: {
          en: "I'm listening, {name}. Take your time. 💜",
          ceb: "Naminaw ko, {name}. Hinay-hinay lang. 💜",
          tl: "Nakikinig ako, {name}. Sige lang. 💜",
        },
        no: {
          en: "That's okay, {name}. I'm here whenever you want to talk.",
          ceb: "Okay ra, {name}. Naa ra ko kung gusto ka mag-istorya.",
          tl: "Okay lang, {name}. Nandito lang ako kapag gusto mo.",
        },
      },
      howareyou: {
        yes: { en: "Glad to hear it, {name}!", ceb: "Nalipay ko, {name}!", tl: "Masaya ako para sa'yo, {name}!" },
      },
    };

    const GENERIC = {
      yes: {
        en: ["Great! Tell me more, {name}.", "Okay! Go ahead, I'm listening 😊"],
        ceb: ["Sige, {name}! Isulti na.", "Okay! Naminaw ko 😊"],
        tl: ["Sige, {name}! Ikuwento mo.", "Okay! Nakikinig ako 😊"],
      },
      no: {
        en: ["Alright, {name}. Let me know if you change your mind.", "No problem, {name}!"],
        ceb: ["Okay ra, {name}. Sultihi ko kung mausab imong hunahuna.", "Walay problema, {name}!"],
        tl: ["Sige, {name}. Sabihin mo lang kung magbago isip mo.", "Walang problema, {name}!"],
      },
      question: {
        en: [
          'You asked "{r}?" Good one, {name}! I don\'t know that yet, but try /time, /date, /joke or /calc.',
          'Hmm, "{r}?" I\'m not sure, {name}. Can you tell me more?',
        ],
        ceb: [
          'Nangutana ka "{r}?" Nindot na, {name}! Wala pa ko kahibalo, pero sulayi ang /time, /date, /joke o /calc.',
          'Hmm, "{r}?" Dili ko sigurado, {name}. Pwede nimo isulti pa?',
        ],
        tl: [
          'Tinanong mo "{r}?" Magandang tanong, {name}! Hindi ko pa alam, pero subukan ang /time, /date, /joke o /calc.',
          'Hmm, "{r}?" Hindi ako sigurado, {name}. Pwede mo bang ikwento pa?',
        ],
      },
      short: {
        en: ["{R}, huh? Tell me more, {name}.", "{R}. I see, {name}!"],
        ceb: ["{R}, ha? Isulti pa, {name}.", "{R}. Ay, mao ba, {name}!"],
        tl: ["{R}, ha? Ikwento mo pa, {name}.", "{R}. Ay, ganun ba, {name}!"],
      },
      statement: {
        en: [
          "So {r}. How do you feel about that, {name}?",
          "I see, {r}. What happened next, {name}?",
          "Interesting, {name}! {R}. Why is that?",
        ],
        ceb: [
          "Mao nga {r}. Unsa imong gibati bahin ana, {name}?",
          "Ay, {r}. Unya unsay nahitabo, {name}?",
          "Interesting, {name}! {R}. Ngano man?",
        ],
        tl: [
          "Ah, {r}. Ano ang pakiramdam mo diyan, {name}?",
          "Ganun ba, {r}. Tapos ano ang nangyari, {name}?",
          "Interesting, {name}! {R}. Bakit kaya?",
        ],
      },
    };

    function fill(tpl, text, lang) {
      const r = reflect(text, lang);
      const R = r.charAt(0).toUpperCase() + r.slice(1);
      return tpl.replace(/\{r\}/g, r).replace(/\{R\}/g, R);
    }

    function smartReply(text) {
      const clean = text.trim();
      const lang = detectLang(clean);
      lastLang = lang;

      // Plain math like "5+5"
      if (/^[0-9+\-*/().%\s]+$/.test(clean) && /\d/.test(clean) && /[+\-*/%]/.test(clean)) {
        lastIntent = "math";
        return calc(clean);
      }

      // "call me X" / "my name is X"
      const nameMatch = clean.match(/\b(?:call me|my name is|ako si|ako ni|akong ngalan|ang pangalan ko ay)\s+([A-Za-z][\w'-]{0,29})/i);
      if (nameMatch) {
        userName = nameMatch[1];
        saveSettings({ fcName: userName });
        updateGreeting();
        lastIntent = "setname";
        return {
          en: "Nice to meet you, " + userName + "! 😊",
          ceb: "Nalipay ko makaila nimo, " + userName + "! 😊",
          tl: "Nice to meet you, " + userName + "! 😊",
        }[lang];
      }

      // Short yes/no follow-up to the previous topic
      const isYes = /^(yes|yeah|yep|oo|opo|sure|ok|okay|sige|ya|yes po)[.!\s]*$/i.test(clean);
      const isNo = /^(no|nope|dili|hindi|ayaw|dili ko|hindi po)[.!\s]*$/i.test(clean);
      if (lastIntent && FOLLOWUPS[lastIntent]) {
        const f = FOLLOWUPS[lastIntent];
        if (isYes && f.yes) { lastIntent = "yes"; return f.yes[lang]; }
        if (isNo && f.no) { lastIntent = "no"; return f.no[lang]; }
      }
      if (isYes) { lastIntent = "yes"; return pick(GENERIC.yes[lang]); }
      if (isNo) { lastIntent = "no"; return pick(GENERIC.no[lang]); }

      // Keyword rules
      for (const rule of RULES) {
        if (rule.test.test(clean)) {
          lastIntent = rule.intent;
          return pick(rule.replies[lang] || rule.replies.en);
        }
      }

      // Unknown question: mirror the question back
      if (clean.endsWith("?")) {
        lastIntent = "question";
        return fill(pick(GENERIC.question[lang]), clean, lang);
      }

      // Short message vs longer statement: mirror what they said
      lastIntent = "other";
      const wordCount = clean.split(/\s+/).length;
      const short = clean.length > 60 ? clean.slice(0, 60) + "…" : clean;
      const bucket = wordCount <= 3 ? GENERIC.short : GENERIC.statement;
      return fill(pick(bucket[lang]), short, lang);
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, "user");
      beep(520, 70);
      input.value = "";
      emojiPanel.style.display = "none";

      if (text.startsWith("/")) return handleCommand(text);

      let reply = smartReply(text).replace(/\{name\}/g, userName);
      reply = mirrorEnergy(text, reply);
      botReply(reply, 500 + Math.min(reply.length * 12, 900));
    }

    // ----- Events -----
    btn.addEventListener("click", toggleChat);
    closeBtn.addEventListener("click", closeChat);
    sendBtn.addEventListener("click", sendMessage);

    // Stop websites from hijacking keys (YouTube, Gmail, etc.) while typing in the chat
    ["keydown", "keyup", "keypress"].forEach((evt) => {
      chatbox.addEventListener(evt, (e) => e.stopPropagation());
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });

    searchInput.addEventListener("input", () => filterMessages(searchInput.value));

    chatbox.querySelector("#fc-tool-emoji").addEventListener("click", toggleEmoji);
    chatbox.querySelector("#fc-tool-theme").addEventListener("click", toggleTheme);
    chatbox.querySelector("#fc-tool-font").addEventListener("click", cycleFont);
    chatbox.querySelector("#fc-tool-sound").addEventListener("click", toggleSound);
    chatbox.querySelector("#fc-tool-search").addEventListener("click", toggleSearch);
    chatbox.querySelector("#fc-tool-notes").addEventListener("click", showNotes);
    chatbox.querySelector("#fc-tool-copy").addEventListener("click", copyChat);
    chatbox.querySelector("#fc-tool-export").addEventListener("click", exportChat);
    chatbox.querySelector("#fc-tool-clear").addEventListener("click", clearChat);

    // ----- Init -----
    let initialized = false;
    function init(res) {
      if (initialized) return;
      initialized = true;
      userName = (res && res.fcName) || DEFAULT_NAME;
      darkMode = !!(res && res.fcDark);
      soundOn = res && typeof res.fcSound === "boolean" ? res.fcSound : true;
      fontSize = res && typeof res.fcFont === "number" ? res.fcFont : 1;
      notes = (res && Array.isArray(res.fcNotes)) ? res.fcNotes : [];
      updateGreeting();
      applyTheme();
      applyFont();
      applySound();
      welcome();
    }

    loadSettings(init);
    setTimeout(() => init({}), 1500);
  }
})();