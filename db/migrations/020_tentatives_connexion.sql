-- ═══════════════════════════════════════════════════════════════════════════
-- 020 — Traçage des tentatives de connexion
--
-- CE QUE ÇA CORRIGE
-- Jusqu'ici, /auth/connexion n'avait aucune limite : un attaquant pouvait
-- essayer des mots de passe aussi vite que le réseau le permettait. Argon2id
-- rend chaque essai coûteux, ce qui aide, mais ne remplace pas une limite —
-- il rend l'attaque lente, pas impossible, et il rend surtout le service
-- attaquable par épuisement de CPU.
--
-- POURQUOI EN BASE ET NON EN MÉMOIRE
-- Un compteur en mémoire se remet à zéro à chaque redémarrage — il suffit donc
-- de faire tomber le service pour repartir de zéro — et ne compte que pour une
-- instance. Le jour où l'API sera répliquée, la limite serait multipliée par le
-- nombre d'instances sans que personne ne s'en aperçoive.
--
-- DEUX AXES, ET IL EN FAUT DEUX
--   par ADRESSE : arrête celui qui essaie mille mots de passe sur un compte.
--   par COMPTE  : arrête celui qui essaie un mot de passe sur mille comptes
--                 depuis mille adresses — la limite par adresse n'y peut rien.
--
-- Le verrouillage de compte est BORNÉ DANS LE TEMPS, et c'est délibéré : un
-- verrouillage définitif transformerait la protection en déni de service, un
-- attaquant n'ayant qu'à échouer volontairement pour fermer l'accès d'un agent.
-- ═══════════════════════════════════════════════════════════════════════════

create table tentatives_connexion (
  id           bigserial primary key,
  survenue_le  timestamptz not null default now(),
  -- L'adresse peut être absente derrière un mandataire mal configuré : on
  -- l'accepte pour ne pas perdre la trace côté compte.
  ip           inet,
  -- L'e-mail présenté, PAS un identifiant de compte : une tentative sur une
  -- adresse inexistante est précisément ce qu'on veut pouvoir compter.
  email        citext,
  reussie      boolean not null
);

-- Les deux index servent les deux requêtes de comptage, et seulement elles.
create index on tentatives_connexion (ip, survenue_le desc) where not reussie;
create index on tentatives_connexion (email, survenue_le desc) where not reussie;

-- Purge : la table n'a d'intérêt que sur une fenêtre courte, et une table de
-- tentatives qui grossit indéfiniment devient elle-même un problème.
create or replace function app.purger_tentatives(anciennete interval default interval '30 days')
  returns integer language plpgsql as $$
declare
  supprimees integer;
begin
  delete from tentatives_connexion where survenue_le < now() - anciennete;
  get diagnostics supprimees = row_count;
  return supprimees;
end;
$$;

grant select, insert, delete on tentatives_connexion to app_5sync;
grant usage, select on sequence tentatives_connexion_id_seq to app_5sync;
