import { Sparkles, Rocket, Users } from "lucide-react";

const VisionHero = () => {
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 max-w-5xl mx-auto text-center px-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">SJ Marketing Hub Vision</span>
        </div>

        {/* Main headline */}
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Transform Marketing with
          <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            AI-Powered Intelligence
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
          We believe the future of marketing isn't about replacing people—it's about{" "}
          <span className="text-foreground font-semibold">augmenting their capabilities</span>{" "}
          with AI agents that work alongside every team member.
        </p>

        {/* Stats/highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="flex flex-col items-center p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
            <Rocket className="h-8 w-8 text-primary mb-3" />
            <span className="text-3xl font-bold text-foreground">10+</span>
            <span className="text-sm text-muted-foreground">AI Agents</span>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
            <Users className="h-8 w-8 text-accent mb-3" />
            <span className="text-3xl font-bold text-foreground">100%</span>
            <span className="text-sm text-muted-foreground">Team Accessible</span>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
            <Sparkles className="h-8 w-8 text-primary mb-3" />
            <span className="text-3xl font-bold text-foreground">24/7</span>
            <span className="text-sm text-muted-foreground">Always Ready</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisionHero;
