import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import WidgetPractitioners from "@/components/widgets/WidgetPractitioners";
import WidgetActivities from "@/components/widgets/WidgetActivities";
import WidgetRooms from "@/components/widgets/WidgetRooms";
import WidgetSchedule from "@/components/widgets/WidgetSchedule";

export interface WidgetConfig {
  id: string;
  name: string;
  type: "practitioners" | "activities" | "rooms" | "schedule";
  template: string;
  settings: {
    autoScroll?: boolean;
    scrollInterval?: number;
    showTitle?: boolean;
    title?: string;
    maxItems?: number;
    theme?: "light" | "dark";
  };
}

const Widget = () => {
  const { id } = useParams<{ id: string }>();
  const [widget, setWidget] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWidget = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "widgets")
        .single();
      if (data) {
        const widgets = (data.value as any)?.items || [];
        const found = widgets.find((w: WidgetConfig) => w.id === id);
        if (found) {
          setWidget(found);
        } else {
          setError("Widget introuvable");
        }
      } else {
        setError("Widget introuvable");
      }
      setLoading(false);
    };
    fetchWidget();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !widget) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{error || "Widget introuvable"}</p>
      </div>
    );
  }

  const isDark = widget.settings.theme === "dark";

  return (
    <div className={`h-screen w-screen overflow-hidden ${isDark ? "dark bg-[#0a0a0a] text-white" : "bg-background text-foreground"}`}>
      {widget.settings.showTitle && widget.settings.title && (
        <div className="px-6 pt-5 pb-2">
          <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold">{widget.settings.title}</h1>
        </div>
      )}
      <div className="h-full w-full p-4 md:p-6">
        {widget.type === "practitioners" && <WidgetPractitioners config={widget} />}
        {widget.type === "activities" && <WidgetActivities config={widget} />}
        {widget.type === "rooms" && <WidgetRooms config={widget} />}
      </div>
    </div>
  );
};

export default Widget;
