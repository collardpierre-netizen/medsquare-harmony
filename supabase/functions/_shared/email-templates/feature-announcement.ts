import { PRIMARY, SAGE } from "../email-template.ts";

const VIOLET = "#534AB7";
const VIOLET_LIGHT = "#EEEDFE";

interface FeatureAnnouncementData {
  firstName: string;
  score: number;
  ctaUrl: string;
}

export function featureAnnouncementSubject(): string {
  return "✨ Votre fiche MedSquare a été enrichie — découvrez les nouveautés";
}

export function featureAnnouncementHtml({ firstName, score, ctaUrl }: FeatureAnnouncementData): string {
  const progressColor = score < 40 ? "#ef4444" : score < 70 ? "#f59e0b" : "#22c55e";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    @media only screen and (max-width:480px) {
      .feature-grid { display:block !important; }
      .feature-cell { display:block !important; width:100% !important; padding:12px 0 !important; }
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

        <!-- Content -->
        <tr>
          <td class="container" style="padding:32px;">
            <h1 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;font-weight:700;line-height:1.3;">
              Bonjour ${firstName}, votre fiche s'améliore&nbsp;!
            </h1>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7;">
              MedSquare a ajouté de nouvelles fonctionnalités inspirées des meilleures plateformes médicales belges. 
              Découvrez ce qui change pour vous et vos patients.
            </p>

            <!-- Feature Grid 2x2 -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="feature-grid" style="margin:0 0 28px;">
              <tr>
                <td class="feature-cell" width="50%" valign="top" style="padding:0 8px 16px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;line-height:1;">💶</p>
                      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">Simulateur de tarifs BIM/OMNIO</p>
                      <p style="margin:0;font-size:13px;color:#666;line-height:1.4;">Patients informés avant le RDV</p>
                    </td></tr>
                  </table>
                </td>
                <td class="feature-cell" width="50%" valign="top" style="padding:0 0 16px 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;line-height:1;">⭐</p>
                      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">Avis multi-critères</p>
                      <p style="margin:0;font-size:13px;color:#666;line-height:1.4;">Plus de crédibilité, plus de confiance</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="feature-cell" width="50%" valign="top" style="padding:0 8px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;line-height:1;">💬</p>
                      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">Q&R publique</p>
                      <p style="margin:0;font-size:13px;color:#666;line-height:1.4;">Visibilité Google + FAQ patients</p>
                    </td></tr>
                  </table>
                </td>
                <td class="feature-cell" width="50%" valign="top" style="padding:0 0 0 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="background:${VIOLET_LIGHT};border-radius:12px;padding:16px;width:100%;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;line-height:1;">📄</p>
                      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">Export PDF de votre fiche</p>
                      <p style="margin:0;font-size:13px;color:#666;line-height:1.4;">Partageable en cabinet ou WhatsApp</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Progress Bar -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background:#f8f9fa;border-radius:12px;padding:16px;">
              <tr><td>
                <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1a1a1a;">
                  Votre fiche est complète à ${score}%
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="background:#e0e0e0;border-radius:8px;height:12px;">
                    <div style="background:${progressColor};height:12px;width:${score}%;border-radius:8px;max-width:100%;"></div>
                  </td></tr>
                </table>
              </td></tr>
            </table>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td align="center">
                <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:${VIOLET};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
                  Compléter ma fiche maintenant
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
