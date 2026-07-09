# EDUMAP Frontend Boundary

- `Supabase` in `admin-web` is allowed only for:
  - `auth`
  - `session`
  - `password recovery`
  - `storage uploads/public URLs`
- Product data must go only through `server API`.
- Use:
  - `@/lib/supabaseAuth`
  - `@/lib/supabaseStorage`
- Do not import `@/lib/supabaseClient` directly from app pages or product code.
