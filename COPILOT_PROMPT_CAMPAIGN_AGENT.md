# 🧠 COPILOT PROMPT — CAMPAIGN AGENT BRANDPILOT
## Méthode : RACI · Chain-of-Thought · Few-Shot · Hard Constraints
## Niveau : Senior Software Engineer — Production-Grade
## Usage : Coller dans GitHub Copilot Chat (VSCode) · `@workspace` activé

---

> **COMMENT UTILISER CE FICHIER**
> 1. Ouvrir Copilot Chat dans VSCode (`Ctrl+Alt+I`)
> 2. Taper `@workspace` pour activer le contexte du repo
> 3. Coller le bloc `## PROMPT PRINCIPAL` en entier
> 4. Pour chaque fichier à générer, coller le bloc `## PROMPT FICHIER` correspondant
> 5. Ne jamais coller plusieurs blocs en même temps — un fichier à la fois

---

## ══════════════════════════════════════════════════════════════
## PROMPT PRINCIPAL — CONTEXTE GLOBAL (coller UNE FOIS en premier)
## ══════════════════════════════════════════════════════════════

```
@workspace

## ROLE
Tu es un Senior Software Engineer Python/TypeScript avec 10 ans d'expérience
sur des systèmes distribués, des pipelines IA asynchrones et des architectures
microservices production-grade. Tu maîtrises FastAPI, Celery, SQLAlchemy 2.0,
Next.js 14 App Router, et les APIs sociales (Meta Graph, TikTok, YouTube, X).

Tu codes comme si ce projet allait être audité par une équipe senior :
- Zéro dette technique acceptée
- Tout est typé strictement (mypy strict côté Python, TypeScript strict côté front)
- Chaque fonction a une docstring Google-style + type hints complets
- Chaque fichier a le header standard du projet en première ligne
- Les fonctions font ≤ 50 lignes, les classes ont une responsabilité unique (SRP)
- Les erreurs sont toujours gérées explicitement, jamais ignorées silencieusement

## PROJET : BRANDPILOT — Campaign Agent
BRANDPILOT est une plateforme SaaS d'automatisation marketing IA.
Le Campaign Agent est son orchestrateur central : il transforme UN prompt
en langage naturel en une campagne sociale complète.

## STACK TECHNIQUE IMPOSÉE (ne pas dévier)
- Backend  : Python 3.11, FastAPI (async), SQLAlchemy 2.0 async, Pydantic v2
- Queue    : Celery 5 + Redis 7, pattern chord/chain pour parallélisme
- DB       : PostgreSQL (prod) / SQLite (dev), migrations Alembic
- IA       : OpenAI GPT-4 (client configuré dans configs/ai_config.py)
- Frontend : Next.js 14 App Router, React 18, TypeScript strict, Tailwind CSS
- Auth     : JWT RS256, tokens stockés côté client (httpOnly cookie)
- Encrypt  : Fernet pour tous les tokens OAuth et champs PII
- Tests    : pytest + pytest-asyncio, coverage ≥ 80%
- Qualité  : ruff + pylint ≥ 8.5 + mypy strict + black

## ARCHITECTURE DU CAMPAIGN AGENT
Le Campaign Agent suit ce pipeline strict en 10 étapes :

  [1] parse_intent()        → Extrait paramètres du prompt via GPT-4 JSON mode
  [2] build_context()       → Charge brand_analysis + social_accounts depuis DB
  [3] plan_execution()      → Décide microservices à appeler + ordre
  [4] Celery chord (//):
       ├── analyze_brand()       → bs_brand_analyzer
       ├── analyze_audience()    → bs_audience_insights
       └── suggest_influencers() → bs_audience_insights
  [5] generate_content()    → bs_ai_text (captions par plateforme)
  [6] generate_visuals()    → bs_ai_image (visuels multi-format)
  [7] compute_schedule()    → bs_audience_insights (best time to post)
  [8] build_plan()          → Construit le planning éditorial complet
  ⏸️  STATUS → "pending_validation" (BLOQUANT — jamais auto-publié)
  [9] publish()             → bs_social_publisher + Celery Beat
      (UNIQUEMENT après approve_and_schedule() appelé par l'utilisateur)
  [10] collect_analytics()  → bs_analytics (collecte 24h après publication)

## RÈGLE DE SÉCURITÉ ABSOLUE — HUMAN-IN-THE-LOOP
  ⛔ JAMAIS de publication sans validation manuelle explicite.
  Le statut "pending_validation" doit être vérifié à 3 niveaux :
    1. Base de données  : status check AVANT tout insert dans celery_beat_schedule
    2. Worker Celery    : status check AU MOMENT d'exécuter publish_post_at_scheduled_time()
    3. Endpoint API     : POST /campaigns/{id}/publish → HTTP 403 si status != "approved"

## MODÈLES DE DONNÉES CLÉS

### CampaignIntent (dataclass Python)
  platform: str              # "instagram"|"tiktok"|"youtube"|"x"|"multi"
  audience_age: str          # "25-35"
  audience_gender: str       # "female"|"male"|"all"
  audience_csp: str          # "csp+"|"standard"|"all"
  budget_influencer: float   # 500.0
  duration_days: int         # 14
  objective: str             # "awareness"|"conversion"|"engagement"
  product_description: str   # "sac en cuir premium"
  tone_override: str | None  # None = utiliser le ton détecté de la brand

### SocialPost (ORM SQLAlchemy)
  id: UUID
  campaign_id: UUID → campaigns.id
  platform: str
  content_text: str (Fernet encrypted si contient PII)
  media_urls: JSONB           # liste URLs S3
  hashtags: JSONB
  scheduled_at: datetime (UTC)
  published_at: datetime | None
  status: str                 # "draft"|"pending_validation"|"approved"|"scheduled"|"published"|"failed"|"cancelled"
  platform_post_id: str | None

### CampaignValidation (ORM)
  id: UUID
  campaign_id: UUID
  user_id: UUID
  action: str                 # "approved"|"rejected"|"modified"
  modified_posts: JSONB
  validated_at: datetime

## CONVENTIONS DE CODE OBLIGATOIRES

### Python
  - Header de fichier (ligne 1-4) :
    # -*- coding: utf-8 -*-
    # BRANDPILOT — [nom du module]
    # [description courte]
    # Copyright © 2026 BRANDPILOT Dev Team — MIT License

  - Imports : stdlib → third-party → local (séparés par ligne vide)
  - Logging : loguru uniquement, jamais print()
  - Exceptions : classes custom héritant de BrandpilotError (base dans backend/exceptions.py)
  - Async : toutes les fonctions I/O sont async def, jamais de blocking call dans une coroutine
  - Celery tasks : décorateur @celery_app.task(bind=True, max_retries=3, default_retry_delay=60)

### TypeScript / React
  - Jamais de `any` explicite
  - Props toujours typées avec interface (pas type)
  - Hooks custom dans frontend/hooks/ préfixés use*
  - Appels API via frontend/utils/api.ts (wrapper fetch centralisé)
  - Gestion erreur : React Error Boundary sur chaque page
  - État serveur : SWR ou React Query, jamais useState pour les données distantes

## STRUCTURE DES FICHIERS À CRÉER
  microservices/
  └── campaign_agent/
      ├── __init__.py
      ├── agent.py           # CampaignAgent class — orchestrateur principal
      ├── intent_parser.py   # parse_intent() — GPT-4 JSON mode
      ├── context_builder.py # build_context() — charge brand + comptes
      ├── execution_planner.py # plan_execution() — routing microservices
      ├── campaign_builder.py  # build_plan() — assemble le planning
      ├── worker.py          # Celery tasks (chord/chain)
      └── api.py             # FastAPI router /api/v1/campaigns/agent/*

  backend/api/v1/
  └── routes/campaigns_agent.py  # Endpoints REST

  frontend/
  ├── app/campaigns/
  │   ├── new/page.tsx           # Page prompt → génération
  │   └── [id]/validate/page.tsx # Page validation Human-in-the-loop
  ├── components/campaigns/
  │   ├── CampaignPromptInput.tsx
  │   ├── ValidationBoard.tsx    # Board complet de validation
  │   ├── PostPreviewCard.tsx    # Carte post avec actions
  │   ├── EditorialCalendar.tsx  # Calendrier drag & drop
  │   └── MobilePreview.tsx     # Prévisualisation smartphone
  └── hooks/
      ├── useCampaignAgent.ts
      └── useCampaignValidation.ts

  tests/
  ├── microservices/test_campaign_agent.py
  └── backend/test_campaigns_agent_routes.py

Tu as compris le contexte complet. Attends mes instructions fichier par fichier.
Réponds "CONTEXTE CHARGÉ ✅ — Prêt à générer fichier par fichier." et rien d'autre.
```

