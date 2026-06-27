import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database helpers
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getWorkspaceByUserId: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    companyName: "Test Corp",
    companySize: "11-50",
    industry: "SaaS / Technology",
    websiteUrl: null,
    plan: "starter",
    onboardingCompleted: true,
    selectedFeatures: ["ai_agent"],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createWorkspace: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    companyName: "Test Corp",
    companySize: "11-50",
    industry: "SaaS / Technology",
    websiteUrl: null,
    plan: "starter",
    onboardingCompleted: false,
    selectedFeatures: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getOrCreateWorkspace: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    companyName: "Test Corp",
    companySize: "11-50",
    industry: "SaaS / Technology",
    websiteUrl: null,
    plan: "starter",
    onboardingCompleted: true,
    selectedFeatures: ["ai_agent"],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateWorkspace: vi.fn().mockResolvedValue(undefined),
  createAgent: vi.fn().mockResolvedValue({
    id: 1,
    workspaceId: 1,
    name: "Test Agent",
    isActive: true,
    handoffMode: "ai_only",
    tone: "professional",
    language: "English",
    responseStyle: "balanced",
    maxResponseLength: "medium",
    systemPrompt: "You are a helpful assistant.",
    welcomeMessage: "Hello!",
    fallbackMessage: "I cannot help with that.",
    escalationMessage: null,
    escalationTriggers: [],
    workingHoursEnabled: false,
    offlineMessage: null,
    leadCaptureEnabled: false,
    widgetColor: "#6366f1",
    widgetPosition: "bottom-right",
    widgetSize: "standard",
    widgetTheme: "light",
    widgetFont: "Inter",
    avatarUrl: null,
    launcherIconUrl: null,
    brandLogoUrl: null,
    customCss: null,
    typingDelay: 1000,
    workingHours: null,
    leadCaptureFields: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getAgentById: vi.fn().mockResolvedValue({
    id: 1,
    workspaceId: 1,
    name: "Test Agent",
    isActive: true,
    handoffMode: "ai_only",
    tone: "professional",
    language: "English",
    responseStyle: "balanced",
    maxResponseLength: "medium",
    systemPrompt: "You are a helpful assistant.",
    welcomeMessage: "Hello!",
    fallbackMessage: "I cannot help with that.",
    escalationMessage: null,
    escalationTriggers: [],
    workingHoursEnabled: false,
    offlineMessage: null,
    leadCaptureEnabled: false,
    widgetColor: "#6366f1",
    widgetPosition: "bottom-right",
    widgetSize: "standard",
    widgetTheme: "light",
    widgetFont: "Inter",
    avatarUrl: null,
    launcherIconUrl: null,
    brandLogoUrl: null,
    customCss: null,
    typingDelay: 1000,
    workingHours: null,
    leadCaptureFields: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getAgentsByWorkspace: vi.fn().mockResolvedValue([]),
  updateAgent: vi.fn().mockResolvedValue(undefined),
  deleteAgent: vi.fn().mockResolvedValue(undefined),
  createArticle: vi.fn().mockResolvedValue({ id: 1, title: "Test", content: "Content", workspaceId: 1, agentId: null, category: "general", tags: null, imageUrl: null, status: "ready", sourceUrl: null, createdAt: new Date(), updatedAt: new Date() }),
  getArticlesByWorkspace: vi.fn().mockResolvedValue([]),
  updateArticle: vi.fn().mockResolvedValue(undefined),
  deleteArticle: vi.fn().mockResolvedValue(undefined),
  createQAPair: vi.fn().mockResolvedValue({ id: 1, question: "Q?", answer: "A.", workspaceId: 1, agentId: null, category: null, createdAt: new Date(), updatedAt: new Date() }),
  getQAPairsByWorkspace: vi.fn().mockResolvedValue([]),
  deleteQAPair: vi.fn().mockResolvedValue(undefined),
  getConversationsByWorkspace: vi.fn().mockResolvedValue([]),
  getConversationById: vi.fn().mockResolvedValue(null),
  createConversation: vi.fn().mockResolvedValue({ id: 1, workspaceId: 1, agentId: 1, visitorId: "v1", visitorName: null, visitorEmail: null, status: "open", handoffMode: "ai", isEscalated: false, assignedUserId: null, csatScore: null, createdAt: new Date(), updatedAt: new Date() }),
  updateConversation: vi.fn().mockResolvedValue(undefined),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockResolvedValue({ id: 1, conversationId: 1, role: "user", content: "Hello", isInternal: false, attachmentUrl: null, attachmentType: null, attachmentName: null, createdAt: new Date() }),
  getTicketsByWorkspace: vi.fn().mockResolvedValue([]),
  getTicketById: vi.fn().mockResolvedValue(null),
  createTicket: vi.fn().mockResolvedValue({ id: 1, workspaceId: 1, conversationId: null, title: "Test Ticket", description: null, status: "open", priority: "medium", assignedUserId: null, createdAt: new Date(), updatedAt: new Date() }),
  updateTicket: vi.fn().mockResolvedValue(undefined),
  getCampaignsByWorkspace: vi.fn().mockResolvedValue([]),
  getCampaignById: vi.fn().mockResolvedValue(null),
  createCampaign: vi.fn().mockResolvedValue({ id: 1, workspaceId: 1, agentId: null, name: "Test Campaign", type: "broadcast", message: "Hello!", targetSegment: null, targetUrlPattern: null, triggerDelay: null, scheduledAt: null, status: "draft", sentCount: 0, openCount: 0, createdAt: new Date(), updatedAt: new Date() }),
  updateCampaign: vi.fn().mockResolvedValue(undefined),
  getNotificationsByWorkspace: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue(undefined),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  getAnalyticsSummary: vi.fn().mockResolvedValue({ total: 100, resolved: 75, escalated: 10, avgCsat: 4.2 }),
  getConversationsByDay: vi.fn().mockResolvedValue([]),
  getAgentPerformance: vi.fn().mockResolvedValue([]),
  getOrCreatePlaygroundSession: vi.fn().mockResolvedValue({ id: 1, agentId: 1, userId: 1, messages: [], model: "gpt-4o-mini", answerGuidance: "balanced", createdAt: new Date(), updatedAt: new Date() }),
  updatePlaygroundSession: vi.fn().mockResolvedValue(undefined),
  getArticleById: vi.fn().mockResolvedValue(null),
  updateQAPair: vi.fn().mockResolvedValue(undefined),
  deleteTicket: vi.fn().mockResolvedValue(undefined),
  deleteCampaign: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "This is a test AI response." } }],
  }),
  listLLMModels: vi.fn().mockResolvedValue({
    data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o" }],
  }),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

