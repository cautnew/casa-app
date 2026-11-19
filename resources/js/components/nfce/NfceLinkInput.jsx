import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaste, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { Button } from "../ui/Button.jsx";
import { Input } from "../ui/Input.jsx";
import { parseNfceInput, INPUT_ERRORS } from "../../utils/nfce.js";

/** Aba "Colar link": aceita o link do app/e-mail Nota Potiguar, o texto do QR Code ou a chave de 44 dígitos. */
export function NfceLinkInput({ onSubmit, busy, initialValue = "" }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  const submit = (text = value) => {
    const { key, reason } = parseNfceInput(text);
    if (!key) return setError(INPUT_ERRORS[reason]);
    setError("");
    onSubmit(text.trim());
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return setError("A área de transferência está vazia. Copie o link da nota e tente de novo.");
      setValue(text);
      const { key, reason } = parseNfceInput(text);
      if (key) submit(text);
      else setError(INPUT_ERRORS[reason]);
    } catch {
      setError("Não foi possível colar automaticamente. Toque no campo e cole o link.");
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <label htmlFor="nfce-link" className="block text-xs font-medium text-stone-500">Link da NFC-e</label>
      <div className="flex gap-2">
        <Input
          id="nfce-link"
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          placeholder="https://nfce.sefaz.rn.gov.br/..."
          autoFocus
          inputMode="url"
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby="nfce-link-help"
          className={error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""}
        />
        {canPaste && (
          <Button type="button" variant="outline" onClick={paste} disabled={busy} className="shrink-0">
            <FontAwesomeIcon icon={faPaste} style={{ height: "0.875rem" }} /> Colar
          </Button>
        )}
      </div>
      {error ? (
        <p id="nfce-link-help" role="alert" className="text-xs text-rose-600">{error}</p>
      ) : (
        <p id="nfce-link-help" className="text-xs text-stone-400">
          O link vem no e-mail ou no app Nota Potiguar. Também aceitamos o texto do QR Code ou a chave de acesso (44 números).
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !value.trim()}>
          {busy ? "Lendo nota…" : <>Ler nota <FontAwesomeIcon icon={faArrowRight} style={{ height: "0.875rem" }} /></>}
        </Button>
      </div>
    </form>
  );
}
