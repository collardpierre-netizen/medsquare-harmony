import { Badge } from "@/components/ui/badge";
import { Lock, CalendarClock, Ban, UserCheck } from "lucide-react";
import {
  getRoomStatus,
  getPrivatizationLabel,
  type RoomPrivatizationFields,
} from "@/lib/roomPrivatization";
import { cn } from "@/lib/utils";

interface RoomStatusBadgeProps {
  room: RoomPrivatizationFields;
  /** Hide the badge when status is "available" (default true). */
  hideWhenAvailable?: boolean;
  /** Use compact (smaller) sizing. */
  compact?: boolean;
  /** Optional name of the practitioner the room is assigned to (when privatized for someone specific). */
  assignedPractitionerName?: string | null;
  className?: string;
}

/**
 * Single badge component to render a room's status — guarantees consistent
 * colors and icons everywhere a room status is shown.
 *
 *  - Indisponible (is_available=false)        → muted/grey   + Ban icon
 *  - Privatisé en cours                        → destructive  + Lock icon
 *  - Privatisation programmée (à venir)        → warning amber+ CalendarClock icon
 *  - Disponible                                → no badge (or null)
 *
 *  When `assignedPractitionerName` is provided AND the room is privatized/scheduled,
 *  the badge label becomes "Cabinet de [Nom]" (with a UserCheck icon) instead of the date range.
 */
const RoomStatusBadge = ({
  room,
  hideWhenAvailable = true,
  compact = false,
  assignedPractitionerName,
  className,
}: RoomStatusBadgeProps) => {
  const status = getRoomStatus(room);

  if (status === "available") {
    if (hideWhenAvailable) return null;
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-success/40 text-success",
          compact && "text-[10px] py-0 px-1.5",
          className
        )}
      >
        Disponible
      </Badge>
    );
  }

  if (status === "unavailable") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 bg-muted text-muted-foreground border border-border",
          compact && "text-[10px] py-0 px-1.5",
          className
        )}
      >
        <Ban className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        Indisponible
      </Badge>
    );
  }

  const hasAssignee = !!assignedPractitionerName?.trim();
  const Icon = hasAssignee ? UserCheck : status === "scheduled" ? CalendarClock : Lock;
  const label = hasAssignee
    ? `Cabinet de ${assignedPractitionerName}`
    : getPrivatizationLabel(room) ||
      (status === "scheduled" ? "Privatisation programmée" : "Privatisé");

  if (status === "scheduled") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-warning/50 bg-warning/10 text-warning",
          compact && "text-[10px] py-0 px-1.5",
          className
        )}
      >
        <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {label}
      </Badge>
    );
  }

  // privatized (active)
  return (
    <Badge
      variant="destructive"
      className={cn("gap-1", compact && "text-[10px] py-0 px-1.5", className)}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label}
    </Badge>
  );
};

export default RoomStatusBadge;
