import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CategoryPillsProps {
  categories: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

const CategoryPills = ({ categories, selected, onSelect }: CategoryPillsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, categories]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      {/* Left fade + arrow */}
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Right fade + arrow */}
      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 pb-2 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border shrink-0",
              selected === cat.value
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:bg-accent hover:border-accent-foreground/20"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryPills;
