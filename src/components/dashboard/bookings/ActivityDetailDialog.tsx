import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, MapPin, User, Tag, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ActivitySessionSlot } from "./utils";

interface ActivityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ActivitySessionSlot | null;
  roomName?: string;
}

const ActivityDetailDialog = ({
  open,
  onOpenChange,
  session,
  roomName,
}: ActivityDetailDialogProps) => {
  if (!session) return null;

  const start = new Date(session.start_time);
  const end = new Date(session.end_time);
  const activity = session.activities;
  const practitioner = activity?.profiles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Tag className="h-4 w-4 text-orange-600" />
            </div>
            <DialogTitle className="text-lg">
              {activity?.title || "Activité"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Category */}
          {activity?.category && (
            <Badge
              variant="secondary"
              className="bg-orange-500/10 text-orange-700 border-orange-500/20"
            >
              {activity.category}
            </Badge>
          )}

          {/* Date & time */}
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {format(start, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(start, "HH:mm")} – {format(end, "HH:mm")}
              </p>
            </div>
          </div>

          {/* Room */}
          {roomName && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">{roomName}</p>
            </div>
          )}

          {/* Practitioner */}
          {practitioner && (
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">
                {practitioner.first_name} {practitioner.last_name}
              </p>
            </div>
          )}

          {/* Max participants */}
          {session.max_participants && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">
                {session.max_participants} participant{session.max_participants > 1 ? "s" : ""} max.
              </p>
            </div>
          )}

          {/* Info banner */}
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
            <p className="text-xs text-orange-800">
              Ce créneau est bloqué par une activité et n'est pas disponible à la réservation.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityDetailDialog;
