# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/campaign_agent/__init__.py
# Public API for the Campaign Agent microservice package.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from microservices.campaign_agent.agent import (
    BrandContext,
    CampaignAgent,
    CampaignNotFoundError,
    CampaignValidationRecord,
    ExecutionPlan,
    InvalidStatusError,
    SocialPost,
    UnauthorizedError,
)
from microservices.campaign_agent.campaign_builder import CampaignBuilder
from microservices.campaign_agent.context_builder import ContextBuilder
from microservices.campaign_agent.execution_planner import ExecutionPlanner
from microservices.campaign_agent.intent_parser import (
    AmbiguousPromptError,
    CampaignIntent,
    IntentParseError,
    OpenAITimeoutError,
    parse_intent,
)

__all__ = [
    # Intent parsing
    "CampaignIntent",
    "AmbiguousPromptError",
    "IntentParseError",
    "OpenAITimeoutError",
    "parse_intent",
    # Agent & data models
    "CampaignAgent",
    "BrandContext",
    "SocialPost",
    "CampaignValidationRecord",
    "ExecutionPlan",
    "CampaignNotFoundError",
    "InvalidStatusError",
    "UnauthorizedError",
    # Pipeline components
    "ContextBuilder",
    "ExecutionPlanner",
    "CampaignBuilder",
]
