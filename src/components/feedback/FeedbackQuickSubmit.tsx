import { Bug, Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function FeedbackQuickSubmit() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Bug Reports",
      description: "Report technical issues, errors, or unexpected behavior",
      icon: Bug,
      bgClass: "bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40",
      borderClass: "border-red-200 dark:border-red-900",
      iconBgClass: "bg-red-100 dark:bg-red-900/50",
      iconClass: "text-red-500",
      buttonClass: "bg-red-500 hover:bg-red-600 text-white",
      buttonText: "Submit Bug Report",
      type: "bug",
    },
    {
      title: "Feature Requests",
      description: "Suggest new features or improvements to existing ones",
      icon: Lightbulb,
      bgClass: "bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/40 dark:to-purple-950/40",
      borderClass: "border-blue-200 dark:border-blue-900",
      iconBgClass: "bg-blue-100 dark:bg-blue-900/50",
      iconClass: "text-blue-500",
      buttonClass: "bg-blue-500 hover:bg-blue-600 text-white",
      buttonText: "Submit Feature Request",
      type: "feature",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card) => (
        <Card
          key={card.type}
          className={`${card.bgClass} ${card.borderClass} border transition-all hover:shadow-lg group cursor-pointer`}
          onClick={() => navigate(`/feedback/submit?type=${card.type}`)}
        >
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`p-4 rounded-full ${card.iconBgClass}`}>
                <card.icon className={`h-8 w-8 ${card.iconClass}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{card.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
              </div>
              <Button
                className={`${card.buttonClass} gap-2 group-hover:gap-3 transition-all`}
              >
                {card.buttonText}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
