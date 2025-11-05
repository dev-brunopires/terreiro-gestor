-- Verificar outras funções suspeitas
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname IN ('faturas_sync_valor', 'faturas_bi_fill_defaults', 'faturas_set_refer', 'faturas_sync_venc');