-- Create storage bucket for knowledge files
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;

-- RLS policies for knowledge bucket
create policy "Admins can upload knowledge files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'knowledge' and
  (has_role(auth.uid(), 'super_admin'::app_role) or has_role(auth.uid(), 'manager'::app_role))
);

create policy "Admins can read knowledge files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'knowledge' and
  (has_role(auth.uid(), 'super_admin'::app_role) or has_role(auth.uid(), 'manager'::app_role))
);

create policy "Admins can update knowledge files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'knowledge' and
  (has_role(auth.uid(), 'super_admin'::app_role) or has_role(auth.uid(), 'manager'::app_role))
);

create policy "Admins can delete knowledge files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'knowledge' and
  (has_role(auth.uid(), 'super_admin'::app_role) or has_role(auth.uid(), 'manager'::app_role))
);