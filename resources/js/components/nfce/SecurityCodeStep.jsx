import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faRotateRight, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { Button } from "../ui/Button.jsx";
import { Input } from "../ui/Input.jsx";

/**
 * Etapa exigida pela SEFAZ no caminho do QR Code: a pessoa digita o código da imagem.
 * O app não tenta resolver o código — só repassa o que foi digitado.
 */
export function SecurityCodeStep({ note, captcha, error, busy, onSubmit, onRefresh, onUseLink }) {
  const [code, setCode] = useState("");
  const inputRef = useRef(null);

  // A cada nova imagem (erro ou "outra imagem"), limpa o campo e devolve o foco.
  useEffect(() => {
    setCode("");
    inputRef.current?.focus();
  }, [captcha]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (code.trim()) onSubmit(code.trim()); }}
    >
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <FontAwesomeIcon icon={faCircleCheck} style={{ height: "0.875rem" }} />
        <span>
          QR Code lido · NFC-e {note?.number}
          {note?.storeName ? ` · ${note.storeName}` : ""}
        </span>
      </div>

      <p className="text-sm text-stone-600">
        A SEFAZ pede um código de segurança para liberar a nota. Digite os caracteres da imagem:
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-[60px] w-[220px] items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white">
          {captcha
            ? <img src={captcha} alt="Código de segurança da SEFAZ" className="h-[50px] w-[200px] object-contain" />
            : <span className="text-xs text-stone-400">Carregando…</span>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={busy}>
          <FontAwesomeIcon icon={faRotateRight} style={{ height: "0.875rem" }} /> Outra imagem
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
          maxLength={6}
          placeholder="Código"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Código de segurança"
          aria-invalid={!!error}
          className={`max-w-[12rem] font-mono text-lg tracking-[0.3em] ${error ? "border-rose-300" : ""}`}
        />
        <Button type="submit" disabled={busy || !code.trim()}>
          {busy ? "Lendo nota…" : <>Continuar <FontAwesomeIcon icon={faArrowRight} style={{ height: "0.875rem" }} /></>}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}

      <p className="border-t border-stone-100 pt-3 text-xs text-stone-400">
        Tem o link da nota (app ou e-mail Nota Potiguar)?{" "}
        <button type="button" onClick={onUseLink} className="font-medium text-stone-700 underline hover:text-stone-900">
          Cole o link e pule esta etapa →
        </button>
      </p>
    </form>
  );
}
