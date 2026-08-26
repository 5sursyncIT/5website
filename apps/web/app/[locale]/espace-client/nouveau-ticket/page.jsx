import Link from 'next/link';
import { Button, Field, SectionHeading } from '@5sync/ui';
import { exigerSession } from '../../../../lib/session.js';
import { ouvrirTicket } from './actions.js';
import styles from './nouveau.module.css';

export const metadata = { title: 'Ouvrir un ticket' };

const MESSAGES = {
  objet_requis: 'Décrivez l’objet de votre demande.',
  refuse: 'La demande n’a pas pu être enregistrée. Réessayez, ou écrivez à contact@5sursync.com.',
  indisponible: 'Le service est momentanément indisponible.',
};

/**
 * Les niveaux tels que le client les vit, et non tels que le contrat les
 * nomme. « N2 » ne veut rien dire pour un agent d'état civil ; « plusieurs
 * personnes bloquées » si. Le niveau reste indicatif : c'est la prise en
 * charge qui le qualifie réellement.
 */
const NIVEAUX = [
  { valeur: 'n1', titre: 'Gêne isolée', detail: 'un poste, un utilisateur, un contournement existe' },
  { valeur: 'n2', titre: 'Service dégradé', detail: 'plusieurs personnes bloquées, ou un service ralenti' },
  { valeur: 'n3', titre: 'Interruption', detail: 'un service est à l’arrêt, aucun contournement' },
];

export default async function NouveauTicket({ params, searchParams }) {
  const { locale } = await params;
  const { etat } = await searchParams;
  await exigerSession(locale, `/${locale}/espace-client/nouveau-ticket`);

  return (
    <div className={styles.page}>
      <SectionHeading size="app">Ouvrir un ticket</SectionHeading>
      <p className={styles.chapo}>
        Votre demande est horodatée à l’enregistrement : c’est cet horodatage qui sert au calcul
        du délai de prise en charge de votre contrat.
      </p>

      <form action={ouvrirTicket} className={styles.formulaire} noValidate>
        <input type="hidden" name="locale" value={locale} />

        {MESSAGES[etat] ? (
          <p className={styles.erreur} role="alert">
            {MESSAGES[etat]}
          </p>
        ) : null}

        <Field
          label="OBJET DE LA DEMANDE"
          id="objet"
          name="objet"
          as="textarea"
          rows={3}
          placeholder="Décrivez ce qui ne fonctionne pas, et depuis quand."
          required
        />

        <fieldset className={styles.niveaux}>
          <legend className={styles.legende}>Portée</legend>
          {NIVEAUX.map((n, index) => (
            <label key={n.valeur} className={styles.niveau}>
              <input
                type="radio"
                name="niveau"
                value={n.valeur}
                defaultChecked={index === 0}
                className={styles.radio}
              />
              <span className={styles.niveauCorps}>
                <span className={styles.niveauTitre}>{n.titre}</span>
                <span className={styles.niveauDetail}>{n.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={styles.actions}>
          <Button size="md" type="submit">
            Enregistrer la demande
          </Button>
          <Link href={`/${locale}/espace-client/tickets`} className={styles.annuler}>
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
