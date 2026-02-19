import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles }: ProtectedRouteProps) => {
  const { user, isAdmin, roles, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Practitioner with pending activation
  const isPractitioner = roles.includes("practitioner");
  if (isPractitioner && profile && !profile.is_active && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border max-w-md text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Compte en attente d'activation</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Votre compte professionnel est en cours de vérification par l'administration de Medsquare. 
            Vous recevrez un email dès que votre accès sera activé.
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r)) && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
