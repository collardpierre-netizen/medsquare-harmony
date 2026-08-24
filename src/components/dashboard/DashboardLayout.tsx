import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  CalendarDays,
  FileText,
  Users,
  DoorOpen,
  CalendarCheck,
  LogOut,
  Menu,
  Activity,
  ClipboardList,
  TrendingUp,
  Settings,
  Download,
  BookOpen,
  Scale,
  Star,
  MessageCircle,
  Receipt,
  Bell,
  Lock,
  FileSignature,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mon profil", href: "/dashboard/profile", icon: User },
  { label: "Réservations", href: "/dashboard/bookings", icon: CalendarDays },
  { label: "Mes activités", href: "/dashboard/activities", icon: Activity },
  
  { label: "Mes inscriptions", href: "/dashboard/registrations", icon: ClipboardList },
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  { label: "Documents juridiques", href: "/dashboard/legal-documents", icon: Scale },
  { label: "Export journalier", href: "/dashboard/export", icon: Download },
  { label: "Mes tarifs", href: "/dashboard/rates", icon: Receipt },
  { label: "Avis patients", href: "/dashboard/reviews", icon: Star },
  { label: "Questions & Réponses", href: "/dashboard/qna", icon: MessageCircle },
  { label: "Guide praticien", href: "/dashboard/guide", icon: BookOpen },
  { label: "Praticiens", href: "/dashboard/admin/practitioners", icon: Users, adminOnly: true },
  { label: "Salles", href: "/dashboard/admin/rooms", icon: DoorOpen, adminOnly: true },
  { label: "Privatisations", href: "/dashboard/admin/privatizations", icon: Lock, adminOnly: true },
  { label: "Forfaits locataires", href: "/dashboard/admin/contracts", icon: FileSignature, adminOnly: true },
  { label: "Toutes les réservations", href: "/dashboard/admin/bookings", icon: CalendarCheck, adminOnly: true },
  { label: "Inscriptions activités", href: "/dashboard/admin/registrations", icon: ClipboardList, adminOnly: true },
  { label: "Statistiques", href: "/dashboard/admin/analytics", icon: TrendingUp, adminOnly: true },
  { label: "Documents juridiques", href: "/dashboard/admin/legal-documents", icon: Scale, adminOnly: true },
  { label: "Notifications", href: "/dashboard/admin/notifications", icon: Bell, adminOnly: true },
  { label: "Annonce praticiens", href: "/dashboard/admin/practitioner-notice", icon: Megaphone, adminOnly: true },
  { label: "Paramètres du site", href: "/dashboard/admin/site-settings", icon: Settings, adminOnly: true },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingLegalCount, setPendingLegalCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      const { data: docs } = await supabase
        .from("legal_documents")
        .select("id, version")
        .eq("is_active", true);
      if (!docs || docs.length === 0) { setPendingLegalCount(0); return; }
      const { data: acks } = await supabase
        .from("legal_document_acknowledgments")
        .select("document_id, version_acknowledged")
        .eq("user_id", user.id);
      const ackMap = new Map((acks || []).map((a: any) => [a.document_id, a.version_acknowledged]));
      const pending = docs.filter((d: any) => {
        const v = ackMap.get(d.id);
        return !v || v < d.version;
      });
      setPendingLegalCount(pending.length);
    };
    fetchPending();
  }, [user, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-medsquare.png" alt="Medsquare" className="h-12 w-auto" />
          </Link>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-border">
          <p className="font-semibold text-sm truncate">
            {profile?.first_name} {profile?.last_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {isAdmin ? "Administrateur" : "Praticien"}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isAdmin && (
            <p className="px-3 py-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Mon espace
            </p>
          )}
          {filteredItems
            .filter((i) => !i.adminOnly)
            .map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/dashboard/legal-documents" && pendingLegalCount > 0 && (
                  <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingLegalCount}
                  </span>
                )}
              </Link>
            ))}

          {isAdmin && (
            <>
              <p className="px-3 py-2 mt-4 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Administration
              </p>
              {filteredItems
                .filter((i) => i.adminOnly)
                .map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      location.pathname === item.href
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
            </>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent mr-3"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold flex-1">
            {filteredItems.find((i) => i.href === location.pathname)?.label || "Dashboard"}
          </h1>
          <NotificationBell />
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
