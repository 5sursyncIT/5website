-- ═══════════════════════════════════════════════════════════════════════════
-- 014 — Le périmètre demandé lie aussi le personnel
--
-- LE DÉFAUT CORRIGÉ
-- La politique posée en 001 disait :
--     organisation_id = app.current_organisation() OR app.is_staff()
--
-- Pour un compte du personnel, le second terme était toujours vrai : demander
-- explicitement le périmètre de la Ville de Dakar ne restreignait rien, et la
-- requête renvoyait aussi les tickets de l'Institut National de l'Audiovisuel.
--
-- Ce n'est pas une fuite vers un client — le personnel 5/Sync a bien le droit
-- de tout voir — mais c'est un mélange. Dans le back-office, l'opérateur qui
-- ouvre la fiche d'un client verrait les données d'un autre sur la même page,
-- sans que rien ne le signale. Pour des dossiers institutionnels, c'est une
-- confusion inacceptable.
--
-- LA RÈGLE CORRIGÉE
--     organisation_id = app.current_organisation()
--     OR (app.is_staff() AND app.current_organisation() IS NULL)
--
-- Le personnel voit tout quand il ne demande RIEN de précis — la vue
-- transverse du back-office. Dès qu'il pose un périmètre, celui-ci le lie
-- exactement comme un client. Le privilège reste, l'imprécision disparaît.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.proteger(nom_table text) returns void
  language plpgsql
  as $$
begin
  execute format('alter table %I enable row level security', nom_table);
  -- Sans FORCE, le propriétaire de la table contourne ses propres politiques.
  execute format('alter table %I force row level security', nom_table);
  execute format($p$
    create policy %1$I_cloisonnement on %1$I
      using (
        organisation_id = app.current_organisation()
        or (app.is_staff() and app.current_organisation() is null)
      )
      with check (
        organisation_id = app.current_organisation()
        or (app.is_staff() and app.current_organisation() is null)
      )
  $p$, nom_table);
  execute format($t$
    create trigger %1$I_audit
      after insert or update or delete on %1$I
      for each row execute function app.tracer()
  $t$, nom_table);
end;
$$;

-- Repose la politique sur toutes les tables déjà protégées. On les découvre
-- dans le catalogue plutôt que de les énumérer : une liste écrite à la main
-- oublierait la prochaine table ajoutée.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
       and exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid
                      and a.attname = 'organisation_id'
                      and not a.attisdropped)
  loop
    execute format('drop policy if exists %1$I_cloisonnement on %1$I', t.relname);
    execute format($p$
      create policy %1$I_cloisonnement on %1$I
        using (
          organisation_id = app.current_organisation()
          or (app.is_staff() and app.current_organisation() is null)
        )
        with check (
          organisation_id = app.current_organisation()
          or (app.is_staff() and app.current_organisation() is null)
        )
    $p$, t.relname);
  end loop;
end
$$;
