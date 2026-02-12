import { Brain, Workflow, UserCheck } from "lucide-react";

const pillars = [
  {
    icon: Brain,
    title: "Always-On Intelligence",
    description: "AI agents anticipate opportunities and surface insights without requiring manual prompts or constant monitoring.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Workflow,
    title: "Composable Workflows",
    description: "Marketing teams can orchestrate complex content sequences and campaigns without writing any code.",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: UserCheck,
    title: "Human-in-the-Loop",
    description: "Clear approval checkpoints ensure quality control and compliance before any content goes live.",
    gradient: "from-emerald-500 to-teal-600",
  },
];

const VisionPillars = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Core Principles
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three foundational pillars that guide how our AI agents work with your team
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <div
                key={index}
                className="group relative bg-card border border-border rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30"
              >
                {/* Icon */}
                <div
                  className={`w-16 h-16 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {pillar.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {pillar.description}
                </p>

                {/* Decorative gradient line */}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${pillar.gradient} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default VisionPillars;