---

## ══════════════════════════════════════════════════════════════
## PROMPTS PAR FICHIER — À coller UN PAR UN après le prompt principal
## ══════════════════════════════════════════════════════════════

---

### ▶ FICHIER 1 — `microservices/campaign_agent/intent_parser.py`

```
Génère le fichier complet `microservices/campaign_agent/intent_parser.py`.

## CE QUE CE FICHIER DOIT FAIRE
Extraire les paramètres d'une campagne depuis un prompt en langage naturel,
en utilisant GPT-4 en mode JSON strict (response_format={"type": "json_object"}).

## CONTRAINTES TECHNIQUES
- Utilise le client OpenAI de `configs/ai_config.py` (ne pas recréer de client)
- Retourne un objet `CampaignIntent` (dataclass, définie dans ce fichier)
- Si un champ est absent du prompt → utilise la valeur par défaut définie dans CampaignIntent
- Si le prompt est trop vague (< 3 champs détectés) → lève `AmbiguousPromptError`
  avec une liste de questions de clarification dans son message
- Température GPT-4 : 0.0 (déterministe, parseur pas créatif)
- Timeout : 10 secondes max
- La fonction principale est `parse_intent(prompt: str) -> CampaignIntent`

## CHAMPS DE CampaignIntent À EXTRAIRE
  platform: str = "multi"
  audience_age: str = "all"
  audience_gender: str = "all"
  audience_csp: str = "all"
  budget_influencer: float = 0.0
  duration_days: int = 14
  objective: str = "awareness"
  product_description: str = ""
  tone_override: str | None = None

## MAPPING SÉMANTIQUE (few-shot pour le system prompt GPT-4)
  "femmes"/"féminin"          → audience_gender = "female"
  "hommes"/"masculin"         → audience_gender = "male"
  "CSP+"/"cadres"             → audience_csp = "csp+"
  "étudiants"/"jeunes"        → audience_age = "18-25"
  "booster les ventes"/"ROI"  → objective = "conversion"
  "notoriété"/"visibilité"    → objective = "awareness"
  "engagement"/"communauté"   → objective = "engagement"
  "ton jeune"/"dynamique"     → tone_override = "energetic"
  "professionnel"/"B2B"       → tone_override = "professional"
  "inspirant"/"lifestyle"     → tone_override = "inspirational"

## GESTION DES ERREURS
  - AmbiguousPromptError(questions: list[str])  → prompt trop vague
  - IntentParseError(raw_response: str)          → GPT-4 retourne JSON invalide
  - OpenAITimeoutError()                          → timeout > 10s

## TESTS ATTENDUS (donne des exemples dans les docstrings)
  parse_intent("campagne Instagram sac cuir femmes 25-35 budget 500€")
  → CampaignIntent(platform="instagram", audience_gender="female",
                   audience_age="25-35", budget_influencer=500.0, ...)

  parse_intent("lance une campagne")
  → AmbiguousPromptError(questions=["Sur quelle plateforme ?", ...])

Génère le fichier complet, production-ready, avec :
- Header standard BRANDPILOT
- Imports propres
- Dataclass CampaignIntent avec Field() Pydantic si approprié
- Exceptions custom
- Docstrings Google-style sur chaque fonction et classe
- Type hints complets (mypy strict compatible)
- Logging loguru sur chaque étape clé
```

