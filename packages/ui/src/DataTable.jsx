import styles from './DataTable.module.css';

/**
 * Tableau de données des portails.
 *
 * ÉCART ASSUMÉ PAR RAPPORT À LA MAQUETTE, ET IL EST VOULU.
 * La maquette dessine ces tableaux avec `display: grid` sur des <div>. Le rendu
 * est juste, mais un lecteur d'écran n'y voit plus un tableau : ni en-têtes de
 * colonne annoncés, ni navigation cellule à cellule. Pour des clients
 * institutionnels soumis à des obligations d'accessibilité, ce n'est pas tenable.
 *
 * On rend donc un vrai <table> et on retrouve les largeurs exactes autrement :
 * `table-layout: fixed` plus un <col> par colonne. Les chaînes de gabarit de la
 * maquette — « 110px 1fr 130px 110px 130px » — contiennent toutes exactement une
 * fraction ; en disposition fixe, une colonne `auto` unique absorbe l'espace
 * restant, ce qui reproduit `1fr` au pixel près.
 *
 * @param {object} props
 * @param {string} props.columns  gabarit repris tel quel de la maquette
 * @param {string[]} props.headers
 * @param {Array<{id: string, cells: Array<string|import('react').ReactNode>}>} props.rows
 * @param {string} [props.caption] résumé pour lecteurs d'écran
 * @param {boolean} [props.onGround=false]
 */
/* Modèle d'espacement, repris de la maquette : la rangée porte 22 px de marge
   sur ses bords extérieurs et 16 px de gouttière entre colonnes. Un <td> n'a
   pas de gouttière : on répartit donc la moitié de 16 px de chaque côté.

   Conséquence à ne pas manquer : en `table-layout: fixed`, la largeur d'un
   <col> est une largeur de BORDURE, marges comprises. Les gabarits de la
   maquette (« 110px 1fr 130px … ») décrivent, eux, des largeurs de CONTENU.
   Sans cette addition, chaque colonne perd sa marge en largeur utile et les
   pastilles de statut se font rogner. */
const EDGE = 22;
const HALF_GAP = 8;

function borderBoxWidth(value, index, count) {
  if (value.endsWith('fr')) return 'auto';
  const left = index === 0 ? EDGE : HALF_GAP;
  const right = index === count - 1 ? EDGE : HALF_GAP;
  return `${Number.parseFloat(value) + left + right}px`;
}

export function DataTable({ columns, headers, rows, caption, onGround = false }) {
  const declared = columns.trim().split(/\s+/);
  const widths = declared.map((w, i) => borderBoxWidth(w, i, declared.length));

  return (
    <div className={[styles.frame, onGround ? styles.onGround : ''].filter(Boolean).join(' ')}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          {caption ? <caption className={styles.caption}>{caption}</caption> : null}
          <colgroup>
            {widths.map((w, i) => (
              <col key={headers[i] ?? i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, i) => (
                  <td key={headers[i] ?? i} className={i === 0 ? styles.lead : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
