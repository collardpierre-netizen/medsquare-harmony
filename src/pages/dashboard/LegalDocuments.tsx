import { useEffect, useState, useRef } from "react";
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  Eye,
  Info,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import jsPDF from "jspdf";
import { useLegalNotice, toPdfSafeText, formatNoticeDate } from "@/components/dashboard/legal/legalNotice";


interface LegalDocument {
  id: string;
  title: string;
  content: string;
  version: number;
  updated_at: string;
}

interface Acknowledgment {
  document_id: string;
  version_acknowledged: number;
  acknowledged_at: string;
}

const LegalDocuments = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Acknowledgment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDoc, setViewDoc] = useState<LegalDocument | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const notice = useLegalNotice();


  const fetchData = async () => {
    const [{ data: docs }, { data: acks }] = await Promise.all([
      supabase
        .from("legal_documents")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("legal_document_acknowledgments")
        .select("document_id, version_acknowledged, acknowledged_at")
        .eq("user_id", user?.id || ""),
    ]);
    setDocuments((docs as any[]) || []);
    setAcknowledgments((acks as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const isAcknowledged = (doc: LegalDocument) => {
    const ack = acknowledgments.find((a) => a.document_id === doc.id);
    return ack ? ack.version_acknowledged >= doc.version : false;
  };

  const handleAcknowledge = async (doc: LegalDocument) => {
    if (!user) return;
    setAcknowledging(true);

    const existing = acknowledgments.find((a) => a.document_id === doc.id);

    if (existing) {
      await supabase
        .from("legal_document_acknowledgments")
        .update({
          version_acknowledged: doc.version,
          acknowledged_at: new Date().toISOString(),
        } as any)
        .eq("document_id", doc.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("legal_document_acknowledgments").insert({
        document_id: doc.id,
        user_id: user.id,
        version_acknowledged: doc.version,
      } as any);
    }

    toast({ title: "Document marqué comme lu ✅" });
    setAcknowledging(false);
    fetchData();
  };

  const handleExportPdf = (doc: LegalDocument) => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(doc.title, 20, 25);

    // Version & date
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `Version ${doc.version} — ${format(new Date(doc.updated_at), "d MMMM yyyy", { locale: fr })}`,
      20,
      33
    );

    // Separator
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, 36, 190, 36);

    // Content: strip HTML tags for PDF
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 40, 40);

    const tempEl = document.createElement("div");
    tempEl.innerHTML = doc.content;
    const plainText = tempEl.innerText || tempEl.textContent || "";

    const lines = pdf.splitTextToSize(plainText, 170);
    let y = 44;
    const pageHeight = 280;

    for (const line of lines) {
      if (y > pageHeight) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 20, y);
      y += 6;
    }

    // Encart configurable depuis l'espace admin
    if (notice?.enabled) {
      const noticeText = toPdfSafeText(notice.message);
      pdf.setFontSize(10);
      const noticeLines = pdf.splitTextToSize(noticeText, 160);
      const metaParts: string[] = [];
      if (notice.effectiveDate)
        metaParts.push(`Date d'effet : ${formatNoticeDate(notice.effectiveDate)}`);
      if (notice.updatedAt)
        metaParts.push(
          `Derniere mise a jour : ${formatNoticeDate(notice.updatedAt)}`
        );
      const metaLine = toPdfSafeText(metaParts.join("   |   "));
      const boxHeight = noticeLines.length * 5 + 14 + (metaLine ? 6 : 0);

      y += 6;
      if (y + boxHeight > pageHeight) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFillColor(245, 245, 240);
      pdf.setDrawColor(200, 195, 180);
      pdf.rect(20, y, 170, boxHeight, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(60, 60, 60);
      pdf.text(toPdfSafeText(notice.title), 25, y + 7);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(70, 70, 70);
      let ny = y + 13;
      for (const line of noticeLines) {
        pdf.text(line, 25, ny);
        ny += 5;
      }
      if (metaLine) {
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(metaLine, 25, ny + 1);
        pdf.setFontSize(10);
      }
      y += boxHeight + 6;
    }




    // Footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(160, 160, 160);
      pdf.text(`Medsquare — ${doc.title} (v${doc.version})`, 20, 290);
      pdf.text(`Page ${i}/${totalPages}`, 175, 290);
    }

    pdf.save(`${doc.title.replace(/\s+/g, "_")}_v${doc.version}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold">Documents juridiques</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Consultez les conditions générales, règlement et documents du centre.
          </p>
        </div>

        {notice?.enabled && (
          <Alert className="bg-amber-50/50 border-amber-200/60 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-100">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">
              {notice.title}
            </AlertTitle>
            <AlertDescription className="text-amber-800/90 dark:text-amber-200/90 whitespace-pre-line">
              {notice.message}
            </AlertDescription>
            {(notice.effectiveDate || notice.updatedAt) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700/90 dark:text-amber-300/80">
                {notice.effectiveDate && (
                  <span>
                    Date d'effet : {formatNoticeDate(notice.effectiveDate)}
                  </span>
                )}
                {notice.updatedAt && (
                  <span>
                    Dernière mise à jour : {formatNoticeDate(notice.updatedAt)}
                  </span>
                )}
              </div>
            )}
          </Alert>
        )}



        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun document disponible.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const acked = isAcknowledged(doc);
                  return (
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
                            {acked ? (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Lu et approuvé
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                À lire
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setAccepted(false); setViewDoc(doc); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportPdf(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Document Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={() => { setViewDoc(null); setAccepted(false); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{viewDoc.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">v{viewDoc.version}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Mis à jour le {format(new Date(viewDoc.updated_at), "d MMMM yyyy", { locale: fr })}
                  </span>
                </div>
              </DialogHeader>
              <div
                ref={contentRef}
                className="prose prose-sm max-w-none py-4"
                dangerouslySetInnerHTML={{ __html: viewDoc.content }}
              />

              {notice?.enabled && (
                <Alert className="bg-amber-50/50 border-amber-200/60 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-100">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-900 dark:text-amber-100">
                    {notice.title}
                  </AlertTitle>
                  <AlertDescription className="text-amber-800/90 dark:text-amber-200/90 whitespace-pre-line">
                    {notice.message}
                  </AlertDescription>
                  {(notice.effectiveDate || notice.updatedAt) && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700/90 dark:text-amber-300/80">
                      {notice.effectiveDate && (
                        <span>Date d'effet : {formatNoticeDate(notice.effectiveDate)}</span>
                      )}
                      {notice.updatedAt && (
                        <span>
                          Dernière mise à jour : {formatNoticeDate(notice.updatedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </Alert>
              )}

              {!isAcknowledged(viewDoc) && (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 mt-2">
                  <Checkbox
                    id="legal-accept"
                    checked={accepted}
                    onCheckedChange={(v) => setAccepted(v === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="legal-accept"
                    className="text-xs leading-relaxed font-normal cursor-pointer"
                  >
                    J'ai lu et j'accepte le contenu de ce document
                    {notice?.enabled ? `, y compris la clause « ${notice.title} »` : ""}
                    {notice?.enabled && notice.effectiveDate
                      ? ` applicable à partir du ${formatNoticeDate(notice.effectiveDate)}`
                      : ""}
                    .
                  </Label>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExportPdf(viewDoc)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter en PDF
                </Button>
                {!isAcknowledged(viewDoc) && (
                  <Button
                    onClick={() => handleAcknowledge(viewDoc)}
                    disabled={acknowledging || !accepted}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {acknowledging ? "En cours..." : "Lu et approuvé"}
                  </Button>
                )}
              </DialogFooter>

            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default LegalDocuments;