---

### ▶ FICHIER 2 — `microservices/campaign_agent/agent.py`

```
Génère le fichier complet `microservices/campaign_agent/agent.py`.

## CE QUE CE FICHIER DOIT FAIRE
Classe CampaignAgent : orchestrateur central du pipeline en 10 étapes.
Prend un prompt, retourne un campaign_id avec statut "pending_validation".

## MÉTHODES PUBLIQUES À IMPLÉMENTER

### build_campaign(prompt: str) -> str
  Pipeline principal. Retourne campaign_id (UUID str).
  1. parse_intent(prompt)           → CampaignIntent
  2. build_context(project_id)      → BrandContext
  3. plan_execution(intent, context) → ExecutionPlan
  4. Lance Celery chord :
       header = [
           analyze_brand.s(project_id),
           analyze_audience.s(intent.platform, intent.audience_age, intent.audience_gender),
           suggest_influencers.s(intent.budget_influencer, intent.platform),
       ]
       callback = build_campaign_plan.s(
           project_id=project_id,
           intent_dict=asdict(intent),
           status="pending_validation"   # ← IMMUABLE ICI
       )
  5. Persiste campaign en DB avec status="pending_validation"
  6. Publie event WebSocket "campaign.ready" pour notifier le frontend
  7. Retourne campaign_id

### approve_and_schedule(campaign_id: str, user_id: str) -> bool
  RÈGLE ABSOLUE : vérifier ownership (user_id == campaign.user_id) AVANT tout.
  1. Vérifie campaign.status == "pending_validation" → sinon InvalidStatusError
  2. Vérifie user_id == campaign.user_id → sinon UnauthorizedError
  3. UPDATE campaigns SET status="approved" WHERE id=campaign_id
  4. Pour chaque post approuvé :
       celery_app.send_task(
           "publish_post_at_scheduled_time",
           args=[post.id],
           eta=post.scheduled_at   # datetime UTC exact
       )
  5. Insère dans campaign_validations (audit trail)
  6. Retourne True

### reject_and_regenerate(campaign_id: str, post_id: str, feedback: str, user_id: str) -> SocialPost
  Régénère UN post spécifique.
  NE CHANGE PAS le statut de la campagne globale.
  Lance bs_ai_text.regenerate(post_id, feedback) de manière async.
  Retourne le nouveau SocialPost avec statut "pending_validation".

### cancel_campaign(campaign_id: str, user_id: str) -> bool
  Annule une campagne et tous ses posts non publiés.
  Révoque les tâches Celery Beat si eta > now() + 5min.
  Statut → "cancelled" pour campagne + posts non publiés.

## CONTRAINTES CRITIQUES
  - __init__ injecte les dépendances (db_session, celery_app, intent_parser, context_builder)
    → facilite les tests unitaires (pas d'import direct)
  - Toutes les méthodes sont async
  - Chaque étape est loguée avec loguru (level=INFO pour succès, ERROR pour échec)
  - En cas d'échec partiel du chord Celery → rollback DB + status="failed" + notification user
  - Le champ status ne peut JAMAIS passer à "scheduled" ou "published" depuis cette classe
    (seul publish_post_at_scheduled_time() dans worker.py peut le faire, après vérification)

## PATTERN D'INJECTION DE DÉPENDANCES
  class CampaignAgent:
      def __init__(
          self,
          db: AsyncSession,
          celery_app: Celery,
          intent_parser: IntentParser,
          context_builder: ContextBuilder,
      ) -> None:

Génère le fichier complet, production-ready.
```

