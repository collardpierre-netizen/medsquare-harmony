import { SAGE } from "../email-template.ts";

const VIOLET = "#534AB7";
const VIOLET_LIGHT = "#EEEDFE";

interface WeeklyDigestData {
  firstName: string;
  semaine: string;
  vues: number;
  nbAvis: number;
  nbQuestions: number;
  dernierAvisTexte?: string;
  ctaUrl: string;
  ctaQuestionsUrl?: string;
}

const TIPS = [
  "Les praticiens qui répondent aux Q&R voient leur fiche 40% plus souvent dans les résultats Google.",
  "Une photo de profil professionnelle augmente le taux de clic de 35% sur votre fiche.",
  "Les fiches avec des tarifs transparents reçoivent 2× plus de demandes de rendez-vous.",
  "Répondre rapidement aux avis (même négatifs) renforce la confiance des futurs patients.",
];

export function weeklyDigestSubject(semaine: string): string {
  return `📊 Votre semaine sur MedSquare — ${semaine}`;
}

export function weeklyDigestHtml(data: WeeklyDigestData): string {
  const { firstName, semaine, vues, nbAvis, nbQuestions, dernierAvisTexte, ctaUrl, ctaQuestionsUrl } = data;
  
  // Pick a tip based on week string hash
  const tipIndex = semaine.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % TIPS.length;
  const tip = TIPS[tipIndex];

  const truncatedReview = dernierAvisTexte && dernierAvisTexte.length > 100
    ? dernierAvisTexte.substring(0, 100) + "…"
    : dernierAvisTexte;

  const questionsBlock = nbQuestions > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FFF7ED;border-left:3px solid #F59E0B;border-radius:8px;padding:14px 16px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400E;">
            💬 ${nbQuestions} question${nbQuestions > 1 ? "s" : ""} attend${nbQuestions > 1 ? "ent" : ""} votre réponse
          </p>
          <a href="${ctaQuestionsUrl || ctaUrl}" style="color:${VIOLET};font-size:13px;font-weight:600;text-decoration:none;">Répondre maintenant →</a>
        </td></tr>
      </table>`
    : "";

  const reviewBlock = nbAvis > 0 && truncatedReview
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8f9fa;border-radius:10px;padding:14px 16px;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Dernier avis reçu</p>
          <p style="margin:0;font-size:14px;color:#555;line-height:1.5;font-style:italic;">"${truncatedReview}"</p>
        </td></tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    @media only screen and (max-width:480px) {
      .metric-cell { display:block !important; width:100% !important; padding:8px 0 !important; }
      .container { padding:16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;">
    <tr><td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

        <!-- Logo -->
        <tr>
          <td style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid ${SAGE};">
            <img src="https://medsquare-harmony.lovable.app/logo-medsquare.png" alt="MedSquare" width="160" style="display:inline-block;max-width:160px;height:auto;" />
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:${VIOLET};padding:16px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">📊 Semaine du ${semaine}</h1>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td class="container" style="padding:32px;">
            <p style="margin:0 0 20px;color:#555;font-size:15px;">Bonjour ${firstName}, voici ce qui s'est passé sur votre fiche cette semaine.</p>

            <!-- Metrics 3 columns -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td class="metric-cell" width="33%" align="center" style="padding:0 4px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;text-align:center;">
                    <tr><td>
                      <p style="margin:0;font-size:28px;line-height:1;">👁</p>
                      <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${VIOLET};">${vues}</p>
                      <p style="margin:2px 0 0;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Vues de fiche</p>
                    </td></tr>
                  </table>
                </td>
                <td class="metric-cell" width="33%" align="center" style="padding:0 4px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;text-align:center;">
                    <tr><td>
                      <p style="margin:0;font-size:28px;line-height:1;">⭐</p>
                      <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${VIOLET};">${nbAvis}</p>
                      <p style="margin:2px 0 0;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Nouveaux avis</p>
                    </td></tr>
                  </table>
                </td>
                <td class="metric-cell" width="33%" align="center" style="padding:0 4px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;text-align:center;">
                    <tr><td>
                      <p style="margin:0;font-size:28px;line-height:1;">💬</p>
                      <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${VIOLET};">${nbQuestions}</p>
                      <p style="margin:2px 0 0;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Questions</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            ${questionsBlock}
            ${reviewBlock}

            <!-- Tip -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:8px;padding:14px 16px;">
              <tr><td>
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;">💡 Conseil de la semaine</p>
                <p style="margin:0;font-size:13px;color:#78350F;line-height:1.5;">${tip}</p>
              </td></tr>
            </table>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td align="center">
                <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:${VIOLET};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
                  Voir mon tableau de bord complet
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#F7FAF8;border-top:1px solid #E8F0EA;">
            <p style="margin:0 0 4px;color:#888;font-size:12px;text-align:center;">
              Centre pluridisciplinaire de santé — 25 rue de la Procession, 7822 Meslin-l'Évêque
            </p>
            <p style="margin:0;color:#888;font-size:12px;text-align:center;">
              <a href="mailto:support@medsquare.be" style="color:#888;">support@medsquare.be</a>
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;
}
