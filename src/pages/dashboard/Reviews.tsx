import SmartDashboardLayout from "@/components/dashboard/SmartDashboardLayout";
import ReviewModeration from "@/components/dashboard/reviews/ReviewModeration";
import { Star } from "lucide-react";

const Reviews = () => {
  return (
    <SmartDashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            Modération des avis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approuvez ou masquez les avis soumis par vos patients.
          </p>
        </div>
        <ReviewModeration />
      </div>
    </SmartDashboardLayout>
  );
};

export default Reviews;