---

### ▶ FICHIER 3 — `microservices/campaign_agent/worker.py`

```
Génère le fichier complet `microservices/campaign_agent/worker.py`.

## CE QUE CE FICHIER DOIT FAIRE
Définir toutes les Celery tasks du Campaign Agent.

## TASKS À IMPLÉMENTER

### analyze_brand(self, project_id: str) -> dict
  Appelle bs_brand_analyzer.service.analyze(project_id)
  Retry : max_retries=3, exponential backoff (60s, 120s, 240s)
  Retourne : {"tone": str, "colors": list, "keywords": list, "niche": str}

### analyze_audience(self, platform: str, age_range: str, gender: str) -> dict
  Appelle bs_audience_insights.service.analyze(...)
  Retourne : {"best_times": list[dict], "engagement_benchmark": float}

### suggest_influencers(self, budget: float, platform: str) -> list[dict]
  Appelle bs_audience_insights.service.find_influencers(...)
  Retourne : liste de {"username": str, "followers": int, "er": float, "price_estimate": float}

### build_campaign_plan(self, results: list, project_id: str, intent_dict: dict, status: str) -> str
  Callback du chord (reçoit results = liste des retours des 3 tasks parallèles).
  1. Déstructure results[0] (brand), results[1] (audience), results[2] (influenceurs)
  2. Calcule le planning éditorial (nb posts, fréquence, formats par jour)
  3. Lance en chaîne :
       chain(
           generate_all_captions.s(intent_dict, brand_data),
           generate_all_visuals.s(),
           assemble_final_plan.s(project_id, status)
       ).apply_async()
  4. Retourne campaign_id

### generate_all_captions(self, intent_dict: dict, brand_data: dict) -> dict
  Pour chaque post du planning, génère la caption adaptée à la plateforme.
  Appelle bs_ai_text.service.generate_caption(platform, brief, tone, brand_data)
  Retourne : {"posts": [{"id": str, "platform": str, "caption": str, "hashtags": list}]}

### generate_all_visuals(self, captions_data: dict) -> dict
  Pour chaque post, génère le visuel au bon format.
  Appelle bs_ai_image.service.generate(prompt, format_size)
  Format mapping :
    instagram_feed  → "1080x1080"
    instagram_story → "1080x1920"
    tiktok          → "1080x1920"
    youtube         → "1280x720"
    x               → "1200x675"
  Retourne : {"posts": [..., "media_url": str (S3 URL)]}

### assemble_final_plan(self, visuals_data: dict, project_id: str, status: str) -> str
  Persiste tous les SocialPost en DB avec status="pending_validation".
  Met à jour Campaign.status = status (toujours "pending_validation" ici).
  Publie WebSocket event "campaign.generation_complete".
  Retourne campaign_id.

### publish_post_at_scheduled_time(self, post_id: str) -> None
  ⛔ TRIPLE VÉRIFICATION SÉCURITÉ OBLIGATOIRE :
    if post.status != "approved":
        logger.warning(f"SECURITY: Post {post_id} status={post.status}, publication bloquée")
        return
    if post.campaign.status not in ("approved", "active"):
        logger.warning(f"SECURITY: Campaign {post.campaign_id} non approuvée, publication bloquée")
        return
    if post.campaign.user_id not in get_authorized_users():
        raise UnauthorizedPublicationError(post_id)

  Puis publie via le bon publisher selon post.platform.
  En cas d'échec : self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
  Après succès : lance collect_post_analytics.apply_async(args=[post_id], countdown=86400)

### collect_post_analytics(self, post_id: str) -> None
  Collecte les métriques 24h après publication.
  Appelle bs_analytics.service.collect(post_id, platform)
  Persiste dans social_metrics.
  Si mi-campagne (J+7) → lance check_campaign_optimization(campaign_id)

## DÉCORATEUR STANDARD pour toutes les tasks
  @celery_app.task(
      bind=True,
      max_retries=3,
      default_retry_delay=60,
      acks_late=True,
      reject_on_worker_lost=True,
  )

Génère le fichier complet, production-ready.
```

