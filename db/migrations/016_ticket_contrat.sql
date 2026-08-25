-- ═══════════════════════════════════════════════════════════════════════════
-- 016 — Rattacher un ticket au contrat qui le couvre
--
-- POURQUOI
-- L'espace client affiche « RESPECT DES SLA — 100 %, aucun dépassement de
-- GTR ». Ce chiffre suppose de savoir quel engagement s'applique à quel
-- ticket : la Ville de Dakar a deux contrats actifs, l'un à 2 h / 8 h pour le
-- support, l'autre à 4 h / 24 h pour l'infrastructure. Mesurer un ticket
-- d'infrastructure contre la GTR du support donnerait un taux faux.
--
-- Sans ce rattachement, l'indicateur ne pourrait être calculé qu'en devinant,
-- ce qui est exactement ce que ce projet refuse de faire pour les chiffres
-- affichés à un client.
--
-- La colonne est facultative : un ticket peut arriver avant d'être qualifié.
-- Les tickets non rattachés sont exclus du calcul du respect des SLA, et leur
-- nombre est renvoyé avec l'indicateur — un taux calculé sur un échantillon
-- partiel doit dire sur quoi il porte.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tickets
  add column contrat_id uuid references contrats (id) on delete set null;

create index on tickets (contrat_id) where contrat_id is not null;

alter table interventions
  add column contrat_id uuid references contrats (id) on delete set null;

create index on interventions (contrat_id) where contrat_id is not null;
