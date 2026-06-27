// Shared channel definitions used across Campaigns, Contacts, and Inbox.
// Only Web Chat and Email are available today; everything else is "coming soon".
// SMS has been removed from the platform.

export type ChannelId = "web" | "email" | "whatsapp" | "instagram" | "messenger" | "telegram";

export interface ChannelDef {
  id: ChannelId;
  label: string;
  icon: string;
  available: boolean;
}

export const CHANNELS: ChannelDef[] = [
  { id: "web", label: "Web Chat", icon: "💬", available: true },
  { id: "email", label: "Email", icon: "📧", available: true },
  { id: "whatsapp", label: "WhatsApp", icon: "🟢", available: false },
  { id: "instagram", label: "Instagram", icon: "📸", available: false },
  { id: "messenger", label: "Messenger", icon: "💌", available: false },
  { id: "telegram", label: "Telegram", icon: "✈️", available: false },
];

export const AVAILABLE_CHANNELS = CHANNELS.filter((c) => c.available);
export const COMING_SOON_CHANNELS = CHANNELS.filter((c) => !c.available);

export function getChannelLabel(id?: string | null): string {
  if (!id) return "Web Chat";
  return CHANNELS.find((c) => c.id === id)?.label ?? id;
}

export function getChannelIcon(id?: string | null): string {
  if (!id) return "💬";
  return CHANNELS.find((c) => c.id === id)?.icon ?? "💬";
}
