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
README.md
```
