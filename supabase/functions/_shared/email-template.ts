// Medsquare branded email template
// Colors: Primary #024D30, Sage #4E7355, Light sage #E8F0EA

const LOGO_URL = "https://medsquare-harmony.lovable.app/logo-medsquare.png";
const PRIMARY = "#024D30";
const SAGE = "#4E7355";
const LIGHT_BG = "#F7FAF8";
const BORDER_COLOR = "#E8F0EA";
const TEXT_PRIMARY = "#1a1a1a";
const TEXT_SECONDARY = "#555555";
const TEXT_MUTED = "#888888";
const SUCCESS_GREEN = "#059669";
const ERROR_RED = "#B91C1C";

interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  content: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}

export function medsquareEmail({
  title,
  preheader,
  content,
  ctaLabel,
  ctaUrl,
  footer,
}: EmailTemplateOptions): string {
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding: 24px 0 0;">
            <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background:${PRIMARY};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              ${ctaLabel}
            </a>
          </td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Container -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

        <!-- Header with logo -->
        <tr>
          <td style="background:${PRIMARY};padding:28px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="Medsquare" width="160" style="display:inline-block;max-width:160px;height:auto;" />
          </td>
        </tr>

        <!-- Title bar -->
        <tr>
          <td style="background:${SAGE};padding:16px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${title}</h1>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:32px;background:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="color:${TEXT_PRIMARY};font-size:15px;line-height:1.7;">
                ${content}
              </td></tr>
              ${ctaBlock}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:${LIGHT_BG};border-top:1px solid ${BORDER_COLOR};">
            <p style="margin:0 0 4px;color:${TEXT_MUTED};font-size:12px;text-align:center;">
              ${footer || "Cet email a été envoyé automatiquement par Medsquare."}
            </p>
            <p style="margin:0;color:${TEXT_MUTED};font-size:12px;text-align:center;">
              Centre pluridisciplinaire de santé — Bruxelles
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Helper: styled info table row
 */
export function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 12px;color:${TEXT_SECONDARY};font-size:13px;border-bottom:1px solid ${BORDER_COLOR};width:130px;">${label}</td>
    <td style="padding:10px 12px;color:${TEXT_PRIMARY};font-size:14px;font-weight:600;border-bottom:1px solid ${BORDER_COLOR};">${value}</td>
  </tr>`;
}

/**
 * Helper: styled info table wrapper
 */
export function infoTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid ${BORDER_COLOR};border-radius:10px;overflow:hidden;background:${LIGHT_BG};">
    ${rows}
  </table>`;
}

/**
 * Helper: status badge
 */
export function statusBadge(status: "confirmed" | "cancelled" | "pending" | "registered"): string {
  const map = {
    confirmed: { bg: "#ECFDF5", color: SUCCESS_GREEN, label: "Confirmée" },
    cancelled: { bg: "#FEF2F2", color: ERROR_RED, label: "Refusée" },
    pending: { bg: "#FFFBEB", color: "#D97706", label: "En attente" },
    registered: { bg: "#ECFDF5", color: SUCCESS_GREEN, label: "Inscrit(e)" },
  };
  const s = map[status];
  return `<span style="display:inline-block;padding:4px 14px;background:${s.bg};color:${s.color};border-radius:20px;font-size:13px;font-weight:600;">${s.label}</span>`;
}

export { PRIMARY, SAGE, SUCCESS_GREEN, ERROR_RED };
