import { useEffect, useState, useRef } from "react";
import {
  FileText,
  Download,
  Calendar,
  Upload,
  Trash2,
  Plus,
  File,
  FileSpreadsheet,
  FileImage,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const DOC_TYPES = [
  { value: "invoice", label: "Facture" },
  { value: "contract", label: "Contrat" },
  { value: "other", label: "Autre" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-5 w-5 text-destructive" />;
  if (["xls", "xlsx", "csv"].includes(ext || ""))
    return <FileSpreadsheet className="h-5 w-5 text-primary" />;
  if (["jpg", "jpeg", "png", "webp"].includes(ext || ""))
    return <FileImage className="h-5 w-5 text-accent-foreground" />;
  return <File className="h-5 w-5 text-primary" />;
};

const Documents = () => {
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("other");

  // Admin: select practitioner to upload for
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [targetPractitionerId, setTargetPractitionerId] = useState("");

  const fetchDocuments = async () => {
    if (!profile) return;

    let query = supabase
      .from("documents")
      .select("*, profiles(first_name, last_name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("practitioner_id", profile.id);
    }

    const { data } = await query;
    setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();

    if (isAdmin) {
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name")
        .then(({ data }) => setPractitioners(data || []));
    }
  }, [profile, isAdmin]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10 Mo.",
      });
      return;
    }

    setSelectedFile(file);
    if (!docName) {
      setDocName(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !profile) return;
    setUploading(true);

    // Determine which practitioner this document is for
    const practId = isAdmin && targetPractitionerId
      ? targetPractitionerId
      : profile.id;

    // Get the user_id for the target practitioner (for storage folder)
    let folderUserId = user.id;
    if (isAdmin && targetPractitionerId) {
      const pract = practitioners.find((p) => p.id === targetPractitionerId);
      if (pract) {
        // We need the user_id of this practitioner for the storage folder
        const { data: practProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", targetPractitionerId)
          .maybeSingle();
        if (practProfile) folderUserId = practProfile.user_id;
      }
    }

    const ext = selectedFile.name.split(".").pop();
    const fileName = `${folderUserId}/${Date.now()}_${docName.replace(/\s+/g, "_")}.${ext}`;

    // Upload to storage
    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(fileName, selectedFile, { upsert: false });

    if (storageError) {
      toast({
        variant: "destructive",
        title: "Erreur d'upload",
        description: storageError.message,
      });
      setUploading(false);
      return;
    }

    // Get signed URL (private bucket)
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10); // 10 years

    const fileUrl = urlData?.signedUrl || fileName;

    // Insert document record
    const { error: dbError } = await supabase.from("documents").insert({
      name: docName || selectedFile.name,
      document_type: docType,
      file_url: fileUrl,
      practitioner_id: practId,
      uploaded_by: user.id,
    });

    if (dbError) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: dbError.message,
      });
    } else {
      toast({ title: "Document uploadé ✅" });
      setShowUpload(false);
      setSelectedFile(null);
      setDocName("");
      setDocType("other");
      setTargetPractitionerId("");
      fetchDocuments();
    }

    setUploading(false);
  };

  const handleDelete = async (doc: any) => {
    // Extract storage path from the signed URL or file_url
    // Try to delete from storage first
    const pathMatch = doc.file_url.match(/documents\/([^?]+)/);
    if (pathMatch) {
      await supabase.storage.from("documents").remove([pathMatch[1]]);
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (!error) {
      toast({ title: "Document supprimé" });
      fetchDocuments();
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const handleDownload = async (doc: any) => {
    // If it's a signed URL, just open it
    window.open(doc.file_url, "_blank");
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">
              {isAdmin ? "Gestion des documents" : "Mes documents"}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAdmin
                ? "Uploadez et gérez les documents des praticiens."
                : "Consultez, uploadez et téléchargez vos documents."}
            </p>
          </div>
          <Button onClick={() => setShowUpload(true)}>
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
                  Aucun document disponible.
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Cliquez sur "Nouveau document" pour en ajouter un.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {getFileIcon(doc.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {typeLabel(doc.document_type)}
                          {isAdmin && doc.profiles && (
                            <Badge variant="outline" className="text-[10px]">
                              {doc.profiles.first_name} {doc.profiles.last_name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(doc.created_at), "d MMM yyyy", {
                              locale: fr,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-3 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc)}
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

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Nouveau document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  {getFileIcon(selectedFile.name)}
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour sélectionner un fichier
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    PDF, Word, Excel, images — max 10 Mo
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
              />
            </div>

            <div>
              <Label>Nom du document</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Ex: Facture Janvier 2026"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Type de document</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Admin: select practitioner */}
            {isAdmin && practitioners.length > 0 && (
              <div>
                <Label>Praticien concerné</Label>
                <Select
                  value={targetPractitionerId}
                  onValueChange={setTargetPractitionerId}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner un praticien" />
                  </SelectTrigger>
                  <SelectContent>
                    {practitioners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !docName}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Upload en cours..." : "Uploader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Documents;
