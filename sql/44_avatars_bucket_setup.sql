-- ============================================================
-- Storage `avatars` 버킷 생성 + RLS 정책 (프로필 이미지 업로드)
--
-- 증상: 프로필 이미지 변경 시 "Bucket not found" 알림.
-- 원인: 이전에 sql/31_avatar_url_storage.sql 미적용 환경에서
--       avatar_url 컬럼만 sql/43 으로 추가했으나 Storage 버킷·정책이 없음.
--
-- 이 파일은 멱등 — 여러 번 실행해도 안전.
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

-- 1) 'avatars' 버킷 — public 읽기 (getPublicUrl 사용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Storage RLS — 정책이 이미 있으면 제거 후 재생성 (멱등)
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"   ON storage.objects;

-- SELECT — 누구나 읽기 (public 버킷이라 어차피 외부 노출)
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO public, anon, authenticated
  USING (bucket_id = 'avatars');

-- INSERT — 본인 폴더(<user_id>/...) 에만 업로드 허용
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

-- UPDATE — 본인 파일만 (avatar.jpg 덮어쓰기 시 사용)
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

-- DELETE — 본인 파일만
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

-- ============================================================
-- 확인 쿼리 (선택) — 버킷·정책 잘 만들어졌는지
-- ============================================================
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'avatars';
-- SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
