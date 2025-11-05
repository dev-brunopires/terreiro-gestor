-- Listar todos os triggers da tabela faturas para identificar qual está causando o problema
SELECT 
    t.tgname AS trigger_name,
    pg_get_triggerdef(t.oid) AS trigger_definition,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'faturas'
  AND t.tgisinternal = false
ORDER BY t.tgname;