import { ReactNode } from "react";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  { label: "Mes espaces", href: "/dashboard/rooms", icon: DoorOpen },
  { label: "Mes inscriptions", href: "/dashboard/registrations", icon: ClipboardList },
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  { label: "Praticiens", href: "/dashboard/admin/practitioners", icon: Users, adminOnly: true },
  { label: "Salles", href: "/dashboard/admin/rooms", icon: DoorOpen, adminOnly: true },
  { label: "Toutes les réservations", href: "/dashboard/admin/bookings", icon: CalendarCheck, adminOnly: true },
  { label: "Statistiques", href: "/dashboard/admin/analytics", icon: TrendingUp, adminOnly: true },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                {item.label}
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
