import styles from './Field.module.css';

/**
 * Champ de formulaire. Le libellé de la maquette n'est pas celui de Classical :
 * il est en monospace capitales, pas en Lora 12 px.
 *
 * @param {{label: string, id: string, as?: 'input'|'textarea'}} props
 */
export function Field({ label, id, as = 'input', className = '', ...rest }) {
  const Control = as;
  return (
    <div className={['field', styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Control id={id} className="input" {...rest} />
    </div>
  );
}
