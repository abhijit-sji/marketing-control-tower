import { User, Bot, Linkedin, ArrowRight, Sparkles, Search, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ContentCreationFlowProps {
  compact?: boolean;
}

export function ContentCreationFlow({ compact = false }: ContentCreationFlowProps) {
  const steps = [
    {
      icon: User,
      title: "You",
      subtitle: "Ideas & POV",
      description: "Your experiences, questions, unique perspective",
      color: "bg-blue-500",
      items: ["Your POV", "Experience", "Questions"]
    },
    {
      icon: Bot,
      title: "AI Agent",
      subtitle: "Research & Generation",
      description: "Trend analysis, knowledge base, style matching",
      color: "bg-purple-500",
      items: ["Trend analysis", "Knowledge base", "Style matching"]
    },
    {
      icon: Linkedin,
      title: "LinkedIn Post",
      subtitle: "Ready to Publish",
      description: "Authentic content in your voice, backed by data",
      color: "bg-primary",
      items: ["Your voice", "Data-backed", "Optimized"]
    }
  ];

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="p-1.5 rounded-full bg-blue-500/10">
            <User className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <span className="text-muted-foreground">Your Ideas</span>
        </div>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <div className="flex items-center gap-1.5 text-xs">
          <div className="p-1.5 rounded-full bg-purple-500/10">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <span className="text-muted-foreground">AI Research</span>
        </div>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <div className="flex items-center gap-1.5 text-xs">
          <div className="p-1.5 rounded-full bg-primary/10">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-muted-foreground">Great Content</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {steps.map((step, index) => (
            <div key={step.title} className="relative p-5">
              {/* Connection Arrow (desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <div className="p-1.5 rounded-full bg-background border shadow-sm">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* Step Content */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`p-3 rounded-xl ${step.color} text-white shadow-lg`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold">{step.title}</h4>
                  <p className="text-sm text-muted-foreground">{step.subtitle}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {step.items.map((item) => (
                    <span 
                      key={item} 
                      className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer Message */}
        <div className="px-5 py-3 bg-muted/30 border-t">
          <p className="text-xs text-center text-muted-foreground">
            <span className="font-medium text-foreground">Ideas come from you</span>
            {" "}— the AI agent handles research, trends, and formatting to amplify your voice
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
