import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Booking } from "./utils";

interface CancelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  futureCount: number;
  isCancelling: boolean;
  onCancelSingle: () => void;
  onCancelAllFuture: () => void;
}

const CancelBookingDialog = ({
  open,
  onOpenChange,
  booking,
  futureCount,
  isCancelling,
  onCancelSingle,
  onCancelAllFuture,
}: CancelBookingDialogProps) => {
  if (!booking) return null;

  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Annuler la réservation</DialogTitle>
          <DialogDescription>
            {format(start, "EEEE d MMMM yyyy", { locale: fr })} de{" "}
            {format(start, "HH:mm")} à {format(end, "HH:mm")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">
              {booking.profiles?.first_name} {booking.profiles?.last_name} —{" "}
              {booking.status === "confirmed" ? "Confirmée" : booking.status === "pending" ? "En attente" : booking.status}
            </p>
          </div>

          {booking.notes && (
            <p className="text-xs text-muted-foreground italic">
              Note : {booking.notes}
            </p>
          )}

          <div className="space-y-2">
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
