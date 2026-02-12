export interface ContentFunnelStage {
  id: string;
  name: string;
  tagline: string;
  color: string;
  colorDark: string;
  icon: string;
  contentTypes: string[];
  kpis: string[];
  strategies: string[];
  promptHint: string;
  postTypes: string[];
}

export const CONTENT_FUNNEL_STAGES: ContentFunnelStage[] = [
  {
    id: 'awareness',
    name: 'Awareness',
    tagline: 'Get discovered by people and AI',
    color: 'hsl(100, 45%, 72%)',
    colorDark: 'hsl(100, 45%, 35%)',
    icon: 'Eye',
    contentTypes: [
      'Founder-led social content (LinkedIn, X, YouTube)',
      'AI search results (ChatGPT, Perplexity, Google AI)',
      'Top-of-funnel SEO content'
    ],
    kpis: ['Impressions', 'AI mentions and citations', 'Organic traffic growth'],
    strategies: [
      'Publish founder-led POV content',
      'Optimize for AEO + GEO (SEO)',
      'Create broad content AI can surface'
    ],
    promptHint: 'Share a unique perspective or insight that positions you as a thought leader',
    postTypes: ['Hot take', 'Industry observation', 'Trend commentary', 'Personal story']
  },
  {
    id: 'consideration',
    name: 'Consideration',
    tagline: 'Educate and nurture that audience',
    color: 'hsl(95, 40%, 65%)',
    colorDark: 'hsl(95, 40%, 32%)',
    icon: 'BookOpen',
    contentTypes: [
      'Newsletters and email sequences',
      'Educational SEO content',
      'Podcasts/interviews'
    ],
    kpis: ['Email subscribers', 'Content engagement', 'Time on site'],
    strategies: [
      'Nurture via email and community',
      'Capture micro-signals (clicks, saves, follows)',
      'Expand narrative in long-form'
    ],
    promptHint: 'What educational value or framework can you teach your audience?',
    postTypes: ['How-to guide', 'Framework breakdown', 'Lessons learned', 'Case study']
  },
  {
    id: 'intent',
    name: 'Intent',
    tagline: 'Capture high-intent signals',
    color: 'hsl(90, 35%, 55%)',
    colorDark: 'hsl(90, 35%, 28%)',
    icon: 'Target',
    contentTypes: [
      'Demo pages and product tours',
      'Comparison content',
      'Bottom-of-funnel keywords'
    ],
    kpis: ['Demo requests', 'High-intent page visits', 'MQL volume'],
    strategies: [
      'Offer clear paths to demos, trials, or waitlists',
      'Content focused on solution evaluation',
      'Capture high-intent keywords'
    ],
    promptHint: 'What proof, results, or case study demonstrates your solution works?',
    postTypes: ['Results showcase', 'Before/after', 'Client win', 'Product insight']
  },
  {
    id: 'conversion',
    name: 'Conversion',
    tagline: 'Turn intent into revenue',
    color: 'hsl(85, 30%, 45%)',
    colorDark: 'hsl(85, 30%, 25%)',
    icon: 'DollarSign',
    contentTypes: [
      'Sales enablement materials',
      'Pricing pages',
      'ROI calculators'
    ],
    kpis: ['Pipeline generated', 'Win rates', 'Deal velocity'],
    strategies: [
      'Support sales with content assets',
      'Reduce friction with social proof',
      'Address objections proactively'
    ],
    promptHint: 'What call-to-action or offer resonates most with your ideal customer?',
    postTypes: ['Offer announcement', 'Limited opportunity', 'Direct CTA', 'Testimonial feature']
  },
  {
    id: 'loyalty',
    name: 'Loyalty',
    tagline: 'Compound trust and growth',
    color: 'hsl(80, 25%, 38%)',
    colorDark: 'hsl(80, 25%, 22%)',
    icon: 'Heart',
    contentTypes: [
      'Customer community',
      'Exclusive content/events',
      'Referral programs'
    ],
    kpis: ['NRR/retention', 'Referral traffic', 'Community engagement'],
    strategies: [
      'Deepen customer community',
      'Enable advocacy and referrals',
      'Create exclusive experiences'
    ],
    promptHint: 'How can you deepen connection with your existing community?',
    postTypes: ['Community spotlight', 'Behind-the-scenes', 'Exclusive insight', 'Appreciation post']
  }
];

export const getFunnelStageById = (id: string): ContentFunnelStage | undefined => {
  return CONTENT_FUNNEL_STAGES.find(stage => stage.id === id);
};
