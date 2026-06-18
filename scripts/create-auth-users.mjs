#!/usr/bin/env node
/**
 * Create auth.users with UUIDs matching public.users from db-bundle export.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = process.env.SUPABASE_URL || 'https://tkdksyfudpzxrlnvybqz.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
  { id: '500b4a7f-4c4a-429e-a307-0601568c8525', email: 'demo.admin@sjinnovation.com', password: 'demo-password-123' },
  { id: 'b31fefe1-d78f-4160-85d3-298bccf9e02e', email: 'demo.user@sjinnovation.com', password: 'demo-password-123' },
  { id: 'afa2dd3c-4213-4137-a743-12c7c65b4e7d', email: 'demo.pm@sjinnovation.com', password: 'demo-password-123' },
  { id: 'c5806b04-2637-4c5d-bfba-a0c93188d879', email: 'demo.brand.manager@sjinnovation.com', password: 'demo-password-123' },
  { id: '82deff65-1b87-4d87-8b66-ac29bf54e3fb', email: 'demo.manager@sjinnovation.com', password: 'demo-password-123' },
];

for (const user of DEMO_USERS) {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === user.email || u.id === user.id);

  if (found) {
    console.log(`Exists: ${user.email} (${found.id})`);
    if (found.id !== user.id) {
      console.warn(`  WARNING: UUID mismatch expected ${user.id}`);
    }
    continue;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password: user.password,
    email_confirm: true,
  });

  if (error) {
    console.error(`Failed ${user.email}:`, error.message);
    process.exit(1);
  }
  console.log(`Created: ${user.email} (${data.user.id})`);
}

console.log('Auth users ready.');
