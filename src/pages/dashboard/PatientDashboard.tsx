import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, User, ClipboardList, LogOut, Menu, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { cn } from "@/lib/utils";
import { useState, ReactNode } from "react";

const patientNavItems = [
  { label: "Mon espace", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mon profil", href: "/dashboard/profile", icon: User },
  { label: "Mes inscriptions", href: "/dashboard/registrations", icon: ClipboardList },
];

const PatientDashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-medsquare.png" alt="Medsquare" className="h-12 w-auto" />
          </Link>
        </div>

        <div className="p-4 border-b border-border">
          <p className="font-semibold text-sm truncate">
            {profile?.first_name} {profile?.last_name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Heart className="h-3 w-3 text-primary" />
            <p className="text-xs text-muted-foreground">Patient</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {patientNavItems.map((item) => (
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
        </nav>

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

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent mr-3"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold flex-1">
            {patientNavItems.find((i) => i.href === location.pathname)?.label || "Mon espace"}
          </h1>
          <NotificationBell />
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default PatientDashboardLayout;
