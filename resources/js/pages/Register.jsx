import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input } from "../components/ui/Input.jsx";
import { useAuth } from "../store/AuthContext.jsx";

const EMPTY = { name: "", username: "", email: "", password: "" };

export function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setErrors(err.errors ?? { name: [err.message ?? "Não foi possível criar a casa."] });
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(name) {
    return errors[name]?.[0];
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-900 text-white">
            <FontAwesomeIcon icon={faDollarSign} style={{ height: "1.375rem", width: "1.375rem" }} />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Cadastrar sua casa</p>
            <p className="text-xs text-stone-400">Cada casa tem seus próprios dados, isolados</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome da casa" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            {fieldError("name") && <p className="text-xs text-rose-600">{fieldError("name")}</p>}
          </Field>

          <Field label="Usuário" htmlFor="username">
            <Input
              id="username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
            {fieldError("username") && <p className="text-xs text-rose-600">{fieldError("username")}</p>}
          </Field>

          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            {fieldError("email") && <p className="text-xs text-rose-600">{fieldError("email")}</p>}
          </Field>

          <Field label="Senha (6 dígitos)" htmlFor="password">
            <Input
              id="password"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value.replace(/\D/g, "").slice(0, 6) }))
              }
              required
            />
            {fieldError("password") && <p className="text-xs text-rose-600">{fieldError("password")}</p>}
          </Field>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Criando…" : "Criar casa"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Já tem uma casa cadastrada?{" "}
          <Link to="/login" className="font-medium text-stone-900 hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
