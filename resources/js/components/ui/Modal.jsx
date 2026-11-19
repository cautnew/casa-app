import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { Button } from "./Button.jsx";

/**
 * Modal acessível: fecha com Escape, clique no backdrop e botão X.
 * stickyFooter mantém as ações visíveis ao rolar conteúdos longos (útil no celular).
 */
export function Modal({ open, onClose, title, children, footer, wide, stickyFooter }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[100dvh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <FontAwesomeIcon icon={faXmark} style={{ height: "1rem", width: "1rem" }} />
          </Button>
        </div>
        {children}
        {footer && (
          <div className={stickyFooter
            ? "sticky bottom-0 -mx-6 -mb-6 mt-6 flex justify-end gap-2 rounded-b-3xl border-t border-stone-100 bg-white px-6 py-4"
            : "mt-6 flex justify-end gap-2"}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Diálogo de confirmação reutilizável (usado antes de exclusões). */
export function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm}>Excluir</Button>
        </>
      }
    >
      <p className="text-sm text-stone-600">{message}</p>
    </Modal>
  );
}
