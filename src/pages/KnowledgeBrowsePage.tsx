import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Search, FileText, BookOpen } from "lucide-react";
import { KnowledgeStatusBadge } from "@/components/knowledge/KnowledgeStatusBadge";

type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface KnowledgeFileRow {
  id: string;
  name: string;
  file_type: string | null;
  is_indexed: boolean;
  last_indexed: string | null;
  embedding_count: number | null;
  processing_status: ProcessingStatus | null;
  last_error: string | null;
  brand_id: string | null;
  created_at: string;
  brands?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface BrandKnowledgeFileRow {
  id: string;
  file_name: string;
  file_type: string | null;
  file_indexed_at: string | null;
  embedding_count: number | null;
  brand_id: string;
  created_at: string;
  brands: {
    id: string;
    name: string;
    slug: string;
  };
}

interface GlobalKnowledgeRow {
  id: string;
  title: string;
  content: string;
  knowledge_type: string | null;
  created_at: string;
}

const fileTypeLabel = (value: string | null) => {
  if (!value) return "Unknown";
  const lower = value.toLowerCase();
  if (lower.includes("pdf")) return "PDF";
  if (lower.includes("csv")) return "CSV";
  if (lower.includes("spreadsheet") || lower.includes("excel")) return "Spreadsheet";
  if (lower.includes("presentation") || lower.includes("powerpoint")) return "Presentation";
  if (lower.includes("document") || lower.includes("word")) return "Document";
  if (lower.includes("plain") || lower.includes("text")) return "Text";
  if (lower.includes("markdown") || lower === "md") return "Markdown";
  return value;
};

const formatDate = (value: string | null) => {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

export default function KnowledgeBrowsePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");

  // Fetch all brands
  const { data: brands } = useQuery({
    queryKey: ['brands-for-knowledge'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch knowledge files (from knowledge_files table)
  const { data: knowledgeFiles, isLoading: isLoadingKnowledgeFiles } = useQuery({
    queryKey: ['knowledge-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_files')
        .select(`
          id,
          name,
          file_type,
          is_indexed,
          last_indexed,
          embedding_count,
          processing_status,
          last_error,
          brand_id,
          created_at,
          brands (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KnowledgeFileRow[];
    },
  });

  // Fetch brand knowledge files (from brand_knowledge_files table)
  const { data: brandKnowledgeFiles, isLoading: isLoadingBrandFiles } = useQuery({
    queryKey: ['brand-knowledge-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_knowledge_files')
        .select(`
          id,
          file_name,
          file_type,
          file_indexed_at,
          embedding_count,
          brand_id,
          created_at,
          brands (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BrandKnowledgeFileRow[];
    },
  });

  // Fetch global knowledge base entries
  const { data: globalKnowledge, isLoading: isLoadingGlobal } = useQuery({
    queryKey: ['global-knowledge'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, title, content, knowledge_type, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GlobalKnowledgeRow[];
    },
  });

  // Combine all files into a unified list
  const allFiles = useMemo(() => {
    const files: Array<{
      id: string;
      name: string;
      brandName: string | null;
      brandSlug: string | null;
      fileType: string | null;
      isIndexed: boolean;
      embeddingCount: number | null;
      processingStatus: ProcessingStatus | null;
      lastIndexed: string | null;
      lastError: string | null;
      createdAt: string;
      source: 'knowledge_files' | 'brand_knowledge_files' | 'global';
    }> = [];

    // Add knowledge_files
    if (knowledgeFiles) {
      knowledgeFiles.forEach(file => {
        files.push({
          id: file.id,
          name: file.name,
          brandName: file.brands?.name || null,
          brandSlug: file.brands?.slug || null,
          fileType: file.file_type,
          isIndexed: file.is_indexed,
          embeddingCount: file.embedding_count,
          processingStatus: file.processing_status,
          lastIndexed: file.last_indexed,
          lastError: file.last_error,
          createdAt: file.created_at,
          source: 'knowledge_files',
        });
      });
    }

    // Add brand_knowledge_files
    if (brandKnowledgeFiles) {
      brandKnowledgeFiles.forEach(file => {
        files.push({
          id: file.id,
          name: file.file_name,
          brandName: file.brands.name,
          brandSlug: file.brands.slug,
          fileType: file.file_type,
          isIndexed: !!file.file_indexed_at,
          embeddingCount: file.embedding_count,
          processingStatus: file.file_indexed_at ? 'completed' : 'pending',
          lastIndexed: file.file_indexed_at,
          lastError: null,
          createdAt: file.created_at,
          source: 'brand_knowledge_files',
        });
      });
    }

    // Add global knowledge
    if (globalKnowledge) {
      globalKnowledge.forEach(item => {
        files.push({
          id: item.id,
          name: item.title,
          brandName: null,
          brandSlug: null,
          fileType: 'text/plain',
          isIndexed: true,
          embeddingCount: 1,
          processingStatus: 'completed',
          lastIndexed: item.created_at,
          lastError: null,
          createdAt: item.created_at,
          source: 'global',
        });
      });
    }

    return files;
  }, [knowledgeFiles, brandKnowledgeFiles, globalKnowledge]);

  // Filter files based on search and selected brand
  const filteredFiles = useMemo(() => {
    return allFiles.filter(file => {
      // Filter by brand
      if (selectedBrandId !== "all") {
        const fileBrandId =
          knowledgeFiles?.find(kf => kf.id === file.id && file.source === 'knowledge_files')?.brand_id ||
          brandKnowledgeFiles?.find(bkf => bkf.id === file.id && file.source === 'brand_knowledge_files')?.brand_id;

        if (file.source === 'global' || fileBrandId !== selectedBrandId) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          file.name.toLowerCase().includes(query) ||
          file.brandName?.toLowerCase().includes(query) ||
          file.fileType?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [allFiles, selectedBrandId, searchQuery, knowledgeFiles, brandKnowledgeFiles]);

  const isLoading = isLoadingKnowledgeFiles || isLoadingBrandFiles || isLoadingGlobal;

  // Get unique brands from files
  const brandsWithFiles = useMemo(() => {
    const uniqueBrands = new Map<string, { id: string; name: string; count: number }>();

    allFiles.forEach(file => {
      if (file.brandName) {
        const brandKey = file.brandName;
        const existing = uniqueBrands.get(brandKey);

        if (existing) {
          existing.count++;
        } else {
          const brand = brands?.find(b => b.name === file.brandName);
          if (brand) {
            uniqueBrands.set(brandKey, {
              id: brand.id,
              name: brand.name,
              count: 1,
            });
          }
        }
      }
    });

    return Array.from(uniqueBrands.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allFiles, brands]);

  const globalCount = allFiles.filter(f => f.source === 'global').length;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse all indexed knowledge across brands and global resources
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Database className="h-4 w-4 mr-2" />
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
          <CardDescription>Find knowledge files by brand or search query</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by file name, brand, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Brand</label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands ({allFiles.length})</SelectItem>
                  {globalCount > 0 && (
                    <SelectItem value="global">Global Knowledge ({globalCount})</SelectItem>
                  )}
                  {brandsWithFiles.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name} ({brand.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Files</CardTitle>
          <CardDescription>
            {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading knowledge files...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No files found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search query' : 'No knowledge files available'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Indexed</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map(file => (
                    <TableRow key={`${file.source}-${file.id}`}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>
                        {file.brandName ? (
                          <Badge variant="outline">{file.brandName}</Badge>
                        ) : (
                          <Badge variant="secondary">Global</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {fileTypeLabel(file.fileType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <KnowledgeStatusBadge
                          isIndexed={file.isIndexed}
                          processingStatus={file.processingStatus || 'pending'}
                          embeddingCount={file.embeddingCount || 0}
                          errorMessage={file.lastError || undefined}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(file.lastIndexed)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {file.source === 'knowledge_files' ? 'Knowledge' :
                           file.source === 'brand_knowledge_files' ? 'Brand' : 'Global'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
