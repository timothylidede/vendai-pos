# AI with Intuition (fast, reliable heuristics)

This note distills how to complement transformer-style “intellect” (deliberative reasoning) with “intuition” (fast, approximate, confident guesses), and proposes concrete, low-latency patterns we can ship in VendAI.

## Intellect vs Intuition

- Intellect: slow(er), explicit, step-by-step reasoning (e.g., chain-of-thought). High quality when time/compute allow.
- Intuition: fast, automatic, associative, approximate. Good-enough decisions under latency/cost constraints.

Goal: Use slow models to teach fast ones, then run the fast path by default with confidence gating and safe escalation.

## Implementation techniques

- Amortized inference: Learn direct predictors that approximate expensive inference (quick posterior guesses).
- Meta-learning (MAML): Initialize parameters for rapid adaptation from few examples (intuitive priors).
- Distillation (teacher → student): Train a small student to mimic a large, deliberative teacher’s outputs.
- World models & value nets: Learn compact dynamics/value functions for fast action selection.
- Retrieval/prototypes (RAG/NN): Nearest-neighbor over embeddings to reuse decisions from similar past states.
- Habit systems/cached policies: Cache frequent state→action mappings (with periodic refresh).
- Approximate Bayesian: Cheap, uncertainty-aware guesses (variational/Laplace approximations).
- Neuro-symbolic heuristics: Small rules library to backstop ML policies in common edge cases.

## Hybrid architecture (Intuition + Intellect)

- Fast Guesser (Intuition): Small distilled model or retrieval+heuristics; runs by default.
- Arbiter: Confidence gating (calibrated score or tiny verifier). High confidence → accept; else escalate.
- Slow Thinker (Intellect): Larger model with chain-of-thought or tools; used for hard/novel cases and to teach the student.

Benefits: latency, cost, robustness in noisy settings, and better UX for real-time flows.

## Concrete experiments (this week)

1) CoT → Student distillation
- Task: product categorization and reorder suggestions.
- Method: use a deliberate model to generate labels; train a small student to map input→answer.
- Metrics: accuracy vs. latency/cost; calibration (ECE/Brier).

2) Prototype retrieval baseline
- Build an embedding index of past orders + context (store type, seasonality, location).
- Inference: retrieve k-nearest; vote or copy action as the fast guess.
- Measure: precision/recall vs. slow model and blended via confidence gating.

3) Confidence gating loop
- Student outputs prediction + confidence.
- If confidence < τ, call slow model and update student online (distill new case).
- Track escalation rate and end-to-end latency.

4) Quick personalization (few-shot)
- Meta-learned head or adapters that adapt to a new shop with 5–10 examples.
- Measure first-24h accuracy improvements and drift behavior.

## Safety and limits

- Intuition is approximate: add hallucination checks and uncertainty estimation.
- Always provide escalation paths to slow thinker or human-in-the-loop for high-stakes actions.

## VendAI next steps

- Design a two-module “Ordering Assistant”:
  - Student: tiny classifier/policy for product category + reorder quantity, trained via distillation with retrieval features.
  - Thinker: tool-augmented LLM (CoT + store constraints) to provide gold labels and handle escalations.
  - Arbiter: calibrated confidence to route between them; log escalations for online distillation.
- Ship a v0 with retrieval baseline + confidence gating; layer in distilled student model once we have labels.

Links
- See ROADMAP for integration milestones.
- Related: docs/GMV_PLAYBOOK.md for impact levers and metrics.
