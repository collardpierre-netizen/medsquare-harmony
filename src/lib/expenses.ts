/**
 * Dépenses (charges) — logique d'imputation mensuelle.
 *
 * Deux natures :
 *  - récurrente : mensuelle / trimestrielle / annuelle, entre start_date et end_date (optionnelle).
 *    Le montant encodé est le montant PAR ÉCHÉANCE. Pour la vue mensuelle, on lisse :
 *      mensuelle    → montant
 *      trimestrielle→ montant / 3
 *      annuelle     → montant / 12
 *  - ponctuelle : imputée en totalité sur le mois de expense_date.
 *
 * Tous les montants sont HTVA.
 */

export const EXPENSE_CATEGORIES = [
  "Crédit",
  "Charges",
  "Précompte immobilier",
  "Assurances",
  "Entretien / nettoyage",
  "Internet / télécom",
  "Comptabilité",
  "Autres",
] as const;

export type ExpenseRecurrence = "monthly" | "quarterly" | "yearly";

export interface Expense {
  id: string;
  label: string;
  category: string;
  amount: number;
  is_recurring: boolean;
  recurrence: string;
  start_date: string | null;
  end_date: string | null;
  expense_date: string | null;
  notes: string | null;
}

export const RECURRENCE_LABELS: Record<string, string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  yearly: "Annuelle",
};

/** Montant imputé (lissé) d'une dépense sur un mois donné, format monthKey "yyyy-MM". */
export const getExpenseMonthlyAmount = (expense: Expense, monthKey: string): number => {
  const amount = Number(expense.amount || 0);
  if (amount <= 0) return 0;

  if (!expense.is_recurring) {
    if (!expense.expense_date) return 0;
    return expense.expense_date.slice(0, 7) === monthKey ? amount : 0;
  }

  const startKey = expense.start_date ? expense.start_date.slice(0, 7) : null;
  const endKey = expense.end_date ? expense.end_date.slice(0, 7) : null;
  if (startKey && monthKey < startKey) return 0;
  if (endKey && monthKey > endKey) return 0;

  switch (expense.recurrence) {
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
};

/** Montant annualisé (12 mois glissants théoriques) d'une dépense récurrente. */
export const getExpenseAnnualAmount = (expense: Expense): number => {
  const amount = Number(expense.amount || 0);
  if (!expense.is_recurring) return amount;
  switch (expense.recurrence) {
    case "quarterly":
      return amount * 4;
    case "yearly":
      return amount;
    default:
      return amount * 12;
  }
};
