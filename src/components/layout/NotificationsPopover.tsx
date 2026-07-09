import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, MessageSquareReply, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dealRecords } from "@/data/dealsData";
import { brandActionStore } from "@/lib/brandActionStore";
import { dealActionStore } from "@/lib/dealActionStore";
import { canSeeRoute, getVisibleDealsForUser, useScopedUser, useUserRole } from "@/hooks/useUserRole";

interface Notification {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  href?: string;
}

const READ_NOTIFICATIONS_KEY = "rcre_read_notifications";

interface NotificationsPopoverProps {
  mobile?: boolean;
}

function formatNotificationTime(value: string | null | undefined): string {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(values: Set<string>) {
  try {
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(values).slice(-250)));
  } catch {}
}

export function NotificationsPopover({ mobile }: NotificationsPopoverProps) {
  const navigate = useNavigate();
  const role = useUserRole();
  const user = useScopedUser();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);
  const [storeVersion, setStoreVersion] = useState(0);
  const canOpenActionItems = canSeeRoute(user ?? role, "/action-items");

  useEffect(() => {
    const bump = () => setStoreVersion((version) => version + 1);
    const unsubscribeBrand = brandActionStore.subscribe(bump);
    const unsubscribeDeal = dealActionStore.subscribe(bump);
    return () => {
      unsubscribeBrand();
      unsubscribeDeal();
    };
  }, []);

  const brandId = role === "brand" ? user?.brandId ?? null : null;
  const visibleDealIds = useMemo(() => {
    if (!user) return [];
    if (role === "deal" && user.dealId) return [user.dealId];
    if (role === "brand" || role === "broker") {
      return getVisibleDealsForUser(user, dealRecords)
        .filter((deal) => !deal.isOneOff)
        .map((deal) => deal.id);
    }
    return [];
  }, [role, user]);
  const visibleDealIdsKey = visibleDealIds.join("|");

  const loadActionResponses = useCallback(async () => {
    const jobs: Promise<unknown>[] = [];
    const dealIds = visibleDealIdsKey ? visibleDealIdsKey.split("|") : [];
    if (brandId) jobs.push(brandActionStore.loadByBrand(brandId));
    if (dealIds.length > 0) jobs.push(dealActionStore.loadByDeals(dealIds));
    if (jobs.length === 0) return;
    await Promise.allSettled(jobs);
  }, [brandId, visibleDealIdsKey]);

  useEffect(() => {
    void loadActionResponses();
    const onFocus = () => void loadActionResponses();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void loadActionResponses(), 60000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [loadActionResponses]);

  useEffect(() => {
    if (open) void loadActionResponses();
  }, [loadActionResponses, open]);

  const notifications = useMemo<Notification[]>(() => {
    const brandNotifications = brandId
      ? brandActionStore.getByBrand(brandId)
          .filter((item) => Boolean(item.responseBody))
          .map((item) => ({
            id: `brand-response-${item.id}-${item.respondedAt ?? item.updatedAt ?? item.timestamp}`,
            icon: MessageSquareReply,
            iconColor: "#059669",
            iconBg: "rgba(5,150,105,0.12)",
            title: "Reimagine responded",
            body: item.responseBody || item.actionTypeLabel,
            time: formatNotificationTime(item.respondedAt ?? item.updatedAt ?? item.timestamp),
            read: readIds.has(`brand-response-${item.id}-${item.respondedAt ?? item.updatedAt ?? item.timestamp}`),
            href: `/brands/${item.brandId}/deals`,
          }))
      : [];

    const dealNotifications = visibleDealIds.flatMap((dealId) =>
      dealActionStore.getByDeal(dealId)
        .filter((item) => Boolean(item.responseBody))
        .map((item) => {
          const id = `deal-response-${item.id}-${item.respondedAt ?? item.updatedAt ?? item.timestamp}`;
          return {
            id,
            icon: MessageSquareReply,
            iconColor: "#059669",
            iconBg: "rgba(5,150,105,0.12)",
            title: "Reimagine responded",
            body: item.responseBody || item.title,
            time: formatNotificationTime(item.respondedAt ?? item.updatedAt ?? item.timestamp),
            read: readIds.has(id),
            href: `/deals/${item.dealId}`,
          };
        })
    );

    return [...brandNotifications, ...dealNotifications].sort((a, b) => Number(a.read) - Number(b.read));
  }, [brandId, readIds, storeVersion, visibleDealIds]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setReadIds((current) => {
      const next = new Set(current);
      notifications.forEach((notification) => next.add(notification.id));
      saveReadIds(next);
      return next;
    });
  };

  const markRead = (id: string) => {
    setReadIds((current) => {
      const next = new Set(current);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {mobile ? (
          <button
            aria-label="Notifications"
            className="relative flex items-center justify-center"
            style={{ width: 32, height: 32, color: "var(--text-tertiary)" }}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <div
                className="absolute"
                style={{
                  top: 6, right: 6, width: 8, height: 8, borderRadius: "50%",
                  background: "#E18739", border: "1.5px solid #ffffff",
                }}
              />
            )}
          </button>
        ) : (
          <button
            aria-label="Notifications"
            className="relative flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--bg-card)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 1px 4px rgba(36,60,81,0.06)",
              color: "var(--text-tertiary)",
              transition: "all 0.2s ease",
            }}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <div
                className="absolute"
                style={{
                  top: 4, right: 4, width: 8, height: 8, borderRadius: "50%",
                  background: "#E18739", border: "1.5px solid #ffffff",
                }}
              />
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="p-0 overflow-hidden"
        style={{
          width: mobile ? "calc(100vw - 24px)" : 380,
          maxWidth: mobile ? "calc(100vw - 24px)" : 380,
          borderRadius: 12,
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 12px 48px rgba(36,60,81,0.18), 0 2px 8px rgba(36,60,81,0.08)",
          background: "var(--bg-surface)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border-divider)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#ffffff", background: "#E18739",
                borderRadius: 10, padding: "1px 7px", minWidth: 18, textAlign: "center",
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ fontSize: 12, fontWeight: 500, color: "var(--text-orange-ui, #b85c1a)", background: "none", border: "none", cursor: "pointer" }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="flex items-center justify-center"
              style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(36,60,81,0.06)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {notifications.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center" }}>
              <Bell className="w-6 h-6 mx-auto" style={{ color: "var(--text-muted)", opacity: 0.55 }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginTop: 10 }}>
                No notifications
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Take Action responses will appear here.
              </p>
            </div>
          )}
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                onClick={() => {
                  markRead(n.id);
                  if (n.href) {
                    setOpen(false);
                    navigate(n.href);
                  }
                }}
                className="flex gap-3 cursor-pointer transition-colors"
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-divider)",
                  background: n.read ? "transparent" : "rgba(225,135,57,0.04)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = n.read ? "rgba(36,60,81,0.02)" : "rgba(225,135,57,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? "transparent" : "rgba(225,135,57,0.04)"; }}
              >
                {/* Icon */}
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{ width: 32, height: 32, borderRadius: 8, background: n.iconBg }}
                >
                  <Icon className="w-4 h-4" style={{ color: n.iconColor }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate" style={{ fontSize: 14, fontWeight: n.read ? 500 : 600, color: "var(--text-primary)", margin: 0 }}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: "50%", background: "#E18739", marginTop: 5 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4 }}>
                    {n.body}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{n.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center" style={{ padding: "10px 16px", borderTop: "1px solid var(--border-divider)" }}>
          <button
            onClick={() => {
              setOpen(false);
              if (canOpenActionItems) navigate("/action-items");
            }}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui, #b85c1a)", background: "none", border: "none", cursor: "pointer" }}
          >
            {canOpenActionItems ? "View action items" : "Close"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
