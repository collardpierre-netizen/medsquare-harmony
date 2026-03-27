import { SAGE } from "../email-template.ts";

const VIOLET = "#534AB7";

interface ProfileIncompleteData {
  firstName: string;
  missingFields: string[];
  ctaUrl: string;
  score: number;
}

export function profileIncompleteSubject(nbMissing: number): string {
  return `📋 Il vous reste ${nbMissing} élément${nbMissing > 1 ? "s" : ""} à compléter sur votre fiche`;
}

export function profileIncompleteHtml({ firstName, missingFields, ctaUrl, score }: ProfileIncompleteData): string {
  const missingListHtml = missingFields
    .map(
      (field) =>
        `<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#888;font-size:18px;width:28px;vertical-align:middle;">○</td>
                <td style="color:#333;font-size:14px;vertical-align:middle;">${field}</td>
                <td align="right" style="vertical-align:middle;">
                  <a href="${ctaUrl}" style="color:${VIOLET};font-size:13px;font-weight:600;text-decoration:none;">Compléter →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    @media only screen and (max-width:480px) {
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
            <p style="margin:0 0 8px;color:#555;font-size:15px;">Bonjour ${firstName},</p>
            <h1 style="margin:0 0 12px;color:#1a1a1a;font-size:20px;font-weight:700;line-height:1.3;">
              Quelques minutes suffisent pour maximiser votre visibilité
            </h1>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Les praticiens avec une fiche complète reçoivent <strong style="color:${VIOLET};">3× plus de prises de contact</strong> de la part des patients.
            </p>

            <!-- Missing Fields List -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #E8F0EA;border-radius:12px;overflow:hidden;background:#fafafa;">
              <tr>
                <td style="padding:14px 16px;background:#f5f5f5;border-bottom:1px solid #E8F0EA;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.5px;">
                    Éléments manquants (${missingFields.length})
                  </p>
                </td>
              </tr>
              ${missingListHtml}
            </table>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr><td align="center">
                <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:${VIOLET};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
                  Accéder à mon dashboard
                </a>
              </td></tr>
            </table>

            <!-- Reassurance -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7FAF8;border-radius:10px;padding:16px;">
              <tr><td style="text-align:center;">
                <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
                  Besoin d'aide ? Contactez-nous à <a href="mailto:support@medsquare.be" style="color:${VIOLET};text-decoration:none;font-weight:600;">support@medsquare.be</a>
                </p>
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
