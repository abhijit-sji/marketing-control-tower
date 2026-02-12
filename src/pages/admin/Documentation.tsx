import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { DocSidebar } from "@/components/documentation/DocSidebar";
import { MarkdownRenderer } from "@/components/documentation/MarkdownRenderer";
import { DocumentationSearch } from "@/components/documentation/DocumentationSearch";
import { documentationIndex, getAllDocItems, getDocByFile } from "@/lib/documentation";
import { useToast } from "@/hooks/use-toast";

export default function Documentation() {
  const [selectedDoc, setSelectedDoc] = useState<string>("features/admin-panel-system.md");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [downloadAllLoading, setDownloadAllLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDocumentation(selectedDoc);
  }, [selectedDoc]);

  const loadDocumentation = async (docFile: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/docs/${docFile}`);
      if (response.ok) {
        const text = await response.text();
        setContent(text);
      } else {
        setContent(`# Documentation\n\nDocument "${docFile}" not found.`);
      }
    } catch (error) {
      console.error('Error loading documentation:', error);
      setContent(`# Error\n\nFailed to load documentation.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const doc = getDocByFile(selectedDoc);
    const filename = doc?.title.replace(/\s+/g, '-').toLowerCase() || 'documentation';
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: `${doc?.title} has been downloaded as text file`,
    });
  };

  const handleDownloadAll = async () => {
    const uniqueDocs = Array.from(new Map(getAllDocItems().map(doc => [doc.file, doc])).values());

    if (uniqueDocs.length === 0) {
      toast({
        title: "No documentation found",
        description: "There are no documents to download.",
        variant: "destructive",
      });
      return;
    }

    setDownloadAllLoading(true);

    try {
      const documentsWithContent = await Promise.all(uniqueDocs.map(async (doc) => {
        try {
          const response = await fetch(`/docs/${doc.file}`);
          if (!response.ok) {
            return { doc, content: `# ${doc.title}\n\nDocument \"${doc.file}\" not found.` };
          }

          const text = await response.text();
          return { doc, content: `# ${doc.title}\n\n${text.trim()}` };
        } catch (error) {
          console.error(`Failed to download ${doc.file}`, error);
          return { doc, content: `# ${doc.title}\n\nFailed to load document due to a network error.` };
        }
      }));

      const bundle = documentsWithContent
        .map(({ doc, content }) => `${content}\n\n_Last updated: ${doc.lastUpdated ?? 'unknown'}\nCategory: ${doc.category}_`)
        .join("\n\n---\n\n");

      const blob = new Blob([bundle], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sj-marketing-ai-documentation.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Documentation downloaded",
        description: `All ${uniqueDocs.length} documents exported to sj-marketing-ai-documentation.txt`,
      });
    } catch (error) {
      console.error('Failed to download all documentation', error);
      toast({
        title: "Download failed",
        description: "We were unable to bundle the documentation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadAllLoading(false);
    }
  };

  const handleSelectDoc = (docFile: string) => {
    setSelectedDoc(docFile);
  };

  const currentDoc = getDocByFile(selectedDoc);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/10 p-4 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Documentation</h2>
          <DocumentationSearch 
            onSelectDoc={handleSelectDoc}
            currentDoc={selectedDoc}
          />
        </div>
        <DocSidebar 
          categories={documentationIndex}
          currentDoc={selectedDoc}
          onSelectDoc={handleSelectDoc}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{currentDoc?.title || 'Documentation'}</h1>
              <p className="text-muted-foreground mt-1">
                {currentDoc?.description || 'Platform guides and references'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownload} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={handleDownloadAll} disabled={downloadAllLoading}>
                <FileText className="mr-2 h-4 w-4" />
                {downloadAllLoading ? 'Preparing…' : 'Download All'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <MarkdownRenderer content={content} />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
