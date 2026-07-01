import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input } from "../components/ui/Input.jsx";
import { useAuth } from "../store/AuthContext.jsx";

export function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={location.state?.from ?? "/"} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form.login, form.password);
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err.errors?.login?.[0] ?? err.message ?? "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-900 text-white">
            <FontAwesomeIcon icon={faDollarSign} style={{ height: "1.375rem", width: "1.375rem" }} />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Entrar na sua casa</p>
            <p className="text-xs text-stone-400">Usuário ou e-mail + senha numérica</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Usuário ou e-mail" htmlFor="login">
            <Input
              id="login"
              autoComplete="username"
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              required
            />
          </Field>

          <Field label="Senha (6 dígitos)" htmlFor="password">
            <Input
              id="password"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value.replace(/\D/g, "").slice(0, 6) }))
              }
              required
            />
          </Field>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Ainda não tem uma casa cadastrada?{" "}
          <Link to="/registro" className="font-medium text-stone-900 hover:underline">
            Criar casa
          </Link>
        </p>
      </Card>
    </div>
  );
}
