import { redirect } from 'next/navigation';

/** La racine renvoie vers la langue par défaut. */
export default function Racine() {
  redirect('/fr');
}
