# Knowledge Base Data Cleanup Guide

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active  
> **Audience:** Team Members, Admins, Super Admins

---

## Table of Contents

1. [Overview](#overview)
2. [What Files Are Supported](#what-files-are-supported)
3. [What to Keep vs What to Remove](#what-to-keep-vs-what-to-remove)
4. [Data Quality Standards](#data-quality-standards)
5. [Cleanup Procedures](#cleanup-procedures)
6. [Security & Privacy Guidelines](#security--privacy-guidelines)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [FAQ](#faq)

---

## Overview

The knowledge base system uses AI to convert uploaded files into searchable vectors that help generate better, brand-specific content. Clean, high-quality data is essential for accurate AI responses.

### Why Clean Data Matters

- ✅ **Better AI Responses**: Clean data = more accurate content generation
- ✅ **Faster Processing**: Smaller, focused files process quickly
- ✅ **Lower Costs**: Fewer embeddings = lower OpenAI API costs
- ✅ **Better Security**: Removing sensitive data prevents leaks

### Related Tables

- `knowledge_base_categories` - Category organization
- `knowledge_sources` - Source configuration
- `knowledge_files` - File metadata and status
- `knowledge_embeddings` - Vector embeddings (pgvector)
- `brand_knowledge_files` - Brand-specific knowledge
- `brand_knowledge_embeddings` - Brand vector embeddings

---

## What Files Are Supported

### ✅ SUPPORTED FILE TYPES

| File Type | Extension | Notes |
|-----------|-----------|-------|
| Plain Text | `.txt` | 100% success rate, fastest processing |
| Markdown | `.md` | 100% success rate, supports formatting |

### ❌ NOT SUPPORTED (Will Be Rejected)

- `.pdf` - PDF files (removed as of Dec 2024)
- `.doc` / `.docx` - Microsoft Word documents
- `.xls` / `.xlsx` - Excel spreadsheets
- `.ppt` / `.pptx` - PowerPoint presentations
- Images (`.png`, `.jpg`, etc.)
- Videos
- Any binary files

### File Size Limits

- **Maximum:** 10MB per file
- **Recommended:** 100KB - 2MB for optimal processing
- **Large files:** Automatically chunked into ~6000 character segments

---

## What to Keep vs What to Remove

### ✅ KEEP - High-Value Content

#### 1. **Brand Voice & Guidelines**
- Brand style guides
- Tone of voice documentation
- Writing guidelines
- Approved messaging
- Brand personality descriptions

#### 2. **Product/Service Information**
- Product descriptions
- Service offerings
- Feature lists
- Technical specifications
- Value propositions

#### 3. **Company Information**
- Company history
- Mission/vision statements
- Core values
- Team bios (public-facing)
- Awards and achievements

#### 4. **Marketing Assets**
- Successful blog posts
- Case studies
- White papers
- Customer testimonials
- FAQ documents

#### 5. **Industry/Niche Knowledge**
- Industry trends
- Market research summaries
- Competitor analysis
- Best practices
- Terminology glossaries

---

### ❌ REMOVE - Low-Value or Problematic Content

#### 1. **Sensitive Information** 🚨 PRIORITY
- Client contracts or NDAs
- Employee personal information
- Financial data (salaries, budgets)
- API keys, passwords, credentials
- Internal-only strategy documents
- Legal documents

#### 2. **Outdated Information**
- Old product versions
- Expired promotions
- Deprecated features
- Old brand guidelines

#### 3. **Duplicate Content**
- Multiple versions of the same document
- Copy-pasted content across files

#### 4. **Low-Quality Content**
- Unformatted text dumps
- Broken or garbled text
- Test files
- Lorem ipsum placeholder text

#### 5. **Internal-Only Content**
- Internal meeting notes
- Project management updates
- HR policies and procedures

---

## Data Quality Standards

### File Naming Conventions

#### ✅ GOOD File Names
```
brand-voice-guidelines.txt
product-catalog-2024.md
linkedin-post-templates.txt
customer-testimonials.md
```

#### ❌ BAD File Names
```
Untitled.txt
doc1.txt
New Document (1).txt
temp.txt
```

### Content Quality Checklist

Before uploading, verify:

- [ ] File is in `.txt` or `.md` format
- [ ] File size is under 10MB
- [ ] Content is relevant to brand/content generation
- [ ] No sensitive or private information
- [ ] Text is properly formatted and readable
- [ ] File name is descriptive and clear
- [ ] Content is up-to-date
- [ ] No duplicate content exists

---

## Cleanup Procedures

### For Brand Users

1. Navigate to: **Dashboard > Brands > [Your Brand] > Knowledgebase**
2. Review uploaded files
3. Delete files with "Failed" status, outdated documents, or duplicates
4. Upload clean replacements if needed

### For Super Admins

1. Navigate to: **Admin Panel > Knowledgebase**
2. Use "All Brand Files" tab to see all files across brands
3. Monitor statistics cards (Total, Completed, Processing, Pending, Failed)
4. Investigate failed files and contact brand owners

---

## Security & Privacy Guidelines

### 🚨 CRITICAL - Never Upload These

1. **Personally Identifiable Information (PII)**
   - Social Security Numbers
   - Credit card numbers
   - Personal addresses
   - Phone numbers

2. **Confidential Business Information**
   - Employee salaries
   - Client pricing
   - Financial projections
   - Trade secrets

3. **Credentials & Keys**
   - API keys
   - Passwords
   - Access tokens

4. **Legal Documents**
   - Contracts
   - NDAs
   - Legal correspondence

### Pre-Upload Security Checklist

Before uploading ANY file, ask:

- [ ] Would I be comfortable if this appeared in a blog post?
- [ ] Does this contain any client-specific confidential data?
- [ ] Are there any employee names with personal details?
- [ ] Does this contain any login credentials or keys?
- [ ] Would this violate any NDAs or contracts?

**If you answered YES to any question above → DO NOT UPLOAD**

---

## Monitoring & Maintenance

### Weekly Maintenance (Brand Users)

**Time Required:** 5-10 minutes

1. Review uploaded files list
2. Check for failed files → delete or re-upload
3. Remove outdated content
4. Upload new relevant content

### Monthly Audit (Super Admins)

**Time Required:** 30-60 minutes

1. Review Statistics Dashboard
2. Check Brand Activity
3. Quality Audit Sample (10-20 files)
4. Performance Check

---

## FAQ

### Q1: What happens when I delete a file?

**A:** Three things:
1. Original file deleted from Supabase storage
2. All vector embeddings deleted from database
3. File record removed from knowledge_files table

**This is permanent and cannot be undone.**

### Q2: How long does file processing take?

**A:**
- **Small files** (<100KB): 10-30 seconds
- **Medium files** (100KB-1MB): 30-90 seconds
- **Large files** (1MB-10MB): 2-5 minutes

### Q3: Why did my file fail?

**Common reasons:**
1. "File contains binary data" - Wrong file type
2. "File appears to be empty" - Corrupted or blank file
3. "Invalid text content" - Not a text file
4. "Maximum context length exceeded" - File too large

### Q4: How do I convert a PDF to text?

**Online Tools:**
- https://www.adobe.com/acrobat/online/pdf-to-text.html
- https://www.ilovepdf.com/pdf_to_text

**Manual:** Open PDF, select all text, paste into `.txt` file