---

### ▶ FICHIER 4 — `backend/api/v1/routes/campaigns_agent.py`

```
Génère le fichier complet `backend/api/v1/routes/campaigns_agent.py`.

## ENDPOINTS À CRÉER

### POST /api/v1/campaigns/agent/create
  Body : { "prompt": str, "project_id": str }
  Auth : JWT requis (dépendance get_current_user)
  Action : CampaignAgent.build_campaign(prompt)
  Response 202 : { "campaign_id": str, "status": "pending_validation", "estimated_ready_in_seconds": 120 }
  Erreurs :
    400 → AmbiguousPromptError (avec liste questions dans le body)
    422 → Prompt vide ou project_id invalide
    404 → Project non trouvé ou n'appartient pas à l'utilisateur

### GET /api/v1/campaigns/agent/{campaign_id}/status
  Auth : JWT requis + ownership check
  Response 200 : { "campaign_id": str, "status": str, "posts_count": int, "posts_ready": int }
  Polling-friendly : utilisé par le frontend toutes les 2s pendant la génération

### GET /api/v1/campaigns/agent/{campaign_id}/preview
  Auth : JWT requis + ownership check
  Retourne la campagne complète pour la page de validation :
  Response 200 :
    {
      "campaign": CampaignPreviewSchema,
      "posts": list[PostPreviewSchema],
      "influencers": list[InfluencerSuggestionSchema],
      "schedule": EditorialScheduleSchema
    }
  Erreur 403 si status != "pending_validation"

### POST /api/v1/campaigns/agent/{campaign_id}/approve
  Auth : JWT requis + ownership check STRICT
  Body : { "approved_post_ids": list[str] } (optionnel — si vide, approuve tout)
  Action : CampaignAgent.approve_and_schedule(campaign_id, user_id)
  Response 200 : { "campaign_id": str, "status": "approved", "first_post_scheduled_at": datetime }
  ⛔ Retourne 403 si status != "pending_validation"
  ⛔ Retourne 403 si user_id != campaign.user_id

### POST /api/v1/campaigns/agent/{campaign_id}/posts/{post_id}/regenerate
  Auth : JWT requis + ownership check
  Body : { "feedback": str }
  Action : CampaignAgent.reject_and_regenerate(campaign_id, post_id, feedback, user_id)
  Response 200 : PostPreviewSchema (nouveau post généré)
  NE CHANGE PAS le statut de la campagne

### DELETE /api/v1/campaigns/agent/{campaign_id}
  Auth : JWT requis + ownership check
  Action : CampaignAgent.cancel_campaign(campaign_id, user_id)
  Response 200 : { "cancelled": true, "posts_cancelled": int }
  ⛔ Retourne 409 si des posts sont déjà publiés (ne peut pas annuler le passé)

## SCHEMAS PYDANTIC V2 À DÉFINIR DANS CE FICHIER

  class CreateCampaignRequest(BaseModel):
      prompt: str = Field(..., min_length=10, max_length=1000)
      project_id: UUID

  class PostPreviewSchema(BaseModel):
      id: UUID
      platform: str
      content_text: str
      media_urls: list[str]
      hashtags: list[str]
      scheduled_at: datetime
      status: str

  class CampaignPreviewSchema(BaseModel):
      id: UUID
      status: str
      duration_days: int
      platform: str
      objective: str
      created_at: datetime

## MIDDLEWARES ET DÉPENDANCES
  - get_current_user : injecté sur tous les endpoints
  - get_campaign_or_404 : dépendance qui vérifie existence + ownership
  - rate_limiter : max 5 créations de campagne par utilisateur par heure

Génère le fichier complet, production-ready.
```

---

### ▶ FICHIER 5 — `frontend/components/campaigns/ValidationBoard.tsx`

