"use server";

import { redirect } from "next/navigation";
import { deleteSession, loginWithPassword } from "@/lib/auth";

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Ingresa correo y contrasena para continuar.",
    };
  }

  const user = await loginWithPassword(email, password);

  if (!user) {
    return {
      error: "Credenciales invalidas o usuario no configurado.",
    };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
