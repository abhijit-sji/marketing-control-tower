import React from 'react';

/**
 * Component to render text with clickable URLs
 * Detects URLs in text and converts them to clickable links
 * Also applies proper word-breaking for long strings
 */
interface UrlRendererProps {
  text: string;
  className?: string;
}

// Regex pattern to detect URLs (including variations with special characters)
const URL_PATTERN = /(https?:\/\/[^\s<>"\)]+)/gi;

export function UrlRenderer({ text, className = '' }: UrlRendererProps) {
  if (!text) {
    return null;
  }

  // Split text by URLs and create array of text nodes and link components
  const parts = text.split(URL_PATTERN);

  return (
    <div
      className={`whitespace-pre-wrap leading-relaxed ${className}`}
      style={{
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        hyphens: 'auto'
      }}
    >
      {parts.map((part, index) => {
        // Check if this part is a URL
        if (URL_PATTERN.test(part)) {
          // Reset the regex lastIndex since test() modifies it
          URL_PATTERN.lastIndex = 0;
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all"
              title={`Open: ${part}`}
            >
              {part}
            </a>
          );
        }
        // Return regular text node
        return part ? <span key={index}>{part}</span> : null;
      })}
    </div>
  );
}
