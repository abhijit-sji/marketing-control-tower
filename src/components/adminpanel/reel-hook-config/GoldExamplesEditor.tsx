import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GoldExamplesEditorProps {
  goldExamples: Record<string, string[]>;
  onSave: (updated: Record<string, string[]>) => void;
  isSaving: boolean;
}

const HOOK_CATEGORIES = [
  { key: 'curiosity', label: 'Curiosity', color: 'bg-purple-100 text-purple-800' },
  { key: 'pain', label: 'Pain', color: 'bg-red-100 text-red-800' },
  { key: 'contrarian', label: 'Contrarian', color: 'bg-orange-100 text-orange-800' },
  { key: 'mistake', label: 'Mistake', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'identity', label: 'Identity', color: 'bg-blue-100 text-blue-800' },
  { key: 'shock', label: 'Shock', color: 'bg-pink-100 text-pink-800' },
  { key: 'fomo', label: 'FOMO', color: 'bg-green-100 text-green-800' },
];

export default function GoldExamplesEditor({
  goldExamples,
  onSave,
  isSaving,
}: GoldExamplesEditorProps) {
  const [examples, setExamples] = useState<Record<string, string[]>>(goldExamples);
  const [newExample, setNewExample] = useState<Record<string, string>>({});

  const addExample = (category: string) => {
    const text = newExample[category]?.trim();
    if (!text) return;

    setExamples((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), text],
    }));

    setNewExample((prev) => ({ ...prev, [category]: '' }));
  };

  const removeExample = (category: string, index: number) => {
    setExamples((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    onSave(examples);
  };

  const hasChanges = JSON.stringify(examples) !== JSON.stringify(goldExamples);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gold Example Library</h3>
          <p className="text-sm text-muted-foreground">
            High-performing hook examples organized by category. The AI uses these as inspiration.
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
          Add 3-5 proven hooks per category. These serve as style guides for the AI. Use hooks that
          have performed well on the target platform.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6">
        {HOOK_CATEGORIES.map((category) => (
          <Card key={category.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={category.color}>{category.label}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {(examples[category.key] || []).length} examples
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Examples */}
              {(examples[category.key] || []).length > 0 && (
                <div className="space-y-2">
                  {(examples[category.key] || []).map((example, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-muted">
                      <span className="text-sm flex-1 font-medium">{example}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExample(category.key, index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Example */}
              <div className="flex gap-2">
                <Input
                  placeholder={`Add new ${category.label.toLowerCase()} hook example...`}
                  value={newExample[category.key] || ''}
                  onChange={(e) =>
                    setNewExample((prev) => ({ ...prev, [category.key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExample(category.key);
                    }
                  }}
                />
                <Button
                  onClick={() => addExample(category.key)}
                  disabled={!newExample[category.key]?.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
