import { useMemo } from "react";
import { addDays, format, isSameDay, isBefore, startOfDay, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WeekDatePickerProps {
  weekStart: Date;
  selectedDate: Date;
  onWeekChange: (newStart: Date) => void;
  onDateSelect: (day: Date) => void;
}

const WeekDatePicker = ({ weekStart, selectedDate, onWeekChange, onDateSelect }: WeekDatePickerProps) => {
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onWeekChange(addDays(weekStart, -7))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-lg">
              {format(weekStart, "MMMM yyyy", { locale: fr })}
            </h3>
            {!isSameDay(selectedDate, new Date()) && (
              <button
                onClick={() => {
                  const today = new Date();
                  onWeekChange(startOfWeek(today, { weekStartsOn: 1 }));
                  onDateSelect(today);
                }}
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Aujourd'hui
              </button>
            )}
          </div>
          <button
            onClick={() => onWeekChange(addDays(weekStart, 7))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const isPast = isBefore(day, startOfDay(new Date()));

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(day)}
                disabled={isPast}
                className={cn(
                  "flex flex-col items-center py-3 px-3 min-w-[3.2rem] rounded-xl transition-all text-center snap-center shrink-0 sm:min-w-0 sm:shrink",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md"
                    : isToday
                    ? "bg-accent text-accent-foreground"
                    : isPast
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-muted cursor-pointer"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {format(day, "EEE", { locale: fr })}
                </span>
                <span className="text-2xl font-bold mt-1">
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeekDatePicker;
