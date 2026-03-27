import jsPDF from "jspdf";
import QRCode from "qrcode";

interface PractitionerPdfData {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  bio: string | null;
  avatar_url: string | null;
  languages: string[];
  specialties: string[];
  payment_methods: string[];
  conventioned: boolean | null;
  inami_number: string | null;
  tiers_payant: boolean;
  pmr_accessible: boolean;
  parking: boolean;
  video_available: boolean;
  home_visit: boolean;
  accepts_new_patients: boolean;
  avg_appointment_delay_days: number | null;
  phone: string | null;
  contact_email: string | null;
  associations: string[];
  schedule: { day: string; start: string; end: string }[] | null;
}

// Brand colors
const PRIMARY = [2, 77, 48] as const; // #024D30
const PRIMARY_LIGHT = [78, 115, 85] as const; // #4E7355
const TEXT_DARK = [30, 35, 40] as const;
const TEXT_MUTED = [120, 120, 130] as const;
const BG_LIGHT = [245, 243, 238] as const;
const WHITE = [255, 255, 255] as const;

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, skipFooterPages: Set<number>) {
  if (skipFooterPages.has(pageNum)) return;
  const y = PAGE_H - 10;
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Medsquare — Centre médical pluridisciplinaire", MARGIN, y);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y, { align: "right" });
  doc.text(new Date().toLocaleDateString("fr-BE"), PAGE_W / 2, y, { align: "center" });
}

function addHeader(doc: jsPDF) {
  // Top green bar
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_W, 8, "F");

  // Thin accent line
  doc.setFillColor(...PRIMARY_LIGHT);
  doc.rect(0, 8, PAGE_W, 1.5, "F");
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 25) {
    doc.addPage();
    addHeader(doc);
    return 20;
  }
  return y;
}

