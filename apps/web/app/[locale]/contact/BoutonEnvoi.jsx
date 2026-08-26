'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@5sync/ui';

/**
 * Seul fragment client de la page, et il ne sert qu'à une chose : dire que
 * l'envoi est en cours. Sur une connexion lente, un bouton qui ne réagit pas
 * se fait cliquer deux fois.
 *
 * Sans JavaScript, il reste un bouton de soumission ordinaire — la page ne
 * perd rien, elle perd seulement ce retour visuel.
 */
export function BoutonEnvoi({ libelle }) {
  const { pending } = useFormStatus();
  return (
    <Button size="lg" type="submit" disabled={pending}>
      {pending ? 'Envoi en cours…' : libelle}
    </Button>
  );
}
