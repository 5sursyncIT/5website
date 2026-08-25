-- 013 — Motive l'exemption de la table pivot.
--
-- La 012 se contentait de « table pivot ». C'est vrai mais insuffisant : le
-- test structurel exige une raison, pas une étiquette. Les migrations étant
-- immuables une fois appliquées, on corrige par ajout — ce qui est le
-- comportement voulu, pas une contrariété.

comment on table organisations is
  'app:hors-cloisonnement — table pivot du cloisonnement : c''est elle qui porte le '
  'périmètre auquel toutes les autres se réfèrent. Une politique RLS ici créerait une '
  'dépendance circulaire : pour savoir si vous avez le droit de lire une organisation, '
  'il faudrait déjà avoir lu une organisation. Le back-office doit par ailleurs pouvoir '
  'les lister toutes. L''accès est contrôlé par la capacité organisations:lire, et un '
  'compte client ne peut lire que la sienne — voir repositories/organisations.js.';
