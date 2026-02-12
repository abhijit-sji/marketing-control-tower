import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Instagram, Youtube, Video, Facebook } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlatformRulesEditorProps {
  platformRules: Record<string, any>;
  onSave: (updated: Record<string, any>) => void;
  isSaving: boolean;
}

const PLATFORMS = [
  {
    key: 'instagram',
    label: 'Instagram Reels',
    icon: Instagram,
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  {
    key: 'youtube_shorts',
    label: 'YouTube Shorts',
    icon: Youtube,
    color: 'bg-gradient-to-br from-red-500 to-red-600',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: Video,
    color: 'bg-gradient-to-br from-gray-800 to-black',
  },
  {
    key: 'facebook',
    label: 'Facebook Reels',
    icon: Facebook,
    color: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
];

export default function PlatformRulesEditor({
  platformRules,
  onSave,
  isSaving,
}: PlatformRulesEditorProps) {
  const [rules, setRules] = useState<Record<string, any>>(platformRules);

  const updatePlatformRule = (platform: string, field: string, value: any) => {
    setRules((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || {}),
        [field]: value,
      },
    }));
  };

  const updateBestCategories = (platform: string, value: string) => {
    const categories = value.split(',').map((c) => c.trim()).filter((c) => c.length > 0);
    updatePlatformRule(platform, 'best_categories', categories);
  };

  const handleSave = () => {
    onSave(rules);
  };

  const hasChanges = JSON.stringify(rules) !== JSON.stringify(platformRules);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Platform-Specific Rules</h3>
          <p className="text-sm text-muted-foreground">
            Optimize hook generation for each platform's algorithm and audience behavior
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Alert>
        <AlertDescription>
          Configure attention spans, hook styles, and preferred categories for each platform. These
          rules guide the AI's strategy selection.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6">
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const platformRule = rules[platform.key] || {};

          return (
            <Card key={platform.key}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${platform.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{platform.label}</CardTitle>
                    <CardDescription>
                      Avg attention: {platformRule.avg_attention || 'N/A'}s
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Average Attention */}
                  <div className="space-y-2">
                    <Label htmlFor={`${platform.key}-attention`}>
                      Average Attention Span (seconds)
                    </Label>
                    <Input
                      id={`${platform.key}-attention`}
                      type="number"
                      step="0.5"
                      value={platformRule.avg_attention || ''}
                      onChange={(e) =>
                        updatePlatformRule(platform.key, 'avg_attention', parseFloat(e.target.value))
                      }
                      placeholder="e.g., 1.5"
                    />
                  </div>

                  {/* Hook Style */}
                  <div className="space-y-2">
                    <Label htmlFor={`${platform.key}-style`}>Hook Style</Label>
                    <Input
                      id={`${platform.key}-style`}
                      value={platformRule.hook_style || ''}
                      onChange={(e) =>
                        updatePlatformRule(platform.key, 'hook_style', e.target.value)
                      }
                      placeholder="e.g., Visual + text overlay"
                    />
                  </div>
                </div>

                {/* Best Categories */}
                <div className="space-y-2">
                  <Label htmlFor={`${platform.key}-categories`}>
                    Best Categories (comma-separated)
                  </Label>
                  <Input
                    id={`${platform.key}-categories`}
                    value={(platformRule.best_categories || []).join(', ')}
                    onChange={(e) => updateBestCategories(platform.key, e.target.value)}
                    placeholder="e.g., curiosity, identity, mistake"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(platformRule.best_categories || []).map((cat: string) => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Avoid */}
                <div className="space-y-2">
                  <Label htmlFor={`${platform.key}-avoid`}>What to Avoid</Label>
                  <Input
                    id={`${platform.key}-avoid`}
                    value={platformRule.avoid || ''}
                    onChange={(e) =>
                      updatePlatformRule(platform.key, 'avoid', e.target.value)
                    }
                    placeholder="e.g., Long setups, corporate tone"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
