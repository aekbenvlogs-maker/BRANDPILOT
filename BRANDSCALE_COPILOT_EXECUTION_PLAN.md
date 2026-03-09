# BRANDSCALE — PLAN D'EXÉCUTION COPILOT
**Repository : https://github.com/aekbenvlogs-maker/BRANDPILOT.git**
**Outil : GitHub Copilot Pro (VSCode)**
**Objectif : Tester, corriger et valider le projet étape par étape**

---

## COMMENT UTILISER CE PLAN

```
1. Ouvre ce fichier dans VSCode
2. Pour chaque étape :
   a. Lance la commande dans le terminal VSCode
   b. Si erreur → colle le prompt Copilot correspondant dans Copilot Chat (Ctrl+Shift+I)
   c. Attends la correction de Copilot
   d. Valide avec la commande de test
   e. Coche la case ✅ avant de passer à l'étape suivante
3. Ne jamais sauter une étape
4. make qa doit passer à zéro erreur à la fin de chaque phase
```

---

## SETUP INITIAL — À FAIRE UNE SEULE FOIS

```bash
# 1. Cloner le repo
git clone https://github.com/aekbenvlogs-maker/BRANDPILOT.git
cd BRANDPILOT

# 2. Ouvrir dans VSCode avec Copilot actif
code .

# 3. Vérifier que Copilot est actif
# → Icône Copilot en bas à droite de VSCode doit être VERTE
# → Si grise : Ctrl+Shift+P → "GitHub Copilot: Enable"

# 4. Créer et activer l'environnement Python
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# ou
.venv\Scripts\activate           # Windows

# 5. Installer les dépendances
pip install -e ".[dev]"

# 6. Vérifier l'installation
python --version    # doit afficher Python 3.11.x
pytest --version    # doit afficher pytest 7.x ou 8.x
black --version
ruff --version
mypy --version
```

**Checkpoint setup :**
```bash
python -c "import fastapi, sqlalchemy, celery, pydantic; print('✅ Dépendances OK')"
```

---

## PHASE 1 — DIAGNOSTIC INITIAL
### Objectif : cartographier l'état exact du projet avant toute modification

---

### Étape 1.1 — Lancer le diagnostic complet

```bash
make qa
```

> ⚠️ Ce premier `make qa` VA échouer — c'est normal et attendu.
> Il révèle tous les problèmes à corriger dans les phases suivantes.
> Copie l'output complet et garde-le pour référence.

**Résultat attendu :**
```
❌ Plusieurs erreurs — pipeline email cassé, scoring incomplet, tests en échec
```

---

### Étape 1.2 — Vérifier les imports microservices

```bash
python -c "from microservices.bs_email.service import send_email; print('OK')"
python -c "from microservices.bs_scoring.service import score_lead; print('OK')"
python -c "from microservices.bs_ai_text.service import generate_post; print('OK')"
```

**Si ModuleNotFoundError → prompt Copilot :**
```
Dans le terminal, j'obtiens ModuleNotFoundError sur les imports microservices.
Crée les fichiers __init__.py manquants dans tous les sous-dossiers de microservices/ :
microservices/__init__.py
microservices/bs_email/__init__.py
microservices/bs_scoring/__init__.py
microservices/bs_ai_text/__init__.py
microservices/bs_ai_image/__init__.py
microservices/bs_ai_video/__init__.py
```

**Validation :**
```bash
python -c "from microservices.bs_email.service import send_email; print('✅ Import OK')"
```

- [ ] Étape 1.2 validée

---

### Étape 1.3 — Lancer les tests existants et mesurer les échecs

```bash
pytest tests/ -v --tb=short 2>&1 | tee diagnostic_initial.txt
cat diagnostic_initial.txt | grep -E "FAILED|ERROR|PASSED" | head -30
```

**Résultat attendu (14 tests) :**
```
FAILED tests/microservices/test_bs_email_send_success.py        ← TypeError attendu
FAILED tests/microservices/test_bs_email_unsubscribe_rgpd_compliant.py
PASSED tests/backend/test_health_endpoint_returns_status.py     ← seul qui passe
...
```

