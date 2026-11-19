import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQrcode, faLink, faCircleInfo, faArrowLeft, faArrowRight, faTriangleExclamation, faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../store/StoreContext.jsx";
import { useToast } from "../../hooks/useToast.jsx";
import { apiFetch } from "../../utils/api.js";
import { formatBRL } from "../../utils/format.js";
import { fmtDate } from "../../utils/date.js";
import { lastTab } from "../../utils/nfce.js";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { QrScanner } from "./QrScanner.jsx";
import { NfceLinkInput } from "./NfceLinkInput.jsx";
import { SecurityCodeStep } from "./SecurityCodeStep.jsx";
import { NfceReview } from "./NfceReview.jsx";

const canUseCamera = () => typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

function splitEqually(members, total) {
  if (!members.length) return [];
  const each = +(total / members.length).toFixed(2);
  return members.map((m, i) => ({
    memberId: m.id,
    amount: i < members.length - 1 ? each : +(total - each * (members.length - 1)).toFixed(2),
  }));
}

/**
 * Importação de compra a partir de NFC-e.
 * Passos: ler (QR Code ou link) → [código de segurança, só no QR] → revisar → registrar.
 */
export function NfceImportModal({ open, onClose }) {
  const { state, reload } = useStore();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState("input"); // input | captcha | duplicate | review
  const [tab, setTab] = useState("link");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { message, retry? }
  const [lastInput, setLastInput] = useState("");
  const [captcha, setCaptcha] = useState(null); // { sessionId, captcha, note, error }
  const [duplicate, setDuplicate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null); // "discard" | "manualDuplicate"

  const reset = useCallback(() => {
    const saved = lastTab.get();
    setTab(saved === "link" || saved === "scan" ? (saved === "scan" && !canUseCamera() ? "link" : saved) : (canUseCamera() ? "scan" : "link"));
    setStep("input");
    setBusy(false);
    setError(null);
    setCaptcha(null);
    setDuplicate(null);
    setPreview(null);
    setForm(null);
    setConfirm(null);
  }, []);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  const chooseTab = (t) => { setTab(t); lastTab.set(t); setError(null); };

  const startReview = (p) => {
    if (p.alreadyImported) {
      setDuplicate(p.alreadyImported);
      setStep("duplicate");
      return;
    }
    setPreview(p);
    setForm({
      store: p.store.name,
      date: p.date,
      items: p.items.map((i) => ({ ...i, include: true })),
      memberPayments: splitEqually(state.members, p.paid),
    });
    setStep("review");
  };

  const handleReadResponse = (res) => {
    if (res.status === "duplicate") {
      setDuplicate(res.alreadyImported);
      setStep("duplicate");
    } else if (res.status === "captcha") {
      setCaptcha({ sessionId: res.sessionId, captcha: res.captcha, note: res.note, error: "" });
      setStep("captcha");
    } else {
      startReview(res.preview);
    }
  };

  const read = async (input) => {
    setLastInput(input);
    setBusy(true);
    setError(null);
    try {
      handleReadResponse(await apiFetch("POST", "/nfce/read", { input }));
    } catch (err) {
      setStep("input");
      setError({
        message: err.message || "Não foi possível ler a nota.",
        retry: err.code === "sefaz_unavailable" || !err.status || err.status >= 500,
      });
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (code) => {
    setBusy(true);
    try {
      handleReadResponse(await apiFetch("POST", "/nfce/captcha/submit", { sessionId: captcha.sessionId, code }));
    } catch (err) {
      if (err.code === "wrong_code") {
        setCaptcha((c) => ({ ...c, captcha: err.data.captcha, error: err.message }));
      } else if (err.code === "session_expired") {
        setStep("input");
        setError({ message: err.message });
      } else {
        setCaptcha((c) => ({ ...c, error: err.message || "Não foi possível ler a nota. Tente novamente." }));
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshCode = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("POST", "/nfce/captcha/refresh", { sessionId: captcha.sessionId });
      setCaptcha((c) => ({ ...c, captcha: res.captcha, error: "" }));
    } catch (err) {
      if (err.code === "session_expired") {
        setStep("input");
        setError({ message: err.message });
      } else {
        setCaptcha((c) => ({ ...c, error: err.message }));
      }
    } finally {
      setBusy(false);
    }
  };

  const validate = () => {
    if (!form.store.trim()) return "Informe o nome da loja.";
    if (!form.date) return "Informe a data da compra.";
    if (form.items.some((i) => !i.name.trim())) return "Todos os itens precisam de um nome.";
    if (form.items.some((i) => !(Number(i.quantity) > 0))) return "Confira as quantidades: todas precisam ser maiores que zero.";
    if (state.members.length > 0) {
      const paid = form.memberPayments.reduce((s, p) => s + (+p.amount || 0), 0);
      if (Math.abs(paid - preview.paid) > 0.01) return "A soma do que cada um pagou deve ser igual ao total pago.";
    }
    return null;
  };

  const register = async (skipManualCheck = false) => {
    const problem = validate();
    if (problem) return toast(problem, "error");
    if (preview.possibleManualDuplicate && !skipManualCheck) return setConfirm("manualDuplicate");

    setConfirm(null);
    setBusy(true);
    try {
      await apiFetch("POST", "/nfce/import", {
        accessKey: preview.accessKey,
        store: form.store.trim(),
        date: form.date,
        items: form.items.map((i) => ({
          index: i.index,
          include: i.include,
          name: i.name.trim(),
          category: i.category,
          unit: i.unit,
          quantity: Number(i.quantity),
          shoppingListItemId: i.shoppingListItemId ?? null,
        })),
        memberPayments: form.memberPayments.map((p) => ({ memberId: p.memberId, amount: +p.amount || 0 })),
      });
      await reload();
      toast(`Compra registrada a partir da NFC-e (${form.items.length} ${form.items.length === 1 ? "item" : "itens"})`);
      onClose();
    } catch (err) {
      if (err.code === "already_imported") {
        setDuplicate(err.data.alreadyImported);
        setStep("duplicate");
      } else if (err.code === "read_expired") {
        setStep("input");
        setError({ message: err.message });
      } else {
        toast(err.message || "Não foi possível registrar a compra.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const viewPurchase = (id) => {
    onClose();
    navigate(`/compras?compra=${id}`);
  };

  const requestClose = () => {
    if (step === "review" && !busy) return setConfirm("discard");
    onClose();
  };

  const stepLabel = step === "review" ? "Passo 2 de 2 · Revisar e confirmar" : step === "duplicate" ? "" : "Passo 1 de 2 · Ler a nota";

  const footer = step === "review" ? (
    <>
      <Button variant="outline" onClick={reset} disabled={busy}>
        <FontAwesomeIcon icon={faArrowLeft} style={{ height: "0.875rem" }} /> Voltar
      </Button>
      <Button onClick={() => register()} disabled={busy}>
        {busy ? "Registrando…" : "Registrar compra"}
      </Button>
    </>
  ) : null;

  return (
    <>
      <Modal open={open} onClose={requestClose} title="Importar nota fiscal" wide footer={footer} stickyFooter>
        {stepLabel && <p className="-mt-3 mb-4 text-xs text-stone-400">{stepLabel}</p>}

        {step === "input" && (
          <div className="space-y-4">
            <div role="tablist" aria-label="Como ler a nota" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
              {[
                ["scan", faQrcode, "Escanear QR Code"],
                ["link", faLink, "Colar link"],
              ].map(([id, icon, label]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={tab === id}
                  onClick={() => chooseTab(id)}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                >
                  <FontAwesomeIcon icon={icon} style={{ height: "0.875rem" }} /> {label}
                </button>
              ))}
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <FontAwesomeIcon icon={faTriangleExclamation} style={{ height: "0.875rem" }} className="mt-0.5" />
                <div className="flex-1">{error.message}</div>
                {error.retry && lastInput && (
                  <Button variant="outline" size="sm" onClick={() => read(lastInput)} disabled={busy}>
                    <FontAwesomeIcon icon={faRotateRight} style={{ height: "0.75rem" }} /> Tentar novamente
                  </Button>
                )}
              </div>
            )}

            {busy ? (
              <ReadingSkeleton />
            ) : tab === "scan" ? (
              <QrScanner onResult={read} onUseLink={() => chooseTab("link")} />
            ) : (
              <NfceLinkInput onSubmit={read} busy={busy} />
            )}
          </div>
        )}

        {step === "captcha" && captcha && (
          busy && !captcha.captcha ? <ReadingSkeleton /> : (
            <SecurityCodeStep
              note={captcha.note}
              captcha={captcha.captcha}
              error={captcha.error}
              busy={busy}
              onSubmit={submitCode}
              onRefresh={refreshCode}
              onUseLink={() => { setStep("input"); chooseTab("link"); }}
            />
          )
        )}

        {step === "duplicate" && duplicate && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-stone-800">
              <FontAwesomeIcon icon={faCircleInfo} className="text-sky-600" style={{ height: "1rem" }} />
              Esta nota já foi registrada
            </p>
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-sm font-semibold text-stone-800">{duplicate.store}</p>
              <p className="text-sm text-stone-600">{fmtDate(duplicate.date)} · {formatBRL(duplicate.total)} · {duplicate.itemsCount} itens</p>
              {duplicate.importedAt && (
                <p className="mt-1 text-xs text-stone-400">
                  Importada em {new Date(duplicate.importedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>
            <p className="text-xs text-stone-400">
              Para não contar a mesma compra duas vezes, uma nota só pode ser registrada uma vez. Se a importação anterior ficou errada, exclua a compra e importe de novo.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset}>Ler outra nota</Button>
              <Button onClick={() => viewPurchase(duplicate.id)}>
                Ver compra <FontAwesomeIcon icon={faArrowRight} style={{ height: "0.875rem" }} />
              </Button>
            </div>
          </div>
        )}

        {step === "review" && preview && form && (
          <NfceReview
            preview={preview}
            form={form}
            setForm={setForm}
            members={state.members}
            shoppingList={state.shoppingList}
            onViewPurchase={viewPurchase}
          />
        )}
      </Modal>

      <Modal
        open={confirm === "manualDuplicate"}
        onClose={() => setConfirm(null)}
        title="Possível compra repetida"
        footer={<>
          <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button onClick={() => register(true)}>Importar mesmo assim</Button>
        </>}
      >
        <p className="text-sm text-stone-600">
          Já existe uma compra registrada manualmente em {preview?.possibleManualDuplicate && fmtDate(preview.possibleManualDuplicate.date)} no
          mesmo valor ({preview?.possibleManualDuplicate && formatBRL(preview.possibleManualDuplicate.total)}). Se for a mesma compra,
          importar vai contá-la duas vezes. Importe só se forem compras diferentes.
        </p>
      </Modal>

      <Modal
        open={confirm === "discard"}
        onClose={() => setConfirm(null)}
        title="Descartar importação?"
        footer={<>
          <Button variant="outline" onClick={() => setConfirm(null)}>Continuar revisando</Button>
          <Button variant="danger" onClick={() => { setConfirm(null); onClose(); }}>Descartar</Button>
        </>}
      >
        <p className="text-sm text-stone-600">A compra ainda não foi registrada. Se sair agora, as alterações desta revisão serão perdidas.</p>
      </Modal>
    </>
  );
}

function ReadingSkeleton() {
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="text-sm text-stone-500">Lendo nota na SEFAZ…</p>
      <div className="h-16 animate-pulse rounded-xl bg-stone-100" />
      {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-stone-100" />)}
    </div>
  );
}
