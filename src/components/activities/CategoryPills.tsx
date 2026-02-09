import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CategoryPillsProps {
  categories: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

const CategoryPills = ({ categories, selected, onSelect }: CategoryPillsProps) => {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border",
              selected === cat.value
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:bg-accent hover:border-accent-foreground/20"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default CategoryPills;
