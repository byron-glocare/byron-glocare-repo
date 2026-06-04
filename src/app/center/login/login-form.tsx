"use client";

import { useActionState } from "react";

import { signInCenter, type SignInState } from "./actions";

export function LoginForm({
  from,
  initialError,
}: {
  from?: string;
  initialError?: string;
}) {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signInCenter,
    initialError ? { error: initialError } : undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {from ? <input type="hidden" name="from" value={from} /> : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-slate-300 px-3 py-2 text-base focus:border-coral-500 focus:outline-none focus:ring-2 focus:ring-coral-200"
          placeholder="ban@trungtam.vn"
        />
        {state?.fieldErrors?.email ? (
          <span className="text-xs text-red-600">
            {state.fieldErrors.email[0]}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Mật khẩu</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-slate-300 px-3 py-2 text-base focus:border-coral-500 focus:outline-none focus:ring-2 focus:ring-coral-200"
        />
        {state?.fieldErrors?.password ? (
          <span className="text-xs text-red-600">
            {state.fieldErrors.password[0]}
          </span>
        ) : null}
      </label>

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-slate-900 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
