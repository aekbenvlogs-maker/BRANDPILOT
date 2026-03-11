// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useContentFormatter.ts
// ============================================================
import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { apiPost } from "@/utils/api";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
export type ContentPlatform = "instagram" | "tiktok" | "youtube" | "x" | "linkedin";

export interface PlatformContent {
  platform: ContentPlatform;
  text: string;
  hashtags: string[];
  char_count: number;
  char_limit: number;
  cta?: string;
}

export interface FormattedContent {
  brief: string;
  platforms: Record<ContentPlatform, PlatformContent>;
  generated_at: string;
}

interface FormatRequest {
  brief: string;
  tone?: string;
  target_platforms: ContentPlatform[];
  project_id?: string;
}

interface HashtagRequest {
  text: string;
  platform: ContentPlatform;
  count?: number;
}

interface HashtagResponse {
  hashtags: string[];
  platform: ContentPlatform;
}

// ──────────────────────────────────────────────────────────────
// useFormatContent
// ──────────────────────────────────────────────────────────────
export function useFormatContent() {
  const { mutate: globalMutate } = useSWRConfig();
  const [isFormatting, setIsFormatting] = useState(false);
  const [result, setResult] = useState<FormattedContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const format = useCallback(
    async (req: FormatRequest) => {
      setIsFormatting(true);
      setError(null);
      try {
        const data = await apiPost<FormattedContent>("/api/v1/content/format", req);
        setResult(data);
        // Invalide le cache SWR du contenu (clé dynamique par campaign_id —
        // on invalide le pattern pour couvrir toutes les campagnes)
        await globalMutate((key) => typeof key === "string" && key.startsWith("/api/v1/content/"), undefined, { revalidate: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la génération");
      } finally {
        setIsFormatting(false);
      }
    },
    [globalMutate]
  );

  const updatePlatformText = useCallback(
    (platform: ContentPlatform, text: string) => {
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          platforms: {
            ...prev.platforms,
            [platform]: {
              ...prev.platforms[platform],
              text,
              char_count: text.length,
            },
          },
        };
      });
    },
    []
  );

  const updatePlatformHashtags = useCallback(
    (platform: ContentPlatform, hashtags: string[]) => {
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          platforms: {
            ...prev.platforms,
            [platform]: {
              ...prev.platforms[platform],
              hashtags,
            },
          },
        };
      });
    },
    []
  );

  return { format, isFormatting, result, error, updatePlatformText, updatePlatformHashtags };
}

// ──────────────────────────────────────────────────────────────
// useGenerateHashtags
// ──────────────────────────────────────────────────────────────
export function useGenerateHashtags() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (req: HashtagRequest) => {
    setIsGenerating(true);
    setError(null);
    try {
      const data = await apiPost<HashtagResponse>("/api/v1/content/hashtags", req);
      setHashtags(data.hashtags);
      return data.hashtags;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur hashtags");
      return [];
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating, hashtags, error };
}
