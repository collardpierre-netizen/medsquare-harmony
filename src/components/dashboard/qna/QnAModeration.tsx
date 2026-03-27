import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Check, Trash2, Clock, Send, User } from "lucide-react";

interface QnA {
  id: string;
  question: string;
  answer: string | null;
  category: string | null;
  author_name: string | null;
  is_published: boolean;
  created_at: string;
}

const CATEGORIES: Record<string, string> = {
  general: "Général",
  tarifs: "Tarifs",
  rdv: "Rendez-vous",
  soins: "Soins",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });
}

const QnAModeration = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [qnas, setQnas] = useState<QnA[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const fetchQnas = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("practitioner_qna")
      .select("*")
      .eq("practitioner_id", profile.id)
      .order("created_at", { ascending: false });
    setQnas((data as QnA[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchQnas(); }, [profile]);

  const handleAnswer = async (id: string) => {
    const text = answerText[id]?.trim();
    if (!text) return;
    setSaving(id);
    const { error } = await supabase
      .from("practitioner_qna")
      .update({ answer: text, is_published: true })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Erreur" });
    } else {
      toast({ title: "Réponse publiée" });
      setAnswerText((prev) => ({ ...prev, [id]: "" }));
      fetchQnas();
    }
    setSaving(null);
  };

  const handleTogglePublish = async (id: string, publish: boolean) => {
    await supabase.from("practitioner_qna").update({ is_published: publish }).eq("id", id);
    toast({ title: publish ? "Question publiée" : "Question masquée" });
    fetchQnas();
  };

  const pending = qnas.filter((q) => !q.is_published);
  const published = qnas.filter((q) => q.is_published);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const QnACard = ({ qna, isPending }: { qna: QnA; isPending: boolean }) => (
    <Card className="shadow-none">
      <CardContent className="p-4 space-y-3">
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
                {qna.author_name || "Anonyme"} · {formatDate(qna.created_at)}
              </span>
            </div>
            <p className="font-medium text-sm">{qna.question}</p>
          </div>
        </div>

        {qna.answer && (
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-medium text-primary mb-1">Votre réponse :</p>
            <p className="text-sm">{qna.answer}</p>
          </div>
        )}

        {isPending && !qna.answer && (
          <div className="space-y-2">
            <Textarea
              value={answerText[qna.id] || ""}
              onChange={(e) => setAnswerText((prev) => ({ ...prev, [qna.id]: e.target.value }))}
              placeholder="Rédigez votre réponse..."
              rows={2}
              maxLength={1000}
            />
            <Button
              size="sm"
              onClick={() => handleAnswer(qna.id)}
              disabled={!answerText[qna.id]?.trim() || saving === qna.id}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {saving === qna.id ? "Envoi..." : "Répondre et publier"}
            </Button>
          </div>
        )}

        {!isPending && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleTogglePublish(qna.id, false)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Masquer
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending" className="gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          En attente
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center text-[10px] rounded-full">
              {pending.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="published" className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Publiées ({published.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4 space-y-3">
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Aucune question en attente.</p>
        ) : (
          pending.map((q) => <QnACard key={q.id} qna={q} isPending />)
        )}
      </TabsContent>

      <TabsContent value="published" className="mt-4 space-y-3">
        {published.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Aucune Q&R publiée.</p>
        ) : (
          published.map((q) => <QnACard key={q.id} qna={q} isPending={false} />)
        )}
      </TabsContent>
    </Tabs>
  );
};

export default QnAModeration;
