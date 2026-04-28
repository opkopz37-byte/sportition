# Sportition SQL Guide

이 폴더는 이제 `00~06`만 기준으로 관리합니다.
예전 단일 SQL, 중간 패치 SQL, 실험용 SQL은 모두 정리하고 이 순서만 사용하면 됩니다.

## 실행 순서

아래 순서대로 한 번씩 실행하세요.

```text
00_reset_all.sql
01_core_schema.sql
02_game_schema.sql
03_auth_and_triggers.sql
04_rls_policies.sql
05_views.sql
06_seed_game_content.sql
```

`00_reset_all.sql`은 매번 돌리는 파일이 아닙니다.
전체를 새로 갈아엎고 다시 만들 때만 1회 실행합니다.

## 왜 이렇게 나눴는지

- `00_reset_all.sql`: 전체 재설치가 필요할 때만 사용하는 초기화 파일
- `01_core_schema.sql`: 회원, 비공개 프로필, 출석, 경기, 통계 같은 핵심 테이블
- `02_game_schema.sql`: 가챠, 카드, 스킬트리, 승인 큐 같은 게임 시스템
- `02_game_schema.sql`에는 기존 `matches` 테이블을 최신 구조(`match_id`, `opponent_id`, `played_at`, `score_for/score_against`)로 맞추는 마이그레이션이 포함됩니다.
- `03_auth_and_triggers.sql`: 회원가입 동기화, 기존 `auth.users` 백필, 출석 처리 트리거, 키오스크 RPC
- `04_rls_policies.sql`: 민감 데이터 보호와 본인 데이터 접근 정책
- `05_views.sql`: 공개 선수 프로필, 카드 상세, 승인 큐 상세 뷰
- `06_seed_game_content.sql`: 카드/노드/도감 기본 시드

### 스킬 노드 (86개) — 편집·적용은 한 파일만

`06`의 스킬 노드 `INSERT`는 일부가 `ON CONFLICT DO NOTHING`이라 **이미 있는 행은 갱신되지 않을 수 있습니다.**  
노드 이름·좌표·부모·맵 부제·설명 등을 바꿀 때는 **`sql/skill_tree/SKILL_TREE_UNIFIED.sql`만** 수정하고, Supabase SQL Editor에서 **그 파일 전체를 1회 실행**하세요.

- 예전 파일명 `18_skill_tree_node_content.sql`, `23_skill_tree_full_upsert_all_83.sql`, `24_skill_tree_level_change_body_jab.sql`는 **스텁**이며, 실제 정의는 통합 파일에만 있습니다.

실행 후 `SELECT COUNT(*) FROM public.skill_tree_nodes;` 결과가 **86**인지 확인하면 됩니다.

## 이번 구조에서 바뀐 핵심

- 역할명이 `athlete`, `coach`, `gym` 중심에서 `player_common`, `player_athlete`, `gym`, `admin` 중심으로 바뀝니다.
- `phone`, `birth_date`, `representative_phone`는 `users`에서 분리되어 `user_private_profiles`에 저장됩니다.
- 공개 프로필용 뷰 `public_player_profiles`가 생겨서 `티어보드`, `상대 프로필`, `검색`은 이 뷰만 기준으로 읽습니다.
- `skill_points`, `total_attendance`, `current_streak`, `longest_streak`는 공개 프로필 뷰에서 제외됩니다.
- `users`, `statistics` 기본 테이블은 본인 것만 직접 읽을 수 있고, 다른 사람 정보는 뷰로만 봅니다.
- `03_auth_and_triggers.sql`에는 기존 `auth.users`를 다시 `public.users`로 채워주는 백필이 들어 있어서, `00`으로 public 테이블을 비운 뒤 다시 설치해도 기존 인증 계정이 바로 연결됩니다.

## 실제로 남겨둘 파일

```text
00_reset_all.sql
01_core_schema.sql
02_game_schema.sql
03_auth_and_triggers.sql
04_rls_policies.sql
05_views.sql
06_seed_game_content.sql
skill_tree/SKILL_TREE_UNIFIED.sql
52_consolidated_runtime_state.sql   ← 출석/SP/스킬/승단 통합 마이그레이션
README.md
```

## 출석 / SP / 스킬 / 승단 통합 (52)

`52_consolidated_runtime_state.sql` — sql/49 + sql/50 + sql/51 의 모든 변경을
정리해 단일 파일로 묶은 멱등 마이그레이션. 여러 번 돌려도 안전.

이 파일이 적용된 정책:
- 출석체크 = DB 기록 + 모달 표시. SP 자동 지급 없음.
- 모달 [스킬 포인트 적립] 클릭 시만 +1 SP.
- 5/5 마스터 + 미승인 노드 1개라도 있으면 SP 적립 차단 (mastery_unresolved).
- 심사 대기/진행 중이면 모든 스킬 투자 차단.
- 마스터 5/5 고정 (거절 시 SP 맥스 +1 시스템 폐기).
- 모든 노드 최소 1 SP 비용.
- 신규 회원 SP = 0.

옛 파일 (49 / 50 / 51) 은 **52 가 적용된 후 다시 돌릴 필요 없음**. 히스토리 보관 용도.
