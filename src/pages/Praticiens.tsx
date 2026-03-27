import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  User, Award, Search, SlidersHorizontal, X, Video, Home, Accessibility,
  ParkingCircle, UserCheck, Languages, Stethoscope, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import CategoryPills from "@/components/activities/CategoryPills";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  bio: string | null;
  avatar_url: string | null;
  languages: string[];
  conventioned: boolean | null;
  video_available: boolean;
  home_visit: boolean;
  pmr_accessible: boolean;
  parking: boolean;
  accepts_new_patients: boolean;
}

const Praticiens = () => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filters
  const [filterLang, setFilterLang] = useState("all");
  const [filterConventioned, setFilterConventioned] = useState(false);
  const [filterVideo, setFilterVideo] = useState(false);
  const [filterHome, setFilterHome] = useState(false);
  const [filterPMR, setFilterPMR] = useState(false);
  const [filterParking, setFilterParking] = useState(false);
  const [filterNewPatients, setFilterNewPatients] = useState(false);

  const hasActiveFilters = filterConventioned || filterVideo || filterHome || filterPMR || filterParking || filterNewPatients || filterLang !== "all";

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, bio, avatar_url, languages, conventioned, video_available, home_visit, pmr_accessible, parking, accepts_new_patients")
        .eq("is_active", true)
        .order("display_order" as any)
        .order("last_name");
      setPractitioners(
        (data || []).map((p: any) => ({
          ...p,
          languages: p.languages || ["français"],
          conventioned: p.conventioned ?? null,
          video_available: p.video_available ?? false,
          home_visit: p.home_visit ?? false,
          pmr_accessible: p.pmr_accessible ?? false,
          parking: p.parking ?? false,
          accepts_new_patients: p.accepts_new_patients ?? true,
        }))
      );
      setLoading(false);
    };
    fetchData();
  }, []);

  const specialtyOptions = useMemo(() => {
    const set = new Set<string>();
    practitioners.forEach((p) => { if (p.specialty) set.add(p.specialty); });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
    return [
      { value: "all", label: "Toutes les spécialités" },
      ...sorted.map((s) => ({ value: s, label: s })),
    ];
  }, [practitioners]);

  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    practitioners.forEach((p) => p.languages.forEach((l) => set.add(l)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [practitioners]);

  const filtered = useMemo(() => {
    return practitioners.filter((p) => {
      if (selectedSpecialty !== "all" && p.specialty !== selectedSpecialty) return false;
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        const spec = (p.specialty || "").toLowerCase();
        const langs = p.languages.join(" ").toLowerCase();
        if (!fullName.includes(q) && !spec.includes(q) && !langs.includes(q)) return false;
      }
      if (filterLang !== "all" && !p.languages.includes(filterLang)) return false;
      if (filterConventioned && !p.conventioned) return false;
      if (filterVideo && !p.video_available) return false;
      if (filterHome && !p.home_visit) return false;
      if (filterPMR && !p.pmr_accessible) return false;
      if (filterParking && !p.parking) return false;
      if (filterNewPatients && !p.accepts_new_patients) return false;
      return true;
    });
  }, [practitioners, search, selectedSpecialty, filterLang, filterConventioned, filterVideo, filterHome, filterPMR, filterParking, filterNewPatients]);

  const clearFilters = () => {
    setFilterLang("all");
    setFilterConventioned(false);
    setFilterVideo(false);
    setFilterHome(false);
    setFilterPMR(false);
    setFilterParking(false);
    setFilterNewPatients(false);
    setSearch("");
    setSelectedSpecialty("all");
  };

  const activeFilterCount = [filterConventioned, filterVideo, filterHome, filterPMR, filterParking, filterNewPatients, filterLang !== "all"].filter(Boolean).length;

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-12 pb-6">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl"
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              Nos praticiens
            </h1>
            <p className="text-muted-foreground mt-2">
              Des professionnels qualifiés et passionnés, unis par une mission commune :
              prendre soin de vous.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search + Filters */}
      <section className="border-b border-border sticky top-[72px] z-30 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un praticien…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5 flex-shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full ml-0.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Specialty pills */}
          {specialtyOptions.length > 1 && (
            <CategoryPills
              categories={specialtyOptions}
              selected={selectedSpecialty}
              onSelect={setSelectedSpecialty}
            />
          )}

          {/* Advanced filters panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Filtres avancés
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Language select */}
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Languages className="h-3.5 w-3.5 text-primary" />
                        Langue
                      </Label>
                      <Select value={filterLang} onValueChange={setFilterLang}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes les langues</SelectItem>
                          {languageOptions.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l.charAt(0).toUpperCase() + l.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Toggle filters */}
                    {([
                      { key: "conventioned", label: "Conventionné(e)", icon: Stethoscope, state: filterConventioned, set: setFilterConventioned },
                      { key: "newPatients", label: "Nouveaux patients", icon: UserCheck, state: filterNewPatients, set: setFilterNewPatients },
                      { key: "video", label: "Consultation vidéo", icon: Video, state: filterVideo, set: setFilterVideo },
                      { key: "home", label: "Visite à domicile", icon: Home, state: filterHome, set: setFilterHome },
                      { key: "pmr", label: "Accès PMR", icon: Accessibility, state: filterPMR, set: setFilterPMR },
                      { key: "parking", label: "Parking", icon: ParkingCircle, state: filterParking, set: setFilterParking },
                    ] as const).map(({ key, label, icon: Icon, state, set }) => (
                      <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                        <Label className="text-xs flex items-center gap-1.5 cursor-pointer" htmlFor={`filter-${key}`}>
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          {label}
                        </Label>
                        <Switch id={`filter-${key}`} checked={state} onCheckedChange={set} />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter badges */}
          {hasActiveFilters && !showFilters && (
            <div className="flex flex-wrap gap-1.5">
              {filterLang !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Languages className="h-3 w-3" />
                  {filterLang}
                  <button onClick={() => setFilterLang("all")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filterConventioned && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Stethoscope className="h-3 w-3" />
                  Conventionné
                  <button onClick={() => setFilterConventioned(false)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filterNewPatients && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <UserCheck className="h-3 w-3" />
                  Nouveaux patients
                  <button onClick={() => setFilterNewPatients(false)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filterVideo && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Video className="h-3 w-3" />
                  Vidéo
                  <button onClick={() => setFilterVideo(false)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filterHome && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Home className="h-3 w-3" />
                  Domicile
                  <button onClick={() => setFilterHome(false)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filterPMR && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Accessibility className="h-3 w-3" />
                  PMR
                  <button onClick={() => setFilterPMR(false)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filterParking && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ParkingCircle className="h-3 w-3" />
                  Parking
                  <button onClick={() => setFilterParking(false)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Grid */}
      <section className="py-8 pb-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <User className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {practitioners.length === 0
                  ? "Aucun praticien disponible pour le moment."
                  : "Aucun praticien ne correspond à vos critères."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-5">
                {filtered.length} praticien{filtered.length > 1 ? "s" : ""}
                {hasActiveFilters && " (filtré)"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((practitioner, index) => (
                  <motion.div
                    key={practitioner.id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                  >
                    <Link to={`/praticiens/${practitioner.id}`} className="group block">
                      <div className="relative overflow-hidden rounded-xl aspect-[4/5] bg-muted mb-3">
                        {practitioner.avatar_url ? (
                          <img
                            src={practitioner.avatar_url}
                            alt={`${practitioner.first_name} ${practitioner.last_name}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-accent">
                            <User className="h-16 w-16 text-muted-foreground/20" />
                          </div>
                        )}
                        {/* Badges overlay */}
                        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                          {practitioner.accepts_new_patients && (
                            <span className="bg-primary/90 text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                              Disponible
                            </span>
                          )}
                          {practitioner.conventioned && (
                            <span className="bg-background/90 text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                              Conv.
                            </span>
                          )}
                          {practitioner.video_available && (
                            <span className="bg-background/90 text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Video className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-display text-base font-semibold group-hover:text-primary transition-colors">
                        {practitioner.first_name} {practitioner.last_name}
                      </h3>
                      <p className="text-sm flex items-center gap-1 mt-0.5">
                        {practitioner.specialty ? (
                          <>
                            <Award className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-primary font-medium">{practitioner.specialty}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Spécialité non renseignée</span>
                        )}
                      </p>
                      {practitioner.languages.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Languages className="h-3 w-3 shrink-0" />
                          {practitioner.languages.join(", ")}
                        </p>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Praticiens;
