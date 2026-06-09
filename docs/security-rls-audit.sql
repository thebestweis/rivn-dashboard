-- RIVN Control security audit: read-only Supabase RLS checks.
-- Run in Supabase SQL Editor before production releases.

-- 1. User data tables with RLS disabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname not like 'schema_%'
  and c.relname not like 'spatial_ref_sys'
  and c.relrowsecurity = false
order by c.relname;

-- 2. RLS-enabled tables without any policies.
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
  and p.tablename = c.relname
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relrowsecurity = true
group by n.nspname, c.relname
having count(p.policyname) = 0
order by c.relname;

-- 3. Policies that allow anonymous access.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and ('anon' = any(roles) or 'public' = any(roles))
order by tablename, policyname;

-- 4. Public storage buckets. Review each public bucket intentionally.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where public = true
order by name;

-- 5. Critical tables and their RLS/policy counts.
with critical_tables(table_name) as (
  values
    ('profiles'),
    ('workspaces'),
    ('workspace_members'),
    ('clients'),
    ('projects'),
    ('tasks'),
    ('payments'),
    ('expenses'),
    ('payroll_payouts'),
    ('workspace_billing'),
    ('billing_transactions'),
    ('telegram_settings'),
    ('notification_logs'),
    ('crm_deals'),
    ('crm_conversations'),
    ('crm_messages'),
    ('avito_report_clients'),
    ('avito_report_accounts'),
    ('avito_report_snapshots'),
    ('rivn_leads_projects'),
    ('rivn_leads_leads')
)
select
  ct.table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  count(p.policyname) as policy_count
from critical_tables ct
left join pg_class c
  on c.relname = ct.table_name
  and c.relnamespace = 'public'::regnamespace
left join pg_policies p
  on p.schemaname = 'public'
  and p.tablename = ct.table_name
group by ct.table_name, c.relrowsecurity
order by ct.table_name;
