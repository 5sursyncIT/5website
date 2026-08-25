-- ═══════════════════════════════════════════════════════════════════════════
-- 015 — Les vues doivent s'exécuter avec les droits de l'appelant
--
-- LA FUITE CORRIGÉE
-- En PostgreSQL, une vue s'exécute par défaut avec les privilèges de son
-- PROPRIÉTAIRE, pas de celui qui l'interroge. Les vues projets_avancement et
-- contrats_consommation ayant été créées par le propriétaire des tables, elles
-- contournaient Row-Level Security : depuis le périmètre d'un client, elles
-- renvoyaient les lignes de TOUTES les organisations.
--
-- Mesuré avant correction : la table projets renvoyait 1 ligne, la vue
-- projets_avancement en renvoyait 3.
--
-- C'est le contournement le plus discret du dispositif, parce qu'il ne
-- ressemble à rien. Les politiques sont bien posées, les tables bien
-- protégées, les tests d'isolation passent — et une vue de commodité rend le
-- tout inopérant. Aucun test du lot 2 ne passait par une vue.
--
-- security_invoker (PostgreSQL 15+) inverse la règle : la vue s'exécute avec
-- les droits de l'appelant, donc ses politiques s'appliquent.
--
-- Un test structurel interdit désormais toute vue sans cette option.
-- ═══════════════════════════════════════════════════════════════════════════

alter view projets_avancement set (security_invoker = true);
alter view contrats_consommation set (security_invoker = true);
