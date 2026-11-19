import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReceipt, faPen } from "@fortawesome/free-solid-svg-icons";
import { Modal } from "../ui/Modal.jsx";

/** Pergunta como registrar a compra: pela nota fiscal (recomendado) ou manualmente. */
export function PurchaseMethodChooser({ open, onClose, onNfce, onManual, manualHint }) {
  return (
    <Modal open={open} onClose={onClose} title="Finalizar compra">
      <p className="mb-4 text-sm text-stone-500">Como você quer registrar esta compra?</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Option
          icon={faReceipt}
          title="Com nota fiscal"
          text="Escaneie o QR Code ou cole o link da NFC-e e preenchemos tudo."
          badge="Recomendado"
          onClick={onNfce}
          autoFocus
        />
        <Option
          icon={faPen}
          title="Manualmente"
          text={manualHint ?? "Informe a loja e o preço de cada item marcado."}
          onClick={onManual}
        />
      </div>
    </Modal>
  );
}

function Option({ icon, title, text, badge, onClick, autoFocus }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 active:scale-[0.98]"
    >
      <span className="flex w-full items-center justify-between">
        <span className="rounded-xl bg-stone-100 p-2.5 text-stone-700 group-hover:bg-white">
          <FontAwesomeIcon icon={icon} style={{ height: "1.1rem", width: "1.1rem" }} />
        </span>
        {badge && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{badge}</span>}
      </span>
      <span className="text-sm font-semibold text-stone-800">{title}</span>
      <span className="text-xs text-stone-500">{text}</span>
    </button>
  );
}
