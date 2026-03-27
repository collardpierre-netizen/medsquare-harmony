import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, Archive, X, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
}

interface PractitionerNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  cta_label: string | null;
  cta_url: string | null;
  created_at: string;
}

const NotificationBell = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [practNotifs, setPractNotifs] = useState<PractitionerNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "bookings" | "activities" | "registrations" | "features" | "archived">("all");

  const unreadCount = notifications.filter((n) => !n.is_read).length + practNotifs.filter((n) => !n.is_read).length;

  const getNotificationType = (title: string): "bookings" | "activities" | "registrations" => {
    if (title.includes("réservation") || title.includes("Réservation")) return "bookings";
    if (title.includes("séance") || title.includes("Séance")) return "activities";
    if (title.includes("inscription") || title.includes("Inscription")) return "registrations";
    return "bookings";
  };

  const activeNotifications = notifications.filter((n) => !n.is_archived);
  const archivedNotifications = notifications.filter((n) => n.is_archived);

  const filteredNotifications = (() => {
    if (filter === "features") return [];
    if (filter === "all") return activeNotifications;
    if (filter === "archived") return archivedNotifications;
    return activeNotifications.filter((n) => getNotificationType(n.title) === filter);
  })();

  const filteredPractNotifs = filter === "all" || filter === "features" ? practNotifs : [];

  const filterCounts = {
    all: activeNotifications.length + practNotifs.length,
    bookings: activeNotifications.filter((n) => getNotificationType(n.title) === "bookings").length,
    activities: activeNotifications.filter((n) => getNotificationType(n.title) === "activities").length,
    registrations: activeNotifications.filter((n) => getNotificationType(n.title) === "registrations").length,
    features: practNotifs.length,
    archived: archivedNotifications.length,
  };

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) || []);
  };

  const fetchPractNotifs = async () => {
    if (!user || !profile) return;
    const { data } = await supabase
      .from("practitioner_notifications")
      .select("*")
      .eq("practitioner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setPractNotifs((data as PractitionerNotification[]) || []);
  };

  useEffect(() => {
    fetchNotifications();
    fetchPractNotifs();

    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          toast({ title: newNotif.title, description: newNotif.message });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "practitioner_notifications" },
        (payload) => {
          const n = payload.new as PractitionerNotification;
          setPractNotifs((prev) => [n, ...prev]);
          toast({ title: n.title, description: n.body });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markPractNotifRead = async (id: string) => {
    await supabase.from("practitioner_notifications").update({ is_read: true } as any).eq("id", id);
    setPractNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    }
    const unreadPractIds = practNotifs.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadPractIds.length > 0) {
      await supabase.from("practitioner_notifications").update({ is_read: true } as any).in("id", unreadPractIds);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setPractNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const archiveAll = async () => {
    const ids = activeNotifications.map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ is_archived: true, is_read: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_archived: true, is_read: true } : n)));
    setFilter("archived");
  };

  const archiveNotification = async (id: string) => {
    await supabase.from("notifications").update({ is_archived: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_archived: true, is_read: true } : n)));
  };

  const unarchiveNotification = async (id: string) => {
    await supabase.from("notifications").update({ is_archived: false }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_archived: false } : n)));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "success": return "✅";
      case "error": return "❌";
      case "feature_announcement": return "🚀";
      case "profile_incomplete": return "📋";
      case "new_qna_pending": return "❓";
      case "rates_reminder": return "💰";
      default: return "ℹ️";
    }
  };

  const handlePractNotifClick = (notif: PractitionerNotification) => {
    if (!notif.is_read) markPractNotifRead(notif.id);
    if (notif.cta_url) {
      setOpen(false);
      navigate(notif.cta_url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-display font-semibold text-sm">Notifications</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Tout lire
              </Button>
            )}
            {activeNotifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={archiveAll}>
                <Archive className="h-3.5 w-3.5 mr-1" /> Tout archiver
              </Button>
            )}
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-border bg-muted/30">
          {(["all", "features", "bookings", "activities", "registrations", "archived"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 shrink-0"
              onClick={(e) => { e.stopPropagation(); setFilter(f); }}
            >
              <span className="text-xs">
                {f === "all" ? "Tous" : f === "features" ? "Nouveautés" : f === "bookings" ? "Réserv." : f === "activities" ? "Séances" : f === "registrations" ? "Inscriptions" : "Archivées"}
              </span>
              {filterCounts[f] > 0 && <span className="ml-1 text-[10px] opacity-75">({filterCounts[f]})</span>}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {/* Practitioner notifications (features) */}
          {filteredPractNotifs.map((notif) => (
            <div
              key={`pn-${notif.id}`}
              onClick={() => handlePractNotifClick(notif)}
              className={cn(
                "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors cursor-pointer hover:bg-muted/50",
                !notif.is_read && "bg-[#534AB7]/5"
              )}
            >
              <span className="text-base mt-0.5 shrink-0">{typeIcon(notif.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{notif.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                {notif.cta_label && (
                  <button className="text-xs font-medium mt-1.5 flex items-center gap-1" style={{ color: "#534AB7" }}>
                    {notif.cta_label} <ExternalLink className="h-3 w-3" />
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          ))}

          {/* System notifications */}
          {filteredNotifications.length === 0 && filteredPractNotifs.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {filter === "all" ? "Aucune notification" : "Aucune notification de ce type"}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
                  !notif.is_read && "bg-accent/50"
                )}
              >
                <span className="text-base mt-0.5 shrink-0">{typeIcon(notif.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{notif.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!notif.is_read && !notif.is_archived && (
                    <button onClick={() => markAsRead(notif.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Marquer comme lu">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                  {!notif.is_archived ? (
                    <button onClick={() => archiveNotification(notif.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Archiver">
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ) : (
                    <button onClick={() => unarchiveNotification(notif.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Désarchiver">
                      <Archive className="h-3.5 w-3.5 text-primary" />
                    </button>
                  )}
                  <button onClick={() => deleteNotification(notif.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Supprimer">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
