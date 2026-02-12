import { Zap, Users, Clock } from "lucide-react";

const metrics = [
  {
    icon: Zap,
    value: "80%",
    label: "Content Velocity",
    description: "Faster content creation with AI-assisted drafting, optimization, and repurposing",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Users,
    value: "10x",
    label: "Team Output",
    description: "More high-quality deliverables without adding headcount or burning out your team",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Clock,
    value: "24/7",
    label: "Always Available",
    description: "AI agents ready to help at any hour, ensuring work moves forward continuously",
    gradient: "from-emerald-500 to-teal-500",
  },
];

const ImpactMetrics = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Target Impact
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Measurable outcomes we're building towards with every feature and agent
          </p>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={index}
                className="relative bg-card border border-border rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 overflow-hidden"
              >
                {/* Background gradient decoration */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-5`}
                />

                {/* Icon */}
                <div className="relative flex justify-center mb-4">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${metric.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                </div>

                {/* Value */}
                <div className="relative">
                  <span
                    className={`text-5xl md:text-6xl font-bold bg-gradient-to-r ${metric.gradient} bg-clip-text text-transparent`}
                  >
                    {metric.value}
                  </span>
                </div>

                {/* Label */}
                <h3 className="relative text-xl font-semibold text-foreground mt-2 mb-3">
                  {metric.label}
                </h3>

                {/* Description */}
                <p className="relative text-sm text-muted-foreground leading-relaxed">
                  {metric.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ImpactMetrics;
