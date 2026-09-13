import { useEffect, useState, useRef } from "react";
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  Info,
  Clock,
  ExternalLink,
  Check,
} from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationItem,
  getToken,
} from "../services/api.js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


interface NotificationCenterProps {
  slug: string;
  onNotificationClick?: (notification: NotificationItem) => void;
  onRealtimeEvent?: (eventType: string, payload: any) => void;
}

export function NotificationCenter({
  slug,
  onNotificationClick,
  onRealtimeEvent,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    if (!slug) return;
    try {
      const data = await getNotifications(slug);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignored if offline or unauthorized
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [slug]);

  // Real-time SSE Connection
  useEffect(() => {
    if (!slug) return;
    const token = getToken();
    if (!token || typeof EventSource === "undefined") return;

    const url = `/api/v1/orgs/${encodeURIComponent(slug)}/events?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    const handleEvent = (event: string, e: MessageEvent) => {
      fetchNotifs();
      if (onRealtimeEvent) {
        try {
          const data = JSON.parse(e.data);
          onRealtimeEvent(event, data);
        } catch {
          onRealtimeEvent(event, e.data);
        }
      }
    };

    const eventNames = [
      "connected",
      "incident:created",
      "incident:claimed",
      "incident:status_updated",
      "incident:resolved",
      "incident:closed",
      "incident:reopened",
      "incident:merged",
      "incident:escalated",
    ];

    for (const name of eventNames) {
      eventSource.addEventListener(name, (e) => handleEvent(name, e as MessageEvent));
    }

    return () => {
      eventSource.close();
    };
  }, [slug]);

  // Close drawer on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        drawerRef.current &&
        !drawerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await markNotificationRead(slug, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Failed to mark as read
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(slug);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Error marking all as read
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = (notification: NotificationItem) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="relative" ref={drawerRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        data-testid="notification-bell"
        aria-label="Notifications"
        onClick={() => {
          setIsOpen((prev) => !prev);
          fetchNotifs();
        }}
        className="relative size-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition focus-ring"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background shadow-xs animate-pulse"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Popover Drawer */}
      {isOpen && (
        <Card
          data-testid="notification-drawer"
          className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] p-0 gap-0"
        >
          {/* Header */}
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-card space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-foreground">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {unreadCount} new
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 px-2 flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3.5" />
                  <span>Mark all read</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="size-7 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Filter Tabs */}
          <div className="flex items-center border-b px-4 py-2 bg-muted/50 text-xs font-medium gap-2">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
              className="h-7 px-2.5 text-xs"
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
              className="h-7 px-2.5 text-xs"
            >
              Unread ({unreadCount})
            </Button>
          </div>

          {/* Notification List */}
          <CardContent className="p-0 flex-1 overflow-y-auto divide-y max-h-96">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Bell className="size-8 opacity-30 text-muted-foreground" />
                <p className="text-xs">No notifications to display.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isHighPriority = notif.priority === "high";

                return (
                  <div
                    key={notif.id}
                    data-testid={`notification-item-${notif.id}`}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 hover:bg-muted/60 transition cursor-pointer flex items-start gap-3 text-left ${
                      !notif.isRead ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                        isHighPriority
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : notif.type.includes("resolved") || notif.type.includes("confirmed")
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      {isHighPriority ? (
                        <AlertTriangle className="size-4" />
                      ) : (
                        <Info className="size-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs truncate ${
                            !notif.isRead
                              ? "font-bold text-foreground"
                              : "font-medium text-muted-foreground"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="size-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono tabular-nums">
                          <Clock className="size-3" />
                          <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {!notif.isRead && (
                            <button
                              type="button"
                              data-testid={`mark-read-${notif.id}`}
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition"
                              title="Mark as read"
                            >
                              <Check className="size-3.5" />
                            </button>
                          )}
                          {(notif.incidentId || notif.complaintId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(notif);
                              }}
                              className="text-primary hover:underline flex items-center gap-0.5 text-[11px] font-medium transition cursor-pointer"
                            >
                              <span>View</span>
                              <ExternalLink className="size-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
