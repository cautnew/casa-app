import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faUsers } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { MEMBER_COLORS } from "../constants.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input } from "../components/ui/Input.jsx";
import { Modal, ConfirmDialog } from "../components/ui/Modal.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";

export function Members() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const save = () => {
    if (!modal.name?.trim()) return toast("Informe um nome", "error");
    if (modal.id) {
      dispatch({ type: "EDIT_MEMBER", payload: modal });
      toast("Integrante atualizado");
    } else {
      dispatch({ type: "ADD_MEMBER", payload: { name: modal.name.trim(), color: modal.color } });
      toast("Integrante adicionado");
    }
    setModal(null);
  };

  return (
    <div>
      <SectionHeader
        title="Integrantes"
        subtitle="Todas as compras e contas são divididas igualmente entre eles"
        action={
          <Button onClick={() => setModal({ name: "", color: MEMBER_COLORS[state.members.length % MEMBER_COLORS.length] })}>
            <FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Adicionar
          </Button>
        }
      />

      {state.members.length === 0 ? (
        <EmptyState
          icon={faUsers}
          title="Nenhum integrante"
          message="Adicione os moradores para começar a dividir as despesas."
          action={
            <Button onClick={() => setModal({ name: "", color: MEMBER_COLORS[0] })}>
              <FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Adicionar integrante
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.members.map((m) => (
            <Card key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white ${m.color}`}>
                  {m.name[0]?.toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-stone-800">{m.name}</p>
                  <p className="text-xs text-stone-400">Participação: {(100 / state.members.length).toFixed(0)}%</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setModal(m)} aria-label="Editar">
                  <FontAwesomeIcon icon={faPen} style={{ height: "1rem" }} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirm(m)} aria-label="Remover">
                  <FontAwesomeIcon icon={faTrash} style={{ height: "1rem" }} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Editar integrante" : "Novo integrante"}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Nome">
              <Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="Ex.: Ana" autoFocus />
            </Field>
            <Field label="Cor">
              <div className="flex gap-2">
                {MEMBER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setModal({ ...modal, color: c })}
                    className={`h-8 w-8 rounded-full ${c} ${modal.color === c ? "ring-2 ring-stone-900 ring-offset-2" : ""}`}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Remover integrante"
        message={`Remover ${confirm?.name}? Os valores por morador serão recalculados automaticamente.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { dispatch({ type: "REMOVE_MEMBER", id: confirm.id }); toast("Integrante removido"); setConfirm(null); }}
      />
    </div>
  );
}
