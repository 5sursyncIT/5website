/**
 * Dérive le contexte d'isolation à partir de la session.
 *
 * LA RÈGLE, ET ELLE N'A PAS D'EXCEPTION : le périmètre vient de la session,
 * jamais du corps ni de l'URL de la requête. Un agent de la Ville de Dakar ne
 * peut pas demander à consulter l'Institut National de l'Audiovisuel, parce
 * qu'il n'existe aucun chemin de code où sa demande pourrait influencer le
 * périmètre.
 *
 * Le personnel 5/Sync, lui, travaille par définition en transverse. Il peut
 * demander un périmètre — le back-office en a besoin pour ouvrir la fiche d'un
 * client — mais c'est son rôle qui l'y autorise, vérifié ici.
 */

export class ErreurAcces extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurAcces';
    this.statusCode = 403;
  }
}

/**
 * @param {{userId: string, role: string, organisationId: string|null, estPersonnel: boolean}} session
 * @param {{organisationDemandee?: string|null}} [options]
 */
export function contexteDe(session, { organisationDemandee = null } = {}) {
  if (session.estPersonnel) {
    return {
      organisationId: organisationDemandee,
      isStaff: true,
      actorId: session.userId,
    };
  }

  if (organisationDemandee && organisationDemandee !== session.organisationId) {
    // On refuse explicitement plutôt que de retomber en silence sur le
    // périmètre de la session : une tentative d'accès croisé doit laisser une
    // trace, pas produire une page qui a l'air normale.
    throw new ErreurAcces("Accès refusé : l'organisation demandée n'est pas la vôtre.");
  }

  return {
    organisationId: session.organisationId,
    isStaff: false,
    actorId: session.userId,
  };
}

/** Rôles autorisés par capacité. Une capacité absente d'ici n'est accordée à personne. */
const CAPACITES = {
  'organisations:lire': ['admin', 'staff'],
  'organisations:ecrire': ['admin'],
  'comptes:gerer': ['admin', 'client_admin'],
  'tickets:lire': ['admin', 'staff', 'client_admin', 'client_user'],
  'tickets:ouvrir': ['admin', 'staff', 'client_admin', 'client_user'],
  'tickets:administrer': ['admin', 'staff'],
  'documents:lire': ['admin', 'staff', 'client_admin', 'client_user'],
  'documents:deposer': ['admin', 'staff'],
  'finances:lire': ['admin', 'staff', 'client_admin'],
  'finances:ecrire': ['admin'],
  'leads:lire': ['admin', 'staff'],
  'audit:lire': ['admin'],
};

export function peut(session, capacite) {
  const roles = CAPACITES[capacite];
  if (!roles) throw new Error(`Capacité inconnue : ${capacite}`);
  return roles.includes(session.role);
}

export function exiger(session, capacite) {
  if (!peut(session, capacite)) {
    throw new ErreurAcces(`Accès refusé : la capacité « ${capacite} » n'est pas accordée à votre rôle.`);
  }
}

export const capacitesConnues = Object.keys(CAPACITES);
