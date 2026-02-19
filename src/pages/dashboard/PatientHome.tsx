import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { ClipboardList, Activity, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const PatientHome = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold">
          Bonjour {profile?.first_name} 👋
        </h2>
        <p className="text-muted-foreground mt-1">
          Bienvenue dans votre espace patient Medsquare.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/dashboard/registrations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Mes inscriptions</h3>
              <p className="text-sm text-muted-foreground">
                Consultez et gérez vos inscriptions aux activités.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/activites">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Découvrir les activités</h3>
              <p className="text-sm text-muted-foreground">
                Explorez les activités proposées par nos praticiens.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/dashboard/profile">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Mon profil</h3>
              <p className="text-sm text-muted-foreground">
                Gérez vos informations personnelles.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default PatientHome;
