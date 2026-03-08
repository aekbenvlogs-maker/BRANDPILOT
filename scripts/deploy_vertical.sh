#!/usr/bin/env bash
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/deploy_vertical.sh
# DESCRIPTION  : Deploy a BRANDSCALE vertical configuration.
#                Validates the YAML, sets VERTICAL env var, and
#                displays a deployment summary.
# USAGE        : bash scripts/deploy_vertical.sh <vertical_name>
#                e.g. bash scripts/deploy_vertical.sh rh
# ============================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SUPPORTED_VERTICALS=("generic" "rh" "immo" "compta" "formation" "esn")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERTICALS_DIR="${REPO_ROOT}/verticals"
ENV_FILE="${REPO_ROOT}/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Usage / help
# ---------------------------------------------------------------------------
usage() {
    echo ""
    echo -e "${BLUE}BRANDSCALE — Deploy Vertical${RESET}"
    echo ""
    echo "Usage: bash scripts/deploy_vertical.sh <vertical_name>"
    echo ""
    echo "Supported verticals:"
    for v in "${SUPPORTED_VERTICALS[@]}"; do
        yaml_path="${VERTICALS_DIR}/${v}/vertical.yaml"
        if [[ -f "${yaml_path}" ]]; then
            echo -e "  ${GREEN}✓${RESET} ${v}"
        else
            echo -e "  ${YELLOW}?${RESET} ${v}  (vertical.yaml not found)"
        fi
    done
    echo ""
    echo "Examples:"
    echo "  bash scripts/deploy_vertical.sh generic    # Switch to generic (baseline)"
    echo "  bash scripts/deploy_vertical.sh rh         # Switch to RH vertical"
    echo "  bash scripts/deploy_vertical.sh esn        # Switch to ESN vertical"
    echo ""
}

# ---------------------------------------------------------------------------
# Validate argument
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
    echo -e "${RED}✗ Erreur : aucune verticale spécifiée${RESET}"
    usage
    echo -e "${RED}USAGE: bash scripts/deploy_vertical.sh <vertical_name>${RESET}"
    exit 1
fi

VERTICAL="${1}"

# Check if supported
is_supported=false
for v in "${SUPPORTED_VERTICALS[@]}"; do
    if [[ "${VERTICAL}" == "${v}" ]]; then
        is_supported=true
        break
    fi
done

if [[ "${is_supported}" == "false" ]]; then
    echo -e "${RED}✗ Verticale invalide: '${VERTICAL}'${RESET}"
    echo -e "  Verticales supportées: ${SUPPORTED_VERTICALS[*]}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Check YAML exists
# ---------------------------------------------------------------------------
YAML_PATH="${VERTICALS_DIR}/${VERTICAL}/vertical.yaml"

if [[ ! -f "${YAML_PATH}" ]]; then
    echo -e "${RED}✗ YAML introuvable: ${YAML_PATH}${RESET}"
    echo -e "  Créez d'abord le fichier vertical.yaml pour la verticale '${VERTICAL}'"
    exit 1
fi

# ---------------------------------------------------------------------------
# Validate vertical YAML
# ---------------------------------------------------------------------------
echo -e "${YELLOW}▶ [1/3] Validation YAML — vertical: ${VERTICAL}${RESET}"
cd "${REPO_ROOT}"

if python scripts/validate_vertical.py "${VERTICAL}"; then
    echo -e "${GREEN}✓ Validation réussie${RESET}"
else
    echo -e "${RED}✗ Validation échouée — déploiement annulé${RESET}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Update .env if it exists
# ---------------------------------------------------------------------------
echo -e "${YELLOW}▶ [2/3] Mise à jour de la configuration...${RESET}"

if [[ -f "${ENV_FILE}" ]]; then
    # Update VERTICAL= line if it exists, or append it
    if grep -q "^VERTICAL=" "${ENV_FILE}"; then
        # Use sed to replace the existing VERTICAL= line
        sed -i.bak "s/^VERTICAL=.*/VERTICAL=${VERTICAL}/" "${ENV_FILE}"
        rm -f "${ENV_FILE}.bak"
        echo -e "  ${GREEN}✓ .env mis à jour : VERTICAL=${VERTICAL}${RESET}"
    else
        echo "" >> "${ENV_FILE}"
        echo "VERTICAL=${VERTICAL}" >> "${ENV_FILE}"
        echo -e "  ${GREEN}✓ .env : VERTICAL=${VERTICAL} ajouté${RESET}"
    fi
else
    echo -e "  ${YELLOW}⚠ .env introuvable — créez-le depuis .env.example et définissez VERTICAL=${VERTICAL}${RESET}"
fi

# ---------------------------------------------------------------------------
# Display deployment summary
# ---------------------------------------------------------------------------
echo -e "${YELLOW}▶ [3/3] Résumé du déploiement${RESET}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║  BRANDSCALE — Vertical '${VERTICAL}' déployé avec succès          ║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  YAML config : ${YAML_PATH}"
echo -e "  Env actif   : VERTICAL=${VERTICAL}"
echo ""
echo -e "${BLUE}Pour activer la verticale, relancez l'application :${RESET}"
echo "  VERTICAL=${VERTICAL} uvicorn backend.main:app --reload"
echo ""
echo -e "${BLUE}Pour valider à nouveau :${RESET}"
echo "  make validate-vertical VERTICAL=${VERTICAL}"
echo ""

exit 0
