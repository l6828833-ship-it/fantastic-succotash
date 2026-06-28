import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Gift,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  LifeBuoy,
  Shield,
  Sparkles,
  Sun,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agents", icon: Bot, label: "AI Agents" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/tickets", icon: Ticket, label: "Tickets" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/embed", icon: Code2, label: "Embed Code" },
  { href: "/affiliate", icon: Gift, label: "Affiliate" },
  { href: "/support", icon: LifeBuoy, label: "Help & Support" },
];

const NOTIF_META: Record<string, { icon: React.ElementType; color: string }> = {
  escalation: { icon: Bell, color: "bg-amber-500/10 text-amber-600" },
  new_ticket: { icon: Ticket, color: "bg-blue-500/10 text-blue-600" },
  campaign_complete: { icon: Megaphone, color: "bg-pink-500/10 text-pink-600" },
  new_conversation: { icon: MessageSquare, color: "bg-emerald-500/10 text-emerald-600" },
  system: { icon: Bell, color: "bg-slate-500/10 text-slate-600" },
  default: { icon: MessageSquare, color: "bg-slate-500/10 text-slate-600" },
};

function NavItem({ href, icon: Icon, label, badge }: { href: string; icon: React.ElementType; label: string; badge?: number }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer group",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}>
        <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function NotificationBell() {
  const utils = trpc.useUtils();
  const { data: notifications, refetch } = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Notifications"
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1 text-primary hover:text-primary"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const meta = NOTIF_META[n.type ?? "default"] ?? NOTIF_META.default;
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors",
                      !n.isRead && "bg-primary/5"
                    )}
                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                  >
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", meta.color)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm text-foreground truncate", !n.isRead ? "font-semibold" : "font-medium")}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme = () => {} } = useTheme();
  const [currentPath] = useLocation();
  const { data: notifications } = trpc.notifications.list.useQuery();
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const utils = trpc.useUtils();
  const { data: workspace } = trpc.workspace.get.useQuery();
  const supportOnline = workspace?.supportOnline !== false;
  const setAvailability = trpc.workspace.update.useMutation({
    onSuccess: () => utils.workspace.get.invalidate(),
  });

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo + quick actions */}
      <div className="flex items-center justify-between gap-2 px-3 h-16 border-b border-sidebar-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0" onClick={onClose}>
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none truncate">Chatrico</p>
        </Link>
        <div className="flex items-center gap-0.5 shrink-0">
          <NotificationBell />
          {user?.role === "admin" && (
            <Link href="/admin" title="Admin" onClick={onClose} className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              currentPath === "/admin" ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            )}>
              <Shield className="w-4 h-4" />
            </Link>
          )}
          <Link href="/settings" title="Settings" onClick={onClose} className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            currentPath === "/settings" ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          )}>
            <Settings className="w-4 h-4" />
          </Link>
          {onClose && (
            <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4 px-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              badge={item.href === "/inbox" ? unreadCount : undefined}
            />
          ))}
        </div>
      </ScrollArea>

      {/* User footer */}
      <div className="px-3 pb-4 shrink-0 border-t border-sidebar-border pt-3">
        {/* Plan promo: current plan + upgrade CTA */}
        {(() => {
          const plan = workspace?.plan === "growth" ? "pro" : (workspace?.plan ?? "free");
          const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
          const canUpgrade = !["business", "enterprise"].includes(plan);
          return (
            <Link href="/settings?tab=billing">
              <div className="mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 cursor-pointer hover:bg-sidebar-accent transition-colors" onClick={onClose}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-sidebar-foreground/60">Current plan</span>
                  <Badge className="text-[10px] bg-sidebar-primary text-sidebar-primary-foreground capitalize">{planLabel}</Badge>
                </div>
                {canUpgrade && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sidebar-primary">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Upgrade for more agents & features
                  </div>
                )}
              </div>
            </Link>
          );
        })()}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-all">
              <div className="relative shrink-0">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span
                  title={supportOnline ? "Online — conversations can reach you" : "Offline — visitors are offered a ticket"}
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar-border",
                    supportOnline ? "bg-green-500" : "bg-gray-400",
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? "User"}</p>
                <p className="text-xs text-sidebar-foreground/40 truncate">{supportOnline ? "Online" : "Offline"}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-sidebar-foreground/40 shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuItem
              onClick={() => setAvailability.mutate({ supportOnline: !supportOnline })}
              disabled={setAvailability.isPending}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full mr-2", supportOnline ? "bg-green-500" : "bg-gray-400")} />
              {supportOnline ? "Go offline" : "Go online"}
            </DropdownMenuItem>
            <p className="px-2 py-1 text-[11px] text-muted-foreground leading-snug">
              {supportOnline
                ? "Conversations that need a human reach your Inbox."
                : "The AI handles chats; visitors are offered a ticket instead of a live human."}
            </p>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background shrink-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">Chatrico</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
