import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, User, ChevronDown, ChevronUp } from "lucide-react";

interface QnA {
  id: string;
  question: string;
  answer: string | null;
  category: string | null;
  author_name: string | null;
  created_at: string;
}

interface Props {
  practitionerId: string;
  practitionerName: string;
}

const CATEGORIES: Record<string, string> = {
  general: "Général",
  tarifs: "Tarifs",
  rdv: "Rendez-vous",
  soins: "Soins",
};

const PractitionerTabQR = ({ practitionerId, practitionerName }: Props) => {
  const { toast } = useToast();
  const [qnas, setQnas] = useState<QnA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    author_name: "",
    question: "",
    category: "general",
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("practitioner_qna")
        .select("id, question, answer, category, author_name, created_at")
        .eq("practitioner_id", practitionerId)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setQnas((data as QnA[]) || []);
      setLoading(false);
    };
    fetch();
  }, [practitionerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim()) {
      toast({ variant: "destructive", title: "Question requise" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("practitioner_qna").insert({
      practitioner_id: practitionerId,
      question: form.question.trim(),
      author_name: form.author_name.trim() || "Anonyme",
      category: form.category,
    });
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer votre question." });
    } else {
      toast({ title: "Question envoyée !", description: "Le praticien vous répondra prochainement." });
      setForm({ author_name: "", question: "", category: "general" });
      setShowForm(false);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg">Questions & Réponses</h3>
          <p className="text-sm text-muted-foreground">
            {qnas.length > 0
              ? `${qnas.length} question${qnas.length > 1 ? "s" : ""} · réponses de ${practitionerName}`
              : "Posez votre question, le praticien vous répondra."}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <MessageCircle className="h-4 w-4 mr-1.5" />
          {showForm ? "Annuler" : "Poser une question"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="qna_question">Votre question *</Label>
                <Textarea
                  id="qna_question"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder="Ex: Quels sont vos délais pour un premier rendez-vous ?"
                  className="mt-1.5"
                  rows={3}
                  maxLength={500}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="qna_name">Votre prénom (optionnel)</Label>
                  <Input
                    id="qna_name"
                    value={form.author_name}
                    onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                    placeholder="Anonyme"
                    className="mt-1.5"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label htmlFor="qna_cat">Catégorie</Label>
                  <select
                    id="qna_cat"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Votre question sera publiée après réponse du praticien.
              </p>
              <Button type="submit" disabled={submitting}>
                <Send className="h-4 w-4 mr-1.5" />
                {submitting ? "Envoi..." : "Envoyer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Q&A list */}
      {qnas.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <p className="font-display font-semibold">Aucune question pour le moment</p>
          <p className="text-sm text-muted-foreground mt-1">Soyez le premier à poser une question !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {qnas.map((qna) => (
            <Card
              key={qna.id}
              className="shadow-none cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setExpandedId(expandedId === qna.id ? null : qna.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {qna.category && CATEGORIES[qna.category] && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {CATEGORIES[qna.category]}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {qna.author_name || "Anonyme"}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{qna.question}</p>
                  </div>
                  {qna.answer && (
                    expandedId === qna.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </div>

                {qna.answer && expandedId === qna.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageCircle className="h-3 w-3 text-primary" />
                      </div>
                      <p className="text-xs font-medium text-primary">{practitionerName}</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{qna.answer}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PractitionerTabQR;
