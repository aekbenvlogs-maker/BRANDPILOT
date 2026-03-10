// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/planner/EditorialCalendar.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostCard } from "@/components/features/planner/PostCard";
import type { ScheduledPost, PostPlatform } from "@/hooks/useSocialCampaign";

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // ISO week: Mon=1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ──────────────────────────────────────────────────────────────
// EDITORIAL CALENDAR
// ──────────────────────────────────────────────────────────────
interface EditorialCalendarProps {
  posts: ScheduledPost[];
  filteredPlatforms: PostPlatform[];
  onMovePost: (postId: string, newScheduledAt: string) => Promise<void>;
  onPostClick?: (post: ScheduledPost) => void;
}

export function EditorialCalendar({ posts, filteredPlatforms, onMovePost, onPostClick }: EditorialCalendarProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [dragging, setDragging] = useState<ScheduledPost | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const visiblePosts = posts.filter(
    (p) => filteredPlatforms.length === 0 || filteredPlatforms.includes(p.platform)
  );

  const postsForDay = (day: Date): ScheduledPost[] =>
    visiblePosts
      .filter((p) => isSameDay(new Date(p.scheduled_at), day))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const handleDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    setDragging(post);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, dayISO: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(dayISO);
  };

  const handleDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragOverDay(null);
    if (!dragging) return;

    // Keep the same time, change the date
    const original = new Date(dragging.scheduled_at);
    const newDate = new Date(day);
    newDate.setHours(original.getHours(), original.getMinutes(), 0, 0);
    await onMovePost(dragging.id, newDate.toISOString());
    setDragging(null);
  };

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(getWeekStart(new Date()));

  const weekLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${addDays(weekStart, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div>
      {/* Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            aria-label="Semaine précédente"
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{weekLabel}</span>
          <button
            onClick={nextWeek}
            aria-label="Semaine suivante"
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Aujourd&apos;hui
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1 overflow-x-auto" role="grid" aria-label="Calendrier éditorial">
        {/* Headers */}
        {days.map((day, i) => {
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={i}
              role="columnheader"
              className={`py-2 text-center ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">{WEEKDAYS[i]}</p>
              <p className={`mt-0.5 text-sm font-bold ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-300"}`}>
                {day.getDate()}
              </p>
            </div>
          );
        })}

        {/* Day columns */}
        {days.map((day, i) => {
          const dayISO = day.toISOString().split("T")[0];
          const isToday = isSameDay(day, new Date());
          const isDragOver = dragOverDay === dayISO;
          const dayPosts = postsForDay(day);

          return (
            <div
              key={i}
              role="gridcell"
              onDragOver={(e) => handleDragOver(e, dayISO)}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => handleDrop(e, day)}
              className={`min-h-[120px] rounded-xl p-1.5 transition-colors ${
                isDragOver
                  ? "border-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10"
                  : isToday
                  ? "border border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/30 dark:bg-indigo-900/5"
                  : "border border-gray-50 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/20"
              }`}
              aria-label={`${WEEKDAYS[i]} ${day.getDate()}, ${dayPosts.length} publication(s)`}
            >
              <div className="space-y-1">
                {dayPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    compact
                    isDragging={dragging?.id === post.id}
                    onDragStart={handleDragStart}
                    onClick={onPostClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
