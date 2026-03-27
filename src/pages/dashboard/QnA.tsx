import SmartDashboardLayout from "@/components/dashboard/SmartDashboardLayout";
import QnAModeration from "@/components/dashboard/qna/QnAModeration";
import { MessageCircle } from "lucide-react";

const QnA = () => {
  return (
    <SmartDashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            Questions & Réponses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Répondez aux questions de vos patients. Les Q&R sont publiées après votre réponse.
          </p>
        </div>
        <QnAModeration />
      </div>
    </SmartDashboardLayout>
  );
};

export default QnA;
