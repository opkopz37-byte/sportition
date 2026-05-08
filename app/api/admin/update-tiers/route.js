import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getTierLabelFromMatchPoints } from '@/lib/tierLadder';

/**
 * 관리자 전용: 모든 유저의 티어 라벨을 tier_points 기반으로 재계산
 * 
 * 사용 시나리오:
 * - 점수 규칙 변경 후 SQL로 tier_points 재계산 완료
 * - 이 API를 호출하여 tier 컬럼 업데이트
 * 
 * 호출: POST /api/admin/update-tiers
 */
export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  
  if (!url || !key) {
    return NextResponse.json(
      { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  try {
    // 1. 모든 유저의 tier_points 가져오기
    const { data: users, error: fetchError } = await admin
      .from('users')
      .select('id, tier_points');
    
    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to update',
        updated: 0,
      });
    }

    // 2. 각 유저의 새 티어 계산 및 업데이트
    let updated = 0;
    let errors = [];

    for (const user of users) {
      const newTier = getTierLabelFromMatchPoints(user.tier_points || 0);
      
      const { error: updateError } = await admin
        .from('users')
        .update({ tier: newTier })
        .eq('id', user.id);
      
      if (updateError) {
        errors.push({ userId: user.id, error: updateError.message });
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updated} users`,
      updated,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