export async function generatePractitionerPdf(practitioner: PractitionerPdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const fullName = `${practitioner.first_name} ${practitioner.last_name}`;
  const publicUrl = `https://www.medsquare.be/praticiens/${practitioner.id}`;

  // Generate QR code
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 200, margin: 1, color: { dark: "#024D30", light: "#FFFFFF" },
    });
  } catch { /* ignore */ }

  // Load avatar
  let avatarData: string | null = null;
  if (practitioner.avatar_url) {
    avatarData = await loadImageAsBase64(practitioner.avatar_url);
  }

  // ========== PAGE 1 ==========
  addHeader(doc);

  let y = 18;

  // Avatar + Name block
  const avatarSize = 30;
  const nameX = avatarData ? MARGIN + avatarSize + 8 : MARGIN;

  if (avatarData) {
    try {
      doc.addImage(avatarData, "JPEG", MARGIN, y, avatarSize, avatarSize);
    } catch { /* ignore */ }
  }

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...TEXT_DARK);
  doc.text(fullName, nameX, y + 10);

  // Specialty
  if (practitioner.specialty) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(practitioner.specialty, nameX, y + 18);
  }

  // Status badges line
  const badges: string[] = [];
  if (practitioner.accepts_new_patients) badges.push("Accepte nouveaux patients");
  if (practitioner.conventioned) badges.push("Conventionné(e)");
  if (practitioner.inami_number) badges.push(`INAMI ${practitioner.inami_number}`);
  if (badges.length) {
    doc.setFontSize(8);
    doc.setTextColor(...PRIMARY_LIGHT);
    doc.text(badges.join("  ·  "), nameX, y + 25);
  }

  y += avatarSize + 10;

  // Divider
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ========== BIO ==========
  if (practitioner.bio) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("À propos", MARGIN, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    const bioLines = doc.splitTextToSize(practitioner.bio, CONTENT_W);
    for (const line of bioLines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 4;
  }

  // ========== SPECIALTIES ==========
  if (practitioner.specialties.length > 0) {
    y = checkPageBreak(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("Spécialités", MARGIN, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.text(practitioner.specialties.join("  ·  "), MARGIN, y);
    y += 8;
  }

  // ========== INFO GRID ==========
  y = checkPageBreak(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text("Informations pratiques", MARGIN, y);
  y += 7;

  const infoItems = [
    { label: "Langues", value: practitioner.languages.join(", ") || "Français" },
    { label: "Paiements", value: practitioner.payment_methods.length ? practitioner.payment_methods.join(", ") : "Espèces, Bancontact" },
    { label: "Tiers payant", value: practitioner.tiers_payant ? "Oui" : "Non" },
    { label: "Accessibilité PMR", value: practitioner.pmr_accessible ? "Oui" : "Non" },
    { label: "Parking", value: practitioner.parking ? "Oui" : "Non" },
    { label: "Consultation vidéo", value: practitioner.video_available ? "Oui" : "Non" },
    { label: "Visite à domicile", value: practitioner.home_visit ? "Oui" : "Non" },
    { label: "Délai moyen RDV", value: practitioner.avg_appointment_delay_days != null ? `~${practitioner.avg_appointment_delay_days} jours` : "Non renseigné" },
  ];

  // Draw info grid as 2 columns
  const colW = CONTENT_W / 2;
  const rowH = 9;

  for (let i = 0; i < infoItems.length; i++) {
    const col = i % 2;
    if (col === 0) y = checkPageBreak(doc, y, rowH + 2);
    const x = MARGIN + col * colW;

    // Background alternation
    if (i % 4 < 2) {
      doc.setFillColor(...BG_LIGHT);
      doc.rect(x, y - 4, colW - 2, rowH, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(infoItems[i].label, x + 2, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(infoItems[i].value, x + 2, y + 4);

    if (col === 1) y += rowH + 1;
  }
  if (infoItems.length % 2 !== 0) y += rowH + 1;

  y += 5;

  // ========== SCHEDULE ==========
  if (practitioner.schedule && practitioner.schedule.length > 0) {
    y = checkPageBreak(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("Horaires", MARGIN, y);
    y += 7;

    const grouped = new Map<string, string[]>();
    practitioner.schedule.forEach((s) => {
      const existing = grouped.get(s.day) || [];
      existing.push(`${s.start} – ${s.end}`);
      grouped.set(s.day, existing);
    });

    const daysOrder = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    doc.setFontSize(9);

    for (const day of daysOrder) {
      if (!grouped.has(day)) continue;
      y = checkPageBreak(doc, y, 6);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      doc.text(dayLabel, MARGIN, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      doc.text(grouped.get(day)!.join(", "), MARGIN + 30, y);
      y += 5.5;
    }
    y += 5;
  }

  // ========== CONTACT ==========
  if (practitioner.phone || practitioner.contact_email) {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("Contact", MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);

    if (practitioner.phone) {
      doc.text(`Tél : ${practitioner.phone}`, MARGIN, y);
      y += 5;
    }
    if (practitioner.contact_email) {
      doc.text(`Email : ${practitioner.contact_email}`, MARGIN, y);
      y += 5;
    }
    y += 3;
  }

  // ========== ASSOCIATIONS ==========
  if (practitioner.associations.length > 0) {
    y = checkPageBreak(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("Associations professionnelles", MARGIN, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.text(practitioner.associations.join("  ·  "), MARGIN, y);
    y += 8;
  }

  // ========== QR CODE FOOTER ==========
  y = checkPageBreak(doc, y, 45);

  // Green footer band
  const footerY = PAGE_H - 42;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, footerY, PAGE_W, 42, "F");

  // QR Code
  const qrSize = 25;
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", MARGIN, footerY + 8, qrSize, qrSize);
    } catch { /* ignore */ }
  }

  // Footer text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("Retrouvez cette fiche en ligne", MARGIN + qrSize + 8, footerY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(publicUrl, MARGIN + qrSize + 8, footerY + 20);

  doc.setFontSize(7);
  doc.text("Medsquare — Centre médical pluridisciplinaire", MARGIN + qrSize + 8, footerY + 28);
  doc.text("Meslin-l'Évêque · www.medsquare.be", MARGIN + qrSize + 8, footerY + 33);

  // Track which page has the QR footer band
  const qrFooterPage = doc.getCurrentPageNumber();
  const skipFooterPages = new Set([qrFooterPage]);

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages, skipFooterPages);
  }

  // Save
  doc.save(`${fullName.replace(/\s+/g, "_")}_MedSquare.pdf`);
}
