import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, Sparkles } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { useGenerateNewsletter, type NewsletterArticle } from "@/hooks/useGenerateNewsletter";
import { useNewsletterCategories } from "@/hooks/useNewsletterCategories";
import { NewsletterArticleCard } from "@/components/newsletter/NewsletterArticleCard";
import { formatNewsletterAsHTML } from "@/lib/newsletter-html-formatter";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const NewsletterGenerator = () => {
  const { categories, loading: categoriesLoading } = useNewsletterCategories();
  const { generateNewsletter, loading, articles, setArticles } = useGenerateNewsletter();
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (selectedCategories.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one category",
        variant: "destructive",
      });
      return;
    }

    await generateNewsletter(selectedCategories);
  };

  const handleUpdateArticle = (index: number, article: NewsletterArticle) => {
    const updatedArticles = [...articles];
    updatedArticles[index] = article;
    setArticles(updatedArticles);
  };

  const handleRemoveArticle = (index: number) => {
    const updatedArticles = articles.filter((_, i) => i !== index);
    setArticles(updatedArticles);
    toast({
      title: "Article Removed",
      description: "Article has been removed from the newsletter",
    });
  };

  const handleCopyHTML = async () => {
    if (articles.length === 0) {
      toast({
        title: "No Content",
        description: "Please generate a newsletter first",
        variant: "destructive",
      });
      return;
    }

    try {
      const html = formatNewsletterAsHTML(articles);
      await navigator.clipboard.writeText(html);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Newsletter HTML has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Newsletter Generator</h1>
        <p className="text-muted-foreground">
          Generate AI-powered newsletter content from RSS feeds
        </p>
      </div>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Newsletter</CardTitle>
          <CardDescription>
            Select a category to fetch and summarize articles from configured RSS feeds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categories">Categories</Label>
            <MultiSelect
              options={categories.map(cat => ({ label: cat, value: cat }))}
              selected={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Select categories"
              loading={categoriesLoading || loading}
            />
            {categories.length === 0 && !categoriesLoading && (
              <p className="text-sm text-muted-foreground">
                No active RSS sources found. Please ask an admin to configure RSS sources.
              </p>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={selectedCategories.length === 0 || loading || categoriesLoading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Newsletter
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Articles Preview */}
      {articles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Newsletter Preview</CardTitle>
                <CardDescription>
                  {articles.length} article{articles.length !== 1 ? 's' : ''} ready
                </CardDescription>
              </div>
              <Button onClick={handleCopyHTML} variant="default">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy HTML
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {articles.map((article, index) => (
                  <NewsletterArticleCard
                    key={index}
                    article={article}
                    index={index}
                    onUpdate={handleUpdateArticle}
                    onRemove={handleRemoveArticle}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {articles.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Articles Yet</h3>
            <p className="text-muted-foreground">
              Select a category and click "Generate Newsletter" to create your newsletter content.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewsletterGenerator;

