import Link from 'next/link';
import { Button, Kicker, SectionHeading, Stat, Tag } from '@5sync/ui';
import { Section, Rail } from '../../components/Section.jsx';
import { accueil, site } from '../../content/fr.js';
import styles from './accueil.module.css';

export const metadata = {
  title: {
    absolute: "5/Sync IT — Ingénierie des systèmes d'information, Dakar",
  },
  description: accueil.hero.chapo,
  alternates: { canonical: '/fr' },
};

export default async function Accueil({ params }) {
  const { locale } = await params;
  const vers = (slug) => `/${locale}/${slug}`;

  return (
    <>
      {/* ── Héro ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroCorps}>
          <div>
            <Kicker size="lg" onGround className={styles.heroKicker}>
              {accueil.hero.surTitre}
            </Kicker>

            <h1 className={styles.heroTitre}>
              {accueil.hero.titre.map((ligne) => (
                <span key={ligne} className={styles.heroLigne}>
                  {ligne}
                </span>
              ))}
              <em className={styles.heroAccent}>{accueil.hero.titreAccent}</em>
            </h1>

            <p className={styles.heroChapo}>{accueil.hero.chapo}</p>

            <div className={styles.heroActions}>
              <Button size="lg" onGround href={vers('references')}>
                Voir nos références
              </Button>
              <Button size="lg" variant="secondary" onGround href={vers('contact')}>
                Parler d’un projet
              </Button>
            </div>
          </div>

          <div className={styles.heroStats}>
            {accueil.hero.stats.map((s) => (
              <Stat key={s.l} value={s.n} label={s.l} size="md" onGround />
            ))}
          </div>
        </div>

        <p className={styles.heroPays}>{site.pays}</p>
      </section>

      {/* ── Promesse ─────────────────────────────────────────────────────── */}
      <Section taille="normal">
        <Rail
          tete={
            <SectionHeading kicker={accueil.promesse.surTitre} size="section">
              {accueil.promesse.titre}
            </SectionHeading>
          }
        >
          <p className={styles.chapoJustifie}>{accueil.promesse.chapo}</p>

          <div className={styles.volets}>
            {accueil.promesse.volets.map((v) => (
              <article key={v.n} className={styles.volet}>
                <p className={styles.numero}>{v.n}</p>
                <h3 className={styles.voletTitre}>{v.t}</h3>
                <p className={styles.voletTexte}>{v.d}</p>
              </article>
            ))}
          </div>
        </Rail>
      </Section>

      {/* ── Expertises ───────────────────────────────────────────────────── */}
      <Section fond="surface" filet taille="normal">
        <SectionHeading kicker={accueil.expertises.surTitre} size="section" className={styles.tete}>
          {accueil.expertises.titre}
        </SectionHeading>

        <ul className={styles.expertises}>
          {accueil.expertises.items.map((e) => (
            <li key={e.n} className={styles.expertise}>
              <p className={styles.numero}>{e.n}</p>
              <h3 className={styles.expertiseTitre}>{e.t}</h3>
              <p className={styles.voletTexte}>{e.d}</p>
            </li>
          ))}
        </ul>

        <p className={styles.suite}>
          <Link href={vers('expertises')}>Le détail de chaque pôle →</Link>
        </p>
      </Section>

      {/* ── Méthode ──────────────────────────────────────────────────────── */}
      <Section filet taille="normal">
        <SectionHeading kicker={accueil.methode.surTitre} size="section" className={styles.tete}>
          {accueil.methode.titre}
        </SectionHeading>

        <p className={styles.chapoLarge}>{accueil.methode.chapo}</p>

        {/* Sept étapes, donc une vraie séquence : la numérotation porte une
            information — l'ordre — et n'est pas un ornement. */}
        <ol className={styles.methode}>
          {accueil.methode.etapes.map((m) => (
            <li key={m.n} className={styles.etape}>
              <p className={styles.etapeNumero}>{m.n}</p>
              <h3 className={styles.etapeTitre}>{m.t}</h3>
              <p className={styles.etapeTexte}>{m.d}</p>
            </li>
          ))}
        </ol>

        <ul className={styles.couches}>
          {accueil.methode.couches.map((c) => (
            <li key={c}>
              <Tag tone="outline">{c}</Tag>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Cas clients ──────────────────────────────────────────────────── */}
      <Section fond="surface" filet taille="normal">
        <SectionHeading kicker={accueil.cas.surTitre} size="section" className={styles.tete}>
          {accueil.cas.titre}
        </SectionHeading>

        <div className={styles.cas}>
          {accueil.cas.items.map((c) => (
            <article key={c.client} className={styles.casCarte}>
              <p className={styles.casPays}>{c.pays}</p>
              <h3 className={styles.casClient}>{c.client}</h3>
              <p className={styles.voletTexte}>{c.resume}</p>
              <p className={styles.casStatut}>{c.statut}</p>
            </article>
          ))}
        </div>

        <p className={styles.suite}>
          <Link href={vers('references')}>Toutes nos références →</Link>
        </p>
      </Section>

      {/* ── Références ───────────────────────────────────────────────────── */}
      <Section filet taille="court">
        <Rail
          tete={
            <SectionHeading kicker={accueil.references.surTitre} size="section">
              {accueil.references.titre}
            </SectionHeading>
          }
        >
          <p className={styles.chapoJustifie}>{accueil.references.chapo}</p>

          <ul className={styles.refs}>
            {accueil.references.items.map((r) => (
              <li key={r.nom} className={styles.ref}>
                <p className={styles.refType}>{r.type}</p>
                <p className={styles.refNom}>{r.nom}</p>
                <p className={styles.refStatut}>{r.statut}</p>
              </li>
            ))}
          </ul>
        </Rail>
      </Section>

      {/* ── Empreinte régionale ──────────────────────────────────────────── */}
      <Section fond="surface" filet taille="normal">
        <SectionHeading kicker={accueil.empreinte.surTitre} size="section" className={styles.tete}>
          {accueil.empreinte.titre}
        </SectionHeading>

        <p className={styles.chapoLarge}>{accueil.empreinte.chapo}</p>

        <div className={styles.pays}>
          {accueil.empreinte.pays.map((p) => (
            <article key={p.nom} className={styles.paysCarte}>
              <h3 className={styles.paysNom}>{p.nom}</h3>
              <p className={styles.paysKicker}>{p.k}</p>
              <p className={styles.voletTexte}>{p.d}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── SmartQueue ───────────────────────────────────────────────────── */}
      <Section filet taille="normal">
        <Rail
          tete={
            <SectionHeading kicker={accueil.smartqueue.surTitre} size="section">
              {accueil.smartqueue.titre}
            </SectionHeading>
          }
        >
          <p className={styles.chapoJustifie}>{accueil.smartqueue.chapo}</p>

          <div className={styles.volets}>
            {accueil.smartqueue.volets.map((v) => (
              <article key={v.t} className={styles.volet}>
                <h3 className={styles.voletTitre}>{v.t}</h3>
                <p className={styles.voletTexte}>{v.d}</p>
              </article>
            ))}
          </div>

          <p className={styles.suite}>
            <Link href={vers('solutions')}>Nos solutions →</Link>
          </p>
        </Rail>
      </Section>

      {/* ── Appel à l'action ─────────────────────────────────────────────── */}
      <Section fond="sombre" taille="court">
        <div className={styles.appel}>
          <h2 className={styles.appelTitre}>{accueil.appel.titre}</h2>
          <p className={styles.appelChapo}>{accueil.appel.chapo}</p>
          <Button size="lg" onGround href={vers('contact')}>
            Nous écrire
          </Button>
        </div>
      </Section>
    </>
  );
}