```
Génère le fichier complet `frontend/components/campaigns/ValidationBoard.tsx`.

## CE QUE CE COMPOSANT DOIT FAIRE
Interface complète de validation Human-in-the-loop.
L'utilisateur voit, modifie, et approuve la campagne avant publication.

## PROPS
  interface ValidationBoardProps {
    campaignId: string
    onApproved: (campaignId: string) => void
    onCancelled: () => void
  }

## LAYOUT (3 zones)
  ┌─────────────────────────────────────────────────────────────┐
  │  Header : nom campagne · statut · durée · nb posts          │
  ├──────────────────────┬──────────────────────────────────────┤
  │  ZONE GAUCHE         │  ZONE DROITE                         │
  │  EditorialCalendar   │  PostPreviewCard (post sélectionné)  │
  │  (liste scrollable)  │  + actions : edit, regen, delete     │
  ├──────────────────────┴──────────────────────────────────────┤
  │  InfluencerSuggestions (bandeau horizontal scrollable)       │
  ├─────────────────────────────────────────────────────────────┤
  │  Footer : [Annuler] ············· [✅ Approuver et lancer]   │
  └─────────────────────────────────────────────────────────────┘

## COMPORTEMENTS REQUIS

### Polling du statut de génération
  Pendant que la campagne est générée (status="generating"), afficher :
  - Barre de progression avec les étapes (1→8) en temps réel
  - Polling GET /api/v1/campaigns/agent/{id}/status toutes les 2 secondes
  - Arrêter le polling quand status="pending_validation"
  - Utiliser useRef pour le cleanup (pas de memory leak)

### Sélection et prévisualisation d'un post
  - Cliquer sur un post dans le calendrier → l'affiche dans PostPreviewCard
  - PostPreviewCard montre : image, caption, hashtags, heure programmée, plateforme

### Modifier un post
  - Clic ✏️ → caption devient un <textarea> éditable inline
  - Auto-save optimiste après 1s de pause de frappe (debounce)
  - PATCH /api/v1/campaigns/agent/{id}/posts/{postId} avec le nouveau texte

### Régénérer un post
  - Clic 🔄 → ouvre un mini-modal avec un champ "feedback optionnel"
  - POST /api/v1/campaigns/agent/{id}/posts/{postId}/regenerate
  - Pendant la régénération : skeleton loader sur le PostPreviewCard
  - Remplace le post dans la liste à la réception de la réponse

### Approuver et lancer
  - Bouton "Approuver et lancer" → dialogue de confirmation (pas de modal complexe, juste un confirm sobre)
  - POST /api/v1/campaigns/agent/{id}/approve
  - En cas de succès → appel onApproved(campaignId) + toast succès
  - Bouton désactivé (disabled + spinner) pendant la requête

### Prévisualisation mobile
  - Bouton "Voir sur mobile" → ouvre MobilePreview en overlay
  - Simule le rendu exact de la plateforme (fond blanc IG, fond noir TikTok)

## CONTRAINTES TECHNIQUES
  - useCampaignValidation hook pour toute la logique (pas de fetch inline)
  - Pas de useState pour les données distantes → SWR avec mutate optimiste
  - Tailwind CSS uniquement, pas de style inline
  - Responsive : fonctionne sur tablette (768px) + desktop (1280px+)
  - Accessibilité : boutons avec aria-label, images avec alt, focus visible
  - Zéro `any` TypeScript

## ÉTATS DE L'INTERFACE
  "generating"          → Barre de progression + skeleton
  "pending_validation"  → Interface complète de validation
  "approving"           → Bouton Approuver en loading, reste de l'interface locked
  "approved"            → Message succès + redirection auto vers dashboard
  "error"               → Message d'erreur + bouton retry

Génère le fichier complet, production-ready.
```

---

### ▶ FICHIER 6 — `frontend/hooks/useCampaignAgent.ts`

```
Génère le fichier complet `frontend/hooks/useCampaignAgent.ts`.

## CE QUE CE HOOK DOIT FAIRE
Encapsuler toute la logique de création et suivi d'une campagne via l'agent.

## API DU HOOK
  const {
    createCampaign,    // (prompt: string, projectId: string) => Promise<string> (campaign_id)
    isCreating,        // boolean
    createError,       // string | null
    clarificationQuestions, // string[] | null (si prompt ambigu)
  } = useCampaignAgent()

## COMPORTEMENTS
  createCampaign() :
    1. POST /api/v1/campaigns/agent/create
    2. Si 400 (AmbiguousPromptError) → peuple clarificationQuestions, ne lance pas d'erreur
    3. Si 202 → retourne campaign_id
    4. Si autre erreur → peuple createError

  Gestion token JWT :
    - Lu depuis le cookie httpOnly via le wrapper api.ts
    - En cas de 401 → redirect vers /login automatiquement

Génère le fichier complet, production-ready avec TypeScript strict.
```

---

### ▶ FICHIER 7 — `tests/microservices/test_campaign_agent.py`

