-- ═══════════════════════════════════════════════════════════════════════════
-- 021 — État du second facteur, porté par la session
--
-- POURQUOI SUR LA SESSION ET NON SUR LE COMPTE
-- « Ce compte a un second facteur » et « cette session l'a franchi » sont deux
-- choses différentes. Sans ce drapeau, un jeton obtenu avant l'enrôlement
-- resterait valable après, et une session ouverte sans code aurait les mêmes
-- droits qu'une session vérifiée.
--
-- Le défaut est FALSE : une session ne passe le second facteur que si elle le
-- passe explicitement. Les comptes clients, qui n'y sont pas soumis, le voient
-- accordé à la connexion.
-- ═══════════════════════════════════════════════════════════════════════════

alter table sessions
  add column totp_valide boolean not null default false;

-- Enrôlement daté : savoir DEPUIS QUAND un compte 5/Sync est protégé est ce
-- qu'on demande lors d'un audit, pas seulement s'il l'est.
alter table users
  add column totp_active_le timestamptz;

comment on column sessions.totp_valide is
  'La session a franchi le second facteur. Faux tant qu''il n''a pas été présenté.';
