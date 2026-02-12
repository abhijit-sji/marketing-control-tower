# People Page Feature Documentation

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Overview

The People page displays a directory of marketing team members, showing their profiles, brand assignments, and contact information. It's a read-only view designed for team discovery and collaboration.

**Location:** `/dashboard/people` or `/people`  
**Access Level:** All authenticated users (with brand-based filtering)  
**Primary File:** `src/pages/PeopleReviewDashboard.tsx`

---

## Database Structure

### Tables Used

This feature uses the same database tables as User Management but with a different access pattern:

1. **users** - User profile information
2. **user_roles** - User role assignments
3. **user_brands** - Brand assignments

See [User Management Documentation](./user-management-feature.md#database-structure) for complete table schemas.

### Key Difference

The People page filters users where `is_marketing = true` and applies brand-based access control for non-admin users.

---

## Access Control Logic

### 1. Super Admin & Manager

Full access to all marketing team members:

```typescript
if (currentUser?.role === 'super_admin' || currentUser?.role === 'manager') {
  return allMarketingUsers;
}
```

### 2. Regular Users

Only see marketing members who share at least one brand assignment:

```typescript
// Fetch current user's assigned brands
const { data } = await supabase
  .from('user_brands')
  .select('brand_id')
  .eq('user_id', currentUser.id);

// Filter marketing users
return allMarketingUsers.filter((user) => {
  const userBrandIds = user.user_brands?.map(ub => ub.brand_id) || [];
  return userBrandIds.some(brandId => currentUserBrands.includes(brandId));
});
```

**Purpose:** Users only see colleagues they might collaborate with on shared brands.

---

## React Component

**File:** `src/pages/People.tsx`

### State Management

```typescript
const { users, fetchUsers, loading } = useAdminUsers();
const { user: currentUser } = useAuth();
const [searchTerm, setSearchTerm] = useState("");
const [currentUserBrands, setCurrentUserBrands] = useState<string[]>([]);
```

### Data Flow

1. **Fetch Users** - Load marketing team members
2. **Fetch Current User Brands** - Get user's brand assignments
3. **Filter by Access** - Apply role-based filtering
4. **Filter by Search** - Apply search term
5. **Render Cards** - Display filtered members

### Computed Values

```typescript
// Marketing members with access control
const marketingMembers = useMemo(() => {
  const allMarketingUsers = users.filter(user => user.is_marketing);
  
  if (currentUser?.role === 'super_admin' || currentUser?.role === 'manager') {
    return allMarketingUsers;
  }
  
  return allMarketingUsers.filter(user => {
    const userBrandIds = user.user_brands?.map(ub => ub.brand_id) || [];
    return userBrandIds.some(brandId => currentUserBrands.includes(brandId));
  });
}, [users, currentUser, currentUserBrands]);

// Filtered by search term
const filteredMembers = useMemo(() => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return marketingMembers;

  return marketingMembers.filter(member => {
    const fullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const title = (member.title || "").toLowerCase();
    return fullName.includes(term) || title.includes(term);
  });
}, [marketingMembers, searchTerm]);

// Total brands managed across all members
const totalBrandsManaged = useMemo(
  () => marketingMembers.reduce((count, member) => {
    return count + (member.user_brands?.length || 0);
  }, 0),
  [marketingMembers]
);
```

---

## UI Components

### Summary Cards

Three metric cards at the top:

1. **Marketing Team Members**
   - Count: `marketingMembers.length`
   - Label: "Active profiles"

2. **Assigned Brands**
   - Count: `totalBrandsManaged`
   - Label: "Across marketing users"

3. **Search**
   - Input field for filtering members

### Member Cards

Each member is displayed in a card with:

**Header Section:**
- Avatar with initials
- Full name (or email if name missing)
- Job title
- Email address

**Content Section:**
- "Marketing Team" badge
- Department badge (if available)
- List of assigned brands

**Example Card:**
```tsx
<Card>
  <CardHeader>
    <Avatar>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
    <CardTitle>{name}</CardTitle>
    <p className="text-sm">{title}</p>
    <p className="text-xs">{email}</p>
  </CardHeader>
  <CardContent>
    <Badge>Marketing Team</Badge>
    <Badge>{department}</Badge>
    <div>
      <p>Brands</p>
      {brandNames.map(brand => (
        <Badge>{brand}</Badge>
      ))}
    </div>
  </CardContent>
</Card>
```

### Responsive Grid

```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {filteredMembers.map(member => (
    <MemberCard key={member.id} {...member} />
  ))}
</div>
```

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

---

## Business Logic

### 1. User Data Fetching

```typescript
useEffect(() => {
  fetchUsers({ limit: 200, isMarketing: true }).catch(() => {
    // errors surfaced by hook toast handler
  });
}, [fetchUsers]);
```

**Parameters:**
- `limit: 200` - Fetch up to 200 users (covers most orgs)
- `isMarketing: true` - Only fetch marketing team members

### 2. Current User Brands

```typescript
useEffect(() => {
  if (currentUser?.id) {
    fetchCurrentUserBrands();
  }
}, [currentUser]);

const fetchCurrentUserBrands = async () => {
  if (!currentUser?.id) return;
  
  const { data } = await supabase
    .from('user_brands')
    .select('brand_id')
    .eq('user_id', currentUser.id);
  
  if (data) {
    setCurrentUserBrands(data.map(ub => ub.brand_id));
  }
};
```

### 3. Search Filtering

Search matches against:
- First name
- Last name
- Full name (first + last)
- Job title

All comparisons are case-insensitive.

---

## Edge Cases

### No Marketing Members

```tsx
{filteredMembers.length === 0 && (
  <Card>
    <CardContent className="py-12 text-center">
      <h3>No marketing members found</h3>
      <p>Try adjusting your search or add marketing members from the admin panel.</p>
    </CardContent>
  </Card>
)}
```

### No Brand Assignments

```tsx
{brandNames.length === 0 ? (
  <p>No brand assignments yet</p>
) : (
  brandNames.map(brand => <Badge>{brand}</Badge>)
)}
```

### Missing User Data

- **No Name:** Falls back to email address
- **No Initials:** Shows "MM" placeholder
- **No Title:** Hides title section
- **No Department:** Hides department badge

---

## Data Privacy & Security

### 1. RLS Enforcement

All queries go through Supabase client which enforces RLS policies:

```typescript
const { data } = await supabase
  .from('user_brands')
  .select('brand_id')
  .eq('user_id', currentUser.id);
```

RLS ensures users can only see their own brand assignments.

### 2. Client-Side Filtering

Additional filtering happens in React to ensure users only see:
- Marketing team members
- Members with shared brand assignments (for regular users)

### 3. Protected Route

The page is wrapped in a `<ProtectedRoute>` component that:
- Redirects unauthenticated users to login
- Verifies user session with Supabase

---

## Performance Optimizations

### 1. Memoization

All computed values use `useMemo()`:
- `marketingMembers` - Only recomputes when users/role changes
- `filteredMembers` - Only recomputes when search/members change
- `totalBrandsManaged` - Only recomputes when members change

### 2. Efficient Queries

- Fetch marketing users only (`isMarketing: true`)
- Include related data in single query (user_brands join)
- Limit results to reasonable maximum (200)

### 3. Conditional Rendering

- Show loading state while fetching
- Lazy render member cards
- CSS Grid for efficient layout

---

## Testing Checklist

### Access Control
- ✅ Super admin sees all marketing members
- ✅ Manager sees all marketing members
- ✅ Regular user sees only shared-brand members
- ✅ Unauthenticated users redirected

### Search
- ✅ Search by first name
- ✅ Search by last name
- ✅ Search by full name
- ✅ Search by title
- ✅ Case-insensitive matching
- ✅ Empty search shows all

### Display
- ✅ Member cards show correct info
- ✅ Avatar shows initials
- ✅ Brand badges display correctly
- ✅ No brands shows placeholder
- ✅ Missing data handled gracefully

### Responsive
- ✅ Mobile: 1 column
- ✅ Tablet: 2 columns
- ✅ Desktop: 3 columns
- ✅ Cards maintain consistent height

---

## Common Issues & Solutions

### Issue: User sees no marketing members
**Causes:**
1. User has no brand assignments
2. No marketing members share their brands
3. Marketing flag not set on other users

**Solution:**
- Ensure user has brand assignments
- Verify other users have `is_marketing = true`
- Check admin panel for proper configuration

### Issue: Brands not showing
**Cause:** Missing join in user query  
**Solution:** Ensure `user_brands(...)` included in select

### Issue: Search not working
**Cause:** Search term trimming or case mismatch  
**Solution:** Apply `.trim().toLowerCase()` to both search term and fields

### Issue: Stale data
**Cause:** Not refetching after updates  
**Solution:** Call `fetchUsers()` after operations or use React Query

---

## Integration Points

### 1. User Management

The People page reads data created/modified in User Management:
- User profiles
- Marketing team flag
- Brand assignments

### 2. Brand Management

When brands are assigned to users in Brand Management:
- New brand appears in People page
- Member cards update automatically

### 3. Authentication

Uses `useAuth()` hook to:
- Get current user info
- Check user role
- Enforce access control

---

## Future Enhancements

1. **Contact Actions**
   - Email button (mailto: link)
   - Slack integration
   - Calendar booking

2. **Advanced Filtering**
   - Filter by department
   - Filter by brand
   - Filter by role

3. **Sorting**
   - Sort by name
   - Sort by brand count
   - Sort by department

4. **Team Analytics**
   - Most active members
   - Brand coverage metrics
   - Department distribution

5. **Profile Details**
   - Click card to view full profile
   - Recent activity
   - Skills & expertise

6. **Export**
   - Export to CSV
   - Generate team directory PDF
   - Print-friendly view

---

## Code Example: Complete Component

```typescript
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function People() {
  const { users, fetchUsers, loading } = useAdminUsers();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserBrands, setCurrentUserBrands] = useState<string[]>([]);

  // Fetch marketing users
  useEffect(() => {
    fetchUsers({ limit: 200, isMarketing: true });
  }, [fetchUsers]);

  // Fetch current user's brands
  useEffect(() => {
    if (currentUser?.id) {
      fetchCurrentUserBrands();
    }
  }, [currentUser]);

  const fetchCurrentUserBrands = async () => {
    const { data } = await supabase
      .from('user_brands')
      .select('brand_id')
      .eq('user_id', currentUser.id);
    
    if (data) {
      setCurrentUserBrands(data.map(ub => ub.brand_id));
    }
  };

  // Filter marketing members with access control
  const marketingMembers = useMemo(() => {
    const allMarketingUsers = users.filter(u => u.is_marketing);
    
    if (currentUser?.role === 'super_admin' || currentUser?.role === 'manager') {
      return allMarketingUsers;
    }
    
    return allMarketingUsers.filter(user => {
      const userBrandIds = user.user_brands?.map(ub => ub.brand_id) || [];
      return userBrandIds.some(brandId => currentUserBrands.includes(brandId));
    });
  }, [users, currentUser, currentUserBrands]);

  // Apply search filter
  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return marketingMembers;

    return marketingMembers.filter(member => {
      const fullName = [member.first_name, member.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const title = (member.title || "").toLowerCase();
      return fullName.includes(term) || title.includes(term);
    });
  }, [marketingMembers, searchTerm]);

  return (
    <div className="space-y-8">
      <div>
        <h1>People</h1>
        <p>Marketing team directory</p>
      </div>

      {/* Summary cards with search */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Marketing team members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMembers.length}</div>
          </CardContent>
        </Card>
        {/* ... more cards */}
      </div>

      {/* Member cards grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredMembers.map(member => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}
```

---

## Related Documentation

- [User Management Documentation](./user-management-feature.md)
- [Brand Management](./brand-management.md)
- [Authentication & Authorization](./auth-system.md)
- [Access Control Patterns](./access-control.md)
