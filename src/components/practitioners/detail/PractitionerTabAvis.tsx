import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Star, Send, ThumbsUp, Clock, Stethoscope, Building2, MessageSquare } from "lucide-react";

interface Review {
  id: string;
  score_global: number;
  score_punctuality: number | null;
  score_listening: number | null;
  score_premises: number | null;
  score_explanation: number | null;
  review_text: string | null;
  author_name: string;
  is_verified: boolean;
  created_at: string;
}

interface Props {
  practitionerId: string;
  practitionerName: string;
}

const CRITERIA = [
  { key: "score_punctuality", label: "Ponctualité", icon: Clock },
  { key: "score_listening", label: "Écoute", icon: ThumbsUp },
  { key: "score_premises", label: "Locaux", icon: Building2 },
  { key: "score_explanation", label: "Explications", icon: Stethoscope },
] as const;

function StarRating({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex gap-0.5">
      {stars.map((s) => {
        const filled = (hover || value / 2) >= s;
        return (
          <button
            key={s}
            type="button"
            disabled={!onChange}
            className={`transition-colors ${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
            onClick={() => onChange?.(s * 2)}
            onMouseEnter={() => onChange && setHover(s)}
            onMouseLeave={() => onChange && setHover(0)}
          >
            <Star
              size={size}
              className={filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
            />
          </button>
        );
      })}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });
}

function avgScore(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.score_global, 0) / reviews.length;
}

function criteriaAvg(reviews: Review[], key: string): number | null {
  const vals = reviews.map((r) => (r as any)[key]).filter((v: any) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
}

const PractitionerTabAvis = ({ practitionerId, practitionerName }: Props) => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    author_name: "",
    author_email: "",
    review_text: "",
    score_global: 0,
    score_punctuality: 0,
    score_listening: 0,
    score_premises: 0,
    score_explanation: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("practitioner_reviews")
        .select("id, score_global, score_punctuality, score_listening, score_premises, score_explanation, review_text, author_name, is_verified, created_at")
        .eq("practitioner_id", practitionerId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      setReviews((data as Review[]) || []);
      setLoading(false);
    };
    fetch();
  }, [practitionerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.score_global === 0) {
      toast({ variant: "destructive", title: "Note requise", description: "Veuillez donner une note globale." });
      return;
    }
    if (!form.author_name.trim()) {
      toast({ variant: "destructive", title: "Nom requis", description: "Veuillez indiquer votre nom." });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("practitioner_reviews").insert({
      practitioner_id: practitionerId,
      author_name: form.author_name.trim(),
      author_email: form.author_email.trim() || null,
      review_text: form.review_text.trim() || null,
      score_global: form.score_global,
      score_punctuality: form.score_punctuality || null,
      score_listening: form.score_listening || null,
      score_premises: form.score_premises || null,
      score_explanation: form.score_explanation || null,
    });

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer votre avis." });
    } else {
      toast({ title: "Merci !", description: "Votre avis sera publié après validation par le praticien." });
      setForm({ author_name: "", author_email: "", review_text: "", score_global: 0, score_punctuality: 0, score_listening: 0, score_premises: 0, score_explanation: 0 });
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

  const avg = avgScore(reviews);

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {reviews.length > 0 ? (
            <>
              <div className="text-4xl font-bold text-primary">{(avg / 2).toFixed(1)}</div>
              <div>
                <StarRating value={avg} size={18} />
                <p className="text-sm text-muted-foreground mt-0.5">
                  {reviews.length} avis vérifié{reviews.length > 1 ? "s" : ""}
                </p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-display font-semibold">Aucun avis pour le moment</p>
              <p className="text-sm text-muted-foreground">Soyez le premier à donner votre avis !</p>
            </div>
          )}
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <MessageSquare className="h-4 w-4 mr-1.5" />
          {showForm ? "Annuler" : "Donner mon avis"}
        </Button>
      </div>

      {/* Criteria breakdown */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CRITERIA.map(({ key, label, icon: Icon }) => {
            const val = criteriaAvg(reviews, key);
            return (
              <Card key={key} className="shadow-none">
                <CardContent className="p-3 text-center">
                  <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="font-bold text-lg">{val != null ? (val / 2).toFixed(1) : "—"}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              <h3 className="font-display font-semibold text-lg">Votre avis sur {practitionerName}</h3>

              {/* Global score */}
              <div className="space-y-1.5">
                <Label className="font-medium">Note globale *</Label>
                <StarRating value={form.score_global} onChange={(v) => setForm({ ...form, score_global: v })} size={28} />
              </div>

              {/* Detail criteria */}
              <div className="grid grid-cols-2 gap-4">
                {CRITERIA.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {label}
                    </Label>
                    <StarRating
                      value={form[key as keyof typeof form] as number}
                      onChange={(v) => setForm({ ...form, [key]: v })}
                      size={18}
                    />
                  </div>
                ))}
              </div>

              {/* Text review */}
              <div>
                <Label htmlFor="review_text">Commentaire (optionnel)</Label>
                <Textarea
                  id="review_text"
                  value={form.review_text}
                  onChange={(e) => setForm({ ...form, review_text: e.target.value })}
                  placeholder="Partagez votre expérience..."
                  className="mt-1.5"
                  rows={3}
                  maxLength={1000}
                />
              </div>

              {/* Author info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="author_name">Votre nom *</Label>
                  <Input
                    id="author_name"
                    value={form.author_name}
                    onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                    placeholder="Prénom N."
                    className="mt-1.5"
                    required
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="author_email">Email (optionnel, pour vérification)</Label>
                  <Input
                    id="author_email"
                    type="email"
                    value={form.author_email}
                    onChange={(e) => setForm({ ...form, author_email: e.target.value })}
                    placeholder="votre@email.com"
                    className="mt-1.5"
                    maxLength={255}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Votre avis sera publié après validation par le praticien. Votre email ne sera jamais affiché publiquement.
              </p>

              <Button type="submit" disabled={submitting}>
                <Send className="h-4 w-4 mr-1.5" />
                {submitting ? "Envoi..." : "Envoyer mon avis"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {review.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{review.author_name}</p>
                      {review.is_verified && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Vérifié</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
                  </div>
                </div>
                <StarRating value={review.score_global} size={14} />
              </div>

              {/* Detail scores */}
              {(review.score_punctuality || review.score_listening || review.score_premises || review.score_explanation) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {CRITERIA.map(({ key, label }) => {
                    const val = (review as any)[key];
                    if (val == null) return null;
                    return (
                      <Badge key={key} variant="outline" className="text-xs font-normal gap-1">
                        {label}: {(val / 2).toFixed(1)}/5
                      </Badge>
                    );
                  })}
                </div>
              )}

              {review.review_text && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  "{review.review_text}"
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PractitionerTabAvis;
