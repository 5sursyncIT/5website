import { Field, Kicker, Button } from '@5sync/ui';
import { seConnecter } from './actions.js';
import { sessionEventuelle } from '../../../lib/session.js';
import { redirect } from 'next/navigation';
import styles from './connexion.module.css';

export const metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false },
};

const MESSAGES = {
  identifiants: 'Identifiants incorrects.',
  champs_manquants: 'Renseignez votre adresse et votre mot de passe.',
  indisponible: 'Le service d’authentification est momentanément indisponible.',
  expiree: 'Votre session a expiré. Reconnectez-vous.',
};

export default async function Connexion({ params, searchParams }) {
  const { locale } = await params;
  const { etat, suite } = await searchParams;

  // Déjà connecté : on ne redemande pas des identifiants pour rien.
  const session = await sessionEventuelle();
  if (session) redirect(`/${locale}/${session.estPersonnel ? 'back-office' : 'espace-client'}`);

  return (
    <section className={styles.page}>
      <div className={styles.carte}>
        <Kicker size="lg">Espace client</Kicker>
        <h1 className={styles.titre}>Connexion</h1>
        <p className={styles.chapo}>
          Accédez à vos tickets, projets, contrats, documents, parc et pièces financières.
        </p>

        <form action={seConnecter} className={styles.formulaire} noValidate>
          <input type="hidden" name="locale" value={locale} />
          {suite ? <input type="hidden" name="suite" value={suite} /> : null}

          {MESSAGES[etat] ? (
            <p className={styles.erreur} role="alert">
              {MESSAGES[etat]}
            </p>
          ) : null}

          <Field
            label="ADRESSE ÉLECTRONIQUE"
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nom@organisation.sn"
            required
          />
          <Field
            label="MOT DE PASSE"
            id="motDePasse"
            name="motDePasse"
            type="password"
            autoComplete="current-password"
            required
          />

          <Button size="lg" type="submit" className={styles.envoyer}>
            Se connecter
          </Button>
        </form>

        <p className={styles.aide}>
          Pas encore d’accès ? Votre interlocuteur 5/Sync IT vous l’ouvre sur demande.
        </p>
      </div>
    </section>
  );
}
