import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Plus, Trash2, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PsychologyMappingEditorProps {
  viewerPsychology: Record<string, any>;
  hookStrategyMatrix: any[];
  antiPatterns: string[][];
  alwaysPair: string[][];
  onSave: (updated: {
    viewer_psychology: Record<string, any>;
    hook_strategy_matrix: any[];
    anti_patterns: string[][];
    always_pair: string[][];
  }) => void;
  isSaving: boolean;
}

export default function PsychologyMappingEditor({
  viewerPsychology,
  hookStrategyMatrix,
  antiPatterns,
  alwaysPair,
  onSave,
  isSaving,
}: PsychologyMappingEditorProps) {
  const [psychology, setPsychology] = useState(viewerPsychology);
  const [strategyMatrix, setStrategyMatrix] = useState(hookStrategyMatrix);
  const [antiPatternsState, setAntiPatterns] = useState(antiPatterns);
  const [alwaysPairState, setAlwaysPair] = useState(alwaysPair);

  const updatePsychologyMapping = (category: string, key: string, value: string) => {
    setPsychology((prev: any) => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [key]: value,
      },
    }));
  };

  const addStrategyRule = () => {
    setStrategyMatrix((prev) => [
      ...prev,
      { goal: '', primary: [], secondary: [] },
    ]);
  };

  const updateStrategyRule = (index: number, field: string, value: any) => {
    setStrategyMatrix((prev) =>
      prev.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule
      )
    );
  };

  const removeStrategyRule = (index: number) => {
    setStrategyMatrix((prev) => prev.filter((_, i) => i !== index));
  };

  const addAntiPattern = () => {
    setAntiPatterns((prev) => [...prev, ['', '']]);
  };

  const updateAntiPattern = (index: number, position: 0 | 1, value: string) => {
    setAntiPatterns((prev) =>
      prev.map((pair, i) =>
        i === index
          ? position === 0
            ? [value, pair[1]]
            : [pair[0], value]
          : pair
      )
    );
  };

  const removeAntiPattern = (index: number) => {
    setAntiPatterns((prev) => prev.filter((_, i) => i !== index));
  };

  const addAlwaysPair = () => {
    setAlwaysPair((prev) => [...prev, ['', '']]);
  };

  const updateAlwaysPair = (index: number, position: 0 | 1, value: string) => {
    setAlwaysPair((prev) =>
      prev.map((pair, i) =>
        i === index
          ? position === 0
            ? [value, pair[1]]
            : [pair[0], value]
          : pair
      )
    );
  };

  const removeAlwaysPair = (index: number) => {
    setAlwaysPair((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      viewer_psychology: psychology,
      hook_strategy_matrix: strategyMatrix,
      anti_patterns: antiPatternsState,
      always_pair: alwaysPairState,
    });
  };

  const hasChanges =
    JSON.stringify(psychology) !== JSON.stringify(viewerPsychology) ||
    JSON.stringify(strategyMatrix) !== JSON.stringify(hookStrategyMatrix) ||
    JSON.stringify(antiPatternsState) !== JSON.stringify(antiPatterns) ||
    JSON.stringify(alwaysPairState) !== JSON.stringify(alwaysPair);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Psychology Mapping & Strategy Rules
          </h3>
          <p className="text-sm text-muted-foreground">
            Map viewer psychology to hook strategies and define pairing rules
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

      {/* Viewer Psychology */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Viewer Psychology Mapping</CardTitle>
          <CardDescription>
            Map audience awareness levels, scroll states, and trust levels to hook strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Awareness Level */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Awareness Level</Label>
            {['unaware', 'problem_aware', 'solution_aware', 'product_aware'].map((level) => (
              <div key={level} className="space-y-2">
                <Label htmlFor={`awareness-${level}`} className="text-sm capitalize">
                  {level.replace('_', ' ')}
                </Label>
                <Input
                  id={`awareness-${level}`}
                  value={psychology.awareness_level?.[level] || ''}
                  onChange={(e) =>
                    updatePsychologyMapping('awareness_level', level, e.target.value)
                  }
                  placeholder="e.g., Use pattern interrupt + curiosity"
                />
              </div>
            ))}
          </div>

          {/* Scroll State */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Scroll State</Label>
            {['passive', 'active_searching', 'end_of_session'].map((state) => (
              <div key={state} className="space-y-2">
                <Label htmlFor={`scroll-${state}`} className="text-sm capitalize">
                  {state.replace('_', ' ')}
                </Label>
                <Input
                  id={`scroll-${state}`}
                  value={psychology.scroll_state?.[state] || ''}
                  onChange={(e) =>
                    updatePsychologyMapping('scroll_state', state, e.target.value)
                  }
                  placeholder="e.g., Shock value needed"
                />
              </div>
            ))}
          </div>

          {/* Trust Level */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Trust Level</Label>
            {['cold', 'warm', 'hot'].map((level) => (
              <div key={level} className="space-y-2">
                <Label htmlFor={`trust-${level}`} className="text-sm capitalize">
                  {level}
                </Label>
                <Input
                  id={`trust-${level}`}
                  value={psychology.trust_level?.[level] || ''}
                  onChange={(e) =>
                    updatePsychologyMapping('trust_level', level, e.target.value)
                  }
                  placeholder="e.g., Avoid claims, use questions"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hook Strategy Matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Hook Strategy Matrix</CardTitle>
              <CardDescription>
                Define which hook categories to use based on goal, audience, persona, etc.
              </CardDescription>
            </div>
            <Button onClick={addStrategyRule} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {strategyMatrix.map((rule, index) => (
            <Card key={index} className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Rule {index + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStrategyRule(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Goal</Label>
                    <Input
                      value={rule.goal || ''}
                      onChange={(e) => updateStrategyRule(index, 'goal', e.target.value)}
                      placeholder="e.g., views, saves"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Categories (comma-separated)</Label>
                    <Input
                      value={(rule.primary || []).join(', ')}
                      onChange={(e) =>
                        updateStrategyRule(
                          index,
                          'primary',
                          e.target.value.split(',').map((s) => s.trim()).filter((s) => s)
                        )
                      }
                      placeholder="e.g., curiosity, pain"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Secondary Categories (comma-separated)</Label>
                    <Input
                      value={(rule.secondary || []).join(', ')}
                      onChange={(e) =>
                        updateStrategyRule(
                          index,
                          'secondary',
                          e.target.value.split(',').map((s) => s.trim()).filter((s) => s)
                        )
                      }
                      placeholder="e.g., contrarian"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Anti-Patterns */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Anti-Patterns (Never Pair)</CardTitle>
              <CardDescription>
                Category combinations that should never be used together
              </CardDescription>
            </div>
            <Button onClick={addAntiPattern} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Anti-Pattern
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {antiPatternsState.map((pair, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={pair[0]}
                onChange={(e) => updateAntiPattern(index, 0, e.target.value)}
                placeholder="Category 1"
              />
              <span className="text-muted-foreground">+</span>
              <Input
                value={pair[1]}
                onChange={(e) => updateAntiPattern(index, 1, e.target.value)}
                placeholder="Category 2"
              />
              <Button variant="ghost" size="sm" onClick={() => removeAntiPattern(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Always Pair */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Always Pair</CardTitle>
              <CardDescription>
                Category combinations that should always be used together
              </CardDescription>
            </div>
            <Button onClick={addAlwaysPair} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Pairing
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alwaysPairState.map((pair, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={pair[0]}
                onChange={(e) => updateAlwaysPair(index, 0, e.target.value)}
                placeholder="Primary category"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                value={pair[1]}
                onChange={(e) => updateAlwaysPair(index, 1, e.target.value)}
                placeholder="Pair with"
              />
              <Button variant="ghost" size="sm" onClick={() => removeAlwaysPair(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
