import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FaqSection = () => {
  const { settings } = useSiteSettings();
  const faq = settings.faq;

  if (!faq.visible || faq.items.length === 0) return null;

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-4">
            <p className="text-sm text-muted-foreground mb-4">{faq.badge}</p>
            <h2 className="font-display font-normal text-4xl md:text-5xl leading-[1.05] tracking-tight text-balance">
              {faq.title}
            </h2>
          </div>

          <Accordion type="single" collapsible className="lg:col-span-8 border-t border-foreground/15">
            {faq.items.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-foreground/15">
                <AccordionTrigger className="text-left text-lg font-medium py-6 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base pb-6 leading-relaxed max-w-2xl">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
