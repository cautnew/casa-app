import { useState } from "react";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input } from "../components/ui/Input.jsx";
import { useAuth } from "../store/AuthContext.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { slugify } from "../utils/format.js";

export function Settings() {
  const { user, updateAccount } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function fieldError(name) {
    return errors[name]?.[0];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await updateAccount({
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password || undefined,
      });
      setForm((f) => ({ ...f, password: "" }));
      toast("Dados da casa atualizados");
    } catch (err) {
      setErrors(err.errors ?? {});
      toast(err.message ?? "Não foi possível salvar as alterações.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Configurações" subtitle="Dados de acesso da sua casa" />

      <Card className="max-w-md p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome da casa" htmlFor="settings-name">
            <Input
              id="settings-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            {fieldError("name") && <p className="text-xs text-rose-600">{fieldError("name")}</p>}
          </Field>

          <Field label="Nome de usuário" htmlFor="settings-username">
            <Input
              id="settings-username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: slugify(e.target.value) }))}
              required
            />
            {fieldError("username") && <p className="text-xs text-rose-600">{fieldError("username")}</p>}
          </Field>

          <Field label="E-mail" htmlFor="settings-email">
            <Input
              id="settings-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            {fieldError("email") && <p className="text-xs text-rose-600">{fieldError("email")}</p>}
          </Field>

          <Field label="Nova senha (6 dígitos)" htmlFor="settings-password">
            <Input
              id="settings-password"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="new-password"
              placeholder="Deixe em branco para manter a atual"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value.replace(/\D/g, "").slice(0, 6) }))
              }
            />
            {fieldError("password") && <p className="text-xs text-rose-600">{fieldError("password")}</p>}
          </Field>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
