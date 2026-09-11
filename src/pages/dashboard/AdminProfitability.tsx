import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Percent,
  Landmark,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  EXPENSE_CATEGORIES,
  RECURRENCE_LABELS,
  getExpenseAnnualAmount,
  getExpenseMonthlyAmount,
  type Expense,
} from "@/lib/expenses";
import type { PractitionerPackage } from "@/lib/practitionerPackages";
import { isPackageActiveInMonth, bookingBilledAmount, type BillingDiscount } from "@/lib/roomBilling";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-BE")} € HTVA`;

/** Forfait mensuel (HTVA) d'une salle privatisée pour un mois donné, ou null. */
const getRoomMonthlyFee = (
  room: {
    is_available: boolean;
    privatized_from: string | null;
    privatized_until: string | null;
    privatization_monthly_fee: number | null;
  },
  monthStart: Date,
): number | null => {
  const fee = Number(room.privatization_monthly_fee || 0);
  if (fee <= 0) return null;
  if (!room.is_available) return fee;
  if (!room.privatized_from) return null;
  const mS = format(monthStart, "yyyy-MM-dd");
  const mE = format(endOfMonth(monthStart), "yyyy-MM-dd");
  if (room.privatized_from > mE) return null;
  if (room.privatized_until && room.privatized_until < mS) return null;
  return fee;
};

interface ExpenseForm {
  id?: string;
  label: string;
  category: string;
  amount: string;
  is_recurring: boolean;
  recurrence: string;
  start_date: string;
  end_date: string;
  expense_date: string;
  notes: string;
}

const emptyForm = (): ExpenseForm => ({
  label: "",
  category: "Charges",
  amount: "",
  is_recurring: true,
  recurrence: "monthly",
  start_date: format(startOfMonth(new Date()), "yyyy-MM-dd"),
  end_date: "",
  expense_date: format(new Date(), "yyyy-MM-dd"),
  notes: "",
});

