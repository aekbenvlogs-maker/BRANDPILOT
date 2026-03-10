"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/ui/EmptyState.tsx
// ============================================================

import React from "react";
import { Button } from "@/components/ui/Button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className,
      ].join(" ")}
    >
      {icon && (
        <span
          className="mb-4 text-5xl text-gray-300 dark:text-gray-600"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="primary"
          size="md"
          className="mt-6"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
