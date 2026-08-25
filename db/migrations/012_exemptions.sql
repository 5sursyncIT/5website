-- ═══════════════════════════════════════════════════════════════════════════
-- 012 — Exemptions de cloisonnement, déclarées
--
-- Deux tables portent organisation_id sans être soumises à Row-Level Security.
-- C'est délibéré, mais « délibéré » ne se voit pas dans un schéma : six mois
-- plus tard, personne ne sait si c'est un choix ou un oubli.
--
-- On l'écrit donc DANS la base, en commentaire de table, avec un marqueur que
-- le test structurel reconnaît. Conséquence voulue : une nouvelle table
-- cloisonnée est protégée par défaut, et l'exempter demande d'écrire pourquoi.
-- ═══════════════════════════════════════════════════════════════════════════

comment on table users is
  'app:hors-cloisonnement — cette table DÉFINIT le périmètre au lieu d''en dépendre. '
  'Les comptes du personnel 5/Sync y ont organisation_id NULL ; une politique RLS les '
  'rendrait invisibles à eux-mêmes et empêcherait toute authentification. '
  'L''accès est contrôlé par le rôle, dans apps/api/src/repositories.';

comment on table audit_log is
  'app:hors-cloisonnement — journal transverse et en écriture seule. Il doit pouvoir '
  'enregistrer un événement quel que soit le périmètre de la transaction, y compris '
  'hors de tout périmètre. La lecture est réservée à la capacité audit:lire (admin). '
  'À rouvrir au client le jour où il demandera la traçabilité de ses propres accès.';

comment on table organisations is
  'app:hors-cloisonnement — table pivot : c''est elle qui porte le périmètre.';

comment on table leads is
  'app:hors-cloisonnement — un prospect n''appartient à aucune organisation cliente. '
  'Réservé au personnel 5/Sync par la capacité leads:lire.';