> Archive ce résultat — il servira de comparaison après les corrections.

- [ ] Étape 1.3 validée

---

## PHASE 2 — CORRECTIONS CRITIQUES (BUGS BLOQUANTS)
### Objectif : débloquer le pipeline email — 6 corrections dans un seul fichier

**Fichier cible :** `microservices/bs_email/service.py`

---

### Étape 2.1 — Ouvrir le fichier dans VSCode

```bash
# Dans VSCode, ouvrir directement :
code microservices/bs_email/service.py
```

Puis ouvrir Copilot Chat : `Ctrl+Shift+I`

---

### Étape 2.2 — Corriger les 6 mismatches ORM

**Prompt Copilot Chat (copie-colle exactement) :**

```
Le fichier microservices/bs_email/service.py contient 6 erreurs de noms de champs ORM
qui causent des AttributeError et TypeError à l'exécution. Corrige-les dans l'ordre :

CORRECTION 1 — Ligne ~115 :
AVANT : recipient = lead.email_encrypted
APRÈS : from backend.api.v1.services.lead_service import decrypt_pii
        recipient = decrypt_pii(lead.email)

CORRECTION 2 — Ligne ~116 :
AVANT : msg["From"] = settings.smtp_from
APRÈS : msg["From"] = settings.smtp_from_email

CORRECTION 3 — Ligne ~75-82 dans create_sequence() :
AVANT : Email(id=str(uuid.uuid4()), body_html=body, status="pending", ...)
APRÈS : Email(id=uuid.uuid4(), body=body, ...)
(supprimer status= qui n'existe pas dans l'ORM, changer str en UUID natif)

CORRECTION 4 — Ligne ~119 :
AVANT : msg.attach(MIMEText(email.body_html, "html", "utf-8"))
APRÈS : msg.attach(MIMEText(email.body, "html", "utf-8"))

CORRECTION 5 — Ligne ~155 dans track_open() :
AVANT : values(opened=True)
APRÈS : values(opened_at=datetime.now(timezone.utc))

CORRECTION 6 — Ligne ~167 dans track_click() :
AVANT : values(clicked=True)
APRÈS : values(clicked_at=datetime.now(timezone.utc))

Après chaque correction, vérifie que la syntaxe Python est valide.
```

**Validation après corrections :**
```bash
python -c "
import ast, sys
with open('microservices/bs_email/service.py') as f:
    source = f.read()
try:
    ast.parse(source)
    print('✅ Syntaxe Python valide')
except SyntaxError as e:
    print(f'❌ Erreur syntaxe : {e}')
    sys.exit(1)
"
```

- [ ] Étape 2.2 validée — 6 corrections appliquées

---

### Étape 2.3 — Remplacer smtplib bloquant par aiosmtplib

**Prompt Copilot Chat :**

```
Dans microservices/bs_email/service.py, la fonction send_email() utilise
smtplib.SMTP() qui est bloquant dans un contexte async. Remplace-le par
aiosmtplib pour ne pas bloquer l'event loop :

AVANT :
import smtplib
with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
    server.login(settings.smtp_username, settings.smtp_password)
    server.send_message(msg)

APRÈS :
import aiosmtplib
async with aiosmtplib.SMTP(
    hostname=settings.smtp_host,
    port=settings.smtp_port,
    use_tls=settings.smtp_tls,
) as server:
    await server.login(settings.smtp_username, settings.smtp_password)
    await server.send_message(msg)

Ajoute aussi aiosmtplib dans pyproject.toml si absent.
```

**Validation :**
```bash
grep -n "smtplib.SMTP(" microservices/bs_email/service.py
# Doit retourner 0 résultat (smtplib.SMTP non-async supprimé)

grep -n "aiosmtplib" microservices/bs_email/service.py
# Doit retourner au moins 1 résultat
```

- [ ] Étape 2.3 validée

---

### Étape 2.4 — Corriger le test cassé

**Fichier :** `tests/microservices/test_bs_email_send_success.py`

