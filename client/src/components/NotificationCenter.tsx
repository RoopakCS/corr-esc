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
      <button
        type="button"
        data-testid="notification-bell"
        aria-label="Notifications"
        onClick={() => {
          setIsOpen((prev) => !prev);
          fetchNotifs();
        }}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <div
          data-testid="notification-drawer"
          className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  data-testid="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center space-x-1 disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-800 px-4 py-2 bg-slate-950/40 text-xs font-medium space-x-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === "all"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === "unread"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 max-h-96">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Bell className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
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
                    className={`p-3.5 hover:bg-slate-800/50 transition cursor-pointer flex items-start space-x-3 text-left ${
                      !notif.isRead ? "bg-indigo-950/20" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                        isHighPriority
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : notif.type.includes("resolved") || notif.type.includes("confirmed")
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                      }`}
                    >
                      {isHighPriority ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs truncate ${
                            !notif.isRead
                              ? "font-bold text-white"
                              : "font-medium text-slate-300"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>

                        <div className="flex items-center space-x-2">
                          {!notif.isRead && (
                            <button
                              type="button"
                              data-testid={`mark-read-${notif.id}`}
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-slate-400 hover:text-indigo-300 p-0.5 rounded transition"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(notif.incidentId || notif.complaintId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(notif);
                              }}
                              className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-0.5 text-[11px] font-medium transition cursor-pointer"
                            >
                              <span>View</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