```
Génère le fichier complet `tests/microservices/test_campaign_agent.py`.

## TESTS À ÉCRIRE (coverage cible : 90%+)

### TestIntentParser
  test_parse_complete_prompt()
    → Vérifie extraction correcte de tous les champs depuis un prompt riche

  test_parse_minimal_prompt()
    → "campagne Instagram" → champs manquants = valeurs par défaut

  test_ambiguous_prompt_raises_error()
    → "lance une campagne" → AmbiguousPromptError avec questions

  test_invalid_gpt_response_raises_error()
    → Mock GPT-4 retournant du JSON invalide → IntentParseError

  test_platform_detection_multi()
    → "multi-plateforme" → platform="multi"

### TestCampaignAgent
  test_build_campaign_sets_pending_validation_status()
    → CRITIQUE : vérifier que status="pending_validation" en DB après build_campaign()

  test_build_campaign_never_sets_scheduled_status()
    → CRITIQUE : vérifier que "scheduled" n'apparaît JAMAIS après build_campaign()

  test_approve_and_schedule_requires_ownership()
    → approve_and_schedule(campaign_id, wrong_user_id) → UnauthorizedError

  test_approve_and_schedule_requires_pending_status()
    → approve_and_schedule sur campagne déjà "approved" → InvalidStatusError

  test_approve_creates_audit_trail()
    → Vérifier insertion dans campaign_validations après approbation

  test_cancel_revokes_celery_tasks()
    → Mock celery + vérifier revoke() appelé sur les tâches futures

### TestPublishWorker
  test_publish_blocked_if_not_approved()
    → CRITIQUE : publish_post_at_scheduled_time sur post status="pending_validation"
    → Vérifier que publish() du publisher N'EST PAS appelé

  test_publish_blocked_if_campaign_not_approved()
    → CRITIQUE : post approuvé mais campagne annulée → publication bloquée

  test_publish_retries_on_api_failure()
    → Mock publisher lançant une exception → vérifier self.retry() appelé

  test_analytics_scheduled_after_publish()
    → Vérifier collect_post_analytics.apply_async() appelé avec countdown=86400

## FIXTURES À CRÉER
  - fake_db_session : AsyncSession mocké avec AsyncMock
  - fake_campaign : Campaign ORM avec status="pending_validation"
  - fake_post : SocialPost avec status="pending_validation"
  - mock_openai : Mock du client OpenAI retournant un JSON valide
  - mock_celery : Mock de celery_app avec send_task, revoke

## CONVENTIONS DE TEST
  - pytest-asyncio pour tous les tests async
  - Pas d'appel réseau réel (tout mocké avec unittest.mock.AsyncMock)
  - Chaque test a une docstring qui décrit SON INVARIANT MÉTIER
  - Tests de sécurité marqués @pytest.mark.security

Génère le fichier complet, production-ready.
```

---

### ▶ FICHIER 8 — `alembic/versions/XXXX_campaign_agent_tables.py`

```
Génère le fichier complet de migration Alembic pour le Campaign Agent.

## CHANGEMENTS À APPLIQUER

### ALTER TABLE campaigns (colonnes à ajouter)
  source          VARCHAR(20)   NOT NULL DEFAULT 'manual'
  prompt_original TEXT          NULL
  intent_parsed   JSONB         NULL
  status          VARCHAR(30)   NOT NULL DEFAULT 'pending_validation'
  -- Contrainte CHECK sur status :
  -- CONSTRAINT chk_campaign_status CHECK (status IN (
  --   'pending_validation','approved','active','completed','cancelled','failed'
  -- ))

### CREATE TABLE social_posts
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  campaign_id       UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE
  platform          VARCHAR(20)  NOT NULL
  content_text      TEXT         NULL
  media_urls        JSONB        NOT NULL DEFAULT '[]'
  hashtags          JSONB        NOT NULL DEFAULT '[]'
  scheduled_at      TIMESTAMPTZ  NOT NULL
  published_at      TIMESTAMPTZ  NULL
  status            VARCHAR(30)  NOT NULL DEFAULT 'pending_validation'
  platform_post_id  VARCHAR(200) NULL
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  -- INDEX sur (campaign_id, status) pour les requêtes fréquentes
  -- INDEX sur (scheduled_at) pour Celery Beat

### CREATE TABLE campaign_validations
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  campaign_id     UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE
  user_id         UUID         NOT NULL REFERENCES users(id)
  action          VARCHAR(20)  NOT NULL  -- 'approved'|'rejected'|'modified'
  modified_posts  JSONB        NULL
  validated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()

### CREATE TABLE campaign_suggestions
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  campaign_id      UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE
  suggestion_type  VARCHAR(50)  NOT NULL
  suggestion_text  TEXT         NOT NULL
  applied          BOOLEAN      NOT NULL DEFAULT FALSE
  user_decision    VARCHAR(20)  NOT NULL DEFAULT 'pending'
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()

### CREATE TABLE social_metrics
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  post_id          UUID         NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE
  platform         VARCHAR(20)  NOT NULL
  impressions      INTEGER      NULL
  reach            INTEGER      NULL
  likes            INTEGER      NULL
  comments         INTEGER      NULL
  shares           INTEGER      NULL
  clicks           INTEGER      NULL
  engagement_rate  DECIMAL(5,2) NULL
  followers_gained INTEGER      NULL
  collected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()

## CONTRAINTES
  - La migration doit être réversible (downgrade() implémentée)
  - Utilise op.batch_alter_table pour ALTER TABLE (compatibilité SQLite dev)
  - Ajoute les index créés dans upgrade(), droppés dans downgrade()
  - revision et down_revision correctement renseignés

Génère le fichier complet, production-ready.
```

