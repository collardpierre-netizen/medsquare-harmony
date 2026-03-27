import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

const PractitionerTabPlaceholder = React.forwardRef<HTMLDivElement, Props>(
  ({ title, description, icon: Icon }, ref) => (
    <Card ref={ref} className="shadow-none border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  )
);

PractitionerTabPlaceholder.displayName = "PractitionerTabPlaceholder";

export default PractitionerTabPlaceholder;
