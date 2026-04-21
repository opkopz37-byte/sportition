-- 비로그인(anon) 랜딩·전적 검색에서 public_player_profiles 조회 허용
-- 뷰는 공개 프로필·전적 요약만 노출합니다 (17_public_discovery_views.sql 참고).
-- Supabase SQL 에디터에서 한 번 실행하세요.

GRANT SELECT ON public.public_player_profiles TO anon;
