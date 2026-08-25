import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { connecter } from '../src/auth/connexion.js';
import { resoudre, revoquer, revoquerToutes, ouvrir } from '../src/auth/sessions.js';
import { hacher, verifier } from '../src/auth/passwords.js';
import { withoutTenant } from '../src/db/tenant.js';
import { getOwnerPool } from '../src/db/pool.js';
import { baseDisponible, RAISON_SAUT, jeuDeuxOrganisations, closePools } from './helpers.js';

describe('Mots de passe', () => {
  test('un mot de passe correct est reconnu, un autre non', async () => {
    const empreinte = await hacher('Un mot de passe correct 2026');

    assert.equal(await verifier('Un mot de passe correct 2026', empreinte), true);
    assert.equal(await verifier('un mot de passe correct 2026', empreinte), false);
  });

  test('l’empreinte est en Argon2id et jamais deux fois la même', async () => {
    const [a, b] = await Promise.all([hacher('identique'), hacher('identique')]);

    assert.match(a, /^\$argon2id\$/);
    assert.notEqual(a, b, 'le sel ne varie pas — deux comptes au même mot de passe seraient liés');
  });

  test('une empreinte malformée renvoie false plutôt que de lever', async () => {
    // Une exception ici distinguerait « compte corrompu » de « mauvais mot de
    // passe », ce qui est une information de trop.
    assert.equal(await verifier('peu importe', 'pas-une-empreinte'), false);
  });
});

describe('Sessions', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let jeu;

  before(async () => {
    jeu = await jeuDeuxOrganisations();
  });

  after(async () => {
    await jeu?.nettoyer();
    await closePools();
  });

  test('le jeton en clair n’est jamais stocké', async () => {
    const { jeton } = await ouvrir({ userId: jeu.userA });

    const trouve = await withoutTenant(async (c) =>
      Number(
        (
          await c.query('select count(*)::int as n from sessions where encode(token_hash, $1) = $2', [
            'escape',
            jeton,
          ])
        ).rows[0].n,
      ),
    );

    assert.equal(trouve, 0, 'le jeton se retrouve en base : une copie de la base donnerait des sessions');
  });

  test('une session valide résout vers le bon périmètre', async () => {
    const { jeton } = await ouvrir({ userId: jeu.userA });
    const session = await resoudre(jeton);

    assert.equal(session.userId, jeu.userA);
    assert.equal(session.organisationId, jeu.a);
    assert.equal(session.estPersonnel, false);
  });

  test('un compte du personnel n’a pas d’organisation et est marqué comme tel', async () => {
    const { jeton } = await ouvrir({ userId: jeu.personnel });
    const session = await resoudre(jeton);

    assert.equal(session.organisationId, null);
    assert.equal(session.estPersonnel, true);
  });

  test('une session révoquée ne résout plus — immédiatement', async () => {
    const { jeton } = await ouvrir({ userId: jeu.userA });
    assert.ok(await resoudre(jeton));

    await revoquer(jeton);

    assert.equal(await resoudre(jeton), null);
  });

  test('révoquer toutes les sessions coupe les accès en cours', async () => {
    const [un, deux] = await Promise.all([ouvrir({ userId: jeu.userB }), ouvrir({ userId: jeu.userB })]);

    await revoquerToutes(jeu.userB);

    assert.equal(await resoudre(un.jeton), null);
    assert.equal(await resoudre(deux.jeton), null);
  });

  test('une session expirée ne résout pas', async () => {
    const { jeton } = await ouvrir({ userId: jeu.userA });
    await getOwnerPool().query(
      "update sessions set expire_le = now() - interval '1 minute' where user_id = $1",
      [jeu.userA],
    );

    assert.equal(await resoudre(jeton), null);
  });

  test('désactiver un compte invalide ses sessions sans avoir à les révoquer', async () => {
    const { jeton } = await ouvrir({ userId: jeu.userA });
    await getOwnerPool().query('update users set actif = false where id = $1', [jeu.userA]);

    assert.equal(await resoudre(jeton), null);

    await getOwnerPool().query('update users set actif = true where id = $1', [jeu.userA]);
  });

  test('un jeton inventé ou vide ne résout pas', async () => {
    for (const faux of ['', 'court', 'x'.repeat(43), null, undefined, 42]) {
      assert.equal(await resoudre(faux), null);
    }
  });
});

describe('Connexion', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let jeu;

  before(async () => {
    jeu = await jeuDeuxOrganisations();
  });

  after(async () => {
    await jeu?.nettoyer();
    await closePools();
  });

  test('un identifiant valide ouvre une session', async () => {
    const r = await connecter({ email: jeu.emailA, motDePasse: jeu.motDePasse });

    assert.equal(r.ok, true);
    assert.equal(r.utilisateur.organisationId, jeu.a);
    assert.ok(await resoudre(r.jeton));
  });

  test('un mot de passe erroné échoue sans dire pourquoi', async () => {
    const r = await connecter({ email: jeu.emailA, motDePasse: 'faux' });

    assert.deepEqual(r, { ok: false });
  });

  test('un e-mail inconnu échoue de la même façon', async () => {
    const r = await connecter({ email: 'inconnu@nulle-part.sn', motDePasse: jeu.motDePasse });

    assert.deepEqual(r, { ok: false });
  });

  test('un e-mail inconnu ne répond pas plus vite qu’un compte réel', async () => {
    // Un écart de temps de réponse révélerait quels e-mails existent en base.
    // On compare des médianes : une moyenne se laisse fausser par un pic.
    const mesurer = async (email) => {
      const relevés = [];
      for (let i = 0; i < 5; i += 1) {
        const t = process.hrtime.bigint();
        await connecter({ email, motDePasse: 'mauvais mot de passe' });
        relevés.push(Number(process.hrtime.bigint() - t) / 1e6);
      }
      return relevés.sort((a, b) => a - b)[2];
    };

    const connu = await mesurer(jeu.emailA);
    const inconnu = await mesurer('inconnu@nulle-part.sn');
    const écart = Math.abs(connu - inconnu) / Math.max(connu, inconnu);

    assert.ok(
      écart < 0.5,
      `écart de ${(écart * 100).toFixed(0)} % entre compte connu (${connu.toFixed(0)} ms) et ` +
        `inconnu (${inconnu.toFixed(0)} ms) : le temps de réponse trahit l'existence du compte`,
    );
  });

  test('la connexion horodate la dernière visite', async () => {
    await connecter({ email: jeu.emailA, motDePasse: jeu.motDePasse });

    const { rows } = await getOwnerPool().query('select derniere_connexion from users where id = $1', [
      jeu.userA,
    ]);

    assert.ok(rows[0].derniere_connexion instanceof Date);
  });
});
