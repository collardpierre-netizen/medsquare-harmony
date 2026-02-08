import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import WhyMedsquare from "@/components/home/WhyMedsquare";
import PractitionersPreview from "@/components/home/PractitionersPreview";
import SpacesPreview from "@/components/home/SpacesPreview";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import ContactBand from "@/components/home/ContactBand";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <WhyMedsquare />
      <PractitionersPreview />
      <SpacesPreview />
      <TestimonialsSection />
      <ContactBand />
    </Layout>
  );
};

export default Index;
