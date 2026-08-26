/**
 * Configuration lue une fois au démarrage, et validée immédiatement.
 *
 * Le service refuse de démarrer si une variable requise manque, plutôt que
 * d'échouer à la première requête en production. C'est le seul endroit du
 * service qui lit process.env.
 */

/** @param {string} name @param {string} [fallback] */
function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example à la racine du dépôt.`,
    );
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.API_HOST ?? '0.0.0.0',
  port: Number(process.env.API_PORT ?? 4000),

  /**
   * Deux connexions, et ce n'est pas une complication gratuite.
   *
   * `ownerUrl` appartient au propriétaire des tables : il fait les migrations,
   * et PostgreSQL le laisse contourner Row-Level Security.
   * `appUrl` est le rôle app_5sync, non superutilisateur : c'est le seul que
   * l'API utilise, et le seul à qui les politiques d'isolation s'appliquent.
   *
   * Confondre les deux ferait disparaître l'isolation sans qu'aucun test ne
   * s'en aperçoive — les requêtes continueraient de fonctionner, simplement
   * elles verraient tout.
   */
  ownerUrl: process.env.DATABASE_URL ?? null,
  appUrl: process.env.DATABASE_APP_URL ?? null,
  appPassword: process.env.DATABASE_APP_PASSWORD ?? null,

  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  cookieName: process.env.SESSION_COOKIE ?? '5sync_session',

  /**
   * Jeton du collecteur de métriques.
   *
   * Les métriques disent combien d'organisations sont clientes, combien de
   * tickets sont ouverts, combien de comptes existent. Ce sont des chiffres
   * commerciaux : le nombre de clients d'une entreprise de services n'a pas à
   * être lisible par quiconque atteint le port. D'où un jeton, et non un
   * simple « c'est interne, personne n'ira voir ».
   */
  metricsToken: process.env.METRICS_TOKEN ?? null,
};

export function assertProductionConfig() {
  if (config.env !== 'production') return;
  required('DATABASE_URL');
  required('DATABASE_APP_URL');

  if (!config.metricsToken) {
    // Un avertissement, pas un refus de démarrer. Refuser mettrait la
    // supervision sur le chemin critique du démarrage, ce qui est le contraire
    // du but : un service qui ne démarre pas parce qu'on n'a pas encore
    // branché Prometheus est moins disponible, pas mieux supervisé.
    //
    // La contrepartie est assumée et couverte : sans jeton, /metrics répond
    // 404, et la règle d'alerte « absent(5sync_base_disponible) » livrée dans
    // infra/supervision/alertes.yml fait du silence lui-même une alerte.
    console.warn(
      "[supervision] METRICS_TOKEN n'est pas défini : /api/v1/metrics est fermé. " +
        'Aucune métrique ne sortira de ce service. Voir infra/supervision/.',
    );
  }

  if (config.appUrl === config.ownerUrl) {
    throw new Error(
      "DATABASE_APP_URL est identique à DATABASE_URL. L'API se connecterait avec le " +
        "propriétaire des tables, qui contourne Row-Level Security : l'isolation entre " +
        'organisations serait inopérante. Utilisez le rôle app_5sync.',
    );
  }
}
