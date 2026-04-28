-- ============================================================
-- 회원 체육관 변경 시 진행 중인 승단 신청을 새 체육관으로 자동 이관
--
-- 문제: 회원이 [승단 심사 신청] 클릭 후 프로필에서 체육관을 바꾸면
--       기존 신청은 옛 체육관 큐에 그대로 남아있어 새 체육관에선 보이지 않음.
--
-- 해결: users.gym_name UPDATE 시 트리거로 처리:
--   1) 같은 user_id 의 pending/reviewing 신청의 gym_name 을 새 값으로 업데이트
--   2) reviewing 상태였다면 pending 으로 리셋 (새 체육관이 처음부터 보도록)
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/52 적용 후.
-- 멱등 — 여러 번 실행해도 안전 (CREATE OR REPLACE / DROP IF EXISTS).
-- ============================================================

-- ============================================================
-- 1) 트리거 함수
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_promotion_requests_on_gym_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_gym TEXT;
BEGIN
  -- gym_name 이 실제로 변경됐을 때만 동작 (NULL ↔ 값 변화 포함)
  IF NEW.gym_name IS NOT DISTINCT FROM OLD.gym_name THEN
    RETURN NEW;
  END IF;

  _new_gym := NULLIF(btrim(COALESCE(NEW.gym_name, '')), '');

  -- 새 gym_name 이 비어 있어도 일단 신청 자체는 이관 (체육관 미정 상태로 남김).
  -- 이후 회원이 새 체육관 지정하면 또 트리거가 재이관.
  UPDATE public.skill_promotion_requests
     SET gym_name = COALESCE(_new_gym, ''),
         -- reviewing → pending 리셋: 새 체육관이 처음부터 볼 수 있게
         status = CASE WHEN status = 'reviewing' THEN 'pending' ELSE status END,
         -- review_started_at 도 reviewing 이었으면 초기화
         review_started_at = CASE WHEN status = 'reviewing' THEN NULL ELSE review_started_at END,
         reviewer_id = CASE WHEN status = 'reviewing' THEN NULL ELSE reviewer_id END
   WHERE user_id = NEW.id
     AND status IN ('pending', 'reviewing');

  RETURN NEW;
END;
$$;


-- ============================================================
-- 2) 트리거 부착 — users.gym_name UPDATE 시
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_promotion_requests_gym ON public.users;

CREATE TRIGGER trg_sync_promotion_requests_gym
  AFTER UPDATE OF gym_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_promotion_requests_on_gym_change();


-- ============================================================
-- 3) 일회성 정합성 — 이미 잘못 매칭된 행이 있으면 현재 회원 gym_name 으로 보정
--    (트리거가 없던 시점에 변경된 케이스 대비)
-- ============================================================
UPDATE public.skill_promotion_requests r
   SET gym_name = COALESCE(NULLIF(btrim(u.gym_name), ''), r.gym_name)
  FROM public.users u
 WHERE r.user_id = u.id
   AND r.status IN ('pending', 'reviewing')
   AND COALESCE(NULLIF(btrim(u.gym_name), ''), '') IS DISTINCT FROM COALESCE(r.gym_name, '');


-- ============================================================
-- ── 테스트 ──
-- 1) 회원 X 가 체육관 A 에서 승단 신청
-- SELECT public.submit_master_exam_request(<node_id>);
--
-- 2) 그 회원의 gym_name 을 B 로 변경 (mypage 편집과 동일)
-- UPDATE public.users SET gym_name = 'B' WHERE id = '<X uuid>';
--
-- 3) 신청이 B 로 이관됐는지 확인
-- SELECT id, gym_name, status FROM public.skill_promotion_requests
--  WHERE user_id = '<X uuid>' ORDER BY requested_at DESC;
-- → gym_name 이 'B', reviewing 이었다면 pending 으로 리셋되어 있어야 함.
-- ============================================================
