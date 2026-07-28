import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Star, Check, X, Clock, Eye, Mail } from "lucide-react";

interface Review {
  id: string;
  score_global: number;
  score_punctuality: number | null;
  score_listening: number | null;
  score_premises: number | null;
  score_explanation: number | null;
  review_text: string | null;
  author_name: string;
  author_email: string | null;
  is_approved: boolean;
  is_verified: boolean;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} className={(value / 2) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"} />
      ))}
    </div>
  );
}

const ReviewModeration = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("practitioner_reviews")
      .select("id, score_global, score_punctuality, score_listening, score_premises, score_explanation, review_text, author_name, is_approved, is_verified, created_at")
      .eq("practitioner_id", profile.id)
      .order("created_at", { ascending: false });

    const list = ((data as Review[]) || []).map((r) => ({ ...r, author_email: null as string | null }));

    if (list.length > 0) {
      const { data: emails } = await supabase.rpc("get_review_author_emails", {
        review_ids: list.map((r) => r.id),
      });
      const map = new Map((emails || []).map((e: any) => [e.review_id, e.author_email]));
      list.forEach((r) => { r.author_email = map.get(r.id) ?? null; });
    }

    setReviews(list);
    setLoading(false);
  };


  useEffect(() => {
    fetchReviews();
  }, [profile]);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("practitioner_reviews")
      .update({ is_approved: true })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'approuver l'avis." });
    } else {
      toast({ title: "Avis approuvé", description: "L'avis est maintenant visible publiquement." });
      fetchReviews();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("practitioner_reviews")
      .update({ is_approved: false })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Erreur" });
    } else {
      toast({ title: "Avis masqué" });
      fetchReviews();
    }
  };

  const pending = reviews.filter((r) => !r.is_approved);
  const approved = reviews.filter((r) => r.is_approved);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const ReviewCard = ({ review, showActions }: { review: Review; showActions: boolean }) => (
    <Card className="shadow-none">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
              {review.author_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{review.author_name}</p>
                {review.author_email && (
                  <Badge variant="outline" className="text-[10px] gap-0.5 px-1">
                    <Mail className="h-2.5 w-2.5" />
                    {review.author_email}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StarDisplay value={review.score_global} />
            <span className="text-sm font-semibold">{(review.score_global / 2).toFixed(1)}</span>
          </div>
        </div>

        {/* Detail scores */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "score_punctuality", label: "Ponctualité" },
            { key: "score_listening", label: "Écoute" },
            { key: "score_premises", label: "Locaux" },
            { key: "score_explanation", label: "Explications" },
          ].map(({ key, label }) => {
            const val = (review as any)[key];
            if (val == null) return null;
            return (
              <Badge key={key} variant="outline" className="text-xs font-normal">
                {label}: {(val / 2).toFixed(1)}/5
              </Badge>
            );
          })}
        </div>

        {review.review_text && (
          <p className="text-sm text-muted-foreground italic">"{review.review_text}"</p>
        )}

        {showActions && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => handleApprove(review.id)}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Approuver
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleReject(review.id)}>
              <X className="h-3.5 w-3.5 mr-1" />
              Masquer
            </Button>
          </div>
        )}
        {!showActions && review.is_approved && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleReject(review.id)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Masquer
            </Button>
          </div>
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
        <TabsTrigger value="approved" className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Publiés ({approved.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4 space-y-3">
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Aucun avis en attente de modération.</p>
        ) : (
          pending.map((r) => <ReviewCard key={r.id} review={r} showActions />)
        )}
      </TabsContent>

      <TabsContent value="approved" className="mt-4 space-y-3">
        {approved.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Aucun avis publié.</p>
        ) : (
          approved.map((r) => <ReviewCard key={r.id} review={r} showActions={false} />)
        )}
      </TabsContent>
    </Tabs>
  );
};

export default ReviewModeration;
