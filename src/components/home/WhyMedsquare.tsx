import { useSiteSettings } from "@/hooks/useSiteSettings";

const WhyMedsquare = () => {
  const { settings } = useSiteSettings();
  const why = settings.why;

  return (
    <section className="py-20 md:py-28 bg-warm">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-4">
            <p className="text-sm text-muted-foreground mb-4">{why.badge}</p>
            <h2 className="font-display font-normal text-4xl md:text-5xl leading-[1.05] tracking-tight mb-5 text-balance">
              {why.title}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">{why.subtitle}</p>
          </div>

          <ol className="lg:col-span-8 grid sm:grid-cols-2 gap-x-10">
            {why.features.map((feature, index) => (
              <li key={index} className="border-t border-foreground/15 py-7">
                <span className="text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-2xl mt-3 mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default WhyMedsquare;
