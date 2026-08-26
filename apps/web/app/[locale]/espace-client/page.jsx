import { redirect } from 'next/navigation';

/** L'espace client s'ouvre sur les tickets, comme la maquette. */
export default async function EspaceClient({ params }) {
  const { locale } = await params;
  redirect(`/${locale}/espace-client/tickets`);
}