**Prompt Copilot Chat :**

```
Dans tests/microservices/test_bs_email_send_success.py, le test construit
Lead(email_encrypted="test@example.com") mais le champ ORM s'appelle email
et stocke le ciphertext Fernet.

Corrige le test :
AVANT : lead = Lead(email_encrypted="test@example.com", ...)
APRÈS :
from backend.api.v1.services.lead_service import encrypt_pii
lead = Lead(email=encrypt_pii("test@example.com"), ...)
```

**Validation :**
```bash
pytest tests/microservices/test_bs_email_send_success.py -v
# Ne doit plus lever TypeError
```

- [ ] Étape 2.4 validée

---

### Validation Phase 2 complète

```bash
# Lancer tous les tests email
pytest tests/microservices/ -v --tb=short

# Vérifier la syntaxe de tous les fichiers modifiés
python -m py_compile microservices/bs_email/service.py && echo "✅ bs_email OK"
python -m py_compile tests/microservices/test_bs_email_send_success.py && echo "✅ test OK"

# Quality gate
make qa
```

**Résultat attendu Phase 2 :**
```
✅ 0 TypeError sur tests email
✅ smtplib.SMTP remplacé par aiosmtplib
✅ 6 corrections ORM appliquées
```

```bash
git add .
git commit -m "fix(email): Phase 2 — 6 ORM mismatches + aiosmtplib + test corrigé"
git push origin main
```

- [ ] Phase 2 validée et commitée

---

## PHASE 3 — RÉPARER LE SCORING
### Objectif : rendre le tier Hot accessible — score max actuel = 53/100

---

### Étape 3.1 — Ajouter les champs manquants au modèle Lead ORM

**Prompt Copilot Chat :**

```
Dans database/models_orm.py, la classe Lead est incomplète.
Les champs company_size, email_opens, email_clicks, page_visits
sont utilisés dans bs_scoring/service.py mais n'existent pas dans l'ORM.

Ajoute ces 4 champs à la classe Lead :

company_size: Mapped[Optional[str]] = mapped_column(
    String(64), nullable=True,
    comment="small / medium / large / enterprise"
)
email_opens: Mapped[int] = mapped_column(
    Integer, nullable=False, default=0
)
email_clicks: Mapped[int] = mapped_column(
    Integer, nullable=False, default=0
)
page_visits: Mapped[int] = mapped_column(
    Integer, nullable=False, default=0
)

Génère ensuite la migration Alembic pour ces nouveaux champs.
```

**Validation :**
```bash
python -c "
from database.models_orm import Lead
fields = [c.key for c in Lead.__table__.columns]
required = ['company_size', 'email_opens', 'email_clicks', 'page_visits']
for f in required:
    assert f in fields, f'Champ manquant : {f}'
print('✅ Tous les champs scoring présents dans Lead ORM')
"
```

- [ ] Étape 3.1 validée

---

### Étape 3.2 — Recalibrer les seuils Hot/Warm/Cold

**Prompt Copilot Chat :**

```
Dans microservices/bs_scoring/service.py, les seuils HOT_THRESHOLD=70
et WARM_THRESHOLD=40 sont inaccessibles avec le score max réel de 53/100
(avant ajout des champs ORM manquants).

Mets à jour les seuils à des valeurs provisoires sûres :
HOT_THRESHOLD = 60   # recalibrer après 90 jours de données réelles
WARM_THRESHOLD = 30

Ajoute un commentaire expliquant que ces seuils sont provisoires.
```

**Validation :**
```bash
pytest tests/microservices/test_bs_scoring_classify_tier_boundaries.py -v
pytest tests/microservices/test_bs_scoring_score_lead_success.py -v
```

- [ ] Étape 3.2 validée

---

### Étape 3.3 — Câbler les compteurs d'engagement

**Prompt Copilot Chat :**

