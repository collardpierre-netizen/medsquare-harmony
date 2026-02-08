import { useEffect, useState } from "react";
import { Users, Plus, Edit, Ban, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const AdminPractitioners = () => {
  const { toast } = useToast();
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPractitioners = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*, user_roles(role)")
      .order("last_name");
    setPractitioners(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPractitioners();
  }, []);

  const toggleActive = async (practitioner: any) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !practitioner.is_active })
      .eq("id", practitioner.id);

    if (!error) {
      toast({
        title: practitioner.is_active ? "Praticien désactivé" : "Praticien activé",
      });
      fetchPractitioners();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Gestion des praticiens</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gérez les profils et les accès des praticiens.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : practitioners.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun praticien enregistré.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {practitioners.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-sm">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {p.first_name} {p.last_name}
                          </p>
                          {p.user_roles?.some((r: any) => r.role === "admin") && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.specialty || "Spécialité non renseignée"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          p.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-600 border-red-200"
                        }
                      >
                        {p.is_active ? "Actif" : "Inactif"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(p)}
                      >
                        {p.is_active ? (
                          <Ban className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPractitioners;
