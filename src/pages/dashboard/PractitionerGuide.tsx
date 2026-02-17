import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Calendar,
  Clock,
  Users,
  Download,
  Mail,
  Settings,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Settings,
    title: "1. Configurez votre profil",
    description:
      "Renseignez vos horaires de disponibilité dans votre profil. Ces horaires déterminent les créneaux que vos patients pourront réserver.",
    link: "/dashboard/profile",
    linkLabel: "Mon profil",
    tips: [
      "Ajoutez vos plages horaires pour chaque jour de la semaine",
      "Définissez votre durée de pause entre les rendez-vous",
      "Renseignez votre email de notification pour recevoir les confirmations",
    ],
  },
  {
    icon: Calendar,
    title: "2. Créez vos prestations",
    description:
      "Chaque prestation (massage 60min, consultation 30min...) est une activité. Définissez la durée, le prix et activez la réservation en ligne.",
    link: "/dashboard/activities",
    linkLabel: "Mes activités",
    tips: [
      "Créez une activité par type de prestation (ex: Massage 60min à 60€, Massage 75min à 70€)",
      "Définissez si la prestation est gratuite ou payante",
      'Activez la prestation pour la rendre visible sur votre page publique',
      "Ajoutez des photos pour rendre votre offre plus attractive",
    ],
  },
  {
    icon: Users,
    title: "3. Vos patients réservent en ligne",
    description:
      "Les patients accèdent à votre page praticien ou à la fiche de votre activité, choisissent un créneau disponible et remplissent un court formulaire.",
    tips: [
      "Les créneaux sont générés automatiquement à partir de vos horaires",
      "Quand un patient réserve, le créneau est bloqué pour éviter les doublons",
      "Les patients sans compte peuvent aussi réserver (nom + email)",
      "Un email de confirmation avec fichier .ics (calendrier) est envoyé automatiquement",
    ],
  },
  {
    icon: Mail,
    title: "4. Notifications automatiques",
    description:
      "Vous et votre patient recevez automatiquement des emails de confirmation avec tous les détails du rendez-vous.",
    tips: [
      "Le patient reçoit un email avec récapitulatif + fichier .ics",
      "Vous recevez une copie sur votre email de notification",
      "Les notifications incluent le nom du patient, la prestation, l'heure et le lieu",
    ],
  },
  {
    icon: Download,
    title: "5. Exportez votre planning",
    description:
      "Chaque jour, exportez la liste de vos rendez-vous en PDF (pour impression) ou CSV (pour tableur) avec les pauses intégrées.",
    link: "/dashboard/export",
    linkLabel: "Export journalier",
    tips: [
      "Définissez la durée de pause entre vos rendez-vous",
      "L'export PDF est formaté pour l'impression avec le logo Medsquare",
      "L'export CSV est compatible Excel/Google Sheets",
    ],
  },
];

const PractitionerGuide = () => {
  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Guide praticien
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Comment utiliser l'outil de réservation en ligne pour vos patients.
          </p>
        </div>

        {/* Quick summary */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1">En résumé</p>
                <p className="text-sm text-muted-foreground">
                  Configurez vos horaires → Créez vos prestations → Les patients réservent en ligne → 
                  Vous recevez les confirmations → Exportez votre planning quotidien.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        {steps.map((step, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <step.icon className="h-5 w-5 text-primary" />
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{step.description}</p>

              {step.tips && (
                <ul className="space-y-1.5">
                  {step.tips.map((tip, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}

              {step.link && (
                <Link
                  to={step.link}
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline mt-2"
                >
                  {step.linkLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Example scenario */}
        <Card className="bg-accent/30">
          <CardHeader>
            <CardTitle className="font-display text-base">💡 Exemple concret</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Vous êtes masseur et proposez deux prestations :
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="font-semibold">Massage relaxant</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> 60 min
                  <Badge className="text-[10px]">60 €</Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="font-semibold">Massage deep tissue</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> 75 min
                  <Badge className="text-[10px]">70 €</Badge>
                </div>
              </div>
            </div>
            <p>
              Un patient réserve un <strong>massage deep tissue</strong> pour mardi à 10h00.
              Le système bloque automatiquement le créneau 10h00–11h15 + 15 min de pause.
              Aucun autre patient ne pourra réserver entre 10h00 et 11h30 sur votre agenda.
            </p>
            <p>
              Vous et le patient recevez un email de confirmation avec un fichier calendrier (.ics) 
              que vous pouvez importer dans Google Calendar, Outlook ou Apple Calendar.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PractitionerGuide;
