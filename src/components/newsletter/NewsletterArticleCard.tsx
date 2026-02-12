import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, ExternalLink, Edit2, Check } from "lucide-react";
import type { NewsletterArticle } from "@/hooks/useGenerateNewsletter";

interface NewsletterArticleCardProps {
  article: NewsletterArticle;
  index: number;
  onUpdate: (index: number, article: NewsletterArticle) => void;
  onRemove: (index: number) => void;
}

export function NewsletterArticleCard({
  article,
  index,
  onUpdate,
  onRemove,
}: NewsletterArticleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(article.title);
  const [editedSummary, setEditedSummary] = useState(article.summary);

  const handleSave = () => {
    onUpdate(index, {
      ...article,
      title: editedTitle,
      summary: editedSummary,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(article.title);
    setEditedSummary(article.summary);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`title-${index}`}>Title</Label>
              <Input
                id={`title-${index}`}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`summary-${index}`}>Summary</Label>
              <Textarea
                id={`summary-${index}`}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg pr-4">{article.title}</h3>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground">{article.summary}</p>
            <div>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm flex items-center gap-1 inline-flex"
              >
                Read full article
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

