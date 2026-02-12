import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Plus, Trash2, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HardRulesEditorProps {
  hardRules: Record<string, any>;
  scoringCriteria: Record<string, any>;
  modelConfig: {
    model_provider: string;
    model_version: string;
    fallback_provider: string;
    scoring_model: string;
    min_quality_score: number;
    max_regeneration_attempts: number;
    hooks_per_generation: number;
  };
  onSave: (updated: {
    hard_rules: Record<string, any>;
    scoring_criteria: Record<string, any>;
    model_provider: string;
    model_version: string;
    fallback_provider: string;
    scoring_model: string;
    min_quality_score: number;
    max_regeneration_attempts: number;
    hooks_per_generation: number;
  }) => void;
  isSaving: boolean;
}

export default function HardRulesEditor({
  hardRules,
  scoringCriteria,
  modelConfig,
  onSave,
  isSaving,
}: HardRulesEditorProps) {
  const [rules, setRules] = useState(hardRules);
  const [criteria, setCriteria] = useState(scoringCriteria);
  const [config, setConfig] = useState(modelConfig);
  const [newBannedPhrase, setNewBannedPhrase] = useState('');
  const [newFirstWord, setNewFirstWord] = useState('');

  const updateRule = (field: string, value: any) => {
    setRules((prev) => ({ ...prev, [field]: value }));
  };

  const addBannedPhrase = () => {
    if (!newBannedPhrase.trim()) return;
    updateRule('banned_phrases', [...(rules.banned_phrases || []), newBannedPhrase.trim()]);
    setNewBannedPhrase('');
  };

  const removeBannedPhrase = (index: number) => {
    updateRule(
      'banned_phrases',
      (rules.banned_phrases || []).filter((_: string, i: number) => i !== index)
    );
  };

  const addFirstWord = () => {
    if (!newFirstWord.trim()) return;
    updateRule('first_word_strength', [...(rules.first_word_strength || []), newFirstWord.trim()]);
    setNewFirstWord('');
  };

  const removeFirstWord = (index: number) => {
    updateRule(
      'first_word_strength',
      (rules.first_word_strength || []).filter((_: string, i: number) => i !== index)
    );
  };

  const updateCriteria = (key: string, field: 'weight' | 'description', value: any) => {
    setCriteria((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave({
      hard_rules: rules,
      scoring_criteria: criteria,
      ...config,
    });
  };

  const hasChanges =
    JSON.stringify(rules) !== JSON.stringify(hardRules) ||
    JSON.stringify(criteria) !== JSON.stringify(scoringCriteria) ||
    JSON.stringify(config) !== JSON.stringify(modelConfig);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Hard Rules & Model Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            Define constraints, scoring criteria, and AI model settings
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

      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Model Configuration</CardTitle>
          <CardDescription>
            Select models and quality thresholds for hook generation and scoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Generation Model Provider</Label>
              <Select
                value={config.model_provider}
                onValueChange={(v) => setConfig((p) => ({ ...p, model_provider: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Generation Model Version</Label>
              <Input
                value={config.model_version}
                onChange={(e) => setConfig((p) => ({ ...p, model_version: e.target.value }))}
                placeholder="e.g., gpt-4o"
              />
            </div>

            <div className="space-y-2">
              <Label>Fallback Provider</Label>
              <Input
                value={config.fallback_provider}
                onChange={(e) => setConfig((p) => ({ ...p, fallback_provider: e.target.value }))}
                placeholder="e.g., gemini:2.0-pro"
              />
            </div>

            <div className="space-y-2">
              <Label>Scoring Model</Label>
              <Input
                value={config.scoring_model}
                onChange={(e) => setConfig((p) => ({ ...p, scoring_model: e.target.value }))}
                placeholder="e.g., gpt-4o-mini"
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Quality Score (1-10)</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={config.min_quality_score}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, min_quality_score: parseFloat(e.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max Regeneration Attempts (1-3)</Label>
              <Input
                type="number"
                min="1"
                max="3"
                value={config.max_regeneration_attempts}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, max_regeneration_attempts: parseInt(e.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Hooks Per Generation (3-10)</Label>
              <Input
                type="number"
                min="3"
                max="10"
                value={config.hooks_per_generation}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, hooks_per_generation: parseInt(e.target.value) }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hard Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hard Rules & Constraints</CardTitle>
          <CardDescription>
            Enforce strict quality standards for generated hooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Word Count */}
          <div className="space-y-2">
            <Label htmlFor="word-count">Maximum Word Count</Label>
            <Input
              id="word-count"
              type="number"
              min="8"
              max="15"
              value={rules.word_count_max || 12}
              onChange={(e) => updateRule('word_count_max', parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 12 words for optimal scroll-stop power
            </p>
          </div>

          {/* Banned Phrases */}
          <div className="space-y-3">
            <Label>Banned Phrases</Label>
            <div className="flex gap-2">
              <Input
                value={newBannedPhrase}
                onChange={(e) => setNewBannedPhrase(e.target.value)}
                placeholder="Add phrase to ban..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBannedPhrase();
                  }
                }}
              />
              <Button onClick={addBannedPhrase} disabled={!newBannedPhrase.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(rules.banned_phrases || []).map((phrase: string, index: number) => (
                <Badge key={index} variant="destructive" className="gap-1">
                  {phrase}
                  <button
                    onClick={() => removeBannedPhrase(index)}
                    className="ml-1 hover:text-white"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* First Word Strength */}
          <div className="space-y-3">
            <Label>Strong First Words</Label>
            <div className="flex gap-2">
              <Input
                value={newFirstWord}
                onChange={(e) => setNewFirstWord(e.target.value)}
                placeholder="Add strong first word..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFirstWord();
                  }
                }}
              />
              <Button onClick={addFirstWord} disabled={!newFirstWord.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(rules.first_word_strength || []).map((word: string, index: number) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {word}
                  <button
                    onClick={() => removeFirstWord(index)}
                    className="ml-1 hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Boolean Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Spoken Style</Label>
              <Badge variant={rules.spoken_style ? 'default' : 'outline'}>
                {rules.spoken_style ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>No Emojis</Label>
              <Badge variant={rules.no_emojis ? 'default' : 'outline'}>
                {rules.no_emojis ? 'Enforced' : 'Allowed'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>Avoid Clickbait Lies</Label>
              <Badge variant={rules.avoid_clickbait_lies ? 'default' : 'outline'}>
                {rules.avoid_clickbait_lies ? 'Enforced' : 'Allowed'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scoring Criteria & Weights</CardTitle>
          <CardDescription>
            Define how hooks are evaluated (weights must sum to 1.0)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {['scroll_stop', 'clarity', 'emotional_pull', 'specificity'].map((key) => {
            const criterion = criteria[key] || {};
            return (
              <div key={key} className="space-y-2">
                <Label className="capitalize">{key.replace('_', ' ')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Weight (0.0 - 1.0)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={criterion.weight || 0}
                      onChange={(e) =>
                        updateCriteria(key, 'weight', parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      value={criterion.description || ''}
                      onChange={(e) => updateCriteria(key, 'description', e.target.value)}
                      placeholder="e.g., Stops thumb mid-scroll"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <Alert>
            <AlertDescription>
              Current weights total:{' '}
              {Object.values(criteria)
                .reduce((sum: number, c: any) => sum + (c.weight || 0), 0)
                .toFixed(2)}
              {' '}(should be 1.0)
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
