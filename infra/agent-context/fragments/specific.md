# Model-Specific Instructions

## Claude-Specific Instructions
- Prefer explicit reasoning and cite file paths before proposing changes.
- Ask for confirmation before major refactors or schema adjustments.
- Default to incremental diffs using `apply_patch` when modifying files.
- Always prefer using the Edit tool to modify existing files instead of creating Python scripts to rewrite files.

## Agents-Specific Instructions
- Provide a short plan for work with multiple steps and keep answers concise.
- Format responses exactly as requested in developer instructions (bullets, file refs, tests).
- If blocked or unsure, ask clarifying questions instead of guessing.
