import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CheckCircle, XCircle, Clock, User, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Booking } from "./utils";

interface CancelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  futureCount: number;
  isCancelling: boolean;
  onCancelSingle: () => void;
  onCancelAllFuture: () => void;
  isAdmin?: boolean;
  onConfirm?: () => void;
  onRefuse?: () => void;
  isUpdating?: boolean;
  roomName?: string;
}

const CancelBookingDialog = ({
  open,
  onOpenChange,
  booking,
  futureCount,
  isCancelling,
  onCancelSingle,
  onCancelAllFuture,
  isAdmin,
  onConfirm,
  onRefuse,
  isUpdating,
  roomName,
}: CancelBookingDialogProps) => {
  if (!booking) return null;

  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const isPending = booking.status === "pending";

  const statusBadge = () => {
    switch (booking.status) {
      case "confirmed":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Confirmée</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200">Annulée</Badge>;
      default:
        return <Badge variant="secondary">{booking.status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Détail de la réservation</DialogTitle>
          <DialogDescription>
            {format(start, "EEEE d MMMM yyyy", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="flex items-center gap-2">
            {statusBadge()}
          </div>

          {/* Time */}
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm">
              {format(start, "HH:mm")} – {format(end, "HH:mm")}
            </p>
          </div>

          {/* Room */}
          {roomName && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">{roomName}</p>
            </div>
          )}

          {/* Practitioner */}
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm">
              {booking.profiles?.first_name} {booking.profiles?.last_name}
            </p>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm italic text-muted-foreground">{booking.notes}</p>
            </div>
          )}

          {/* Admin confirm/refuse for pending bookings */}
          {isAdmin && isPending && onConfirm && onRefuse && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 space-y-3">
              <p className="text-sm font-medium text-yellow-800">
                Cette réservation est en attente de validation.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={onConfirm}
                  disabled={isUpdating}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {isUpdating ? "..." : "Confirmer"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onRefuse}
                  disabled={isUpdating}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {isUpdating ? "..." : "Refuser"}
                </Button>
              </div>
            </div>
          )}

          {/* Cancel actions */}
          {booking.status !== "cancelled" && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">Annuler la réservation</p>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={onCancelSingle}
                disabled={isCancelling}
              >
                {isCancelling ? "Annulation..." : "Annuler cette réservation"}
              </Button>

              {futureCount > 1 && (
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={onCancelAllFuture}
                  disabled={isCancelling}
                >
                  {isCancelling
                    ? "Annulation..."
                    : `Annuler toutes les occurrences futures (${futureCount})`}
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelBookingDialog;
