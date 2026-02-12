import { 
  Video, 
  ImageIcon, 
  Building2, 
  Target, 
  MessageSquareQuote, 
  Calendar, 
  FileText, 
  Bug 
} from "lucide-react";
import VisionFeatureCard from "./VisionFeatureCard";

const features = [
  {
    icon: Video,
    title: "Video AI",
    description: "Generate professional marketing videos with Sora & Gemini Veo 3 AI models.",
    href: "/workspace",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: ImageIcon,
    title: "Image AI",
    description: "Create stunning visuals with Google Gemini AI for all your marketing needs.",
    href: "/image-ai",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Building2,
    title: "Brand Management",
    description: "Track KPIs, analytics, and performance across all your brands in one place.",
    href: "/brands",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: Target,
    title: "Project Tracking",
    description: "Manage clients, projects, and tasks with intelligent AI-powered insights.",
    href: "/projects",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: MessageSquareQuote,
    title: "Testimonials",
    description: "AI-powered testimonial collection pipeline to capture customer success stories.",
    href: "/testimonials",
    gradient: "from-rose-500 to-red-500",
  },
  {
    icon: Calendar,
    title: "EOD Submissions",
    description: "Daily work tracking and team visibility for better project management.",
    href: "/eod-submission",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    icon: FileText,
    title: "Content Generation",
    description: "LinkedIn posts, SEO blogs, and newsletters powered by AI writing assistants.",
    href: "/content/linkedin",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    icon: Bug,
    title: "Bugs & Feedback",
    description: "Continuous improvement through team feedback and feature requests.",
    href: "/feedback/history",
    gradient: "from-slate-500 to-gray-500",
  },
];

const VisionFeatureGrid = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What We've Built
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete suite of AI-powered tools designed to supercharge your marketing workflow
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <VisionFeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default VisionFeatureGrid;
