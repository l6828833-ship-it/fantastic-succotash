import type { Express, Request, Response } from "express";
import * as db from "../db";
import { invokeLLM, type Message as LLMMessage } from "./llm";
import { createCustomerTicket } from "./ticketing";
import { requestBaseUrl, safeColor } from "./email";

// The embeddable widget runs on third-party websites, so these routes must be
// public (no auth) and CORS-enabled.
function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Remembers chat POSTs we've recently started processing, keyed by
// conversationId + message text. Browsers/proxies/extensions sometimes fire the
// exact same chat request twice (e.g. a retry of a slow LLM call). Without a
// guard each copy generates its OWN, different AI reply and the duplicate leaks
// in through the poll loop, so the bot looks like it "answers twice". This lets
// a duplicate wait for the first reply instead of generating a second one.
const recentWidgetChats = new Map<string, number>();

// Vanilla JS widget served at /widget/embed.js. Kept dependency-free and
// namespaced (cbp-) so it never clashes with the host page. No template
// literals / ${} are used inside so it can live safely in this TS string.
const WIDGET_JS = `(function(){
  if (window.__chatbotpro_loaded) return;
  window.__chatbotpro_loaded = true;

  var cfg = window.ChatBotProConfig || {};
  var apiBase = String(cfg.apiBase || "").replace(/\\/$/, "");
  var agentId = cfg.agentId;
  if (!agentId || !apiBase) { console.error("[ChatBotPro] Missing agentId or apiBase in ChatBotProConfig"); return; }

  // window.ChatBotProConfig only supplies FALLBACK DEFAULTS. The agent's saved
  // settings are fetched from the API below and always take priority, so any
  // change made in the dashboard (position, theme, color, size) propagates to
  // every embedded widget automatically without re-copying the snippet.
  var sizeMap = { compact: 320, standard: 372, large: 420 };
  var settings = {
    color: cfg.color || "#6366f1",
    position: cfg.position === "bottom-left" ? "bottom-left" : "bottom-right",
    size: sizeMap[cfg.size] ? cfg.size : "standard",
    theme: cfg.theme === "dark" ? "dark" : "light",
    font: cfg.font || "Inter"
  };

  // Derived style values — (re)computed by applySettings().
  var color, side, dark, panelW, bg, fg, sub, border, fontStack, fgOn;

  var storeKey = "chatbotpro_conv_" + agentId;
  var leadStoreKey = "chatbotpro_lead_" + agentId;
  var seenKey = "chatbotpro_seen_" + agentId;
  var conversationId = null;
  try { conversationId = localStorage.getItem(storeKey); } catch (e) {}

  // Polling state so human-agent replies (sent from the Inbox after a handoff)
  // appear in the widget. lastMsgId tracks the highest message id we've shown.
  var lastMsgId = 0;
  try { lastMsgId = Number(localStorage.getItem(seenKey)) || 0; } catch (e) {}
  var pollTimer = null;
  var humanNoticeShown = false;

  // Session lifetime. If the visitor returns within 10 minutes we resume the
  // same conversation; after that we start a fresh chat with the welcome message
  // so they're not dropped back into a stale thread.
  var lastActivityKey = "chatbotpro_last_" + agentId;
  var SESSION_TIMEOUT_MS = 10 * 60 * 1000;
  function touchSession(){ try { localStorage.setItem(lastActivityKey, String(Date.now())); } catch (e) {} }
  (function(){
    try {
      var last = Number(localStorage.getItem(lastActivityKey)) || 0;
      if (conversationId && last && (Date.now() - last) > SESSION_TIMEOUT_MS){
        // Expired — forget the old conversation so the next open greets fresh.
        conversationId = null; lastMsgId = 0;
        try { localStorage.removeItem(storeKey); localStorage.removeItem(seenKey); } catch (e) {}
      }
    } catch (e) {}
  })();

  var open = false;
  var loading = false;
  var greeted = false;
  var agentName = "Assistant";
  var welcome = "Hi! How can I help you today?";

  // Lead capture + readiness state. configLoaded flips true once the agent
  // config request settles so the open flow knows whether to greet or first
  // show the lead form.
  var configLoaded = false;
  var leadRequired = false;
  // A lead is only "done" once the visitor actually SUBMITTED the form. We track
  // that with its own localStorage flag — NOT the presence of a conversation id,
  // because a conversation may already exist from before lead capture was turned
  // on (which would otherwise wrongly skip the form for returning testers).
  var leadDone = false;
  try { leadDone = localStorage.getItem(leadStoreKey) === "1"; } catch (e) {}
  var leadForm = null;

  // Ticket capture: "off" | "always" | "ai_fallback". The header ticket button
  // appears from the start in "always", and after the AI can't help in
  // "ai_fallback".
  var ticketMode = (cfg.ticketMode === "always" || cfg.ticketMode === "ai_fallback") ? cfg.ticketMode : "off";
  // How long to wait for a human before offering a ticket (ai_fallback mode).
  var ticketDelaySeconds = Number(cfg.ticketDelaySeconds) || 0;
  var ticketForm = null;
  var ticketOffered = false;
  // Set true once a human/agent reply arrives via polling — cancels any pending
  // ticket offer because someone IS available.
  var humanReplied = false;
  var ticketTimer = null;

  // Launcher icon presets. The default "chat" icon is available on every plan;
  // the rest are premium and require a paid plan. Values are filled SVGs (the
  // launcher CSS paints them white).
  var ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1L4 21l4-1.6c1.2.4 2.6.6 4 .6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>',
    message: '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm1.8-6.3l-.9.9c-.6.6-.9 1.1-.9 2.4h-2v-.5c0-1 .4-1.9 1.1-2.6l1.2-1.2c.4-.4.6-.9.6-1.4a2 2 0 0 0-4 0H8a4 4 0 0 1 8 0c0 .8-.3 1.5-.9 2.1z"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-5l-1.6-1.6V11a5.4 5.4 0 0 0-4-5.2V5a1.4 1.4 0 0 0-2.8 0v.8A5.4 5.4 0 0 0 6.6 11v4.4L5 17v1h14v-1z"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1z"/></svg>',
    zap: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
  };
  var FREE_ICON = "chat";
  var PREMIUM_ICONS = { message: 1, help: 1, sparkles: 1, bell: 1, phone: 1, zap: 1, heart: 1 };

  function launcherMarkup(iconId, plan){
    var id = iconId || FREE_ICON;
    // Allow an uploaded image URL too.
    if (/^(https?:)?\\/\\//.test(id) || id.charAt(0) === "/") {
      return '<img src="' + id + '" alt="">';
    }
    var paid = plan && plan !== "free";
    if (!ICONS[id]) id = FREE_ICON;
    if (PREMIUM_ICONS[id] && !paid) id = FREE_ICON; // enforce gating on the widget too
    return ICONS[id];
  }

  // Pick a readable text/icon color (#fff or near-black) for content placed on
  // top of the brand color, so even light primary colors stay legible instead
  // of rendering white-on-white. Keeps the dashboard color applied literally.
  function contrastOn(hex){
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length < 6) return "#ffffff";
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "#ffffff";
    var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.62 ? "#111827" : "#ffffff";
  }

  function buildCss(){
    return ""
      + ".cbp-launcher{position:fixed;bottom:20px;" + side + ":20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}"
      + ".cbp-launcher:hover{transform:scale(1.06);}"
      + ".cbp-launcher svg{width:26px;height:26px;fill:" + fgOn + ";}"
      + ".cbp-launcher img{width:30px;height:30px;border-radius:8px;object-fit:cover;}"
      + ".cbp-panel{position:fixed;bottom:88px;" + side + ":20px;width:" + panelW + "px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);background:" + bg + ";color:" + fg + ";border:1px solid " + border + ";border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font-family:" + fontStack + ";}"
      + ".cbp-panel.cbp-open{display:flex;}"
      + ".cbp-head{padding:14px 16px;color:" + fgOn + ";display:flex;align-items:center;gap:10px;}"
      + ".cbp-head .cbp-av{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;overflow:hidden;}"
      + ".cbp-head .cbp-av img{width:100%;height:100%;object-fit:cover;}"
      + ".cbp-head .cbp-name{font-weight:600;font-size:15px;}"
      + ".cbp-head .cbp-x{margin-left:auto;background:none;border:none;color:" + fgOn + ";cursor:pointer;font-size:20px;line-height:1;opacity:.85;}"
      + ".cbp-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:" + (dark ? "#0b0b12" : "#fafafa") + ";}"
      + ".cbp-msg{max-width:80%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}"
      + ".cbp-bot{align-self:flex-start;background:" + sub + ";color:" + fg + ";border-bottom-left-radius:4px;}"
      + ".cbp-user{align-self:flex-end;color:" + fgOn + ";border-bottom-right-radius:4px;}"
      + ".cbp-foot{border-top:1px solid " + border + ";padding:10px;display:flex;gap:8px;background:" + bg + ";}"
      + ".cbp-foot input{flex:1;border:1px solid " + border + ";background:" + bg + ";color:" + fg + ";border-radius:10px;padding:10px 12px;font-size:14px;outline:none;}"
      + ".cbp-foot button{border:none;border-radius:50%;color:" + fgOn + ";width:42px;height:42px;flex:0 0 auto;cursor:pointer;display:flex;align-items:center;justify-content:center;}"
      + ".cbp-foot button:disabled{opacity:.5;cursor:default;}"
      + ".cbp-foot button svg{width:18px;height:18px;fill:" + fgOn + ";}"
      + ".cbp-typing{display:flex;gap:4px;padding:4px 2px;}"
      + ".cbp-typing span{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:cbpb 1s infinite;}"
      + ".cbp-typing span:nth-child(2){animation-delay:.15s;}.cbp-typing span:nth-child(3){animation-delay:.3s;}"
      + "@keyframes cbpb{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}"
      + ".cbp-foot{align-items:center;}"
      + ".cbp-lead{padding:18px;display:flex;flex-direction:column;gap:12px;}"
      + ".cbp-lead h4{margin:0;font-size:15px;font-weight:600;color:" + fg + ";}"
      + ".cbp-lead p{margin:0 0 2px;font-size:13px;color:" + (dark ? "#9ca3af" : "#6b7280") + ";}"
      + ".cbp-lead label{font-size:12px;font-weight:600;color:" + fg + ";display:block;margin-bottom:4px;}"
      + ".cbp-lead input{width:100%;box-sizing:border-box;border:1px solid " + border + ";background:" + bg + ";color:" + fg + ";border-radius:10px;padding:10px 12px;font-size:14px;outline:none;}"
      + ".cbp-lead .cbp-start{border:none;border-radius:10px;color:" + fgOn + ";padding:11px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;}"
      + ".cbp-lead .cbp-start:disabled{opacity:.6;cursor:default;}"
      + ".cbp-lead .cbp-err{color:#ef4444;font-size:12px;min-height:14px;}"
      + ".cbp-head .cbp-ticket{margin-left:auto;background:none;border:none;color:" + fgOn + ";cursor:pointer;opacity:.9;display:flex;align-items:center;justify-content:center;padding:0;}"
      + ".cbp-head .cbp-ticket:hover{opacity:1;}"
      + ".cbp-head .cbp-ticket svg{height:16px;width:auto;fill:" + fgOn + ";}"
      + ".cbp-offer-btn{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;border:none;border-radius:10px;color:" + fgOn + ";padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.12);}"
      + ".cbp-offer-btn:hover{filter:brightness(1.06);}"
      + ".cbp-offer-btn svg{height:14px;width:auto;fill:" + fgOn + ";}"
      + ".cbp-lead textarea{width:100%;box-sizing:border-box;border:1px solid " + border + ";background:" + bg + ";color:" + fg + ";border-radius:10px;padding:10px 12px;font-size:14px;outline:none;resize:vertical;min-height:84px;font-family:inherit;}";
  }

  // Recompute every visual value from the current settings and repaint. Safe to
  // call repeatedly — used once with the config fallbacks and again once the API
  // returns the authoritative agent settings.
  function applySettings(){
    color = settings.color || "#6366f1";
    fgOn = contrastOn(color);
    side = settings.position === "bottom-left" ? "left" : "right";
    dark = settings.theme === "dark";
    panelW = sizeMap[settings.size] || 372;
    bg = dark ? "#0b0b12" : "#ffffff";
    fg = dark ? "#e5e7eb" : "#111827";
    sub = dark ? "#1c1c28" : "#f3f4f6";
    border = dark ? "#26263a" : "#e5e7eb";
    fontStack = "'" + (settings.font || "Inter") + "',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    style.textContent = buildCss();
    launcher.style.background = color;
    head.style.background = color;
    sendBtn.style.background = color;
    // Re-tint any messages already rendered with the previous color.
    var users = body.querySelectorAll(".cbp-user");
    for (var i = 0; i < users.length; i++) { users[i].style.background = color; }
  }

  var style = document.createElement("style");
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.className = "cbp-launcher";
  launcher.setAttribute("aria-label", "Open chat");
  launcher.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1L4 21l4-1.6c1.2.4 2.6.6 4 .6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>';

  var panel = document.createElement("div");
  panel.className = "cbp-panel";

  var head = document.createElement("div");
  head.className = "cbp-head";
  var avatar = document.createElement("div");
  avatar.className = "cbp-av";
  avatar.textContent = "A";
  var nameEl = document.createElement("div");
  nameEl.className = "cbp-name";
  nameEl.textContent = agentName;
  var closeBtn = document.createElement("button");
  closeBtn.className = "cbp-x";
  closeBtn.innerHTML = "&times;";
  // Clean, modern ticket icon (no hardcoded fill, so it inherits the adaptive
  // fgOn color set via CSS — i.e. it follows the chat's color/theme).
  var TICKET_SVG = '<svg viewBox="0 -4 40 40"><path d="M39.5 23h0.5v1c-0.299 0-0.628 0-1 0-1.104 0-2 0.896-2 2 0 0.366 0 0.705 0 1h-34c0-0.295 0-0.634 0-1 0-1.104-0.896-2-2-2-0.319 0-0.666 0-1 0v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1h0.5c0.276 0 0.5-0.224 0.5-0.5s-0.224-0.5-0.5-0.5h-0.5v-1c0.299 0 0.628 0 1 0 1.104 0 2-0.896 2-2 0-0.366 0-0.705 0-1h34c0 0.295 0 0.634 0 1 0 1.104 0.896 2 2 2 0.372 0 0.701 0 1 0v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5h0.5v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5h0.5v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5h0.5v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5h0.5v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5h0.5v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5h0.5v1h-0.5c-0.276 0-0.5 0.224-0.5 0.5s0.224 0.5 0.5 0.5zM36 11c0-1.104-0.896-2-2-2h-28c-1.104 0-2 0.896-2 2v11c0 1.104 0.896 2 2 2h28c1.104 0 2-0.896 2-2v-11zM34 23h-28c-0.553 0-1-0.448-1-1v-11c0-0.553 0.447-1 1-1h28c0.552 0 1 0.447 1 1v11c0 0.552-0.448 1-1 1zM11.387 13.988h-3.973v0.59h1.652v4.422h0.664v-4.422h1.656v-0.59zM12.768 13.988h-0.664v5.012h0.664v-5.012zM14.759 15.49c0.104-0.312 0.287-0.56 0.546-0.744 0.258-0.185 0.58-0.277 0.965-0.277 0.335 0 0.613 0.083 0.834 0.25 0.222 0.166 0.39 0.432 0.506 0.797l0.652-0.154c-0.134-0.462-0.372-0.821-0.714-1.076s-0.764-0.383-1.265-0.383c-0.442 0-0.847 0.101-1.215 0.303s-0.651 0.497-0.852 0.886c-0.199 0.389-0.299 0.844-0.299 1.365 0 0.479 0.089 0.927 0.266 1.344s0.434 0.736 0.771 0.956c0.339 0.22 0.778 0.33 1.318 0.33 0.521 0 0.963-0.143 1.324-0.429s0.611-0.701 0.75-1.246l-0.664-0.168c-0.091 0.422-0.266 0.74-0.522 0.955-0.258 0.214-0.571 0.321-0.943 0.321-0.305 0-0.589-0.079-0.851-0.236s-0.455-0.395-0.579-0.713-0.187-0.69-0.187-1.117c0.002-0.332 0.054-0.653 0.159-0.964zM23.363 13.988h-0.898l-2.488 2.48v-2.48h-0.664v5.012h0.664v-1.738l0.822-0.795 1.783 2.533h0.875l-2.195-2.98 2.101-2.032zM27.938 18.41h-3.074v-1.707h2.77v-0.59h-2.77v-1.535h2.957v-0.59h-3.621v5.012h3.738v-0.59zM32.625 13.988h-3.973v0.59h1.652v4.422h0.664v-4.422h1.656v-0.59z"/></svg>';
  var ticketBtn = document.createElement("button");
  ticketBtn.className = "cbp-ticket";
  ticketBtn.setAttribute("title", "Open a ticket");
  ticketBtn.style.display = "none";
  ticketBtn.innerHTML = TICKET_SVG;
  closeBtn.style.marginLeft = "4px";
  head.appendChild(avatar);
  head.appendChild(nameEl);
  head.appendChild(ticketBtn);
  head.appendChild(closeBtn);

  var body = document.createElement("div");
  body.className = "cbp-body";

  var foot = document.createElement("div");
  foot.className = "cbp-foot";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type a message...";
  var sendBtn = document.createElement("button");
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .65.65 1.1 1.39.91z"/></svg>';
  foot.appendChild(input);
  foot.appendChild(sendBtn);

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(foot);

  // Paint once with the config fallbacks so the launcher shows immediately.
  applySettings();
  // Keep the message input hidden until the open flow runs, so a visitor can't
  // start chatting before we know whether a lead form must be shown first.
  foot.style.display = "none";

  function addMsg(role, text){
    var d = document.createElement("div");
    d.className = "cbp-msg " + (role === "user" ? "cbp-user" : "cbp-bot");
    if (role === "user") d.style.background = color;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }

  function showTyping(){
    var d = document.createElement("div");
    d.className = "cbp-msg cbp-bot";
    d.innerHTML = '<div class="cbp-typing"><span></span><span></span><span></span></div>';
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }

  function bumpSeen(id){
    if (Number(id) > lastMsgId){ lastMsgId = Number(id); try { localStorage.setItem(seenKey, String(lastMsgId)); } catch(e){} }
  }

  function renderIncoming(list){
    for (var i = 0; i < list.length; i++){
      var m = list[i];
      if (Number(m.id) <= lastMsgId) continue;
      bumpSeen(m.id);
      // A human agent replied from the Inbox — someone IS available, so cancel
      // any pending ticket offer.
      if (m.role === "agent"){
        humanReplied = true;
        if (ticketTimer){ clearTimeout(ticketTimer); ticketTimer = null; }
      }
      addMsg("bot", m.content || "");
    }
  }

  // Reveal the ticket button without posting a message (caller handles messaging).
  function revealTicketButton(){
    ticketOffered = true;
    ticketBtn.style.display = "flex";
  }

  // Show a clickable "Open a ticket" button inside the chat. The visitor taps it
  // to reveal the ticket form — we never force the form open. Optional text is
  // shown as a short bot line above the button.
  function addTicketOffer(text){
    if (text){ addMsg("bot", text); }
    var b = document.createElement("button");
    b.className = "cbp-offer-btn";
    b.style.background = color;
    b.innerHTML = TICKET_SVG + "<span>Open a ticket</span>";
    b.addEventListener("click", function(){ showTicketForm(); });
    body.appendChild(b);
    body.scrollTop = body.scrollHeight;
  }

  // Reveal the ticket option now (used immediately or after the wait timer).
  function offerTicketNow(){
    if (ticketOffered || humanReplied) return;
    revealTicketButton();
    addTicketOffer("For this one it's best to open a ticket \u2014 a support specialist will get back to you by email.");
  }

  // Offer a ticket after ticketDelaySeconds, unless a human replies first.
  function scheduleTicketOffer(){
    if (ticketOffered || humanReplied || ticketTimer) return;
    var ms = (ticketDelaySeconds > 0 ? ticketDelaySeconds : 0) * 1000;
    if (ms <= 0){ offerTicketNow(); return; }
    ticketTimer = setTimeout(function(){ ticketTimer = null; offerTicketNow(); }, ms);
  }

  function poll(){
    if (!conversationId) return;
    fetch(apiBase + "/widget/messages?agentId=" + encodeURIComponent(agentId) + "&conversationId=" + encodeURIComponent(conversationId) + "&after=" + lastMsgId)
      .then(function(r){ return r.json(); })
      .then(function(d){ if (d && d.messages && d.messages.length) renderIncoming(d.messages); })
      .catch(function(){});
  }

  function ensurePolling(){
    if (pollTimer || !conversationId) return;
    if (leadRequired && !leadDone) return; // wait until the lead form is done
    poll();
    pollTimer = setInterval(poll, 4000);
  }

  function stopPolling(){ if (pollTimer){ clearInterval(pollTimer); pollTimer = null; } }

  function openFlow(){
    if (!open || !configLoaded) return;
    if (leadRequired && !leadDone){ showLeadForm(); return; }
    foot.style.display = "flex"; // lead not required (or already captured) — allow chatting
    if (!greeted){
      greeted = true;
      touchSession();
      // Returning visitor with an existing conversation → replay the thread so
      // they continue where they left off (and see the agent's messages first),
      // instead of starting from zero. New visitors get the welcome message.
      if (conversationId){ loadHistory(); }
      else { addMsg("bot", welcome); }
      input.focus();
    }
    ensurePolling();
  }

  // Fetch and render the full conversation thread for a returning visitor.
  function loadHistory(){
    fetch(apiBase + "/widget/messages?agentId=" + encodeURIComponent(agentId) + "&conversationId=" + encodeURIComponent(conversationId) + "&history=1")
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.messages && d.messages.length){
          for (var i = 0; i < d.messages.length; i++){
            var m = d.messages[i];
            addMsg(m.role === "user" ? "user" : "bot", m.content || "");
            bumpSeen(m.id);
          }
        } else {
          addMsg("bot", welcome);
        }
      })
      .catch(function(){ addMsg("bot", welcome); });
  }

  function showLeadForm(){
    foot.style.display = "none";
    if (leadForm){ return; }
    leadForm = document.createElement("div");
    leadForm.className = "cbp-lead";
    var title = document.createElement("h4");
    title.textContent = "Before we start";
    var desc = document.createElement("p");
    desc.textContent = "Please share your details so we can assist you better.";
    var nameWrap = document.createElement("div");
    var nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    var leadName = document.createElement("input");
    leadName.type = "text";
    leadName.placeholder = "Your name";
    nameWrap.appendChild(nameLabel);
    nameWrap.appendChild(leadName);
    var emailWrap = document.createElement("div");
    var emailLabel = document.createElement("label");
    emailLabel.textContent = "Email";
    var leadEmail = document.createElement("input");
    leadEmail.type = "email";
    leadEmail.placeholder = "you@example.com";
    emailWrap.appendChild(emailLabel);
    emailWrap.appendChild(leadEmail);
    var err = document.createElement("div");
    err.className = "cbp-err";
    var startBtn = document.createElement("button");
    startBtn.className = "cbp-start";
    startBtn.style.background = color;
    startBtn.textContent = "Start chat";

    function submitLead(){
      var nm = (leadName.value || "").trim();
      var em = (leadEmail.value || "").trim();
      if (!nm){ err.textContent = "Please enter your name."; leadName.focus(); return; }
      if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(em)){ err.textContent = "Please enter a valid email."; leadEmail.focus(); return; }
      err.textContent = "";
      startBtn.disabled = true; startBtn.textContent = "Starting...";
      fetch(apiBase + "/widget/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentId, conversationId: conversationId, name: nm, email: em })
      }).then(function(r){ return r.json(); }).then(function(d){
        if (d && d.conversationId){ conversationId = String(d.conversationId); try { localStorage.setItem(storeKey, conversationId); } catch(e){} }
      }).catch(function(){}).then(function(){
        leadDone = true;
        try { localStorage.setItem(leadStoreKey, "1"); } catch(e){}
        if (leadForm && leadForm.parentNode){ leadForm.parentNode.removeChild(leadForm); }
        leadForm = null;
        foot.style.display = "flex";
        if (!greeted){ greeted = true; addMsg("bot", welcome); }
        input.focus();
        ensurePolling();
      });
    }

    startBtn.addEventListener("click", submitLead);
    leadEmail.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); submitLead(); } });

    leadForm.appendChild(title);
    leadForm.appendChild(desc);
    leadForm.appendChild(nameWrap);
    leadForm.appendChild(emailWrap);
    leadForm.appendChild(err);
    leadForm.appendChild(startBtn);
    body.appendChild(leadForm);
    leadName.focus();
  }

  function showTicketForm(){
    if (ticketForm) return;
    foot.style.display = "none";
    ticketForm = document.createElement("div");
    ticketForm.className = "cbp-lead";
    var title = document.createElement("h4"); title.textContent = "Open a support ticket";
    var desc = document.createElement("p"); desc.textContent = "Tell us what you need and we'll get back to you by email.";
    function field(labelText, el){ var w = document.createElement("div"); var l = document.createElement("label"); l.textContent = labelText; w.appendChild(l); w.appendChild(el); return w; }
    var nm = document.createElement("input"); nm.type = "text"; nm.placeholder = "Your name";
    var em = document.createElement("input"); em.type = "email"; em.placeholder = "you@example.com";
    var subj = document.createElement("input"); subj.type = "text"; subj.placeholder = "Subject";
    var msg = document.createElement("textarea"); msg.placeholder = "Describe your issue...";
    var err = document.createElement("div"); err.className = "cbp-err";
    var submit = document.createElement("button"); submit.className = "cbp-start"; submit.style.background = color; submit.textContent = "Submit ticket";
    var cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText = "background:none;border:none;color:" + (dark ? "#9ca3af" : "#6b7280") + ";font-size:13px;cursor:pointer;";

    function close(){ if (ticketForm && ticketForm.parentNode) ticketForm.parentNode.removeChild(ticketForm); ticketForm = null; foot.style.display = "flex"; }
    cancel.addEventListener("click", close);
    submit.addEventListener("click", function(){
      var s = (subj.value || "").trim();
      var m = (msg.value || "").trim();
      var e = (em.value || "").trim();
      if (!s || !m){ err.textContent = "Please add a subject and a message."; return; }
      if (e && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(e)){ err.textContent = "Please enter a valid email."; return; }
      err.textContent = ""; submit.disabled = true; submit.textContent = "Submitting...";
      fetch(apiBase + "/widget/ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentId, conversationId: conversationId, name: (nm.value || "").trim(), email: e, subject: s, message: m })
      }).then(function(r){ return r.json(); }).then(function(d){
        if (d && d.ok){ close(); addMsg("bot", "Thanks! Your ticket has been created" + (e ? " — we'll reply to " + e : "") + "."); }
        else { err.textContent = (d && d.error) ? d.error : "Could not create your ticket."; submit.disabled = false; submit.textContent = "Submit ticket"; }
      }).catch(function(){ err.textContent = "Could not reach the server."; submit.disabled = false; submit.textContent = "Submit ticket"; });
    });

    ticketForm.appendChild(title); ticketForm.appendChild(desc);
    ticketForm.appendChild(field("Name", nm)); ticketForm.appendChild(field("Email", em));
    ticketForm.appendChild(field("Subject", subj)); ticketForm.appendChild(field("Message", msg));
    ticketForm.appendChild(err); ticketForm.appendChild(submit); ticketForm.appendChild(cancel);
    body.appendChild(ticketForm);
    subj.focus();
  }

  function toggle(){
    open = !open;
    panel.className = "cbp-panel" + (open ? " cbp-open" : "");
    if (open){ openFlow(); ensurePolling(); } else { stopPolling(); }
  }

  function send(){
    var text = (input.value || "").trim();
    if (!text || loading) return;
    touchSession();
    input.value = "";
    addMsg("user", text);
    loading = true; sendBtn.disabled = true;
    var typing = showTyping();
    fetch(apiBase + "/widget/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: agentId, message: text, conversationId: conversationId })
    }).then(function(r){ return r.json(); }).then(function(data){
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      if (data && data.conversationId){ conversationId = String(data.conversationId); try { localStorage.setItem(storeKey, conversationId); } catch(e){} }
      // Advance the seen marker past the messages the server just created so the
      // poll loop doesn't render the same AI reply twice.
      if (data && data.userMessageId) bumpSeen(data.userMessageId);
      if (data && data.messageId) bumpSeen(data.messageId);
      if (data && data.mode === "human"){
        var notice = data.escalationMessage || null;
        // The handoff notice is persisted server-side; skip it in polling so it
        // isn't shown twice.
        if (data.escalationMessageId) bumpSeen(data.escalationMessageId);
        if (data.humanAvailable === false){
          // No human online right now — show the offline message and offer a
          // ticket, NOT the "connecting you to our team" escalation notice.
          if (!humanNoticeShown){ humanNoticeShown = true; addMsg("bot", data.offlineMessage || "For this one it's best to open a ticket \u2014 a support specialist will get back to you by email."); }
          // Give the visitor an easy in-chat button to open the ticket form —
          // shown on each handoff answer, not just the first one.
          if (ticketMode !== "off"){ revealTicketButton(); addTicketOffer(null); }
        } else {
          // A human will answer from the Inbox; their reply arrives via polling.
          if (!humanNoticeShown){ humanNoticeShown = true; addMsg("bot", notice || "You're connected to our team — someone will reply right here shortly."); }
          else if (notice){ addMsg("bot", notice); }
          // If no human replies within the wait window, offer a ticket.
          if (ticketMode === "ai_fallback"){ scheduleTicketOffer(); }
        }
      } else if (data && data.reply){
        addMsg("bot", data.reply);
        // In ai_fallback mode, offer a ticket when the AI couldn't answer. If no
        // human is online, offer it right away; otherwise wait the configured
        // window so a teammate can still jump in first.
        if (ticketMode === "ai_fallback" && data.fallback){
          if (data.humanAvailable === false){
            // The AI's reply already invited them to open a ticket — in the
            // visitor's own language — so just reveal the button, without adding
            // a separate (English) banner on top of it. Show it on EVERY handoff
            // answer (not only the first) so the button is always right under the
            // relevant message; only skip if a human has taken over the chat.
            if (!humanReplied){ revealTicketButton(); addTicketOffer(null); }
          }
          else { scheduleTicketOffer(); }
        }
      } else {
        addMsg("bot", "Sorry, something went wrong. Please try again.");
      }
      ensurePolling();
    }).catch(function(){
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      addMsg("bot", "Sorry, I couldn't reach the server. Please try again.");
    }).then(function(){ loading = false; sendBtn.disabled = false; input.focus(); });
  }

  launcher.addEventListener("click", toggle);
  closeBtn.addEventListener("click", toggle);
  ticketBtn.addEventListener("click", showTicketForm);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); send(); } });

  // Fetch the agent's saved settings from the API. These are AUTHORITATIVE:
  // position, theme, size and color from the dashboard override the local
  // ChatBotProConfig fallbacks, then we repaint so changes apply everywhere.
  fetch(apiBase + "/widget/agent/" + agentId).then(function(r){ return r.json(); }).then(function(a){
    if (!a || a.error) return;
    if (a.name){ agentName = a.name; nameEl.textContent = a.name; avatar.textContent = a.name.charAt(0).toUpperCase(); }
    if (a.welcomeMessage) welcome = a.welcomeMessage;
    if (a.color) settings.color = a.color;
    if (a.position) settings.position = a.position === "bottom-left" ? "bottom-left" : "bottom-right";
    if (a.size && sizeMap[a.size]) settings.size = a.size;
    if (a.theme) settings.theme = a.theme === "dark" ? "dark" : "light";
    if (a.font) settings.font = a.font;
    applySettings();
    if (a.avatarUrl){ avatar.innerHTML = '<img src="' + a.avatarUrl + '" alt="">'; }
    // Launcher icon (preset id or uploaded URL), gated by the workspace plan.
    launcher.innerHTML = launcherMarkup(a.launcherIcon, a.plan);
    leadRequired = !!a.leadCapture;
    if (a.ticketMode === "always" || a.ticketMode === "ai_fallback") ticketMode = a.ticketMode;
    if (typeof a.ticketDelaySeconds === "number") ticketDelaySeconds = a.ticketDelaySeconds;
    if (ticketMode === "always") ticketBtn.style.display = "flex";
  }).catch(function(){}).then(function(){
    // Always mark config resolved so the open flow can proceed (greet or lead).
    configLoaded = true;
    if (open) openFlow();
  });

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
})();`;

