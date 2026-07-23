# LaxHornet Branch Protection Recommendations

These are manual repository settings. This review branch does not change GitHub protection rules.

## `main`

- Require a pull request.
- Require one approving review from the repository owner.
- Require CODEOWNERS review.
- Dismiss stale approvals when security-sensitive files change.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Require linear history only if it does not interfere with the approved migration merge process.

## Required checks

- Release manifest validation
- JavaScript syntax
- Event-operation service contracts
- Version and cache coordination
- Release containment
- Minimum disclosure
- Trust Spine contracts, SQL acceptance, and rollback
- Product Alignment source and browser checks
- Cancel Game
- Delete permissions
- Player-removal cleanup
- Track-to-share browser journey
- Secret and hosted-project scan

## Release boundary

Database migration approval, static/PWA deployment approval, and feature activation approval should remain separate human decisions. A green pull request is evidence for review, not authorization to deploy.
