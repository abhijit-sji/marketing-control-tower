import { useParams, Link } from 'react-router-dom'
import { useSEOBlogDetails } from '@/hooks/useSEOBlogGenerator'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  ArrowLeft,
  FileText,
  BarChart3,
  Clock,
  DollarSign,
} from 'lucide-react'
import Unauthorized from '@/pages/Unauthorized'

export default function SEOBlogResult() {
  const { blogId } = useParams<{ blogId: string }>()
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: blog, isLoading } = useSEOBlogDetails(blogId!)

  const handleCopy = () => {
    if (!blog) return

    const fullText = `${blog.title}\n\n${(blog.paragraphs as string[]).join('\n\n')}`

    navigator.clipboard.writeText(fullText).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'Blog content copied successfully.',
      })
    }).catch(() => {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard. Please try again.',
        variant: 'destructive',
      })
    })
  }

  const handleDownloadMarkdown = () => {
    if (!blog) return

    const fullText = `# ${blog.title}\n\n${(blog.paragraphs as string[]).join('\n\n')}`
    const blob = new Blob([fullText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${blog.title.slice(0, 50).replace(/[^a-z0-9]/gi, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Downloaded',
      description: 'Blog saved as Markdown file.',
    })
  }

  const handleDownloadHTML = () => {
    if (!blog) return

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${blog.title}</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1 {
            color: #1a1a1a;
            margin-bottom: 2rem;
        }
        p {
            margin-bottom: 1.5rem;
        }
        ul {
            margin-bottom: 1.5rem;
        }
        li {
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <h1>${blog.title}</h1>
    ${(blog.paragraphs as string[]).map(para => {
      // Check if paragraph contains bullets
      if (para.includes('\n-') || para.includes('\n*') || para.includes('\n•')) {
        const lines = para.split('\n')
        const bullets = lines.filter(line => /^[\s]*[\-\*•]/.test(line))
          .map(line => `<li>${line.replace(/^[\s]*[\-\*•]\s*/, '')}</li>`)
          .join('\n')
        return `<ul>\n${bullets}\n</ul>`
      } else {
        return `<p>${para}</p>`
      }
    }).join('\n')}
</body>
</html>`

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${blog.title.slice(0, 50).replace(/[^a-z0-9]/gi, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Downloaded',
      description: 'Blog saved as HTML file.',
    })
  }

  if (!user) {
    return <Unauthorized />
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="container max-w-5xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Blog not found</CardTitle>
            <CardDescription>The requested blog could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/seo-blog-generator">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Generator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const validation = blog.validation_result as any
  const paragraphs = blog.paragraphs as string[]

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button variant="ghost" asChild>
          <Link to="/seo-blog-generator">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Generator
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Text
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
            <Download className="mr-2 h-4 w-4" />
            Download MD
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadHTML}>
            <Download className="mr-2 h-4 w-4" />
            Download HTML
          </Button>
        </div>
      </div>

      {/* Validation Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Validation Status</CardTitle>
              <CardDescription>
                Generated in {blog.generation_time_ms}ms • {blog.generation_attempts} attempt(s)
              </CardDescription>
            </div>
            {blog.is_valid ? (
              <Badge variant="default" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                All Rules Passed
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {validation?.errors?.length || 0} Validation Errors
              </Badge>
            )}
          </div>
        </CardHeader>
        {validation?.errors?.length > 0 && (
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation Errors Found</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {validation.errors.map((error: string, index: number) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Stats Grid */}
      {validation?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Total Words
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{validation.stats.total_word_count}</p>
              <p className="text-xs text-muted-foreground">Target: 600-700</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Paragraphs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{validation.stats.paragraph_count}</p>
              <p className="text-xs text-muted-foreground">Target: 5-8</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Generation Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{(blog.generation_time_ms / 1000).toFixed(1)}s</p>
              <p className="text-xs text-muted-foreground">{blog.generation_attempts} attempts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${blog.cost_usd?.toFixed(4) || '0.00'}</p>
              <p className="text-xs text-muted-foreground">{blog.total_tokens_used || 0} tokens</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generated Blog Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">{blog.title}</CardTitle>
          <CardDescription>
            {validation?.stats?.title_word_count} words in title •{' '}
            Primary keyword: &quot;{blog.primary_keyword}&quot; •{' '}
            Brand: {blog.brand_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {paragraphs.map((para: string, index: number) => {
            // Check if this paragraph has bullets
            const hasBullets = /^[\s]*[\-\*•]/m.test(para)

            return (
              <div key={index} className="text-sm leading-relaxed">
                {hasBullets ? (
                  <ul className="list-disc list-inside space-y-2 pl-4">
                    {para.split('\n').filter(line => /^[\s]*[\-\*•]/.test(line)).map((line, lineIndex) => (
                      <li key={lineIndex}>
                        {line.replace(/^[\s]*[\-\*•]\s*/, '')}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="whitespace-pre-wrap">{para}</p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Keyword Analysis */}
      {validation?.stats && (
        <Card>
          <CardHeader>
            <CardTitle>Keyword Analysis</CardTitle>
            <CardDescription>Keyword placement verification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Keyword: &quot;{blog.primary_keyword}&quot;</p>
                  <p className="text-xs text-muted-foreground">
                    Target: 1x in title + 1x in body = 2 total
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{validation.stats.keyword_counts.primary_total}x</p>
                  <p className="text-xs text-muted-foreground">
                    ({validation.stats.keyword_counts.primary_in_title} title, {validation.stats.keyword_counts.primary_in_body} body)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Brand: &quot;{blog.brand_name}&quot;</p>
                  <p className="text-xs text-muted-foreground">Target: 1x in last paragraph</p>
                </div>
                <p className="text-2xl font-bold">{validation.stats.keyword_counts.brand}x</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