```
Dans microservices/bs_email/service.py, les fonctions track_open() et
track_click() mettent à jour Email.opened_at et Email.clicked_at mais
n'incrémentent jamais Lead.email_opens et Lead.email_clicks.

Ajoute dans track_open() après la mise à jour de Email.opened_at :
await db.execute(
    update(Lead).where(Lead.id == lead_id)
    .values(email_opens=Lead.email_opens + 1)
)

Ajoute dans track_click() après la mise à jour de Email.clicked_at :
await db.execute(
    update(Lead).where(Lead.id == lead_id)
    .values(email_clicks=Lead.email_clicks + 1)
)
```

**Validation :**
```bash
make qa
```

- [ ] Étape 3.3 validée

---

### Validation Phase 3 complète

```bash
# Test scoring complet
pytest tests/microservices/test_bs_scoring_score_lead_success.py -v
pytest tests/microservices/test_bs_scoring_classify_tier_boundaries.py -v

# Vérifier que Hot tier est maintenant atteignable
python -c "
from microservices.bs_scoring.service import score_lead, classify_tier
lead = {
    'sector': 'tech',
    'company_size': 'large',
    'email_opens': 5,
    'email_clicks': 3,
    'page_visits': 10,
    'source': 'referral'
}
score = score_lead(lead)
tier = classify_tier(score)
print(f'Score : {score}/100')
print(f'Tier : {tier}')
assert tier == 'hot', f'Hot tier inaccessible — score={score}'
print('✅ Hot tier accessible')
"

make qa

git add .
git commit -m "fix(scoring): Phase 3 — champs ORM Lead + seuils recalibrés + engagement"
git push origin main
```

- [ ] Phase 3 validée et commitée

---

## PHASE 4 — COST CONTROLS & FEEDBACK LOOP
### Objectif : câbler le budget IA et rendre la boucle de feedback réelle

---

### Étape 4.1 — Ajouter le budget IA sur Campaign

**Prompt Copilot Chat :**

```
Dans database/models_orm.py, la classe Campaign n'a pas de champ
pour contrôler le budget IA par campagne.

Ajoute ces 2 champs :
ai_budget_usd: Mapped[Optional[Decimal]] = mapped_column(
    Numeric(10, 2), nullable=True,
    comment="Budget IA maximum en USD pour cette campagne"
)
ai_spent_usd: Mapped[Decimal] = mapped_column(
    Numeric(10, 4), nullable=False, default=Decimal("0.0000"),
    comment="Coût IA consommé en USD"
)

Puis dans microservices/workflow.py, ajoute un pre-flight check au début
de run_campaign_pipeline() qui lève BudgetExceededError si
campaign.ai_spent_usd >= campaign.ai_budget_usd (quand ai_budget_usd est défini).
```

**Validation :**
```bash
python -c "
from database.models_orm import Campaign
fields = [c.key for c in Campaign.__table__.columns]
assert 'ai_budget_usd' in fields
assert 'ai_spent_usd' in fields
print('✅ Budget IA sur Campaign ORM OK')
"
```

- [ ] Étape 4.1 validée

---

### Étape 4.2 — Persister les coûts IA dans Analytics

**Prompt Copilot Chat :**

```
Dans microservices/bs_ai_text/service.py, le coût de chaque génération est
calculé et loggué mais jamais persisté dans Analytics.ai_cost_usd.

Après chaque appel API réussi, ajoute une mise à jour :
await db.execute(
    update(Analytics)
    .where(Analytics.campaign_id == campaign_id)
    .values(ai_cost_usd=Analytics.ai_cost_usd + cost_usd)
)

Remplace aussi la formule de coût hardcodée :
AVANT : cost_usd = (tokens_used / 1000) * 0.01

APRÈS — table de pricing par modèle :
MODEL_PRICING = {
    "gpt-4o":        {"input": 0.005,   "output": 0.015},
    "gpt-4-turbo":   {"input": 0.010,   "output": 0.030},
    "gpt-3.5-turbo": {"input": 0.0005,  "output": 0.0015},
    "gpt-4o-mini":   {"input": 0.00015, "output": 0.0006},
    "ollama/local":  {"input": 0.0,     "output": 0.0},
}
pricing = MODEL_PRICING.get(model_name, {"input": 0.01, "output": 0.01})
cost_usd = (input_tokens/1000)*pricing["input"] + (output_tokens/1000)*pricing["output"]
```