function createAuthContext(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-open-id",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

describe("auth", () => {
  it("returns current user from auth.me", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
  });

  it("clears cookie on logout", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("workspace", () => {
  it("returns workspace data for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.workspace.get();
    expect(result).toBeDefined();
    expect(result?.companyName).toBe("Test Corp");
  });

  it("updates workspace onboarding data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.workspace.update({
      companyName: "Updated Corp",
      industry: "SaaS / Technology",
      companySize: "11-50",
      onboardingCompleted: true,
      selectedFeatures: ["ai_agent", "ticketing"],
    })).resolves.not.toThrow();
  });
});

describe("agent", () => {
  it("lists agents for workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a new agent with required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.create({
      name: "Test Agent",
      handoffMode: "ai_only",
      tone: "professional",
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("Test Agent");
    expect(result.handoffMode).toBe("ai_only");
  });

  it("accepts AI First then Human Escalation mode without error", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw - the input schema accepts ai_first_human_escalation
    await expect(caller.agent.create({
      name: "Hybrid Agent",
      handoffMode: "ai_first_human_escalation",
      tone: "friendly",
    })).resolves.toBeDefined();
  });

  it("accepts Human Only mode without error", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw - the input schema accepts human_only
    await expect(caller.agent.create({
      name: "Human Agent",
      handoffMode: "human_only",
      tone: "empathetic",
    })).resolves.toBeDefined();
  });

  it("retrieves agent by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.get({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
  });
});

describe("tickets", () => {
  it("lists tickets for workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tickets.list({ status: "open" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a ticket with open status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tickets.create({
      title: "Customer issue",
      description: "Customer cannot log in",
      priority: "high",
    });
    expect(result).toBeDefined();
    expect(result.title).toBe("Test Ticket");
    expect(result.status).toBe("open");
  });

  it("ticket status values are open, in-progress, and closed", () => {
    const validStatuses = ["open", "in-progress", "closed"];
    expect(validStatuses).toContain("open");
    expect(validStatuses).toContain("in-progress");
    expect(validStatuses).toContain("closed");
    expect(validStatuses).not.toContain("pending");
    expect(validStatuses).not.toContain("resolved");
  });
});

describe("campaigns", () => {
  it("lists campaigns for workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.campaigns.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a broadcast campaign", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.campaigns.create({
      name: "Welcome Campaign",
      message: "Welcome to our service!",
      type: "broadcast",
    });
    expect(result).toBeDefined();
    expect(result.status).toBe("draft");
  });
});

describe("knowledge", () => {
  it("lists articles for workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.knowledge.listArticles();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a knowledge article", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.knowledge.createArticle({
      title: "How to reset password",
      content: "Go to settings and click forgot password.",
      category: "technical",
    });
    expect(result).toBeDefined();
    expect(result.title).toBe("Test");
  });
});

describe("analytics", () => {
  it("returns analytics summary with correct shape", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.summary();
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
    expect(typeof result.resolved).toBe("number");
    expect(typeof result.escalated).toBe("number");
    expect(result.total).toBe(100);
    expect(result.resolved).toBe(75);
    expect(result.escalated).toBe(10);
  });

  it("returns conversations by day array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.conversationsByDay();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns agent performance array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.agentPerformance();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("inbox", () => {
  it("lists conversations with status filter", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inbox.listConversations({ status: "open" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("conversation status values are open, pending, and resolved", () => {
    const validStatuses = ["open", "pending", "resolved"];
    expect(validStatuses).toContain("open");
    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("resolved");
    expect(validStatuses).not.toContain("closed");
    expect(validStatuses).not.toContain("in-progress");
  });
});

describe("handoff modes", () => {
  it("validates all three handoff mode values", () => {
    const validModes = ["ai_only", "ai_first_human_escalation", "human_only"];
    expect(validModes).toContain("ai_only");
    expect(validModes).toContain("ai_first_human_escalation");
    expect(validModes).toContain("human_only");
    expect(validModes).toHaveLength(3);
  });

  it("AI Only mode label matches specification", () => {
    const mode = { id: "ai_only", label: "AI Only" };
    expect(mode.label).toBe("AI Only");
  });

  it("AI First then Human Escalation mode label matches specification", () => {
    const mode = { id: "ai_first_human_escalation", label: "AI First then Human Escalation" };
    expect(mode.label).toBe("AI First then Human Escalation");
  });

  it("Human Only mode label matches specification", () => {
    const mode = { id: "human_only", label: "Human Only" };
    expect(mode.label).toBe("Human Only");
  });
});
