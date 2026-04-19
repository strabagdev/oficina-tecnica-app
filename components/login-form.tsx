"use client";

import { useActionState, useState } from "react";
import {
  loginAction,
  requestAccessAction,
  type LoginActionState,
  type RequestAccessActionState,
} from "@/app/actions/auth";

const initialState: LoginActionState = {};
const initialRequestState: RequestAccessActionState = {};
type LoginFormTab = "login" | "request";

export function LoginForm() {
  const [activeTab, setActiveTab] = useState<LoginFormTab>("login");
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const [requestState, requestFormAction, requestPending] = useActionState(
    requestAccessAction,
    initialRequestState,
  );

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1"
        role="tablist"
        aria-label="Modo de acceso"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "login"}
          onClick={() => setActiveTab("login")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "login"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Ingresar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "request"}
          onClick={() => setActiveTab("request")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "request"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Solicitar acceso
        </button>
      </div>

      {activeTab === "login" ? (
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="email"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@empresa.cl"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
            />
          </div>

          <div className="space-y-2">
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Contrasena
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Tu contrasena"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
            />
          </div>

          {state.error ? (
            <p
              aria-live="polite"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate-600">
            Registra tu solicitud. La cuenta quedara creada y un administrador
            debera aprobarla antes de que puedas ingresar.
          </p>

          <form action={requestFormAction} className="space-y-5">
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="request-name"
              >
                Nombre
              </label>
              <input
                id="request-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Nombre completo"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="request-email"
              >
                Correo
              </label>
              <input
                id="request-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="usuario@empresa.cl"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="request-password"
                >
                  Contrasena
                </label>
                <input
                  id="request-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Minimo 8 caracteres"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="request-confirm-password"
                >
                  Confirmar contrasena
                </label>
                <input
                  id="request-confirm-password"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Repite la contrasena"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
            </div>

            {requestState.error ? (
              <p
                aria-live="polite"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {requestState.error}
              </p>
            ) : null}

            {requestState.success ? (
              <p
                aria-live="polite"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {requestState.success}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={requestPending}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {requestPending ? "Enviando solicitud..." : "Solicitar acceso"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
