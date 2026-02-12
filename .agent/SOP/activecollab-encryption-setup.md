# ActiveCollab Encryption Setup

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

## Overview

This document explains how ActiveCollab credentials are encrypted and stored securely in the SJ Marketing AI Platform.

## How It Works

1. **Saving Credentials (Frontend)**:
   - User enters email, password, and API URL in `/adminpanel/data-sync/activecollab`
   - Frontend uses `encryptValue()` from `src/lib/encryption.ts` to encrypt the password
   - Encrypted password is stored in `activecollab_credentials` table
   - Email is base64 encoded (not encrypted)

2. **Using Credentials (Edge Functions)**:
   - Edge functions call `createActiveCollabClientFromDb()` from `supabase/functions/_shared/activecollab-client.ts`
   - Function fetches credentials from database
   - Uses `decryptValue()` from `supabase/functions/_shared/encryption.ts` to decrypt the password
   - Creates authenticated API client

## Setup Instructions

### Set Supabase Secret (Required)

The encryption key must be set as a Supabase secret for the edge functions to decrypt stored passwords.

**Option 1: Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to: Project Settings > Edge Functions > Secrets
3. Add a new secret:
   - Name: `ENCRYPTION_KEY`
   - Value: Your 256-bit base64-encoded key

**Option 2: Supabase CLI**
```bash
supabase secrets set ENCRYPTION_KEY=your-base64-encoded-key
```

## Security Notes

- The encryption key is a 256-bit key encoded in base64
- Both frontend and backend must use the SAME key
- The key should be kept secret and not committed to version control
- In production, rotate this key periodically and re-encrypt all stored passwords

## Related Files

- `src/lib/encryption.ts` - Frontend encryption utilities
- `supabase/functions/_shared/encryption.ts` - Backend encryption utilities
- `supabase/functions/_shared/activecollab-client.ts` - ActiveCollab API client

## Testing

After setting up the encryption key:

1. Restart your development server to pick up new environment variables
2. Go to `/adminpanel/data-sync/activecollab`
3. Enter your ActiveCollab credentials
4. Click "Save Credentials"
5. Verify you see "ActiveCollab credentials saved successfully"

## Troubleshooting

- **"Failed to encrypt value" error**: Ensure encryption key is set and restart dev server
- **Edge functions can't decrypt**: Ensure `ENCRYPTION_KEY` secret is set in Supabase dashboard
- **Keys don't match**: Both frontend and backend must use the exact same encryption key
