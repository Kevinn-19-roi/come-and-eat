"use client";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/toast-provider";
import { uploadMedia } from "@/services/media-upload";
import type { VendorActionState } from "@/app/vendor/actions";

export function ActionForm({
  action,
  children,
  className = "vendor-form",
  submitLabel = "Enregistrer",
}: {
  action: (
    state: VendorActionState,
    form: FormData,
  ) => Promise<VendorActionState>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string | false;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <div className="form-feedback error" role="alert">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="form-feedback success" role="status">
          ✓ {state.message}
        </div>
      ) : null}
      {submitLabel ? (
        <button className="btn btn-dark" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </button>
      ) : null}
    </form>
  );
}
export function SubmitButton({
  children,
  className = "btn btn-dark",
  confirmMessage,
  pendingLabel = "Un instant…",
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  pendingLabel?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      name={name}
      value={value}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage))
          event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
export function VendorFlash({ message }: { message?: string }) {
  const toast = useToast();
  useEffect(() => {
    if (message) toast(message);
  }, [message, toast]);
  return null;
}

export type MediaChoice = {
  id: string;
  path: string;
  file_name: string;
  alt_text: string;
  publicUrl: string;
};
export function VendorMediaPicker({
  name = "media_id",
  pathName,
  restaurantId,
  type,
  label = "Ajouter une photo",
  items = [],
  initialId = "",
  initialPath = "",
}: {
  name?: string;
  pathName?: string;
  restaurantId?: string;
  type: string;
  label?: string;
  items?: MediaChoice[];
  initialId?: string;
  initialPath?: string;
}) {
  const [chosen, setChosen] = useState<MediaChoice | undefined>(
    items.find((item) => item.id === initialId) ??
      items.find((item) => item.path === initialPath),
  );
  const [path, setPath] = useState(initialPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadMedia(file, {
        restaurantId,
        type,
        altText: file.name,
      });
      const item = {
        id: String(uploaded.id),
        path: String(uploaded.path),
        file_name: String(uploaded.file_name),
        alt_text: String(uploaded.alt_text),
        publicUrl: String(uploaded.publicUrl),
      };
      setChosen(item);
      setPath(item.path);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "La photo n’a pas pu être ajoutée.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="vendor-media-picker">
      <input type="hidden" name={name} value={chosen?.id ?? ""} />
      {pathName ? <input type="hidden" name={pathName} value={path} /> : null}
      {chosen ? (
        <div className="vendor-media-preview">
          <Image
            src={chosen.publicUrl}
            alt={chosen.alt_text || "Photo sélectionnée"}
            fill
            sizes="180px"
          />
          <button
            type="button"
            onClick={() => {
              setChosen(undefined);
              setPath("");
            }}
          >
            Changer
          </button>
        </div>
      ) : null}
      <label className="upload-button">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <span>{busy ? "Envoi…" : label}</span>
        <small>JPG, PNG ou WebP · 10 Mo maximum</small>
      </label>
      {!chosen && items.length ? (
        <details className="vendor-library">
          <summary>Choisir une photo existante</summary>
          <div>
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setChosen(item);
                  setPath(item.path);
                }}
              >
                <Image
                  src={item.publicUrl}
                  alt={item.alt_text || item.file_name}
                  fill
                  sizes="90px"
                />
              </button>
            ))}
          </div>
        </details>
      ) : null}
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}

type OptionType = "accompaniment" | "drink" | "supplement";
const optionMeta: Record<
  OptionType,
  { label: string; example: string; required: boolean }
> = {
  accompaniment: {
    label: "Accompagnements",
    example: "Frites",
    required: true,
  },
  drink: { label: "Boissons", example: "Bissap", required: false },
  supplement: { label: "Suppléments", example: "Fromage", required: false },
};
export type EditableOptionGroup = {
  type: OptionType;
  required: boolean;
  multiple: boolean;
  options: Array<{ name: string; price: number }>;
};
export function ProductOptionsEditor({
  initial = [],
}: {
  initial?: EditableOptionGroup[];
}) {
  const initialRows = {
    accompaniment: [],
    drink: [],
    supplement: [],
  } as Record<OptionType, Array<{ name: string; price: number }>>;
  for (const group of initial) initialRows[group.type] = group.options;
  const [enabled, setEnabled] = useState<OptionType[]>(
    initial.map((group) => group.type),
  );
  const [rows, setRows] = useState(initialRows);
  function toggle(type: OptionType) {
    setEnabled((values) =>
      values.includes(type)
        ? values.filter((item) => item !== type)
        : [...values, type],
    );
  }
  return (
    <section className="option-editor">
      <div>
        <h2>Ajouter des options ?</h2>
        <p>
          Proposez un accompagnement, une boisson ou un supplément avec ce plat.
        </p>
      </div>
      <div className="option-checks">
        {(Object.keys(optionMeta) as OptionType[]).map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={enabled.includes(type)}
              onChange={() => toggle(type)}
            />
            <span>{optionMeta[type].label}</span>
          </label>
        ))}
      </div>
      {enabled.map((type) => (
        <OptionGroup
          key={type}
          type={type}
          initial={initial.find((group) => group.type === type)}
          rows={rows[type]}
          setRows={(next) =>
            setRows((current) => ({ ...current, [type]: next }))
          }
        />
      ))}
    </section>
  );
}
function OptionGroup({
  type,
  initial,
  rows,
  setRows,
}: {
  type: OptionType;
  initial?: EditableOptionGroup;
  rows: Array<{ name: string; price: number }>;
  setRows: (rows: Array<{ name: string; price: number }>) => void;
}) {
  const meta = optionMeta[type];
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  return (
    <div className="option-builder">
      <div className="option-builder-head">
        <div>
          <h3>{meta.label}</h3>
          <p>
            {type === "supplement"
              ? "Facultatif par défaut, plusieurs choix possibles."
              : "Le choix reste simple pour le client."}
          </p>
        </div>
        <div className="simple-rules">
          <label>
            Le client doit-il choisir ?{" "}
            <select
              name={`${type}_required`}
              defaultValue={(initial?.required ?? meta.required) ? "yes" : "no"}
            >
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
          </label>
          <label>
            Combien peut-il choisir ?{" "}
            <select
              name={`${type}_multiple`}
              defaultValue={
                (initial?.multiple ?? type === "supplement") ? "yes" : "no"
              }
            >
              <option value="no">1</option>
              <option value="yes">Plusieurs</option>
            </select>
          </label>
        </div>
      </div>
      <div className="option-add">
        <label>
          Nom
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={meta.example}
          />
        </label>
        <label>
          Prix ajouté
          <input
            type="number"
            min="0"
            step="100"
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
          />
          <small>0 FCFA signifie « inclus ».</small>
        </label>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (!name.trim()) return;
            setRows([...rows, { name: name.trim(), price }]);
            setName("");
            setPrice(0);
          }}
        >
          Ajouter
        </button>
      </div>
      {rows.length ? (
        <ul className="option-lines">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`}>
              <input type="hidden" name={`${type}_name`} value={row.name} />
              <input type="hidden" name={`${type}_price`} value={row.price} />
              <span>
                <strong>{row.name}</strong>
                <small>
                  {row.price
                    ? `+${new Intl.NumberFormat("fr-FR").format(row.price)} FCFA`
                    : "Inclus"}
                </small>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Supprimer « ${row.name} » ?`))
                    setRows(rows.filter((_, position) => position !== index));
                }}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inline-empty">Aucune option ajoutée.</p>
      )}
    </div>
  );
}
