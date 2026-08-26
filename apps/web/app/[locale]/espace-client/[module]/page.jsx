import { notFound } from 'next/navigation';
import { Button, KpiCard, Meter, RecordList, SectionHeading } from '@5sync/ui';
import { apiGetTout } from '../../../../lib/api.js';
import { MODULES, CLES } from '../modules.js';
import styles from './module.module.css';

export function generateStaticParams() {
  return CLES.map((module) => ({ module }));
}

export async function generateMetadata({ params }) {
  const { module } = await params;
  return { title: MODULES[module]?.libelle ?? 'Espace client' };
}

export default async function ModulePage({ params }) {
  const { locale, module } = await params;
  const config = MODULES[module];
  if (!config) notFound();

  // Les deux appels partent ensemble : enchaînés, ils doubleraient l'attente
  // sur une liaison à forte latence pour aucune raison.
  const { liste, indicateurs, contrat } = await apiGetTout({
    liste: `/api/v1/${config.ressource}`,
    indicateurs: `/api/v1/${config.ressource}/indicateurs`,
    contrat: '/api/v1/contrats/indicateurs',
  });

  // 403 : le compte n'a pas la capacité — un agent sur les pièces financières,
  // par exemple. Ce n'est pas une erreur, c'est une limite de son rôle, et il
  // faut le lui dire plutôt que d'afficher une liste vide.
  if (liste.statut === 403) {
    return (
      <div className={styles.refus}>
        <SectionHeading size="app">{config.libelle}</SectionHeading>
        <p className={styles.refusTexte}>
          Votre rôle ne donne pas accès à ce module. Votre référent peut vous l’ouvrir, ou
          consulter ces informations pour vous.
        </p>
      </div>
    );
  }

  const lignes = liste.donnees?.[config.ressource] ?? [];
  const i = indicateurs.donnees ?? {};
  const kpis = indicateurs.statut === 200 ? config.kpis(i) : [];

  const fiches = lignes.map((l) => {
    const f = config.fiche(l);
    return {
      ...f,
      href: f.telechargeable
        ? `/api/v1/documents/${f.id}/telecharger`
        : `/${locale}/espace-client/${module}/${f.id}`,
    };
  });

  const c = contrat.statut === 200 ? contrat.donnees : null;

  return (
    <>
      <header className={styles.entete}>
        <div>
          <SectionHeading size="app">{config.libelle}</SectionHeading>
          {indicateurs.statut === 200 ? <p className={styles.sous}>{config.sous(i)}</p> : null}
        </div>

        {config.action ? (
          <Button size="md" href={`/${locale}/espace-client/${config.action.href}`}>
            {config.action.libelle}
          </Button>
        ) : null}
      </header>

      {kpis.length > 0 ? (
        <div className={styles.kpis}>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} detail={k.detail} />
          ))}
        </div>
      ) : null}

      <div className={styles.corps}>
        <div className={styles.principal}>
          {fiches.length > 0 ? (
            <RecordList
              label={config.libelle}
              summary={config.entete}
              summaryRight="STATUT"
              records={fiches}
            />
          ) : (
            <p className={styles.vide}>Aucune entrée pour le moment.</p>
          )}
        </div>

        <aside className={styles.aside}>
          {c ? (
            <div className={styles.carte}>
              <p className={styles.carteTitre}>Contrat de service</p>
              <dl className={styles.lignes}>
                <div>
                  <dt>Contrats actifs</dt>
                  <dd>{c.actifs}</dd>
                </div>
                <div>
                  <dt>Respect des SLA</dt>
                  <dd>{c.sla.respectPct == null ? '—' : `${c.sla.respectPct} %`}</dd>
                </div>
                <div>
                  <dt>Prochaine échéance</dt>
                  <dd>
                    {c.prochaineEcheance
                      ? new Intl.DateTimeFormat('fr-FR').format(new Date(c.prochaineEcheance))
                      : '—'}
                  </dd>
                </div>
              </dl>

              {c.forfaitHeures > 0 ? (
                <div className={styles.jauge}>
                  <Meter
                    label="Heures d’intervention consommées"
                    value={c.heuresConsommees}
                    max={c.forfaitHeures}
                    caption={`${c.heuresConsommees} / ${c.forfaitHeures} H`}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.carte}>
            <p className={styles.carteTitre}>Besoin d’aide</p>
            <p className={styles.aide}>
              Votre interlocuteur répond sous les délais de votre contrat. Pour une urgence
              d’exploitation, ouvrez un ticket : il est horodaté et suivi.
            </p>
            <Button size="sm" href={`/${locale}/espace-client/nouveau-ticket`}>
              Ouvrir un ticket
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