---

## ══════════════════════════════════════════════════════════════
## PROMPTS DE VÉRIFICATION — À utiliser après chaque génération
## ══════════════════════════════════════════════════════════════

### ✅ VÉRIFICATION SÉCURITÉ (coller après chaque fichier backend)
```
@workspace

Audite le fichier que tu viens de générer sur ces 4 points UNIQUEMENT.
Réponds en liste numérotée, une ligne par point :

1. HUMAN-IN-THE-LOOP : Y a-t-il un chemin de code où un post peut être publié
   sans que status == "approved" ait été vérifié ? Si oui, indique la ligne exacte.

2. OWNERSHIP CHECK : Chaque endpoint ou méthode qui modifie une campagne
   vérifie-t-il que user_id == campaign.user_id ? Si non, indique laquelle.

3. FERNET : Les tokens OAuth et champs PII sont-ils chiffrés avant persistance ?
   Si un champ sensible est stocké en clair, indique lequel.

4. CELERY STATUS : La task publish_post_at_scheduled_time() vérifie-t-elle
   post.status == "approved" EN PREMIER avant toute autre action ? Si non,
   corrige ce point immédiatement.
```

### ✅ VÉRIFICATION QUALITÉ (coller après chaque fichier)
```
@workspace

Vérifie le fichier que tu viens de générer sur ces 5 points.
Pour chaque point non respecté, corrige directement dans le code :

1. mypy strict : tous les paramètres et retours sont-ils typés ?
   Aucun `Any` implicite ou explicite.

2. Fonctions ≤ 50 lignes : y a-t-il des fonctions trop longues ?
   Si oui, propose un refactor avec extraction de méthode privée.

3. Docstrings Google-style : chaque fonction publique en a-t-elle une
   avec Args:, Returns:, Raises: si applicable ?

4. Logging : chaque chemin d'erreur log-t-il avec loguru (logger.error/warning) ?
   Aucun `pass` silencieux dans un except.

5. Header BRANDPILOT : les 4 lignes de header sont-elles présentes en ligne 1 ?
```

### ✅ VÉRIFICATION TESTS (coller après test_campaign_agent.py)
```
@workspace

Pour le fichier de tests généré, vérifie :

1. Les 2 tests de sécurité critiques sont-ils présents et corrects ?
   - test_build_campaign_never_sets_scheduled_status
   - test_publish_blocked_if_not_approved

2. Tous les tests async utilisent-ils @pytest.mark.asyncio ?

3. Aucun test ne fait d'appel réseau réel (tout est mocké) ?

4. Chaque test a-t-il exactement UN assert principal (pas de test fourre-tout) ?

Si l'un de ces points n'est pas respecté, corrige immédiatement.
```

---

## ══════════════════════════════════════════════════════════════
## ORDRE D'EXÉCUTION RECOMMANDÉ
## ══════════════════════════════════════════════════════════════

```
Étape  1 : Coller le PROMPT PRINCIPAL                → Charger le contexte
Étape  2 : FICHIER 8 (migration Alembic)             → La DB d'abord
Étape  3 : FICHIER 1 (intent_parser.py)              → La brique de base
Étape  4 : VÉRIFICATION QUALITÉ sur intent_parser
Étape  5 : FICHIER 2 (agent.py)                      → L'orchestrateur
Étape  6 : VÉRIFICATION SÉCURITÉ sur agent.py        → Critique
Étape  7 : FICHIER 3 (worker.py)                     → Les Celery tasks
Étape  8 : VÉRIFICATION SÉCURITÉ sur worker.py       → Critique
Étape  9 : FICHIER 4 (routes/campaigns_agent.py)     → L'API REST
Étape 10 : VÉRIFICATION SÉCURITÉ sur routes
Étape 11 : FICHIER 7 (tests)                         → Tests en dernier
Étape 12 : VÉRIFICATION TESTS
Étape 13 : FICHIER 5 (ValidationBoard.tsx)           → Frontend
Étape 14 : FICHIER 6 (useCampaignAgent.ts)           → Hook frontend
Étape 15 : make qa                                    → Validation finale
```

---

*Prompt engineered for GitHub Copilot Chat · @workspace mode · VSCode*
*Méthode : RACI + Chain-of-Thought + Few-Shot + Hard Constraints*
*BRANDPILOT Campaign Agent — Mars 2026*