// Evaluate whether a visitor message should trigger escalation to a human, for
// agents in "ai_first_human_escalation" mode. The trigger labels match the ones
// shown in Agent Settings (AgentEdit ESCALATION_TRIGGERS).
function shouldEscalate(message: string, userMessageCount: number, triggers: string[] | null | undefined): boolean {
  if (!triggers || triggers.length === 0) return false;
  const m = String(message || "").toLowerCase();
  const has = (label: string) => triggers.includes(label);

  if (has("Customer requests human agent") &&
    /\b(human|real person|live (agent|person|chat)|speak (to|with) (a |an )?(human|person|someone|agent|representative)|talk (to|with) (a |an )?(human|person|someone|agent|representative)|customer (service|support)|representative|operator|agent)\b/.test(m)) {
    return true;
  }
  if (has("Complaint or refund request") &&
    /\b(refund|money back|charge ?back|reimburse|complaint|complain|cancel my (order|subscription|account))\b/.test(m)) {
    return true;
  }
  if (has("Technical issue reported") &&
    /\b(error|bug|broken|not working|doesn'?t work|won'?t work|crash|glitch|can'?t (log ?in|login|access|sign in))\b/.test(m)) {
    return true;
  }
  if (has("Negative sentiment detected") &&
    /\b(angry|furious|terrible|awful|worst|horrible|frustrat|disappointed|unacceptable|ridiculous|useless|scam)\b/.test(m)) {
    return true;
  }
  if (has("Issue unresolved after 3 messages") && userMessageCount >= 3) {
    return true;
  }
  // "High-value customer detected" has no signal available from the widget alone.
  return false;
}

// Resolve a public widget identifier to an agent. New embeds use the agent's
// unguessable publicId token; we still accept the legacy numeric id so existing
// installs keep working.
async function resolveWidgetAgent(idParam: unknown) {
  const s = String(idParam ?? "").trim();
  if (!s) return undefined;
  const byToken = await db.getAgentByPublicId(s);
  if (byToken) return byToken;
  if (/^\d+$/.test(s)) return db.getAgentById(Number(s));
  return undefined;
}

export function registerWidgetRoutes(app: Express) {
  // The widget loader script.
  app.get("/widget/embed.js", (_req: Request, res: Response) => {
    setCors(res);
    res.type("application/javascript");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(WIDGET_JS);
  });

  // Public agent config for the widget.
  app.get("/api/widget/agent/:id", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const agent = await resolveWidgetAgent(req.params.id);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      // The workspace plan gates which launcher icons are allowed (free plan
      // can only use the default chat icon; premium icons need a paid plan).
      const workspace = await db.getWorkspaceById(agent.workspaceId);
      res.json({
        id: agent.publicId ?? String(agent.id),
        name: agent.name,
        welcomeMessage: agent.welcomeMessage ?? "Hi! How can I help you today?",
        // Serve the agent's literal saved color so the dashboard color always
        // applies on the widget. (We don't luminance-clamp it like emails do —
        // the widget computes a readable icon/text color from it client-side.)
        color: safeColor(agent.widgetColor) ?? "#6366f1",
        position: agent.widgetPosition ?? "bottom-right",
        size: agent.widgetSize ?? "standard",
        theme: agent.widgetTheme ?? "light",
        font: agent.widgetFont ?? "Inter",
        avatarUrl: agent.avatarUrl ?? null,
        launcherIcon: agent.launcherIconUrl ?? "chat",
        leadCapture: agent.leadCaptureEnabled ?? false,
        leadFields: (agent.leadCaptureFields && agent.leadCaptureFields.length > 0) ? agent.leadCaptureFields : ["name", "email"],
        ticketMode: agent.ticketMode ?? "off",
        ticketDelaySeconds: agent.ticketDelaySeconds ?? 0,
        plan: workspace?.plan ?? "free",
        isActive: agent.isActive ?? true,
      });
    } catch (error) {
      console.error("[Widget] agent config failed", error);
      res.status(500).json({ error: "Failed to load agent" });
    }
  });

  app.options("/api/widget/lead", (_req: Request, res: Response) => {
    setCors(res);
    res.sendStatus(204);
  });

  // Public lead-capture endpoint. Called by the widget before the conversation
  // starts when lead capture is enabled. Records the visitor's name/email on the
  // conversation and upserts a workspace contact so it shows up in the CRM/inbox.
  app.post("/api/widget/lead", async (req: Request, res: Response) => {
    setCors(res);
    const fallbackConversationId =
      req.body && (req.body as { conversationId?: string | number }).conversationId != null
        ? Number((req.body as { conversationId?: string | number }).conversationId)
        : null;
    try {
      const body = (req.body ?? {}) as { agentId?: string | number; conversationId?: string | number; name?: string; email?: string };
      const name = String(body.name ?? "").trim().slice(0, 200);
      const email = String(body.email ?? "").trim().slice(0, 320);

      const agent = await resolveWidgetAgent(body.agentId);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      if (!name && !email) {
        res.status(400).json({ error: "at least one of name/email is required" });
        return;
      }

      // Reuse the existing conversation if one was already started, otherwise
      // create a fresh one pre-populated with the visitor details.
      let conversationId = body.conversationId ? Number(body.conversationId) : null;
      let conv = conversationId ? await db.getConversationById(conversationId) : undefined;
      if (!conv || conv.workspaceId !== agent.workspaceId) conv = undefined;
      if (!conv) {
        conv = await db.createConversation({
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          channel: "web",
          visitorId: `widget_${Date.now()}`,
          visitorName: name || null,
          visitorEmail: email || null,
        });
        // New lead/conversation — notify the team for the Inbox/bell badge.
        try {
          const owner = await db.getWorkspaceById(agent.workspaceId);
          if (owner && conv?.id) {
            await db.createNotification({
              workspaceId: agent.workspaceId,
              userId: owner.userId,
              type: "new_conversation",
              title: "New conversation",
              body: `New chat from ${name || email || "a visitor"}`,
              relatedId: conv.id,
              relatedType: "conversation",
            });
          }
        } catch (e) { console.error("[Widget] new lead notify failed", e); }
      } else {
        await db.updateConversation(conv.id, {
          visitorName: name || conv.visitorName,
          visitorEmail: email || conv.visitorEmail,
        });
      }
      conversationId = conv?.id ?? null;

      // Upsert a contact (deduped by email within the workspace), respecting the
      // workspace's plan contact limit for brand-new contacts.
      if (email) {
        const existing = await db.findContactByEmail(agent.workspaceId, email);
        if (existing) {
          await db.updateContact(existing.id, { name: name || existing.name, lastSeenAt: new Date() });
        } else {
          const ws = await db.getWorkspaceById(agent.workspaceId);
          const limit = db.contactLimitForPlan(ws?.plan);
          const underLimit = !Number.isFinite(limit) || (await db.countContactsByWorkspace(agent.workspaceId)) < limit;
          if (underLimit) {
            await db.createContact({ workspaceId: agent.workspaceId, name: name || null, email, channel: "web", lastSeenAt: new Date() });
          }
          // At the limit: skip storing the contact, but the chat still works.
        }
      }

      res.json({ conversationId });
    } catch (error) {
      console.error("[Widget] lead capture failed", error);
      // Degrade gracefully so the visitor can still chat.
      res.status(200).json({ conversationId: fallbackConversationId });
    }
  });

  app.options("/api/widget/chat", (_req: Request, res: Response) => {
    setCors(res);
    res.sendStatus(204);
  });

  app.options("/api/widget/ticket", (_req: Request, res: Response) => {
    setCors(res);
    res.sendStatus(204);
  });

  // Public endpoint: a visitor opens a support ticket from the widget.
  app.post("/api/widget/ticket", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const body = (req.body ?? {}) as { agentId?: string | number; conversationId?: string | number; name?: string; email?: string; subject?: string; message?: string };
      const subject = String(body.subject ?? "").trim();
      const message = String(body.message ?? "").trim();
      const email = String(body.email ?? "").trim();
      if (!subject || !message) {
        res.status(400).json({ error: "Subject and message are required." });
        return;
      }
      const agent = await resolveWidgetAgent(body.agentId);
      if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
      if ((agent.ticketMode ?? "off") === "off") { res.status(403).json({ error: "Ticketing is not enabled for this agent." }); return; }

      // Enforce the workspace plan's monthly ticket limit (free plan = none).
      try {
        const wsForTickets = await db.getWorkspaceById(agent.workspaceId);
        const ticketLimit = db.ticketLimitForPlan(wsForTickets?.plan);
        if (Number.isFinite(ticketLimit)) {
          const usedTickets = await db.countTicketsThisMonth(agent.workspaceId);
          if (usedTickets >= ticketLimit) {
            res.status(403).json({
              error: ticketLimit === 0
                ? "Support tickets aren't available right now."
                : "We've reached our ticket limit for this month. Please try again later.",
              limitReached: true,
            });
            return;
          }
        }
      } catch (ticketLimitErr) {
        console.error("[Widget] ticket limit check failed", ticketLimitErr);
      }

      const result = await createCustomerTicket({
        workspaceId: agent.workspaceId,
        subject,
        message,
        name: String(body.name ?? "").trim() || null,
        email: email || null,
        conversationId: body.conversationId ? Number(body.conversationId) : null,
        channel: "web",
        sendConfirmation: true,
        baseUrl: requestBaseUrl(req),
      });
      res.json({ ok: true, ticketId: result.ticketId });
    } catch (error) {
      console.error("[Widget] ticket create failed", error);
      res.status(500).json({ error: "Could not create your ticket. Please try again." });
    }
  });

  app.options("/api/widget/messages", (_req: Request, res: Response) => {
    setCors(res);
    res.sendStatus(204);
  });

  // Public endpoint the widget polls to receive agent/system messages that
  // arrive after the visitor's own send — primarily a human agent's replies
  // from the Inbox once a conversation has been handed off. Internal notes and
  // the visitor's own messages are never returned.
  app.get("/api/widget/messages", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const conversationId = Number(req.query.conversationId);
      const after = Number(req.query.after) || 0;
      // history=1 returns the full thread (visitor + agent + system) so the
      // widget can replay a returning visitor's conversation. The normal poll
      // returns only new agent/system messages after `after`.
      const history = req.query.history === "1" || req.query.history === "true";
      if (!req.query.agentId || !conversationId) {
        res.status(400).json({ messages: [] });
        return;
      }
      const agent = await resolveWidgetAgent(req.query.agentId);
      const conv = await db.getConversationById(conversationId);
      if (!agent || !conv || conv.workspaceId !== agent.workspaceId) {
        res.json({ messages: [] });
        return;
      }
      const all = await db.getMessagesByConversation(conversationId);
      const messages = all
        .filter((m) => m.isInternal !== true && (history
          ? true
          : (Number(m.id) > after && (m.role === "agent" || m.role === "system"))))
        .map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }));
      res.json({ messages });
    } catch (error) {
      console.error("[Widget] messages poll failed", error);
      res.json({ messages: [] });
    }
  });

  // Public chat endpoint the widget posts to.
  app.post("/api/widget/chat", async (req: Request, res: Response) => {
    setCors(res);
    let conversationId: number | null = null;
    try {
      const body = (req.body ?? {}) as { agentId?: string | number; message?: string; conversationId?: string | number };
      const message = String(body.message ?? "").trim().slice(0, 4000);
      if (!message) {
        res.status(400).json({ error: "agentId and message are required" });
        return;
      }

      const agent = await resolveWidgetAgent(body.agentId);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      // Load or create the conversation (scoped to the agent's workspace).
      conversationId = body.conversationId ? Number(body.conversationId) : null;
      let conv = conversationId ? await db.getConversationById(conversationId) : undefined;
      if (!conv || conv.workspaceId !== agent.workspaceId) conv = undefined;
      if (!conv) {
        // Enforce the workspace's monthly conversation cap before starting a new
        // chat thread. Defensive: a counting failure must never block live chat.
        try {
          const wsForLimit = await db.getWorkspaceById(agent.workspaceId);
          const convLimit = db.conversationLimitForPlan(wsForLimit?.plan);
          if (Number.isFinite(convLimit)) {
            const used = await db.countAiConversationsThisMonth(agent.workspaceId);
            if (used >= convLimit) {
              res.json({
                reply: agent.fallbackMessage || "We're receiving a lot of messages right now. Please reach out again a little later.",
                conversationId: null,
                mode: "ai",
                limitReached: true,
              });
              return;
            }
          }
        } catch (limitErr) {
          console.error("[Widget] conversation limit check failed", limitErr);
        }
        conv = await db.createConversation({
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          channel: "web",
          visitorId: `widget_${Date.now()}`,
        });
        conversationId = conv?.id ?? null;
        // New visitor conversation — notify the team so the Inbox/bell show a
        // red unread badge.
        try {
          const owner = await db.getWorkspaceById(agent.workspaceId);
          if (owner && conversationId) {
            await db.createNotification({
              workspaceId: agent.workspaceId,
              userId: owner.userId,
              type: "new_conversation",
              title: "New conversation",
              body: String(message).slice(0, 140),
              relatedId: conversationId,
              relatedType: "conversation",
            });
          }
        } catch (e) { console.error("[Widget] new conversation notify failed", e); }
      } else {
        conversationId = conv.id;
      }
      if (!conversationId) {
        res.status(500).json({ error: "Could not start conversation" });
        return;
      }

      // ── Duplicate-request guard ───────────────────────────────────────────
      // Collapse duplicate/retried copies of the same chat POST so the bot never
      // generates (and shows) two replies for one visitor message.
      const dupeKey = conversationId + "|" + message;
      const findExistingReply = async () => {
        const msgs = await db.getMessagesByConversation(conversationId!);
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m.role !== "user" || String(m.content ?? "").trim() !== message) continue;
          const t = (m as { createdAt?: string | Date }).createdAt
            ? new Date((m as { createdAt?: string | Date }).createdAt as string | Date).getTime()
            : 0;
          if (t && Date.now() - t > 30000) return null; // too old to be a retry
          const rep = msgs.slice(i + 1).find((x) => x.role === "agent");
          return rep ? { userId: m.id, rep } : null;
        }
        return null;
      };
      // (a) Identical message already answered moments ago → return that reply.
      {
        const existing = await findExistingReply();
        if (existing) {
          res.json({ reply: existing.rep.content, conversationId, mode: "ai", userMessageId: existing.userId, messageId: existing.rep.id, fallback: false, duplicate: true });
          return;
        }
      }
      // (b) A copy is still being processed → wait briefly for its reply instead
      //     of generating a second one.
      const seenAt = recentWidgetChats.get(dupeKey);
      const nowTs = Date.now();
      if (seenAt && nowTs - seenAt < 30000) {
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise((r) => setTimeout(r, 900));
          const existing = await findExistingReply();
          if (existing) {
            res.json({ reply: existing.rep.content, conversationId, mode: "ai", userMessageId: existing.userId, messageId: existing.rep.id, fallback: false, duplicate: true });
            return;
          }
        }
      }
      recentWidgetChats.set(dupeKey, nowTs);
      if (recentWidgetChats.size > 1000) {
        for (const [k, v] of recentWidgetChats) { if (nowTs - v > 120000) recentWidgetChats.delete(k); }
      }

      const userMsg = await db.createMessage({ conversationId, role: "user", content: message });
      const userMessageId = userMsg?.id ?? null;
      // A new visitor message makes this conversation unread again for the agent.
      db.markConversationUnread(conversationId).catch(() => {});

      // Is a human available to take over? Per-agent availability wins; "auto"
      // follows the workspace Inbox online/offline toggle. When unavailable, the
      // widget offers a ticket instead of promising a live reply that won't come.
      const ws = await db.getWorkspaceById(agent.workspaceId);
      const agentAvailability = agent.humanAvailability ?? "auto";
      const humanAvailable =
        agentAvailability === "online" ? true :
        agentAvailability === "offline" ? false :
        ws?.supportOnline !== false;

      // AI-first then escalation: evaluate the configured triggers on this
      // message. If one fires, mark the conversation escalated so it routes to a
      // human (or to a ticket when the team is offline).
      let escalationMessage: string | null = null;
      let escalationMessageId: number | null = null;
      if (conv && !conv.isEscalated && agent.handoffMode === "ai_first_human_escalation") {
        const prior = await db.getMessagesByConversation(conversationId);
        const userCount = prior.filter((x) => x.role === "user").length;
        if (shouldEscalate(message, userCount, agent.escalationTriggers as string[] | null)) {
          await db.updateConversation(conversationId, { isEscalated: true });
          conv.isEscalated = true;
          escalationMessage = agent.escalationMessage || "I'm connecting you with a member of our team who can help. Please hold on a moment.";
          // Persist the handoff notice the visitor sees so it also shows in the
          // agent's Inbox thread. When the team is offline we record the offline
          // message instead (that's what the visitor actually sees).
          const noticeText = humanAvailable
            ? escalationMessage
            : (agent.offlineMessage || "No one's available right now. Leave a ticket and we'll get back to you by email.");
          try {
            const noticeMsg = await db.createMessage({ conversationId, role: "agent", content: noticeText });
            escalationMessageId = noticeMsg?.id ?? null;
          } catch (e) { console.error("[Widget] escalation notice persist failed", e); }
          // Notify the workspace owner that a conversation needs a human.
          try {
            if (ws) {
              await db.createNotification({
                workspaceId: agent.workspaceId,
                userId: ws.userId,
                type: "escalation",
                title: humanAvailable ? "Conversation needs a human" : "Human requested (team offline)",
                body: String(message).slice(0, 140),
                relatedId: conversationId,
                relatedType: "conversation",
              });
            }
          } catch (e) { console.error("[Widget] escalation notify failed", e); }
        }
      }

      // When the conversation has been handed to a human (escalated, switched to
      // "human" handoff in the Inbox, or the agent is human-only), the AI must
      // NOT reply. A teammate answers from the Inbox and the widget receives it
      // by polling GET /api/widget/messages. Here we only record the visitor msg.
      const humanMode =
        conv?.handoffMode === "human" ||
        conv?.isEscalated === true ||
        agent.handoffMode === "human_only";
      if (humanMode) {
        res.json({
          conversationId,
          mode: "human",
          userMessageId,
          humanAvailable,
          escalationMessage,
          escalationMessageId,
          offlineMessage: agent.offlineMessage ?? null,
        });
        return;
      }

      // Build the prompt from the agent config + THIS agent's knowledge base
      // (its own Q&A pairs + articles, plus any shared/workspace-wide entries).
      const history = await db.getMessagesByConversation(conversationId);
      const qaPairs = await db.getQAPairsByAgent(agent.workspaceId, agent.id);
      const articles = await db.getArticlesByAgent(agent.workspaceId, agent.id);
      const qaKnowledge = qaPairs.slice(0, 12).map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n");
      const articleKnowledge = articles
        .slice(0, 6)
        .map((a) => `# ${a.title}\n${String(a.content ?? "").slice(0, 1500)}`)
        .join("\n\n");
      const knowledge = [qaKnowledge, articleKnowledge].filter(Boolean).join("\n\n");
      // Tell the AI to flag (rather than fake) anything it can't handle. The
      // marker is stripped before the reply is shown and is what lets us offer a
      // ticket / escalate — instead of the AI pretending a human is coming.
      // Whether a real human can actually take over right now decides the wording:
      // promise a teammate ONLY when one is reachable; otherwise steer to a ticket.
      const canReachHuman = agent.handoffMode !== "ai_only" && humanAvailable === true;
      const handoffDirective =
        "ANSWER vs HANDOFF: Answer general questions yourself — pricing, plans, features, setup, how-to and anything in the knowledge base. " +
        "Do NOT hand those off; if a detail isn't in your knowledge, give your best general answer or ask a clarifying question. " +
        "ONLY hand off when the visitor needs an action that requires a human or account access — processing a refund or withdrawal, cancelling or changing a paid subscription, billing disputes, complaints, or any promise/guarantee. " +
        "In those cases, don't invent an answer. " +
        (canReachHuman
          ? "Reply briefly, IN THE VISITOR'S OWN LANGUAGE, that you're connecting them to a teammate now, then output the marker [[HANDOFF]] on the very last line by itself."
          : "Reply briefly, IN THE VISITOR'S OWN LANGUAGE, inviting them to open a support ticket using the button shown just below your message, where they can leave their email so the team can reply by email. Do NOT say that YOU will open, are opening, or have opened the ticket — the visitor opens it themselves by tapping that button. Do NOT claim a human is available or has joined, and do NOT say 'please wait', 'one moment', or 'hold on'. Then output the marker [[HANDOFF]] on the very last line by itself.");
      const systemPrompt = [
        agent.systemPrompt || `You are ${agent.name}, a helpful customer support assistant.`,
        `Tone: ${agent.tone ?? "professional"}.`,
        `Language: automatically detect the language the visitor writes in and ALWAYS reply in that same language, matching them naturally (e.g. if they write in Bahasa Indonesia, reply in Bahasa Indonesia; if Arabic, reply in Arabic; if Spanish, reply in Spanish). Switch languages mid-chat if the visitor does. Only if the visitor's language is genuinely unclear, default to ${agent.language ?? "English"}.`,
        "A welcome message has already been shown to the visitor — don't open with another greeting, just help.",
        knowledge ? `Use this knowledge base when relevant:\n${knowledge}` : "",
        handoffDirective,
        agent.fallbackMessage ? `Your fallback message is: "${agent.fallbackMessage}"` : "",
      ].filter(Boolean).join("\n");

      const llmMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-12).map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: String(m.content),
        })),
      ];

      const response = await invokeLLM({ model: "gpt-4o-mini", messages: llmMessages });
      const llmContent = response.choices?.[0]?.message?.content ? String(response.choices[0].message.content) : "";

      // Did the AI signal it can't handle this on its own?
      const HANDOFF_RE = /\[\[\s*handoff\s*\]\]/gi;
      const markerHandoff = /\[\[\s*handoff\s*\]\]/i.test(llmContent);
      let reply = (llmContent || agent.fallbackMessage || "I'm sorry, I couldn't process that right now.")
        .replace(HANDOFF_RE, "")
        .trim();
      if (!reply) reply = agent.fallbackMessage || "Let me pass this to our team so they can help.";

      // Safety net: models don't always emit the marker. Also treat it as a
      // handoff when the visitor clearly needs a human to take an ACTION
      // (refund, cancel a paid plan, dispute, complaint, or explicitly asks for
      // a person). We deliberately do NOT match the AI's own reply text — that
      // caused false tickets and loops — and we do NOT hand off for general
      // info/pricing/how-to questions (the AI should answer those).
      const msgLower = String(message).toLowerCase();
      const TOPIC_HANDOFF_RE = /\b(refund|charge ?back|charge-back|reimburse|money back|cancel( my| the)? (subscription|plan|account|order|payment)|dispute|complaint|speak (to|with) (a |an )?(human|person|someone|agent|representative)|talk (to|with) (a |an )?(human|person|someone|agent|representative)|live (agent|person)|real (human|person)|human agent)\b/i;
      const needsHandoff = markerHandoff || TOPIC_HANDOFF_RE.test(msgLower);
      // Offer a ticket / escalate whenever a handoff is needed or nothing came back.
      const wantsHandoff = needsHandoff || !llmContent;

      // In "AI first → human escalation" mode, a flagged handoff should actually
      // route to a human when the team is online (notify + mark escalated).
      if (
        wantsHandoff &&
        agent.handoffMode === "ai_first_human_escalation" &&
        humanAvailable &&
        conv &&
        !conv.isEscalated
      ) {
        try {
          await db.updateConversation(conversationId, { isEscalated: true });
          if (ws) {
            await db.createNotification({
              workspaceId: agent.workspaceId,
              userId: ws.userId,
              type: "escalation",
              title: "Conversation needs a human",
              body: String(message).slice(0, 140),
              relatedId: conversationId,
              relatedType: "conversation",
            });
          }
        } catch (e) { console.error("[Widget] handoff escalation failed", e); }
      }

      // AI-only agents never route to a live human, so the widget should offer a
      // ticket immediately (don't make the visitor wait for someone who can't come).
      const effectiveHumanAvailable = agent.handoffMode === "ai_only" ? false : humanAvailable;

      // When no human can join and we're handing off, keep the model's reply
      // (it's already in the visitor's language and ticket-oriented per the
      // handoff directive). Only substitute canned wording if the model returned
      // nothing at all, so we never fall back to English on a non-English chat.
      if (wantsHandoff && !canReachHuman && !llmContent) {
        const ticketOn = (agent.ticketMode ?? "off") !== "off";
        reply = ticketOn
          ? "That's something our team handles directly. Tap \u201cOpen a ticket\u201d below and we'll get back to you by email as soon as we can. \uD83D\uDE0A"
          : (agent.fallbackMessage || "That's something our team handles directly \u2014 please reach out to our support team and we'll help you out.");
      }

      const agentMsg = await db.createMessage({ conversationId, role: "agent", content: reply });

      // `fallback` is true when the AI couldn't resolve it on its own; the widget
      // uses it (with the ticket settings) to offer a support ticket.
      res.json({ reply, conversationId, mode: "ai", userMessageId, messageId: agentMsg?.id ?? null, fallback: wantsHandoff, humanAvailable: effectiveHumanAvailable });
    } catch (error) {
      console.error("[Widget] chat failed", error);
      // Degrade gracefully so the visitor still sees a reply.
      res.status(200).json({
        reply: "Sorry, I'm having trouble responding right now. Please try again in a moment.",
        conversationId,
      });
    }
  });
}
