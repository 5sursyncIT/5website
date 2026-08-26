/** Identité de l'expéditeur, employée par les gabarits. */
export const site = {
  nom: '5/Sync IT',
  url: process.env.SITE_URL ?? 'https://5sursync.com',
  expediteur: process.env.MAIL_FROM ?? '5/Sync IT <contact@5sursync.com>',
};
