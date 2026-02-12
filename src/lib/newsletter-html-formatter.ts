import type { NewsletterArticle } from "@/hooks/useGenerateNewsletter";

export function formatNewsletterAsHTML(articles: NewsletterArticle[]): string {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .newsletter-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .newsletter-header {
      border-bottom: 2px solid #e5e5e5;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .newsletter-title {
      font-size: 28px;
      font-weight: bold;
      color: #1a1a1a;
      margin: 0;
    }
    .newsletter-date {
      color: #666;
      font-size: 14px;
      margin-top: 8px;
    }
    .article {
      margin-bottom: 30px;
      padding-bottom: 30px;
      border-bottom: 1px solid #e5e5e5;
    }
    .article:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .article-title {
      font-size: 20px;
      font-weight: bold;
      color: #1a1a1a;
      margin: 0 0 12px 0;
      line-height: 1.3;
    }
    .article-title a {
      color: #1a1a1a;
      text-decoration: none;
    }
    .article-title a:hover {
      color: #0066cc;
      text-decoration: underline;
    }
    .article-summary {
      font-size: 16px;
      color: #555;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .article-link {
      display: inline-block;
      color: #0066cc;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .article-link:hover {
      text-decoration: underline;
    }
    .article-link::after {
      content: " →";
    }
  </style>
</head>
<body>
  <div class="newsletter-container">
    <div class="newsletter-header">
      <h1 class="newsletter-title">Newsletter</h1>
      <div class="newsletter-date">${new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</div>
    </div>
    
    ${articles.map((article, index) => `
      <div class="article">
        <h2 class="article-title">
          <a href="${escapeHtml(article.link)}" target="_blank">${escapeHtml(article.title)}</a>
        </h2>
        <p class="article-summary">${escapeHtml(article.summary)}</p>
        <a href="${escapeHtml(article.link)}" target="_blank" class="article-link">Read full article</a>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `.trim();

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

