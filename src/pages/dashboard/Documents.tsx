import { useEffect, useState } from "react";
import { FileText, Download, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Documents = () => {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchDocuments = async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("practitioner_id", profile.id)
        .order("created_at", { ascending: false });

      setDocuments(data || []);
      setLoading(false);
    };

    fetchDocuments();
  }, [profile]);

  const typeLabel = (type: string) => {
    switch (type) {
      case "contract":
        return <Badge variant="secondary">Contrat</Badge>;
      case "invoice":
        return <Badge variant="secondary">Facture</Badge>;
      default:
        return <Badge variant="secondary">Autre</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold">Mes documents</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Consultez et téléchargez vos documents (contrats, factures).
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Aucun document disponible pour le moment.
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Vos documents seront mis à disposition par l'administration.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {typeLabel(doc.document_type)}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Télécharger
                      </Button>
                    </a>
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

export default Documents;
