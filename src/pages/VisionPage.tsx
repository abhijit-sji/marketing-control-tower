import VisionHero from "@/components/vision/VisionHero";
import VisionPillars from "@/components/vision/VisionPillars";
import VisionFeatureGrid from "@/components/vision/VisionFeatureGrid";
import VisionAgentGallery from "@/components/vision/VisionAgentGallery";
import VisionAgentExamples from "@/components/vision/VisionAgentExamples";
import ImpactMetrics from "@/components/vision/ImpactMetrics";

const VisionPage = () => {
  return (
    <div className="min-h-screen -mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Full-width hero */}
      <VisionHero />
      
      {/* Core Principles */}
      <VisionPillars />
      
      {/* Features Section */}
      <VisionFeatureGrid />
      
      {/* AI Agents Gallery */}
      <VisionAgentGallery />
      
      {/* Interactive Demo */}
      <VisionAgentExamples />
      
      {/* Impact Metrics */}
      <ImpactMetrics />
      
      {/* Footer CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Ready to Transform Your Marketing?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Every feature you see here is built and ready to use. 
            Start exploring and let AI amplify your team's capabilities.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/brands"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              Explore Brands
            </a>
            <a
              href="/workspace"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-card border border-border text-foreground font-medium hover:bg-secondary transition-all"
            >
              Try Video AI
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VisionPage;
