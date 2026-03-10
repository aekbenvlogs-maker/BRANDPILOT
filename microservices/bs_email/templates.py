# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/bs_email/templates.py
# HTML email templates — responsive, RGPD-compliant, Outlook-safe.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

import re
from typing import Any

from loguru import logger

# ---------------------------------------------------------------------------
# Base wrapper
# ---------------------------------------------------------------------------

_BASE_HTML = """\
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
  <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body {{ margin:0; padding:0; background:#f4f4f7; font-family:Arial,sans-serif; }}
    .email-wrapper {{ width:100%; background:#f4f4f7; padding:32px 0; }}
    .email-container {{ max-width:600px; margin:0 auto; background:#ffffff;
                        border-radius:8px; overflow:hidden;
                        box-shadow:0 2px 8px rgba(0,0,0,.08); }}
    .email-header {{ background:#1a1a2e; padding:28px 40px; text-align:center; }}
    .email-header h1 {{ color:#ffffff; margin:0; font-size:22px;
                        font-weight:700; letter-spacing:1px; }}
    .email-body {{ padding:32px 40px; color:#333333; font-size:15px;
                   line-height:1.7; }}
    .email-body h2 {{ color:#1a1a2e; font-size:20px; margin-top:0; }}
    .cta-button {{ display:inline-block; margin:24px 0; padding:14px 32px;
                   background:#6d28d9; color:#ffffff !important;
                   text-decoration:none; border-radius:6px;
                   font-weight:700; font-size:15px; }}
    .email-footer {{ background:#f9f9fb; padding:20px 40px;
                     text-align:center; font-size:11px; color:#888888;
                     border-top:1px solid #e8e8ec; }}
    .unsubscribe-link {{ color:#888888; text-decoration:underline; }}
    @media (max-width:640px) {{
      .email-body, .email-header, .email-footer {{ padding:20px; }}
    }}
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-container">
    <div class="email-header">
      <h1>BRANDPILOT</h1>
    </div>
    <div class="email-body">
      {body}
    </div>
    <div class="email-footer">
      <p>© 2026 BRANDPILOT — Tous droits réservés</p>
      <p>
        Vous recevez cet email car vous avez accepté nos communications.<br/>
        <a href="{unsubscribe_url}" class="unsubscribe-link">
          Se désabonner
        </a>
        &nbsp;·&nbsp;
        <a href="https://brandpilot.ai/privacy" class="unsubscribe-link">
          Politique de confidentialité
        </a>
      </p>
    </div>
  </div>
</div>
</body>
</html>"""

# ---------------------------------------------------------------------------
# Individual template bodies
# ---------------------------------------------------------------------------

