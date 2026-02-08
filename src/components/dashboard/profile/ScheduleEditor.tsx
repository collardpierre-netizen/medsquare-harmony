import { useState } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
).flat();

export interface DaySchedule {
  day: string;
  start: string;
  end: string;
}

interface ScheduleEditorProps {
  schedule: DaySchedule[];
  onChange: (schedule: DaySchedule[]) => void;
}

const ScheduleEditor = ({ schedule, onChange }: ScheduleEditorProps) => {
  const addSlot = (day: string) => {
    onChange([...schedule, { day, start: "09:00", end: "17:00" }]);
  };

  const removeSlot = (index: number) => {
    onChange(schedule.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof DaySchedule, value: string) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Horaires de consultation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS.map((day) => {
          const daySlots = schedule
            .map((s, i) => ({ ...s, originalIndex: i }))
            .filter((s) => s.day === day);

          return (
            <div key={day} className="flex items-start gap-4">
              <div className="w-24 pt-2">
                <span className="text-sm font-medium capitalize">{day}</span>
              </div>
              <div className="flex-1 space-y-2">
                {daySlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground pt-2">Fermé</p>
                ) : (
                  daySlots.map((slot) => (
                    <div key={slot.originalIndex} className="flex items-center gap-2">
                      <Select
                        value={slot.start}
                        onValueChange={(v) => updateSlot(slot.originalIndex, "start", v)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">—</span>
                      <Select
                        value={slot.end}
                        onValueChange={(v) => updateSlot(slot.originalIndex, "end", v)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => removeSlot(slot.originalIndex)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => addSlot(day)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter un créneau
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ScheduleEditor;
