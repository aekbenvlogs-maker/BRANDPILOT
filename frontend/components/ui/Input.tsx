"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/ui/Input.tsx
// ============================================================

import React, { forwardRef } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  register?: UseFormRegisterReturn;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      register,
      id,
      className = "",
      ...props
    },
    ref,
  ) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-gray-400">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            className={[
              "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900",
              "placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
              "dark:bg-gray-800 dark:text-white dark:border-gray-600",
              error ? "border-red-500 focus:ring-red-500" : "border-gray-300",
              leftIcon ? "pl-9" : "",
              rightIcon ? "pr-9" : "",
              className,
            ].join(" ")}
            {...register}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute right-3 text-gray-400">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-red-500"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-gray-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// InputGroup — prefix / suffix wrapper
// ---------------------------------------------------------------------------

interface InputGroupProps {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}

export function InputGroup({ prefix, suffix, children }: InputGroupProps) {
  return (
    <div className="flex items-center rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden dark:border-gray-600">
      {prefix && (
        <span className="flex items-center bg-gray-50 px-3 py-2 text-sm text-gray-500 border-r border-gray-300 dark:bg-gray-700 dark:border-gray-600">
          {prefix}
        </span>
      )}
      <div className="flex-1 [&_input]:border-0 [&_input]:ring-0 [&_input]:focus:ring-0">
        {children}
      </div>
      {suffix && (
        <span className="flex items-center bg-gray-50 px-3 py-2 text-sm text-gray-500 border-l border-gray-300 dark:bg-gray-700 dark:border-gray-600">
          {suffix}
        </span>
      )}
    </div>
  );
}

export default Input;