_BODIES: dict[str, dict[str, str]] = {
    "welcome": {
        "title": "Bienvenue sur BRANDPILOT",
        "body": """\
<h2>Bienvenue, {{first_name}} ! 👋</h2>
<p>
  Votre compte BRANDPILOT est maintenant actif. Nous sommes ravis de vous
  accompagner dans le développement de votre marque grâce à l'intelligence
  artificielle.
</p>
<p>Avec BRANDPILOT vous pouvez :</p>
<ul>
  <li>📣 Créer des campagnes marketing en quelques secondes</li>
  <li>🎯 Scorer et qualifier vos leads automatiquement</li>
  <li>✍️ Générer du contenu adapté à chaque plateforme</li>
  <li>📊 Suivre vos performances en temps réel</li>
</ul>
<p style="text-align:center;">
  <a href="{{cta_url}}" class="cta-button">Accéder à mon espace</a>
</p>
<p>
  En cas de question, notre équipe est disponible à
  <a href="mailto:support@brandpilot.ai">support@brandpilot.ai</a>.
</p>
<p>À très bientôt,<br/>L'équipe BRANDPILOT</p>""",
        "plain": (
            "Bienvenue sur BRANDPILOT, {{first_name}} !\n\n"
            "Votre compte est actif. Accédez à votre espace : {{cta_url}}\n\n"
            "En cas de question : support@brandpilot.ai\n\n"
            "L'équipe BRANDPILOT"
        ),
    },
    "campaign": {
        "title": "{{subject}}",
        "body": """\
<h2>{{headline}}</h2>
<p>{{content}}</p>
<p style="text-align:center;">
  <a href="{{cta_url}}" class="cta-button">{{cta_label}}</a>
</p>
<p style="color:#888;font-size:12px;margin-top:32px;">
  Vous recevez cet email en tant que contact BRANDPILOT.
</p>""",
        "plain": (
            "{{headline}}\n\n"
            "{{content}}\n\n"
            "{{cta_label}} : {{cta_url}}"
        ),
    },
    "unsubscribe_confirm": {
        "title": "Désabonnement confirmé",
        "body": """\
<h2>Vous êtes désabonné(e) ✅</h2>
<p>
  Nous avons bien pris en compte votre demande de désabonnement.
  Vous ne recevrez plus de communications marketing de notre part.
</p>
<p>
  Si vous souhaitez vous réabonner à l'avenir, vous pouvez le faire
  depuis votre espace personnel.
</p>
<p>
  <em>Conformément au RGPD (art. 7), votre consentement a été retiré
  et notre base de données a été mise à jour.</em>
</p>
<p>Cordialement,<br/>L'équipe BRANDPILOT</p>""",
        "plain": (
            "Désabonnement confirmé.\n\n"
            "Votre demande a été prise en compte. "
            "Vous ne recevrez plus de communications marketing.\n\n"
            "L'équipe BRANDPILOT"
        ),
    },
    "password_reset": {
        "title": "Réinitialisation de votre mot de passe",
        "body": """\
<h2>Réinitialisation de mot de passe</h2>
<p>
  Vous avez demandé la réinitialisation de votre mot de passe BRANDPILOT.
  Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
</p>
<p><strong>Ce lien expire dans 24 heures.</strong></p>
<p style="text-align:center;">
  <a href="{{reset_url}}" class="cta-button">Réinitialiser mon mot de passe</a>
</p>
<p>
  Si vous n'êtes pas à l'origine de cette demande, ignorez simplement
  cet email — votre mot de passe reste inchangé.
</p>
<p>
  Pour votre sécurité, ne partagez jamais ce lien.<br/>
  L'équipe BRANDPILOT
</p>""",
        "plain": (
            "Réinitialisation de mot de passe BRANDPILOT.\n\n"
            "Lien (valable 24h) : {{reset_url}}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n"
            "L'équipe BRANDPILOT"
        ),
    },
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# All registered template names
TEMPLATES: dict[str, dict[str, str]] = _BODIES


def render_html(
    template_name: str,
    context: dict[str, Any],
    unsubscribe_url: str = "#unsubscribe",
) -> str:
    """Render a registered HTML email template with context variables.

    Substitutes ``{{key}}`` placeholders using *context*.  Unknown
    placeholders are left untouched.

    Args:
        template_name:   Key from the TEMPLATES dict.
        context:         Variable substitution dict (e.g. ``{"first_name": "Alice"}``).
        unsubscribe_url: One-click unsubscribe URL injected into the footer.

    Returns:
        Fully rendered HTML string.

    Raises:
        KeyError: If *template_name* is not registered.
    """
    if template_name not in TEMPLATES:
        logger.error("[bs_email/templates] Unknown template | name={}", template_name)
        raise KeyError(f"Email template '{template_name}' is not registered.")

    tpl = TEMPLATES[template_name]
    body = _substitute(tpl["body"], context)
    title = _substitute(tpl["title"], context)
    html = _BASE_HTML.format(
        title=title,
        body=body,
        unsubscribe_url=unsubscribe_url,
    )
    return html


def render_plain(template_name: str, context: dict[str, Any]) -> str:
    """Render the plain-text fallback for an email template.

    Args:
        template_name: Key from the TEMPLATES dict.
        context:       Variable substitution dict.

    Returns:
        Plain text string with substituted variables.

    Raises:
        KeyError: If *template_name* is not registered.
    """
    if template_name not in TEMPLATES:
        raise KeyError(f"Email template '{template_name}' is not registered.")

    return _substitute(TEMPLATES[template_name]["plain"], context)


def _substitute(text: str, context: dict[str, Any]) -> str:
    """Replace ``{{key}}`` tokens in *text* with values from *context*.

    Unknown keys are preserved verbatim.

    Args:
        text:    Template string with optional ``{{key}}`` placeholders.
        context: Substitution values.

    Returns:
        Rendered string.
    """
    return re.sub(
        r"\{\{(\w+)\}\}",
        lambda m: str(context.get(m.group(1), m.group(0))),
        text,
    )
