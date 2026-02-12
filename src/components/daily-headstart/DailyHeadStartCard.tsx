import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDailyHeadStart } from "@/hooks/useDailyHeadStart";
import { Rocket, CheckCircle2, Loader2, Plus, X, Smile, Meh, Frown, Zap } from "lucide-react";

const MOOD_OPTIONS = [
  { value: 'great', icon: Smile, label: 'Great', color: 'text-green-500' },
  { value: 'good', icon: Zap, label: 'Good', color: 'text-blue-500' },
  { value: 'okay', icon: Meh, label: 'Okay', color: 'text-yellow-500' },
  { value: 'struggling', icon: Frown, label: 'Struggling', color: 'text-red-500' },
];

export function DailyHeadStartCard() {
  const { todayHeadStart, hasSubmittedToday, isLoading, submitHeadStart, isSubmitting } = useDailyHeadStart();
  
  const [goals, setGoals] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState("");
  const [blockers, setBlockers] = useState("");
  const [mood, setMood] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (todayHeadStart) {
      setGoals(todayHeadStart.goals || "");
      setPriorities(todayHeadStart.priorities || []);
      setBlockers(todayHeadStart.blockers || "");
      setMood(todayHeadStart.mood || "");
    }
  }, [todayHeadStart]);

  const handleAddPriority = () => {
    if (newPriority.trim() && priorities.length < 5) {
      setPriorities([...priorities, newPriority.trim()]);
      setNewPriority("");
    }
  };

  const handleRemovePriority = (index: number) => {
    setPriorities(priorities.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    submitHeadStart({
      goals,
      priorities,
      blockers,
      mood,
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (hasSubmittedToday && !isEditing) {
    const selectedMood = MOOD_OPTIONS.find(m => m.value === mood);
    
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Today's Head Start</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals && (
            <div>
              <Label className="text-xs text-muted-foreground">Goals</Label>
              <p className="text-sm mt-1">{goals}</p>
            </div>
          )}
          {priorities.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Priorities</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {priorities.map((p, i) => (
                  <Badge key={i} variant="secondary">{p}</Badge>
                ))}
              </div>
            </div>
          )}
          {blockers && (
            <div>
              <Label className="text-xs text-muted-foreground">Blockers</Label>
              <p className="text-sm mt-1 text-orange-600 dark:text-orange-400">{blockers}</p>
            </div>
          )}
          {selectedMood && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Mood:</Label>
              <selectedMood.icon className={`h-4 w-4 ${selectedMood.color}`} />
              <span className="text-sm">{selectedMood.label}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Daily Head Start</CardTitle>
        </div>
        <CardDescription>
          Share your goals and priorities for today
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="goals">What do you want to accomplish today?</Label>
          <Textarea
            id="goals"
            placeholder="Describe your main goals for today..."
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Top Priorities (up to 5)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a priority..."
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPriority())}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={handleAddPriority}
              disabled={!newPriority.trim() || priorities.length >= 5}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {priorities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {priorities.map((p, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {p}
                  <button onClick={() => handleRemovePriority(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="blockers">Any blockers or concerns?</Label>
          <Textarea
            id="blockers"
            placeholder="Mention anything that might slow you down..."
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>How are you feeling?</Label>
          <div className="flex gap-2">
            {MOOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={mood === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setMood(option.value)}
                className="gap-1"
              >
                <option.icon className={`h-4 w-4 ${mood === option.value ? '' : option.color}`} />
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || (!goals && priorities.length === 0)}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Start My Day
              </>
            )}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
