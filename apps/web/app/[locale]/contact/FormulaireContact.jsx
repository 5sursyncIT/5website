import { Field } from '@5sync/ui';
import { contact, site } from '../../../content/fr.js';
import { envoyerDemande } from './actions.js';
import { BoutonEnvoi } from './BoutonEnvoi.jsx';
import styles from './contact.module.css';

const MESSAGES = {
  invalide: 'Quelques informations doivent être corrigées.',
  trop_de_demandes: 'Trop de demandes depuis cette adresse. Réessayez dans une heure.',
  indisponible: `Le formulaire est momentanément indisponible. Écrivez-nous directement à ${site.email}.`,
};

const LIBELLES_CHAMPS = {
  organisation: 'L’organisation est requise.',
  nom: 'Le nom est requis.',
  email: 'Adresse électronique invalide ou manquante.',
  contexte: 'Le contexte est trop long.',
  besoins: 'Nature de besoin inconnue.',
};

/**
 * Composant SERVEUR. L'état vient de l'URL, pas d'un état React : c'est ce qui
 * permet à la page de rendre son résultat même quand aucun script ne s'exécute.
 */
export function FormulaireContact({ locale, etat, champs }) {
  if (etat === 'recu') {
    return (
      <div className={styles.confirmation} role="status">
        <p className={styles.confirmationTitre}>Demande reçue</p>
        <p className={styles.texte}>Nous revenons vers vous sous 48 heures ouvrées.</p>
      </div>
    );
  }

  const enErreur = new Set((champs ?? '').split(',').filter(Boolean));
  const message = MESSAGES[etat];

  return (
    <form action={envoyerDemande} className={styles.formulaire} noValidate>
      <input type="hidden" name="locale" value={locale} />

      {message ? (
        <p className={styles.erreurGlobale} role="alert">
          {message}
        </p>
      ) : null}

      <div>
        <Field
          label={contact.champs.organisation.libelle}
          id="organisation"
          name="organisation"
          placeholder={contact.champs.organisation.exemple}
          required
          aria-invalid={enErreur.has('organisation') ? 'true' : undefined}
        />
        {enErreur.has('organisation') ? (
          <p className={styles.erreur}>{LIBELLES_CHAMPS.organisation}</p>
        ) : null}
      </div>

      <div className={styles.paire}>
        <div>
          <Field
            label={contact.champs.nom.libelle}
            id="nom"
            name="nom"
            placeholder={contact.champs.nom.exemple}
            required
            aria-invalid={enErreur.has('nom') ? 'true' : undefined}
          />
          {enErreur.has('nom') ? <p className={styles.erreur}>{LIBELLES_CHAMPS.nom}</p> : null}
        </div>
        <div>
          <Field
            label={contact.champs.email.libelle}
            id="email"
            name="email"
            type="email"
            placeholder={contact.champs.email.exemple}
            required
            aria-invalid={enErreur.has('email') ? 'true' : undefined}
          />
          {enErreur.has('email') ? <p className={styles.erreur}>{LIBELLES_CHAMPS.email}</p> : null}
        </div>
      </div>

      <fieldset className={styles.besoins}>
        <legend className={styles.legende}>{contact.champs.besoin.libelle}</legend>
        <div className={styles.besoinsListe}>
          {contact.besoins.map((b) => (
            <label key={b} className={styles.besoin}>
              <input type="checkbox" name="besoins" value={b} className={styles.caseCachee} />
              <span className={styles.besoinPuce}>{b}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Field
          label={contact.champs.contexte.libelle}
          id="contexte"
          name="contexte"
          as="textarea"
          rows={5}
          placeholder={contact.champs.contexte.exemple}
        />
        {enErreur.has('contexte') ? <p className={styles.erreur}>{LIBELLES_CHAMPS.contexte}</p> : null}
      </div>

      {/* Champ-piège. Hors du parcours clavier et vocal : un humain ne le
          rencontre jamais, un robot le remplit. */}
      <div className={styles.piege} aria-hidden="true">
        <label htmlFor="site">Ne pas remplir</label>
        <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <BoutonEnvoi libelle={contact.envoyer} />
      </div>
    </form>
  );
}
