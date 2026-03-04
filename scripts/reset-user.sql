-- ============================================================
-- FULL USER RESET SCRIPT
-- Run in Supabase SQL Editor
-- Change the email on the next line to the user you want to reset
-- ============================================================

DO $$
DECLARE
  target_email TEXT := 'saras@incommon.co';  -- ← CHANGE THIS
  target_user_id UUID;
BEGIN
  -- Find the user ID from public.users
  SELECT id INTO target_user_id FROM public.users WHERE email = target_email;

  -- If not found in public.users, try auth.users
  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  END IF;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'No user found with email: %', target_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Resetting user: % (ID: %)', target_email, target_user_id;

  -- Delete from all dependent tables
  DELETE FROM public.user_connections WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted user_connections';

  DELETE FROM public.matches WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted matches';

  DELETE FROM public.enriched_profiles WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted enriched_profiles';

  DELETE FROM public.payments WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted payments';

  DELETE FROM public.notifications WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted notifications';

  DELETE FROM public.icp_chat_sessions WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted icp_chat_sessions';

  DELETE FROM public.prompt_runs WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted prompt_runs';

  -- Delete from public.users
  DELETE FROM public.users WHERE id = target_user_id;
  RAISE NOTICE 'Deleted public.users row';

  -- Delete from auth.users (this fully removes the user from Supabase Auth)
  DELETE FROM auth.users WHERE id = target_user_id;
  RAISE NOTICE 'Deleted auth.users row';

  RAISE NOTICE 'DONE — user % fully reset. They can sign up again as a new user.', target_email;
END $$;