- [ ] Étape 4.2 validée

---

### Étape 4.3 — Corriger la clé de cache Redis

**Prompt Copilot Chat :**

```
Dans microservices/bs_ai_text/service.py, la clé de cache Redis
inclut lead_id ce qui donne un taux de hit ≈ 0% en pratique.

AVANT :
cache_key = f"brandscale:text:{content_type}:{lead_id}:{campaign_id}"

APRÈS — clé basée sur le profil sectoriel :
import hashlib, json
def _build_cache_key(content_type, sector, tone, language, platform):
    profile = json.dumps(
        {"type": content_type, "sector": sector,
         "tone": tone, "lang": language, "platform": platform},
        sort_keys=True
    )
    return f"brandscale:text:{hashlib.sha256(profile.encode()).hexdigest()[:16]}"
```

- [ ] Étape 4.3 validée

---

### Validation Phase 4 complète

```bash
make qa

git add .
git commit -m "fix(pipeline): Phase 4 — budget IA + cost persist + cache key"
git push origin main
```

- [ ] Phase 4 validée et commitée

---

## PHASE 5 — RGPD & QUALITÉ
### Objectif : compléter la conformité RGPD et atteindre 80% de coverage

---

### Étape 5.1 — Compléter la fonction unsubscribe()

**Prompt Copilot Chat :**

```
Dans microservices/bs_email/service.py, la fonction unsubscribe() set
Lead.opt_in=False mais ne set jamais Email.unsubscribed=True.
Le taux de désabonnement est donc toujours 0% dans les Analytics.

Complète unsubscribe() pour qu'elle fasse les 2 mises à jour :
1. await db.execute(update(Lead).where(Lead.id == lid).values(opt_in=False))
2. await db.execute(
       update(Email).where(Email.lead_id == lid)
       .values(unsubscribed=True)
   )
await db.commit()
```

**Validation :**
```bash
pytest tests/microservices/test_bs_email_unsubscribe_rgpd_compliant.py -v
```

- [ ] Étape 5.1 validée

---

### Étape 5.2 — Corriger le O(n²) dans import_leads_from_csv()

**Prompt Copilot Chat :**

```
Dans backend/api/v1/services/lead_service.py, la fonction
import_leads_from_csv() fait un SELECT * + decrypt pour chaque ligne du CSV.
Pour 10 000 lignes avec 20 000 leads existants = 200M opérations, timeout garanti.

Corrige en pré-fetchant les emails une seule fois avant la boucle :

AVANT (dans la boucle) :
for row in csv_reader:
    existing = await db.execute(select(Lead).where(Lead.project_id == project_id))
    emails_decrypted = [decrypt_pii(l.email) for l in existing.scalars().all()]
    if row["email"] in emails_decrypted:
        continue

APRÈS (pré-fetch avant la boucle) :
existing_result = await db.execute(
    select(Lead.email).where(Lead.project_id == project_id)
)
existing_encrypted = {row[0] for row in existing_result.all()}
existing_decrypted = {decrypt_pii(e) for e in existing_encrypted}

for row in csv_reader:
    if row["email"] in existing_decrypted:
        continue
    # ... créer le lead
```

**Validation :**
```bash
pytest tests/backend/test_leads_import_csv_success.py -v
```

- [ ] Étape 5.2 validée

---

### Étape 5.3 — Supprimer les dépendances inutilisées

**Prompt Copilot Chat :**

```
Dans pyproject.toml, scikit-learn et pandas sont listés comme dépendances
mais ne sont jamais importés dans le projet.
Supprime ces 2 lignes et ajoute aiosmtplib si absent.
```

**Validation :**
```bash
grep -r "import sklearn\|from sklearn\|import pandas\|from pandas" . --include="*.py"
# Doit retourner 0 résultat
```

- [ ] Étape 5.3 validée

---

### Étape 5.4 — Atteindre 80% de coverage

