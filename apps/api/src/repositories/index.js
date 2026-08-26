/**
 * Les dépôts, regroupés.
 *
 * Chacun reçoit le client PostgreSQL d'une transaction ouverte par
 * withTenant : aucun ne filtre par organisation, le cloisonnement étant tenu
 * par Row-Level Security. Voir db/tenant.js.
 */
export * as tickets from './tickets.js';
export * as projets from './projets.js';
export * as contrats from './contrats.js';
export * as documents from './documents.js';
export * as parc from './parc.js';
export * as finances from './finances.js';
export * as organisations from './organisations.js';
export * as interventions from './interventions.js';
export * as audit from './audit.js';
