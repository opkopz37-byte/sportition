-- ============================================================
-- SPORTITION MVP3 RESET
-- Drops all public schema objects managed by split setup files.
-- Run this only when you want a full rebuild.
-- ============================================================

DROP VIEW IF EXISTS public.public_player_profiles CASCADE;
DROP VIEW IF EXISTS public.approval_queue_detailed CASCADE;
DROP VIEW IF EXISTS public.user_cards_detailed CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_init_statistics ON public.users;
DROP TRIGGER IF EXISTS on_user_created_init_inventory ON public.users;
DROP TRIGGER IF EXISTS on_attendance_recorded_update_stats ON public.attendance;
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
DROP TRIGGER IF EXISTS user_private_profiles_updated_at ON public.user_private_profiles;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_user_statistics() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_user_inventory() CASCADE;
DROP FUNCTION IF EXISTS public.handle_attendance_recorded() CASCADE;
DROP FUNCTION IF EXISTS public.search_members_by_phone_last4(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.kiosk_check_attendance(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS public.user_collection_progress CASCADE;
DROP TABLE IF EXISTS public.collections CASCADE;
DROP TABLE IF EXISTS public.skill_approval_queue CASCADE;
DROP TABLE IF EXISTS public.gacha_history CASCADE;
DROP TABLE IF EXISTS public.user_card_fragments CASCADE;
DROP TABLE IF EXISTS public.user_cards CASCADE;
DROP TABLE IF EXISTS public.user_inventory CASCADE;
DROP TABLE IF EXISTS public.skill_tree_nodes CASCADE;
DROP TABLE IF EXISTS public.skill_cards CASCADE;
DROP TABLE IF EXISTS public.skill_masters CASCADE;
DROP TABLE IF EXISTS public.workout_exercises CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.tier_rankings CASCADE;
DROP TABLE IF EXISTS public.statistics CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.user_private_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
