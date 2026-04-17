import { Badge } from "@/components/ui/badge";
import { Lock, CalendarClock, Ban } from "lucide-react";
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
 */
const RoomStatusBadge = ({
  room,
  hideWhenAvailable = true,
  compact = false,
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
        <CalendarClock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {getPrivatizationLabel(room) || "Privatisation programmée"}
      </Badge>
    );
  }

  // privatized (active)
  return (
    <Badge
      variant="destructive"
      className={cn("gap-1", compact && "text-[10px] py-0 px-1.5", className)}
    >
      <Lock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {getPrivatizationLabel(room) || "Privatisé"}
    </Badge>
  );
};

export default RoomStatusBadge;
