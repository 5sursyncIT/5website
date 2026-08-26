import Link from 'next/link';
import { Kicker } from '@5sync/ui';
import { NavPortail } from './NavPortail.jsx';
import { exigerSession } from '../../../lib/session.js';
import { apiGet } from '../../../lib/api.js';
import { seDeconnecter } from '../connexion/actions.js';
import { MODULES, CLES } from './modules.js';
import styles from './portail.module.css';

export const metadata = {
  title: { template: '%s — Espace client', default: 'Espace client' },
  robots: { index: false, follow: false },
};

/**
 * Coquille de l'espace client.
 *
 * Le rail de 252 px devient un bandeau d'onglets défilants sous 1024 px —
 * décision de Claude Design, qui a écarté explicitement le tiroir : « l'onglet
 * courant doit rester visible ». La bascule est purement CSS, donc sans coût
 * en JavaScript et sans dépendre du script pour rester utilisable.
 */
export default async function PortailLayout({ children, params }) {
  const { locale } = await params;
  const session = await exigerSession(locale, `/${locale}/espace-client`);

  // Le personnel 5/Sync a son propre outil : le renvoyer ici lui donnerait une
  // vue sans périmètre, donc vide, ce qui ressemblerait à une panne.
  const organisation = session.estPersonnel
    ? null
    : (await apiGet(`/api/v1/organisations/${session.organisationId}`)).donnees;

  const compteurs = await apiGet('/api/v1/tickets/indicateurs');
  const ouverts = compteurs.donnees?.ouverts ?? null;

  const entrees = CLES.map((cle) => ({
    href: `/${locale}/espace-client/${cle}`,
    label: MODULES[cle].libelle,
    count: cle === 'tickets' && ouverts != null ? String(ouverts) : undefined,
  }));

  return (
    <div className={styles.portail}>
      <aside className={styles.rail}>
        <div className={styles.identite}>
          <Kicker size="sm">Espace client</Kicker>
          {/* Le nom de l'organisation, pas celui du compte : c'est le
              périmètre qui doit être lisible d'un coup d'œil, surtout pour un
              agent qui travaille pour plusieurs entités. */}
          <p className={styles.client}>{organisation?.nom ?? '—'}</p>
          <p className={styles.compte}>{session.nom}</p>
        </div>

        <NavPortail items={entrees} label="Sections de l’espace client" />

        <div className={styles.pied}>
          <Kicker size="sm">Votre interlocuteur</Kicker>
          <p className={styles.interlocuteur}>Papa Youssoupha Diop</p>
          <a href="mailto:contact@5sursync.com" className={styles.courriel}>
            contact@5sursync.com
          </a>

          <form action={seDeconnecter} className={styles.deconnexion}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={styles.boutonDeconnexion}>
              Se déconnecter
            </button>
          </form>

          <Link href={`/${locale}`} className={styles.retour}>
            ← Retour au site
          </Link>
        </div>
      </aside>

      <section className={styles.contenu}>{children}</section>
    </div>
  );
}
