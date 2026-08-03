\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

SELECT format(
  'SELECT %L, %L, count(*)::bigint FROM %I.%I;',
  schemaname,
  tablename,
  schemaname,
  tablename
)
FROM pg_tables
WHERE schemaname = 'public'
   OR (
     schemaname = 'auth'
     AND tablename NOT LIKE '%migration%'
   )
ORDER BY schemaname, tablename
\gexec