const AdminProfitability = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();

  const [monthsBack, setMonthsBack] = useState("12");
  const [includeProjection, setIncludeProjection] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [investmentInput, setInvestmentInput] = useState<string>("");
  const [savingInvestment, setSavingInvestment] = useState(false);

  // ─── Période analysée ───
  const range = useMemo(() => {
    const start = startOfMonth(subMonths(today, Number(monthsBack) - 1));
    const lastMonth = includeProjection ? addMonths(today, 3) : today;
    const end = addDays(endOfMonth(lastMonth), 1); // exclusif
    return { start, end };
  }, [monthsBack, includeProjection, today.getMonth(), today.getFullYear()]);

  const { data: rooms } = useQuery({
    queryKey: ["profitability-rooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, hourly_rate, is_available, privatized_from, privatized_until, privatization_monthly_fee");
      return data || [];
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["profitability-packages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("practitioner_room_packages")
        .select("id, practitioner_id, room_id, package_label, monthly_fee, is_active, start_date, end_date")
        .eq("is_active", true);
      return (data || []) as PractitionerPackage[];
    },
  });

  const { data: discounts } = useQuery({
    queryKey: ["profitability-discounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("practitioner_discounts")
        .select("practitioner_id, room_id, discount_type, discount_value, label, start_date, end_date, is_active")
        .eq("is_active", true);
      return (data || []) as BillingDiscount[];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["profitability-bookings", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, room_id, practitioner_id, start_time, end_time, status, discount_type, discount_value, discount_reason",
        )
        .gte("start_time", range.start.toISOString())
        .lt("start_time", range.end.toISOString())
        .in("status", ["confirmed", "pending"]);
      return data || [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["profitability-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("category", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data || []) as Expense[];
    },
  });

  const { data: investment } = useQuery({
    queryKey: ["profitability-investment"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "profitability_investment").maybeSingle();
      const value = (data?.value ?? null) as { amount?: number } | number | null;
      if (value == null) return 0;
      if (typeof value === "number") return value;
      return Number(value.amount || 0);
    },
  });

  const investmentAmount = Number(investment || 0);

  const saveInvestment = async () => {
    setSavingInvestment(true);
    const amount = Number(investmentInput.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "profitability_investment", value: { amount } }, { onConflict: "key" });
    setSavingInvestment(false);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
      return;
    }
    setInvestmentInput("");
    queryClient.invalidateQueries({ queryKey: ["profitability-investment"] });
    toast({ title: "Investissement enregistré" });
  };

  // ─── Calcul mensuel : revenus / dépenses / marge ───
  const monthlyRows = useMemo(() => {
    if (!rooms) return [];
    const months = eachMonthOfInterval({ start: range.start, end: subMonths(range.end, 1) });
    const currentKey = format(today, "yyyy-MM");

    return months.map((m) => {
      const start = startOfMonth(m);
      const end = addDays(endOfMonth(m), 1);
      const monthKey = format(start, "yyyy-MM");

      let revenue = 0;
      const flatFeeRoomIds = new Set<string>();
      for (const room of rooms) {
        const fee = getRoomMonthlyFee(room as any, start);
        if (fee != null) {
          flatFeeRoomIds.add(room.id);
          revenue += fee;
        }
      }
      const packagedKeys = new Set<string>();
      for (const pkg of packages ?? []) {
        if (flatFeeRoomIds.has(pkg.room_id)) continue;
        if (!isPackageActiveInMonth(pkg as any, monthKey)) continue; // échu → tarif plein
        revenue += Number(pkg.monthly_fee || 0);
        packagedKeys.add(`${pkg.practitioner_id}|${pkg.room_id}`);
      }
      for (const b of bookings ?? []) {
        const ts = new Date(b.start_time);
        if (ts < start || ts >= end) continue;
        if (flatFeeRoomIds.has(b.room_id)) continue;
        if (packagedKeys.has(`${b.practitioner_id}|${b.room_id}`)) continue;
        const room = rooms.find((r) => r.id === b.room_id);
        const hours = (new Date(b.end_time).getTime() - ts.getTime()) / 3600000;
        revenue += Number(room?.hourly_rate || 0) * hours;
      }

      const expenseByCategory = new Map<string, number>();
      let expenseTotal = 0;
      for (const e of expenses ?? []) {
        const amount = getExpenseMonthlyAmount(e, monthKey);
        if (amount <= 0) continue;
        expenseTotal += amount;
        expenseByCategory.set(e.category, (expenseByCategory.get(e.category) || 0) + amount);
      }

      const margin = revenue - expenseTotal;
      return {
        monthKey,
        label: format(start, "MMM yyyy", { locale: fr }),
        isFuture: monthKey > currentKey,
        revenue,
        expenses: expenseTotal,
        margin,
        marginRate: revenue > 0 ? (margin / revenue) * 100 : 0,
        expenseByCategory: Array.from(expenseByCategory.entries()).sort((a, b) => b[1] - a[1]),
      };
    });
  }, [rooms, packages, bookings, expenses, range, today]);

  const totals = useMemo(() => {
    const revenue = monthlyRows.reduce((s, r) => s + r.revenue, 0);
    const expensesTotal = monthlyRows.reduce((s, r) => s + r.expenses, 0);
    const margin = revenue - expensesTotal;
    const months = monthlyRows.length || 1;
    const annualMargin = (margin / months) * 12;
    return {
      revenue,
      expenses: expensesTotal,
      margin,
      marginRate: revenue > 0 ? (margin / revenue) * 100 : 0,
      annualMargin,
      yieldRate: investmentAmount > 0 ? (annualMargin / investmentAmount) * 100 : null,
    };
  }, [monthlyRows, investmentAmount]);

  const annualExpenses = useMemo(
    () => (expenses ?? []).reduce((s, e) => s + (e.is_recurring ? getExpenseAnnualAmount(e) : 0), 0),
    [expenses],
  );

  const chartData = useMemo(
    () =>
      monthlyRows.map((r) => ({
        month: r.label,
        Revenus: Math.round(r.revenue),
        Dépenses: Math.round(r.expenses),
        "Marge nette": Math.round(r.margin),
      })),
    [monthlyRows],
  );

  /** Ventilation des dépenses par catégorie sur toute la période analysée. */
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of monthlyRows) {
      for (const [cat, amount] of row.expenseByCategory) {
        map.set(cat, (map.get(cat) || 0) + amount);
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthlyRows]);

  const pieColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--primary))",
    "hsl(var(--sage-dark))",
    "hsl(var(--warning))",
  ];


  // ─── CRUD dépenses ───
  const openCreate = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setForm({
      id: e.id,
      label: e.label,
      category: e.category,
      amount: String(e.amount ?? ""),
      is_recurring: e.is_recurring,
      recurrence: e.recurrence || "monthly",
      start_date: e.start_date || "",
      end_date: e.end_date || "",
      expense_date: e.expense_date || format(new Date(), "yyyy-MM-dd"),
      notes: e.notes || "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.label.trim()) {
      toast({ variant: "destructive", title: "Intitulé requis" });
      return;
    }
    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Montant invalide" });
      return;
    }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      category: form.category,
      amount,
      is_recurring: form.is_recurring,
      recurrence: form.is_recurring ? form.recurrence : "monthly",
      start_date: form.is_recurring ? form.start_date || null : null,
      end_date: form.is_recurring && form.end_date ? form.end_date : null,
      expense_date: form.is_recurring ? null : form.expense_date || null,
      notes: form.notes.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("expenses").update(payload).eq("id", form.id)
      : await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
      return;
    }
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["profitability-expenses"] });
    toast({ title: form.id ? "Dépense mise à jour" : "Dépense ajoutée" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("expenses").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profitability-expenses"] });
    toast({ title: "Dépense supprimée" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Rentabilité
            </h1>
            <p className="text-sm text-muted-foreground">
              Recettes, charges encodées, marge nette et rendement. Tous les montants sont HTVA.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={monthsBack} onValueChange={setMonthsBack}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 derniers mois</SelectItem>
                <SelectItem value="6">6 derniers mois</SelectItem>
                <SelectItem value="12">12 derniers mois</SelectItem>
                <SelectItem value="24">24 derniers mois</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="projection" checked={includeProjection} onCheckedChange={setIncludeProjection} />
              <Label htmlFor="projection" className="text-sm">
                + 3 mois de projection
              </Label>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une dépense
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Recettes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{eur(totals.revenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{monthlyRows.length} mois analysés</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-destructive" /> Dépenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{eur(totals.expenses)}</p>
              <p className="text-xs text-muted-foreground mt-1">{eur(annualExpenses)} / an (récurrentes)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Percent className="h-4 w-4 text-primary" /> Marge nette
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totals.margin >= 0 ? "text-primary" : "text-destructive"}`}>
                {eur(totals.margin)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Taux de marge : {totals.marginRate.toFixed(1)} %
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Landmark className="h-4 w-4 text-amber-600" /> Rendement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">
                {totals.yieldRate != null ? `${totals.yieldRate.toFixed(2)} %` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {investmentAmount > 0
                  ? `sur ${investmentAmount.toLocaleString("fr-BE")} € investis`
                  : "Encodez le montant investi ci-dessous"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Investissement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Montant investi</CardTitle>
            <CardDescription>
              Utilisé pour le rendement annuel : marge nette annualisée / investissement.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="investment">Investissement (€ HTVA)</Label>
              <Input
                id="investment"
                inputMode="decimal"
                className="w-[220px]"
                placeholder={investmentAmount > 0 ? String(investmentAmount) : "Ex: 450000"}
                value={investmentInput}
                onChange={(e) => setInvestmentInput(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={saveInvestment} disabled={savingInvestment || !investmentInput}>
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        {/* Graphiques */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recettes vs dépenses</CardTitle>
              <CardDescription>Par mois, en € HTVA</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  Revenus: { label: "Revenus", color: "hsl(var(--primary))" },
                  Dépenses: { label: "Dépenses", color: "hsl(var(--destructive))" },
                }}
                className="h-[280px] w-full"
              >
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Revenus" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dépenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Marge nette</CardTitle>
              <CardDescription>Évolution mensuelle, en € HTVA</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ "Marge nette": { label: "Marge nette", color: "hsl(var(--primary))" } }}
                className="h-[280px] w-full"
              >
                <LineChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="Marge nette" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Ventilation des dépenses */}
        {expenseBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventilation des dépenses</CardTitle>
              <CardDescription>
                Répartition par catégorie sur la période analysée, en € HTVA
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2 items-center">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                  >
                    {expenseBreakdown.map((entry, i) => (
                      <Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v, n) => `${n} : ${Number(v).toLocaleString("fr-BE")} € HTVA`}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                </PieChart>
              </ChartContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseBreakdown.map((row) => {
                    const total = expenseBreakdown.reduce((s, r) => s + r.value, 0);
                    return (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right text-destructive">{eur(row.value)}</TableCell>
                        <TableCell className="text-right">
                          {total > 0 ? ((row.value / total) * 100).toFixed(1) : "0"}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}



        {/* Détail mensuel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail mensuel</CardTitle>
            <CardDescription>Montants HTVA. Les charges trimestrielles/annuelles sont lissées par mois.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Recettes</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Marge nette</TableHead>
                  <TableHead className="text-right">Taux de marge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRows.map((r) => (
                  <TableRow key={r.monthKey} className={r.isFuture ? "bg-muted/30" : undefined}>
                    <TableCell className="font-medium capitalize">
                      {r.label}
                      {r.isFuture && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          projection
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">{eur(r.revenue)}</TableCell>
                    <TableCell className="text-right text-destructive">{eur(r.expenses)}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.margin >= 0 ? "text-primary" : "text-destructive"}`}>
                      {eur(r.margin)}
                    </TableCell>
                    <TableCell className="text-right">{r.marginRate.toFixed(1)} %</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-emerald-600">{eur(totals.revenue)}</TableCell>
                  <TableCell className="text-right text-destructive">{eur(totals.expenses)}</TableCell>
                  <TableCell className={`text-right ${totals.margin >= 0 ? "text-primary" : "text-destructive"}`}>
                    {eur(totals.margin)}
                  </TableCell>
                  <TableCell className="text-right">{totals.marginRate.toFixed(1)} %</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Liste des dépenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dépenses encodées</CardTitle>
            <CardDescription>
              Crédit, charges, précompte, assurances… récurrentes ou ponctuelles. Montants HTVA.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {(expenses ?? []).length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Info className="h-4 w-4" />
                Aucune dépense encodée pour le moment.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intitulé</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Nature</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Impact / mois</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(expenses ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.label}
                        {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{e.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.is_recurring ? RECURRENCE_LABELS[e.recurrence] || e.recurrence : "Ponctuelle"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.is_recurring
                          ? `${e.start_date ? format(new Date(e.start_date), "dd/MM/yyyy") : "—"} → ${
                              e.end_date ? format(new Date(e.end_date), "dd/MM/yyyy") : "indéterminé"
                            }`
                          : e.expense_date
                            ? format(new Date(e.expense_date), "dd/MM/yyyy")
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">{eur(Number(e.amount))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {e.is_recurring ? eur(getExpenseAnnualAmount(e) / 12) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
            <DialogDescription>Tous les montants sont encodés HTVA.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="label">Intitulé</Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ex: Crédit hypothécaire"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="amount">Montant (€ HTVA)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Ex: 1250"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="recurring"
                checked={form.is_recurring}
                onCheckedChange={(v) => setForm({ ...form, is_recurring: v })}
              />
              <Label htmlFor="recurring">Dépense récurrente</Label>
            </div>
            {form.is_recurring ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Périodicité</Label>
                  <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                      <SelectItem value="quarterly">Trimestrielle</SelectItem>
                      <SelectItem value="yearly">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="start">Début</Label>
                  <Input
                    id="start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end">Fin (optionnel)</Label>
                  <Input
                    id="end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="expense-date">Date de la dépense</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {form.is_recurring && form.recurrence !== "monthly" && (
              <p className="text-xs text-muted-foreground">
                Le montant encodé est celui de chaque échéance ; il est lissé sur les mois du tableau de bord.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving}>
              {form.id ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.label} » sera définitivement supprimée du calcul de rentabilité.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminProfitability;
