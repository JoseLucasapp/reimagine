import { useState } from "react";
import { Bell, X, MapPin, FileText, AlertTriangle, Users, CheckCircle2, Clock, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Notification {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [];

interface NotificationsPopoverProps {
  mobile?: boolean;
}

export function NotificationsPopover({ mobile }: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
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
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
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
            onClick={() => setOpen(false)}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui, #b85c1a)", background: "none", border: "none", cursor: "pointer" }}
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
