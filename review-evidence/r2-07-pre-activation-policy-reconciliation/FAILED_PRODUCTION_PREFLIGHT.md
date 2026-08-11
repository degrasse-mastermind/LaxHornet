# Failed production preflight boundary

- Bound merged main: `429b0352d969ba2a4f8ac4ce11429e35094f5673`
- Bound tree: `223ddacca71a3c17ed8475500b3594c3be067d2e`
- Production project: `ulbmjcvnyznvmjgpstno`
- Required connector: `supabase_production_readonly-2` with `read_only=true`
- Production migration history: exactly 18 versions ending at `20260811131042`
- Capability: dormant; Forward Migration B not applied
- Certified policy digest: `0c9fc6789e1401e149592e2d8c7f0334`
- Observed production policy digest: `e7bc2b4dab7dda61af7967dad18b50ca`
- Gate disposition: `POLICY_DRIFT`

This package does not rerun the R2-07F production preflight. The recorded failed
gate is the input boundary for a repository-only prerequisite remediation.
Production was queried only through SELECT-only catalog calls and was not
mutated.
