import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Save,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import RichTextEditor from "@/components/dashboard/legal/RichTextEditor";

interface LegalDocument {
  id: string;
  title: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Acknowledgment {
  user_id: string;
  version_acknowledged: number;
  acknowledged_at: string;
}

const AdminLegalDocuments = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LegalDocument | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LegalDocument | null>(null);

  // Acknowledgment stats
  const [ackStats, setAckStats] = useState<Record<string, { total: number; acknowledged: number }>>({});
  const [showAckDialog, setShowAckDialog] = useState<string | null>(null);
  const [ackDetails, setAckDetails] = useState<any[]>([]);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from("legal_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocuments((data as any[]) || []);
    setLoading(false);

    // Fetch acknowledgment stats
    if (data && data.length > 0) {
      // Get all practitioners
      const { data: practitioners } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("is_active", true);

      const totalPractitioners = practitioners?.length || 0;

      const stats: Record<string, { total: number; acknowledged: number }> = {};
      for (const doc of data) {
        const { count } = await supabase
          .from("legal_document_acknowledgments")
          .select("*", { count: "exact", head: true })
          .eq("document_id", doc.id)
          .eq("version_acknowledged", doc.version);
        stats[doc.id] = { total: totalPractitioners, acknowledged: count || 0 };
      }
      setAckStats(stats);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const openCreate = () => {
    setEditingDoc(null);
    setTitle("");
    setContent("");
    setIsActive(true);
    setShowEditor(true);
  };

  const openEdit = (doc: LegalDocument) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setContent(doc.content);
    setIsActive(doc.is_active);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    if (editingDoc) {
      // Save current version to history
      await supabase.from("legal_document_versions").insert({
        document_id: editingDoc.id,
        title: editingDoc.title,
        content: editingDoc.content,
        version: editingDoc.version,
        created_by: user?.id,
      } as any);

      // Update document with new version
      const { error } = await supabase
        .from("legal_documents")
        .update({
          title,
          content,
          is_active: isActive,
          version: editingDoc.version + 1,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", editingDoc.id);

      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: `Document mis à jour (v${editingDoc.version + 1}) ✅` });
      }
    } else {
      const { error } = await supabase.from("legal_documents").insert({
        title,
        content,
        is_active: isActive,
        created_by: user?.id,
      } as any);

      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Document créé ✅" });
      }
    }

    setSaving(false);
    setShowEditor(false);
    fetchDocuments();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("legal_documents")
      .delete()
      .eq("id", deleteTarget.id);

    if (!error) {
      toast({ title: "Document supprimé" });
      fetchDocuments();
    } else {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
    setDeleteTarget(null);
  };

  const viewAcknowledgments = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    // Get all practitioners with their ack status
    const { data: practitioners } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("is_active", true);

    const { data: acks } = await supabase
      .from("legal_document_acknowledgments")
      .select("*")
      .eq("document_id", docId);

    const details = (practitioners || []).map((p: any) => {
      const ack = (acks as any[] || []).find((a: any) => a.user_id === p.user_id);
      return {
        ...p,
        acknowledged: ack ? ack.version_acknowledged >= doc.version : false,
        version_acknowledged: ack?.version_acknowledged,
        acknowledged_at: ack?.acknowledged_at,
      };
    });

    setAckDetails(details);
    setShowAckDialog(docId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Documents juridiques</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gérez les conditions générales, règlement intérieur et autres documents du centre.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau document
          </Button>
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
                  Aucun document juridique créé.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">v{doc.version}</Badge>
                          {doc.is_active ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                          )}
                          {ackStats[doc.id] && (
                            <Badge
                              variant="outline"
                              className="text-[10px] cursor-pointer hover:bg-accent"
                              onClick={() => viewAcknowledgments(doc.id)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {ackStats[doc.id].acknowledged}/{ackStats[doc.id].total} lu
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(doc.updated_at), "d MMM yyyy", { locale: fr })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 ml-3 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEdit(doc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingDoc ? `Modifier — ${editingDoc.title}` : "Nouveau document juridique"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Titre du document</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Conditions générales du centre"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Contenu</Label>
              <div className="mt-1.5">
                <RichTextEditor content={content} onChange={setContent} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Document actif (visible par les praticiens)</Label>
            </div>
            {editingDoc && (
              <p className="text-xs text-muted-foreground">
                Version actuelle : v{editingDoc.version} — L'enregistrement créera la v{editingDoc.version + 1}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document « {deleteTarget?.title} » et tout son historique seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Acknowledgment details */}
      <Dialog open={!!showAckDialog} onOpenChange={() => setShowAckDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Accusés de réception</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {ackDetails.map((p) => (
              <div
                key={p.user_id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <span className="text-sm font-medium">
                  {p.first_name} {p.last_name}
                </span>
                {p.acknowledged ? (
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">
                      v{p.version_acknowledged} — {format(new Date(p.acknowledged_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Non lu</Badge>
                )}
              </div>
            ))}
            {ackDetails.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun praticien actif.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminLegalDocuments;