**Prompt Copilot Chat :**

```
Lance pytest --cov=. --cov-report=term-missing et identifie les
modules sous 80% de coverage. Génère des tests manquants pour :
- microservices/bs_email/service.py — create_sequence(), track_open(), track_click()
- microservices/bs_scoring/service.py — unknown sector/size/source edge cases
- backend/api/v1/services/lead_service.py — PII encryption round-trip

Naming convention : test_<module>_<function>_<scenario>.py
```

**Validation :**
```bash
pytest --cov=. --cov-report=term-missing --cov-fail-under=80
# Doit passer sans erreur de coverage
```

- [ ] Étape 5.4 validée

---

### Validation Phase 5 complète

```bash
make qa
# Doit passer à ZÉRO erreur

git add .
git commit -m "fix(rgpd+quality): Phase 5 — unsubscribe + O(n²) + deps + coverage 80%"
git push origin main
```

- [ ] Phase 5 validée et commitée

---

## VALIDATION FINALE — QUALITY GATE COMPLET

```bash
# Activer l'environnement
source .venv/bin/activate

# 1. Format
make format
echo "✅ Format OK"

# 2. Lint
make lint
echo "✅ Lint OK"

# 3. Types
make typecheck
echo "✅ Types OK"

# 4. Tests avec coverage
make test
echo "✅ Tests OK"

# 5. Quality gate global
make qa
echo "✅ make qa PASSED"

# 6. Résumé final
pytest --cov=. --cov-report=term-missing | tail -20
```

**Résultat attendu :**

```
✅ Black   — 0 fichier reformaté
✅ Ruff    — 0 warning
✅ Pylint  — score ≥ 8.5/10
✅ Mypy    — 0 erreur (strict mode)
✅ Pytest  — coverage ≥ 80%
✅ ESLint  — 0 warning TypeScript
✅ Jest    — coverage ≥ 70% React

make qa : ✅ PASSED — 0 erreur · 0 warning
```

---

## TABLEAU DE PROGRESSION

| Phase | Objectif | Fichier principal | Commande validation | Statut |
|---|---|---|---|---|
| Setup | Environnement prêt | `.venv/` | `python --version` | ⬜ |
| 1 — Diagnostic | Cartographier les bugs | `diagnostic_initial.txt` | `make qa` | ⬜ |
| 2 — Email | 6 ORM fixes + aiosmtplib | `bs_email/service.py` | `pytest tests/microservices/` | ⬜ |
| 3 — Scoring | Hot tier accessible | `bs_scoring/service.py` + ORM | `pytest tests/microservices/test_bs_scoring*` | ⬜ |
| 4 — Cost | Budget IA + cache | `workflow.py` + `bs_ai_text/service.py` | `make qa` | ⬜ |
| 5 — RGPD | Unsubscribe + O(n²) + 80% cov | `lead_service.py` + nouveaux tests | `make qa` | ⬜ |
| **Final** | **make qa = 0 erreur** | **Tout le projet** | **`make qa`** | ⬜ |

---

## COMMANDES COPILOT CHAT UTILES

Ouvre Copilot Chat avec `Ctrl+Shift+I` puis utilise ces commandes rapides :

```
/explain    → Explique le fichier actuellement ouvert
/fix        → Corrige l'erreur sélectionnée
/tests      → Génère des tests pour la fonction sélectionnée
/doc        → Génère la docstring pour la fonction sélectionnée
```

**Pour auditer un fichier entier :**
```
Analyse microservices/bs_email/service.py et liste tous les bugs
potentiels, les erreurs de noms de champs ORM, et les problèmes
de performance dans les fonctions async.
```

**Pour générer les migrations Alembic :**
```
Génère la commande alembic pour créer une migration des nouveaux
champs ajoutés à la classe Lead dans database/models_orm.py
(company_size, email_opens, email_clicks, page_visits)
```

---

*BRANDSCALE Copilot Execution Plan — v1.0*
*Généré le 2026-03-09 | Basé sur BRANDSCALE Master Audit v1.0.0*
