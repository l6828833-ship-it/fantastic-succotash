import type { Express, Request, Response } from "express";
import * as db from "../db";
import { invokeLLM, type Message as LLMMessage } from "./llm";

// The embeddable widget runs on third-party websites, so these routes must be
// public (no auth) and CORS-enabled.
function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

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

  var color = cfg.color || "#6366f1";
  var side = cfg.position === "bottom-left" ? "left" : "right";
  var dark = cfg.theme === "dark";
  var sizeMap = { compact: 320, standard: 372, large: 420 };
  var panelW = sizeMap[cfg.size] || 372;

  var bg = dark ? "#0b0b12" : "#ffffff";
  var fg = dark ? "#e5e7eb" : "#111827";
  var sub = dark ? "#1c1c28" : "#f3f4f6";
  var border = dark ? "#26263a" : "#e5e7eb";

  var storeKey = "chatbotpro_conv_" + agentId;
  var conversationId = null;
  try { conversationId = localStorage.getItem(storeKey); } catch (e) {}

  var open = false;
  var loading = false;
  var greeted = false;
  var agentName = "Assistant";
  var welcome = "Hi! How can I help you today?";

  var css = ""
    + ".cbp-launcher{position:fixed;bottom:20px;" + side + ":20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}"
    + ".cbp-launcher:hover{transform:scale(1.06);}"
    + ".cbp-launcher svg{width:26px;height:26px;fill:#fff;}"
    + ".cbp-panel{position:fixed;bottom:88px;" + side + ":20px;width:" + panelW + "px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);background:" + bg + ";color:" + fg + ";border:1px solid " + border + ";border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}"
    + ".cbp-panel.cbp-open{display:flex;}"
    + ".cbp-head{padding:14px 16px;color:#fff;display:flex;align-items:center;gap:10px;}"
    + ".cbp-head .cbp-av{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;overflow:hidden;}"
    + ".cbp-head .cbp-av img{width:100%;height:100%;object-fit:cover;}"
    + ".cbp-head .cbp-name{font-weight:600;font-size:15px;}"
    + ".cbp-head .cbp-x{margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.85;}"
    + ".cbp-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:" + (dark ? "#0b0b12" : "#fafafa") + ";}"
    + ".cbp-msg{max-width:80%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}"
    + ".cbp-bot{align-self:flex-start;background:" + sub + ";color:" + fg + ";border-bottom-left-radius:4px;}"
    + ".cbp-user{align-self:flex-end;color:#fff;border-bottom-right-radius:4px;}"
    + ".cbp-foot{border-top:1px solid " + border + ";padding:10px;display:flex;gap:8px;background:" + bg + ";}"
    + ".cbp-foot input{flex:1;border:1px solid " + border + ";background:" + bg + ";color:" + fg + ";border-radius:10px;padding:10px 12px;font-size:14px;outline:none;}"
    + ".cbp-foot button{border:none;border-radius:10px;color:#fff;width:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;}"
    + ".cbp-foot button:disabled{opacity:.5;cursor:default;}"
    + ".cbp-foot button svg{width:18px;height:18px;fill:#fff;}"
    + ".cbp-typing{display:flex;gap:4px;padding:4px 2px;}"
    + ".cbp-typing span{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:cbpb 1s infinite;}"
    + ".cbp-typing span:nth-child(2){animation-delay:.15s;}.cbp-typing span:nth-child(3){animation-delay:.3s;}"
    + "@keyframes cbpb{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}"
    + ".cbp-foot{align-items:center;}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.className = "cbp-launcher";
  launcher.style.background = color;
  launcher.setAttribute("aria-label", "Open chat");
  launcher.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1L4 21l4-1.6c1.2.4 2.6.6 4 .6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>';

  var panel = document.createElement("div");
  panel.className = "cbp-panel";

  var head = document.createElement("div");
  head.className = "cbp-head";
  head.style.background = color;
  var avatar = document.createElement("div");
  avatar.className = "cbp-av";
  avatar.textContent = "A";
  var nameEl = document.createElement("div");
  nameEl.className = "cbp-name";
  nameEl.textContent = agentName;
  var closeBtn = document.createElement("button");
  closeBtn.className = "cbp-x";
  closeBtn.innerHTML = "&times;";
  head.appendChild(avatar);
  head.appendChild(nameEl);
  head.appendChild(closeBtn);

  var body = document.createElement("div");
  body.className = "cbp-body";

  var foot = document.createElement("div");
  foot.className = "cbp-foot";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type a message...";
  var sendBtn = document.createElement("button");
  sendBtn.style.background = color;
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>';
  foot.appendChild(input);
  foot.appendChild(sendBtn);

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(foot);

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

  function toggle(){
    open = !open;
    panel.className = "cbp-panel" + (open ? " cbp-open" : "");
    if (open && !greeted){ greeted = true; addMsg("bot", welcome); input.focus(); }
  }

  function send(){
    var text = (input.value || "").trim();
    if (!text || loading) return;
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
      addMsg("bot", (data && data.reply) ? data.reply : "Sorry, something went wrong. Please try again.");
    }).catch(function(){
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      addMsg("bot", "Sorry, I couldn't reach the server. Please try again.");
    }).then(function(){ loading = false; sendBtn.disabled = false; input.focus(); });
  }

  launcher.addEventListener("click", toggle);
  closeBtn.addEventListener("click", toggle);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); send(); } });

  // Load public agent config (name, welcome, color, icon).
  fetch(apiBase + "/widget/agent/" + agentId).then(function(r){ return r.json(); }).then(function(a){
    if (!a) return;
    if (a.name){ agentName = a.name; nameEl.textContent = a.name; avatar.textContent = a.name.charAt(0).toUpperCase(); }
    if (a.welcomeMessage) welcome = a.welcomeMessage;
    if (a.color){ color = a.color; launcher.style.background = color; head.style.background = color; sendBtn.style.background = color; }
    if (a.avatarUrl){ avatar.innerHTML = '<img src="' + a.avatarUrl + '" alt="">'; }
  }).catch(function(){});

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
})();`;

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
      const agent = await db.getAgentById(Number(req.params.id));
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json({
        id: agent.id,
        name: agent.name,
        welcomeMessage: agent.welcomeMessage ?? "Hi! How can I help you today?",
        color: agent.widgetColor ?? "#6366f1",
        position: agent.widgetPosition ?? "bottom-right",
        size: agent.widgetSize ?? "standard",
        theme: agent.widgetTheme ?? "light",
        avatarUrl: agent.avatarUrl ?? null,
        isActive: agent.isActive ?? true,
      });
    } catch (error) {
      console.error("[Widget] agent config failed", error);
      res.status(500).json({ error: "Failed to load agent" });
    }
  });

  app.options("/api/widget/chat", (_req: Request, res: Response) => {
    setCors(res);
    res.sendStatus(204);
  });

  // Public chat endpoint the widget posts to.
  app.post("/api/widget/chat", async (req: Request, res: Response) => {
    setCors(res);
    let conversationId: number | null = null;
    try {
      const body = (req.body ?? {}) as { agentId?: string | number; message?: string; conversationId?: string | number };
      const agentId = Number(body.agentId);
      const message = String(body.message ?? "").trim().slice(0, 4000);
      if (!agentId || !message) {
        res.status(400).json({ error: "agentId and message are required" });
        return;
      }

      const agent = await db.getAgentById(agentId);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      // Load or create the conversation (scoped to the agent's workspace).
      conversationId = body.conversationId ? Number(body.conversationId) : null;
      let conv = conversationId ? await db.getConversationById(conversationId) : undefined;
      if (!conv || conv.workspaceId !== agent.workspaceId) conv = undefined;
      if (!conv) {
        conv = await db.createConversation({
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          channel: "web",
          visitorId: `widget_${Date.now()}`,
        });
        conversationId = conv?.id ?? null;
      } else {
        conversationId = conv.id;
      }
      if (!conversationId) {
        res.status(500).json({ error: "Could not start conversation" });
        return;
      }

      await db.createMessage({ conversationId, role: "user", content: message });

      // Build the prompt from the agent config + knowledge base.
      const history = await db.getMessagesByConversation(conversationId);
      const qaPairs = await db.getQAPairsByWorkspace(agent.workspaceId);
      const knowledge = qaPairs.slice(0, 12).map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n");
      const systemPrompt = [
        agent.systemPrompt || `You are ${agent.name}, a helpful customer support assistant.`,
        `Tone: ${agent.tone ?? "professional"}.`,
        `Always respond in ${agent.language ?? "English"}.`,
        knowledge ? `Use this knowledge base when relevant:\n${knowledge}` : "",
        agent.fallbackMessage ? `If you cannot help, reply with: "${agent.fallbackMessage}"` : "",
      ].filter(Boolean).join("\n");

      const llmMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-12).map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: String(m.content),
        })),
      ];

      const response = await invokeLLM({ model: "gpt-4o-mini", messages: llmMessages });
      const reply = response.choices?.[0]?.message?.content
        ? String(response.choices[0].message.content)
        : (agent.fallbackMessage ?? "I'm sorry, I couldn't process that right now.");

      await db.createMessage({ conversationId, role: "agent", content: reply });

      res.json({ reply, conversationId });
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
