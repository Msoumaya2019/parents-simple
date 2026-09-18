import { useId, type ReactNode } from 'react';

/**
 * Les quelques pièces d'interface partagées par les quatre formulaires.
 *
 * Elles tiennent dans un fichier parce qu'elles sont courtes et qu'elles vont
 * ensemble. Les séparer produirait cinq fichiers de quinze lignes qu'il
 * faudrait ouvrir l'un après l'autre pour comprendre un seul formulaire.
 *
 * Chaque champ porte son `label` relié par `htmlFor` : sans ce lien, cliquer
 * sur le libellé ne place pas le curseur dans le champ, et un lecteur d'écran
 * annonce « zone de texte » sans dire de quoi il s'agit.
 */

export function Avis({
  ton,
  texte,
}: {
  readonly ton: 'succes' | 'erreur';
  readonly texte: string;
}) {
  return (
    <p className={`avis ${ton}`} role={ton === 'erreur' ? 'alert' : 'status'}>
      {texte}
    </p>
  );
}

export function Carte({
  titre,
  aide,
  children,
}: {
  readonly titre: string;
  readonly aide?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="carte">
      <h2>{titre}</h2>
      {aide !== undefined && <p className="aide">{aide}</p>}
      {children}
    </section>
  );
}

/**
 * Le compteur de caractères, affiché seulement quand il devient utile.
 *
 * Le montrer en permanence encombre la lecture pour rien : personne n'a besoin
 * de savoir qu'il reste 7 940 caractères. Il apparaît donc dans les quarante
 * derniers, et passe en rouge au-delà — ce qui ne devrait pas arriver, puisque
 * le champ lui-même s'arrête à la borne. C'est un filet, pas une consigne.
 */
function Compteur({ valeur, max }: { readonly valeur: string; readonly max: number }) {
  const reste = max - valeur.length;
  if (reste > 40) {
    return null;
  }

  return (
    <span className={`compte${reste < 0 ? ' depasse' : ''}`}>
      {reste < 0 ? `${-reste} caractère(s) de trop` : `${reste} caractère(s) restant(s)`}
    </span>
  );
}

export function Champ({
  libelle,
  valeur,
  onChange,
  type = 'text',
  maxLength,
  obligatoire = false,
  aide,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly type?: 'text' | 'url' | 'date' | 'datetime-local' | 'password';
  readonly maxLength?: number;
  readonly obligatoire?: boolean;
  readonly aide?: string;
}) {
  const id = useId();

  return (
    <div className="champ">
      <label htmlFor={id}>
        {libelle}
        {obligatoire ? '' : ' (facultatif)'}
      </label>
      <input
        id={id}
        type={type}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
        {...(maxLength !== undefined ? { maxLength } : {})}
        {...(obligatoire ? { required: true } : {})}
      />
      {aide !== undefined && <span className="compte">{aide}</span>}
      {maxLength !== undefined && <Compteur valeur={valeur} max={maxLength} />}
    </div>
  );
}

export function ZoneTexte({
  libelle,
  valeur,
  onChange,
  maxLength,
  lignes = 8,
  aide,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly maxLength?: number;
  readonly lignes?: number;
  readonly aide?: string;
}) {
  const id = useId();

  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <textarea
        id={id}
        rows={lignes}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
        {...(maxLength !== undefined ? { maxLength } : {})}
      />
      {aide !== undefined && <span className="compte">{aide}</span>}
      {maxLength !== undefined && <Compteur valeur={valeur} max={maxLength} />}
    </div>
  );
}

export function Choix<T extends string>({
  libelle,
  valeur,
  onChange,
  options,
}: {
  readonly libelle: string;
  readonly valeur: T;
  readonly onChange: (valeur: T) => void;
  readonly options: readonly { readonly valeur: T; readonly libelle: string }[];
}) {
  const id = useId();

  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <select
        id={id}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Case({
  libelle,
  cochee,
  onChange,
}: {
  readonly libelle: string;
  readonly cochee: boolean;
  readonly onChange: (cochee: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="champ">
      <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id={id}
          type="checkbox"
          checked={cochee}
          onChange={(evenement) => onChange(evenement.target.checked)}
          style={{ width: 'auto' }}
        />
        {libelle}
      </label>
    </div>
  );
}

export function Bouton({
  children,
  onClick,
  type = 'button',
  variante = 'principal',
  desactive = false,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit';
  readonly variante?: 'principal' | 'discret' | 'danger';
  readonly desactive?: boolean;
}) {
  return (
    <button
      type={type}
      className={`bouton${variante === 'principal' ? '' : ` ${variante}`}`}
      onClick={onClick}
      disabled={desactive}
    >
      {children}
    </button>
  );
}
