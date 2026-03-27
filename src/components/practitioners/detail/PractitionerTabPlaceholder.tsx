import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  description: string;
  icon?: string;
}

const PractitionerTabPlaceholder = ({ title, description, icon = "🚧" }: Props) => (
  <Card className="shadow-none border-dashed">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-4">{icon}</span>
      <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </CardContent>
  </Card>
);

export default PractitionerTabPlaceholder;
