'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';
// 마이페이지 뷰들

const MyPageView = ({ setActiveTab, t }) => {
  const { profile } = useAuth();
  
  const getRoleLabelKey = (role) => {
    if (role === 'player_common') return 'player_common';
    if (role === 'player_athlete') return 'player_athlete';
    if (role === 'gym') return 'gym';
    return 'player_common';
  };

  const getWeightClass = (weight) => {
    if (!weight) return '';
    if (weight <= 51) return t('minimumWeight') || '미니멈급';
    if (weight <= 54) return t('lightFlyWeight') || '라이트 플라이급';
    if (weight <= 57) return t('flyWeight') || '플라이급';
    if (weight <= 60) return t('bantamWeight') || '밴텀급';
    if (weight <= 63.5) return t('featherWeight') || '페더급';
    if (weight <= 67) return t('lightWeight') || '라이트급';
    if (weight <= 71) return t('welterWeight') || '웰터급';
    if (weight <= 75) return t('middleWeight') || '미들급';
    if (weight <= 81) return t('lightHeavyWeight') || '라이트 헤비급';
    return t('heavyWeight') || '헤비급';
  };

  return (
  <div className="animate-fade-in-up">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-white mb-2">{t('myPage')}</h2>
      <p className="text-gray-500">{t('manageProfile')}</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <SpotlightCard className="col-span-1 md:col-span-2 p-6">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-4xl">
            {(profile?.nickname || profile?.name || 'U').charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                profile?.role === 'player_common' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                profile?.role === 'player_athlete' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                profile?.role === 'gym' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                {t(getRoleLabelKey(profile?.role))}
              </span>
              <h3 className="text-2xl font-bold text-white">{profile?.nickname || profile?.name || '사용자'}</h3>
            </div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {profile?.tier && (
                <>
                  <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold">{profile.tier}</span>
                  <span className="text-gray-500">•</span>
                </>
              )}
              <span className="text-gray-400 text-sm whitespace-nowrap">
                {profile?.weight ? getWeightClass(profile.weight) : ''}
                {profile?.boxing_style ? ` ${profile.boxing_style}` : ''}
                {profile?.gym_name ? ` (${profile.gym_name})` : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {profile?.email && (
                <div>
                  <span className="text-gray-500">{t('email') || '이메일'}: </span>
                  <span className="text-white">{profile.email}</span>
                </div>
              )}
              {(profile?.phone || profile?.phone_number) && (
                <div>
                  <span className="text-gray-500">{t('phone') || '전화번호'}: </span>
                  <span className="text-white">{profile.phone || profile.phone_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard 
        className="p-6 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setActiveTab('mypage-achievements')}
      >
        <div className="text-center">
          <Icon type="trophy" size={32} className="mx-auto mb-3 text-yellow-500" />
          <div className="text-3xl font-bold text-white mb-1">23</div>
          <div className="text-sm text-gray-400">{t('totalAchievements')}</div>
          <div className="text-xs text-blue-400 mt-2">{t('viewAll')} →</div>
        </div>
      </SpotlightCard>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SpotlightCard 
        className="p-6 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setActiveTab('mypage-activity')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{t('recentActivity')}</h3>
          <Icon type="chevronRight" size={20} className="text-gray-500" />
        </div>
        <div className="space-y-3">
          {[
            { icon: 'trophy', text: t('matchVictory'), time: `2 ${t('hoursAgo')}` },
            { icon: 'star', text: t('newSkillUnlocked'), time: `1 ${t('daysAgo')}` },
            { icon: 'trendingUp', text: t('rankUp'), time: `3 ${t('daysAgo')}` },
          ].map((activity, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
              <Icon type={activity.icon} size={16} className="text-blue-400" />
              <div className="flex-1">
                <div className="text-sm text-white">{activity.text}</div>
                <div className="text-xs text-gray-500">{activity.time}</div>
              </div>
            </div>
          ))}
        </div>
      </SpotlightCard>

      <SpotlightCard className="p-6">
        <h3 className="text-lg font-bold text-white mb-4">{t('settings')}</h3>
        <div className="space-y-3">
          {[
            { id: 'edit-profile', label: t('editProfile') },
            { id: 'privacy', label: t('privacySettings') },
            { id: 'notifications', label: t('notifications') },
            { id: 'security', label: t('accountSecurity') }
          ].map((setting) => (
            <button 
              key={setting.id} 
              onClick={() => setActiveTab(`mypage-${setting.id}`)}
              className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left text-white text-sm transition-colors flex items-center justify-between group"
            >
              <span>{setting.label}</span>
              <Icon type="chevronRight" size={16} className="text-gray-500 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>
      </SpotlightCard>
    </div>
  </div>
);
};

// Edit Profile 페이지
const EditProfileView = ({ setActiveTab, t = (key) => key }) => {
  const { profile, user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nickname: '',
    phone: '',
    birth_date: '',
    gender: '',
    height: '',
    weight: '',
    boxing_style: '',
    gym_name: '',
    gym_location: '',
    representative_phone: '',
  });

  useEffect(() => {
    console.log('[EditProfile] 프로필 데이터 확인:', profile);
    if (profile) {
      const newFormData = {
        nickname: profile.nickname || profile.name || '',
        phone: profile.phone || '',
        birth_date: profile.birth_date || '',
        gender: profile.gender || '',
        height: profile.height ? String(profile.height) : '',
        weight: profile.weight ? String(profile.weight) : '',
        boxing_style: profile.boxing_style || '',
        gym_name: profile.gym_name || '',
        gym_location: profile.gym_location || '',
        representative_phone: profile.representative_phone || '',
      };
      console.log('[EditProfile] formData 설정:', newFormData);
      setFormData(newFormData);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.id) {
      setError('사용자 정보가 없습니다');
      return;
    }
    
    console.log('[EditProfile] 저장 시작, formData:', formData);
    setLoading(true);
    setError('');

    try {
      const { updateUserProfile } = await import('@/lib/supabase');
      
      const updates = {
        name: formData.nickname,
        nickname: formData.nickname,
        phone: formData.phone || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        height: formData.height ? parseInt(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
      };

      if (profile?.role === 'player_common') {
        updates.gym_name = formData.gym_name || null;
      } else if (profile?.role === 'player_athlete') {
        updates.boxing_style = formData.boxing_style || null;
        updates.gym_name = formData.gym_name || null;
      } else if (profile?.role === 'gym') {
        updates.gym_name = formData.gym_name || null;
        updates.gym_location = formData.gym_location || null;
        updates.representative_phone = formData.representative_phone || null;
      }

      console.log('[EditProfile] 업데이트 데이터:', updates);
      const { data, error: updateError } = await updateUserProfile(user.id, updates);
      
      if (updateError) {
        console.error('[EditProfile] 업데이트 에러:', updateError);
        throw updateError;
      }

      console.log('[EditProfile] 업데이트 성공:', data);
      console.log('[EditProfile] 프로필 새로고침 시작');
      await refreshProfile();
      console.log('[EditProfile] 프로필 새로고침 완료');
      
      alert('프로필이 성공적으로 업데이트되었습니다!');
      setActiveTab('mypage');
    } catch (err) {
      console.error('[EditProfile] 프로필 업데이트 에러:', err);
      setError('프로필 업데이트에 실패했습니다: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title={t('editProfile')} 
        description={t('updateInfo')}
        onBack={() => setActiveTab('mypage')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SpotlightCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-6">{t('basicInfo')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('nickname') || '닉네임'}</label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                  placeholder={t('enterNickname')}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('email') || '이메일'}</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">{t('emailCannotChange')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('phone') || '전화번호'}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('height') || '키 (cm)'}</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({...formData, height: e.target.value})}
                    placeholder="175"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('weight') || '체중 (kg)'}</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    placeholder="70"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  />
                </div>
              </div>

              {profile?.role === 'player_common' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('gymName') || '소속 체육관'}</label>
                    <input
                      type="text"
                      value={formData.gym_name}
                      onChange={(e) => setFormData({...formData, gym_name: e.target.value})}
                      placeholder={t('enterGymName')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                </>
              )}

              {profile?.role === 'player_athlete' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('boxingStyle') || '복싱 스타일'}</label>
                    <select
                      value={formData.boxing_style}
                      onChange={(e) => setFormData({...formData, boxing_style: e.target.value})}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                    >
                      <option value="">{t('selectStyle') || '선택하세요'}</option>
                      <option value="아웃복서">아웃복서</option>
                      <option value="인파이터">인파이터</option>
                      <option value="스워머">스워머</option>
                      <option value="펀처">펀처</option>
                      <option value="카운터 펀처">카운터 펀처</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('gymName') || '소속 체육관'}</label>
                    <input
                      type="text"
                      value={formData.gym_name}
                      onChange={(e) => setFormData({...formData, gym_name: e.target.value})}
                      placeholder={t('enterGymName')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                </>
              )}

              {profile?.role === 'gym' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('gymName') || '체육관 이름'}</label>
                    <input
                      type="text"
                      value={formData.gym_name}
                      onChange={(e) => setFormData({...formData, gym_name: e.target.value})}
                      placeholder={t('enterGymName')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('gymLocation') || '체육관 위치'}</label>
                    <input
                      type="text"
                      value={formData.gym_location}
                      onChange={(e) => setFormData({...formData, gym_location: e.target.value})}
                      placeholder={t('enterGymLocation')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('representativePhone') || '대표 전화번호'}</label>
                    <input
                      type="tel"
                      value={formData.representative_phone}
                      onChange={(e) => setFormData({...formData, representative_phone: e.target.value})}
                      placeholder={t('enterRepPhone')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('birthDate') || '생년월일'}</label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('gender') || '성별'}</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  >
                    <option value="">{t('select') || '선택'}</option>
                    <option value="male">{t('male') || '남성'}</option>
                    <option value="female">{t('female') || '여성'}</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleSave}
                disabled={loading}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('saving') || '저장 중...'}
                  </>
                ) : (
                  t('saveChanges')
                )}
              </button>
              <button 
                onClick={() => setActiveTab('mypage')}
                disabled={loading}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </SpotlightCard>
        </div>

        <div>
          <SpotlightCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">{t('profilePicture')}</h3>
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                <Icon type="user" size={48} />
              </div>
              <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white font-medium transition-colors">
                {t('changePicture')}
              </button>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};

// Privacy Settings 페이지
const PrivacySettingsView = ({ setActiveTab, t = (key) => key }) => {
  const [settings, setSettings] = useState({
    profileVisibility: 'public',
    showEmail: false,
    showActivity: true,
    allowMessages: true,
    showOnline: true
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title={t('privacySettings')}
        description="정보 공개 범위를 설정합니다"
        onBack={() => setActiveTab('mypage')}
      />

      <div className="space-y-4">
        <SpotlightCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-6">프로필 공개 범위</h3>
          
          <div className="space-y-4">
            {[
              { value: 'public', label: '전체 공개', desc: '모든 사람이 프로필을 볼 수 있습니다' },
              { value: 'friends', label: '친구 공개', desc: '친구만 프로필을 볼 수 있습니다' },
              { value: 'private', label: '비공개', desc: '본인만 프로필을 볼 수 있습니다' }
            ].map((option) => (
              <label key={option.value} className="flex items-start gap-3 p-4 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value={option.value}
                  checked={settings.profileVisibility === option.value}
                  onChange={(e) => setSettings({...settings, profileVisibility: e.target.value})}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">{option.label}</div>
                  <div className="text-sm text-gray-400">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-6">Privacy Options</h3>
          
          <div className="space-y-4">
            {[
              { key: 'showEmail', label: 'Show Email', desc: 'Allow others to see your email address' },
              { key: 'showActivity', label: 'Show Activity', desc: 'Display your recent activities on your profile' },
              { key: 'allowMessages', label: 'Allow Messages', desc: 'Let other users send you messages' },
              { key: 'showOnline', label: 'Show Online Status', desc: 'Display when you are online' }
            ].map((option) => (
              <div key={option.key} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div className="flex-1">
                  <div className="text-white font-medium">{option.label}</div>
                  <div className="text-sm text-gray-400">{option.desc}</div>
                </div>
                <button
                  onClick={() => setSettings({...settings, [option.key]: !settings[option.key]})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings[option.key] ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings[option.key] ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <button 
          onClick={() => alert('Privacy settings saved!')}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
        >
          Save Privacy Settings
        </button>
      </div>
    </div>
  );
};

// Notifications 페이지
const NotificationsView = ({ setActiveTab, t = (key) => key }) => {
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    matchReminders: true,
    skillUnlocks: true,
    rankChanges: true,
    friendRequests: true,
    messages: true,
    weeklyReport: false
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title="Notification Settings" 
        description="Manage how you receive notifications"
        onBack={() => setActiveTab('mypage')}
      />

      <div className="space-y-4">
        <SpotlightCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-6">Notification Channels</h3>
          
          <div className="space-y-4">
            {[
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email', icon: 'bell' },
              { key: 'pushNotifications', label: 'Push Notifications', desc: 'Receive push notifications on your device', icon: 'bell' }
            ].map((option) => (
              <div key={option.key} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div className="flex items-center gap-3 flex-1">
                  <Icon type={option.icon} size={20} className="text-blue-400" />
                  <div>
                    <div className="text-white font-medium">{option.label}</div>
                    <div className="text-sm text-gray-400">{option.desc}</div>
                  </div>
                </div>
                <button
                  onClick={() => setNotifications({...notifications, [option.key]: !notifications[option.key]})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications[option.key] ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications[option.key] ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-6">Notification Types</h3>
          
          <div className="space-y-4">
            {[
              { key: 'matchReminders', label: 'Match Reminders', desc: 'Get reminded about upcoming matches', icon: 'calendar' },
              { key: 'skillUnlocks', label: 'Skill Unlocks', desc: 'Notifications when you unlock new skills', icon: 'star' },
              { key: 'rankChanges', label: 'Rank Changes', desc: 'Alert when your rank changes', icon: 'trendingUp' },
              { key: 'friendRequests', label: 'Friend Requests', desc: 'Notifications for friend requests', icon: 'users' },
              { key: 'messages', label: 'Messages', desc: 'Get notified of new messages', icon: 'bell' },
              { key: 'weeklyReport', label: 'Weekly Report', desc: 'Receive weekly performance summary', icon: 'chart' }
            ].map((option) => (
              <div key={option.key} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div className="flex items-center gap-3 flex-1">
                  <Icon type={option.icon} size={20} className="text-blue-400" />
                  <div>
                    <div className="text-white font-medium">{option.label}</div>
                    <div className="text-sm text-gray-400">{option.desc}</div>
                  </div>
                </div>
                <button
                  onClick={() => setNotifications({...notifications, [option.key]: !notifications[option.key]})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications[option.key] ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications[option.key] ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <button 
          onClick={() => alert('Notification settings saved!')}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
        >
          Save Notification Settings
        </button>
      </div>
    </div>
  );
};

// Account Security 페이지
const AccountSecurityView = ({ setActiveTab, t = (key) => key }) => {
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title="Account Security" 
        description="Protect your account with strong security"
        onBack={() => setActiveTab('mypage')}
      />

      <div className="space-y-4">
        <SpotlightCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-6">Change Password</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Current Password</label>
              <input
                type="password"
                value={passwordData.current}
                onChange={(e) => setPasswordData({...passwordData, current: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
              <input
                type="password"
                value={passwordData.new}
                onChange={(e) => setPasswordData({...passwordData, new: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData({...passwordData, confirm: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                placeholder="Confirm new password"
              />
            </div>

            <button 
              onClick={() => alert('Password changed successfully!')}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
            >
              Update Password
            </button>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
            </div>
            <button
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                twoFactorEnabled ? 'bg-green-500' : 'bg-white/20'
              }`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                twoFactorEnabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </div>

          {twoFactorEnabled && (
            <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <Icon type="shield" size={20} className="text-green-400 mt-0.5" />
                <div>
                  <div className="text-green-400 font-medium mb-1">Two-Factor Authentication Enabled</div>
                  <div className="text-sm text-gray-400">Your account is protected with 2FA</div>
                </div>
              </div>
            </div>
          )}
        </SpotlightCard>

        <SpotlightCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Active Sessions</h3>
          
          <div className="space-y-3">
            {[
              { device: 'Chrome on Windows', location: 'Seoul, Korea', current: true, time: 'Active now' },
              { device: 'Safari on iPhone', location: 'Seoul, Korea', current: false, time: '2 hours ago' },
              { device: 'Chrome on MacBook', location: 'Seoul, Korea', current: false, time: '1 day ago' }
            ].map((session, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div className="flex items-center gap-3">
                  <Icon type="activity" size={20} className="text-blue-400" />
                  <div>
                    <div className="text-white font-medium">{session.device}</div>
                    <div className="text-sm text-gray-400">{session.location} • {session.time}</div>
                  </div>
                </div>
                {session.current ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Current</span>
                ) : (
                  <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};

// Activity History 페이지
const ActivityHistoryView = ({ setActiveTab, t = (key) => key }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailPage, setShowDetailPage] = useState(false);
  
  // 복싱 훈련 데이터 (날짜별)
  const trainingData = {
    '2024-02-07': {
      date: '2024-02-07',
      dayOfWeek: '수요일',
      totalTime: 120,
      calories: 850,
      exercises: [
        { name: '미트 트레이닝', duration: 60, rounds: 8, totalPunches: 800, intensity: 'high', icon: '🎯' },
        { name: '로드워크', duration: 30, distance: 5.2, calories: 350, pace: '5:46/km', intensity: 'medium', icon: '🏃' },
        { name: '스트레칭', duration: 30, type: '회복', flexibility: 85, intensity: 'low', icon: '🧘' },
      ],
      note: '오늘 컨디션 최상! 펀치 스피드 향상',
      coach: '김코치',
      satisfaction: 5,
    },
    '2024-02-06': {
      date: '2024-02-06',
      dayOfWeek: '화요일',
      totalTime: 90,
      calories: 620,
      exercises: [
        { name: '스파링', duration: 45, rounds: 6, intensity: 'high', icon: '🥊' },
        { name: '코어 강화', duration: 30, sets: 8, reps: 120, intensity: 'medium', icon: '💪' },
        { name: '쿨다운', duration: 15, type: '회복', intensity: 'low', icon: '🌊' },
      ],
      note: '스파링 파트너와 좋은 훈련',
      coach: '이코치',
      satisfaction: 4,
    },
    '2024-02-05': {
      date: '2024-02-05',
      dayOfWeek: '월요일',
      totalTime: 75,
      calories: 480,
      exercises: [
        { name: '섀도우 복싱', duration: 60, rounds: 8, intensity: 'medium', icon: '👤' },
        { name: '스트레칭', duration: 15, type: '유연성', intensity: 'low', icon: '🕉️' },
      ],
      note: '테크닉과 풋워크 집중',
      coach: '박코치',
      satisfaction: 5,
    },
    '2024-02-04': {
      date: '2024-02-04',
      dayOfWeek: '일요일',
      totalTime: 0,
      calories: 0,
      exercises: [],
      note: '휴식일',
      coach: null,
      satisfaction: null,
    },
    '2024-02-03': {
      date: '2024-02-03',
      dayOfWeek: '토요일',
      totalTime: 105,
      calories: 780,
      exercises: [
        { name: '헤비백 파워 훈련', duration: 60, rounds: 8, intensity: 'very-high', icon: '💥' },
        { name: '컨디셔닝', duration: 45, type: '체력강화', intensity: 'medium', icon: '🏃' },
      ],
      note: '개인 최고 기록! 펀치력 향상',
      coach: '최코치',
      satisfaction: 5,
    },
  };

  // 캘린더 생성
  const generateCalendar = () => {
    const calendar = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // 이번 달 1일
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // 시작 요일 (일요일 = 0)
    const startDay = firstDay.getDay();
    
    // 빈 칸 추가
    for (let i = 0; i < startDay; i++) {
      calendar.push(null);
    }
    
    // 날짜 추가
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendar.push({
        day,
        dateStr,
        data: trainingData[dateStr] || null,
      });
    }
    
    return calendar;
  };

  const calendar = generateCalendar();

  const handleDateClick = (dateData) => {
    if (dateData && dateData.data) {
      setSelectedDate(dateData.data);
      setShowDetailPage(false);
    }
  };

  // 상세 페이지 렌더링
  if (showDetailPage && selectedDate) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader 
          title={`🗓️ ${selectedDate.date} (${selectedDate.dayOfWeek})`}
          description="상세 트레이닝 리포트"
          onBack={() => setShowDetailPage(false)}
        />

        {/* 전체 통계 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SpotlightCard className="p-5 border-l-4 border-blue-500">
            <div className="text-sm text-gray-400 mb-1">총 운동 시간</div>
            <div className="text-3xl font-bold text-white">{selectedDate.totalTime}분</div>
          </SpotlightCard>
          <SpotlightCard className="p-5 border-l-4 border-red-500">
            <div className="text-sm text-gray-400 mb-1">소모 칼로리</div>
            <div className="text-3xl font-bold text-white">{selectedDate.calories}kcal</div>
          </SpotlightCard>
          <SpotlightCard className="p-5 border-l-4 border-purple-500">
            <div className="text-sm text-gray-400 mb-1">운동 종목</div>
            <div className="text-3xl font-bold text-white">{selectedDate.exercises.length}개</div>
          </SpotlightCard>
          <SpotlightCard className="p-5 border-l-4 border-yellow-500">
            <div className="text-sm text-gray-400 mb-1">만족도</div>
            <div className="text-3xl font-bold text-white">
              {'⭐'.repeat(selectedDate.satisfaction || 0)}
            </div>
          </SpotlightCard>
        </div>

        {/* 운동 상세 */}
        <SpotlightCard className="p-6 mb-6">
          <h3 className="text-2xl font-bold text-white mb-6">📋 운동 상세 내역</h3>
          <div className="space-y-6">
            {selectedDate.exercises.map((exercise, idx) => (
              <div key={idx} className="p-6 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl">{exercise.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-2xl font-bold text-white mb-1">{exercise.name}</h4>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        exercise.intensity === 'very-high' ? 'bg-red-500/20 text-red-400' :
                        exercise.intensity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        exercise.intensity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {exercise.intensity === 'very-high' ? '매우 높음' :
                         exercise.intensity === 'high' ? '높음' :
                         exercise.intensity === 'medium' ? '중간' : '낮음'}
                      </span>
                      <span className="text-gray-400 text-sm">{exercise.duration}분</span>
                    </div>
                  </div>
                </div>

                {/* 세부 정보 */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {exercise.sets && (
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">세트</div>
                      <div className="text-xl font-bold text-blue-400">{exercise.sets}</div>
                    </div>
                  )}
                  {exercise.reps && (
                    <div className="p-3 bg-purple-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">총 반복</div>
                      <div className="text-xl font-bold text-purple-400">{exercise.reps}</div>
                    </div>
                  )}
                  {exercise.weight && (
                    <div className="p-3 bg-red-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">총 중량</div>
                      <div className="text-xl font-bold text-red-400">{exercise.weight}kg</div>
                    </div>
                  )}
                  {exercise.distance && (
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">거리</div>
                      <div className="text-xl font-bold text-emerald-400">{exercise.distance}km</div>
                    </div>
                  )}
                  {exercise.calories && (
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">칼로리</div>
                      <div className="text-xl font-bold text-orange-400">{exercise.calories}kcal</div>
                    </div>
                  )}
                  {exercise.pace && (
                    <div className="p-3 bg-cyan-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">페이스</div>
                      <div className="text-xl font-bold text-cyan-400">{exercise.pace}</div>
                    </div>
                  )}
                  {exercise.rounds && (
                    <div className="p-3 bg-pink-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">라운드</div>
                      <div className="text-xl font-bold text-pink-400">{exercise.rounds}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        {/* 메모 및 코치 */}
        <div className="grid grid-cols-2 gap-6">
          <SpotlightCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">📝 메모</h3>
            <div className="p-4 bg-white/5 rounded-lg text-gray-300">
              {selectedDate.note}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">👨‍🏫 담당 코치</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                {selectedDate.coach?.charAt(0)}
              </div>
              <div>
                <div className="text-xl font-bold text-white">{selectedDate.coach}</div>
                <div className="text-sm text-gray-400">담당 코치</div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title="🗓️ 트레이닝 캘린더" 
        description="날짜를 클릭하여 운동 기록을 확인하세요"
        onBack={() => setActiveTab('mypage')}
      >
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
            ← 이전 달
          </button>
          <button className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg text-sm font-bold">
            2024년 2월
          </button>
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
            다음 달 →
          </button>
        </div>
      </PageHeader>

      {/* 캘린더 */}
      <SpotlightCard className="p-6">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={i} className={`text-center font-bold py-2 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((dateData, i) => (
            <div
              key={i}
              onClick={() => handleDateClick(dateData)}
              className={`aspect-square p-2 rounded-xl border-2 transition-all ${
                dateData === null
                  ? 'border-transparent cursor-default'
                  : dateData.data
                  ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 to-green-500/10 hover:border-emerald-500 cursor-pointer hover:scale-105'
                  : dateData.data !== undefined && dateData.data === null
                  ? 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer'
              }`}
            >
              {dateData && (
                <div className="flex flex-col h-full">
                  <div className="text-white font-bold text-lg mb-1">{dateData.day}</div>
                  {dateData.data && dateData.data.totalTime > 0 && (
                    <>
                      <div className="text-xs text-emerald-400 font-bold">{dateData.data.totalTime}분</div>
                      <div className="text-xs text-gray-500">{dateData.data.exercises.length}개 운동</div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* 날짜 클릭 모달 */}
      {selectedDate && !showDetailPage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDate(null)}
        >
          <div 
            className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-[95vw] sm:max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">{selectedDate.date} ({selectedDate.dayOfWeek})</h2>
                  <p className="text-gray-400">{t('trainingSummary')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowDetailPage(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105"
                  >
                    📊 자세히 보기
                  </button>
                  <button 
                    onClick={() => setSelectedDate(null)}
                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <span className="text-2xl">✕</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {selectedDate.totalTime === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">😴</div>
                  <div className="text-2xl font-bold text-white mb-2">휴식일</div>
                  <div className="text-gray-400">이 날은 운동을 하지 않았습니다</div>
                </div>
              ) : (
                <>
                  {/* 통계 카드 */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">총 운동 시간</div>
                      <div className="text-2xl font-bold text-blue-400">{selectedDate.totalTime}분</div>
                    </div>
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">소모 칼로리</div>
                      <div className="text-2xl font-bold text-red-400">{selectedDate.calories}kcal</div>
                    </div>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">운동 종목</div>
                      <div className="text-2xl font-bold text-purple-400">{selectedDate.exercises.length}개</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">만족도</div>
                      <div className="text-2xl font-bold text-yellow-400">
                        {'⭐'.repeat(selectedDate.satisfaction || 0)}
                      </div>
                    </div>
                  </div>

                  {/* 운동 리스트 */}
                  <div className="space-y-4 mb-6">
                    {selectedDate.exercises.map((exercise, idx) => (
                      <div key={idx} className="p-5 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-xl hover:border-white/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">{exercise.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-xl font-bold text-white">{exercise.name}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                exercise.intensity === 'very-high' ? 'bg-red-500/20 text-red-400' :
                                exercise.intensity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                exercise.intensity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {exercise.intensity === 'very-high' ? '매우 높음' :
                                 exercise.intensity === 'high' ? '높음' :
                                 exercise.intensity === 'medium' ? '중간' : '낮음'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span>⏱️ {exercise.duration}분</span>
                              {exercise.sets && <span>🔢 {exercise.sets} 세트</span>}
                              {exercise.distance && <span>📏 {exercise.distance}km</span>}
                              {exercise.calories && <span>🔥 {exercise.calories}kcal</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 메모 */}
                  <div className="p-5 bg-white/5 border border-white/10 rounded-xl mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">📝</span>
                      <h4 className="text-lg font-bold text-white">메모</h4>
                    </div>
                    <p className="text-gray-300">{selectedDate.note}</p>
                  </div>

                  {/* 담당 코치 */}
                  {selectedDate.coach && (
                    <div className="p-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                          {selectedDate.coach.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">담당 코치</div>
                          <div className="text-xl font-bold text-white">{selectedDate.coach}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Opponent Profile 페이지
const OpponentProfileView = ({ setActiveTab, t = (key) => key, opponentId }) => {
  const [opponent, setOpponent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOpponent = async () => {
      setLoading(true);
      const { getPublicPlayerProfileById } = await import('@/lib/supabase');
      const { data } = await getPublicPlayerProfileById(opponentId);
      setOpponent(data);
      setLoading(false);
    };

    if (opponentId) {
      loadOpponent();
    }
  }, [opponentId]);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          title="프로필 불러오는 중"
          description="선수 공개 프로필을 가져오고 있습니다"
          onBack={() => setActiveTab('ranking-tier-board')}
        />
        <SpotlightCard className="p-10 text-center text-gray-400">잠시만 기다려주세요.</SpotlightCard>
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          title="프로필을 찾을 수 없음"
          description="선수 공개 프로필 데이터가 없습니다"
          onBack={() => setActiveTab('ranking-tier-board')}
        />
        <SpotlightCard className="p-10 text-center text-gray-400">존재하지 않거나 비공개 처리된 선수입니다.</SpotlightCard>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader
        title={`${opponent.display_name} 프로필`}
        description="공개 선수 프로필"
        onBack={() => setActiveTab('ranking-tier-board')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpotlightCard className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg border-2 border-purple-400/50">
                {(opponent.display_name || 'U').charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-3xl font-bold text-white">{opponent.display_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                    opponent.role === 'player_athlete'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {opponent.role === 'player_athlete' ? t('player_athlete') : t('player_common')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                  <span className="font-bold text-yellow-400 whitespace-nowrap">{opponent.tier || 'Unranked'}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="whitespace-nowrap">{t('nationalRanking')} #{opponent.rank || '-'}</span>
                  {opponent.gym_name && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">{opponent.gym_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-500/20">
                <div className="text-xs text-blue-300 mb-1 whitespace-nowrap">{t('totalMatches')}</div>
                <div className="text-2xl font-bold text-white">{opponent.total_matches || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-3 border border-emerald-500/20">
                <div className="text-xs text-emerald-300 mb-1 whitespace-nowrap">{t('record')}</div>
                <div className="text-lg font-bold text-white">
                  {opponent.wins || 0}승 {opponent.draws || 0}무 {opponent.losses || 0}패
                </div>
                <div className="text-xs text-emerald-400 mt-1">승률 {opponent.win_rate || 0}%</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-3 border border-red-500/20">
                <div className="text-xs text-red-300 mb-1 whitespace-nowrap">{t('koWins')}</div>
                <div className="text-2xl font-bold text-red-400">{opponent.ko_wins || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-1 whitespace-nowrap">{t('winStreak')}</div>
                <div className="text-2xl font-bold text-purple-400">{opponent.current_win_streak || 0}</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-white mb-3">{t('boxingStyle')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="text-xs text-gray-400 mb-1">{t('mainStyle')}</div>
                  <div className="text-sm font-bold text-white">{opponent.boxing_style || '미등록'}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="text-xs text-gray-400 mb-1">{t('gender')}</div>
                  <div className="text-sm font-bold text-white">
                    {opponent.gender === 'female' ? t('female') : opponent.gender === 'male' ? t('male') : '미등록'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">{t('athleteInfo')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{t('height')}</div>
                  <div className="text-lg font-bold text-white">{opponent.height ? `${opponent.height}cm` : '미등록'}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-500/20">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{t('weight')}</div>
                  <div className="text-lg font-bold text-white">{opponent.weight ? `${opponent.weight}kg` : '미등록'}</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{t('gender')}</div>
                  <div className="text-lg font-bold text-white">
                    {opponent.gender === 'female' ? t('female') : opponent.gender === 'male' ? t('male') : '미등록'}
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>

        <div className="space-y-4">
          <SpotlightCard className="p-6 bg-[#1a1a1a]">
            <h3 className="text-lg font-bold text-white mb-4">티어 정보</h3>
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-1">
                {opponent.tier || 'Unranked'}
              </div>
              <div className="text-sm text-gray-400">전국 랭킹 #{opponent.rank || '-'}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">전적</span>
                <span className="text-sm font-bold text-white">
                  {opponent.wins || 0}승 {opponent.draws || 0}무 {opponent.losses || 0}패
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">KO승</span>
                <span className="text-sm font-bold text-red-400">{opponent.ko_wins || 0}회</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-400">현재 연승</span>
                <span className="text-sm font-bold text-purple-400">{opponent.current_win_streak || 0}연승</span>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};

// Achievements 페이지
const AchievementsView = ({ setActiveTab, t = (key) => key }) => {
  const achievements = [
    { name: '첫 승리', nameEn: 'First Victory', desc: '첫 경기에서 승리하기', descEn: 'Win your first match', icon: '🏆', unlocked: true, date: '2024-01-15' },
    { name: 'KO 데뷔', nameEn: 'KO Debut', desc: '첫 KO 승리 달성', descEn: 'Score your first KO', icon: '💥', unlocked: true, date: '2024-01-20' },
    { name: '스파링 마스터', nameEn: 'Sparring Master', desc: '스파링 50회 완료', descEn: 'Complete 50 sparring sessions', icon: '🥊', unlocked: true, date: '2024-02-01' },
    { name: '연승 행진', nameEn: 'Winning Streak', desc: '5연승 달성', descEn: 'Win 5 matches in a row', icon: '🔥', unlocked: true, date: '2024-02-05' },
    { name: '다이아 복서', nameEn: 'Diamond Boxer', desc: 'Diamond 티어 달성', descEn: 'Reach Diamond rank', icon: '💎', unlocked: true, date: '2024-02-10' },
    { name: '백전노장', nameEn: 'Century Fighter', desc: '100경기 출전', descEn: 'Fight 100 matches', icon: '💯', unlocked: false, progress: 67 },
    { name: '전설의 챔피언', nameEn: 'Legendary Champion', desc: 'Master 티어 달성', descEn: 'Reach Master rank', icon: '👑', unlocked: false, progress: 45 },
    { name: '완벽한 시합', nameEn: 'Perfect Match', desc: '무실점 승리', descEn: 'Win without taking damage', icon: '✨', unlocked: false, progress: 0 }
  ];

  return (
    <div className="animate-fade-in-up">
    <PageHeader 
      title={t('hi') === '안녕하세요' ? '업적' : 'Achievements'} 
      description={t('hi') === '안녕하세요' ? '복싱 선수로서의 성취를 확인하세요' : 'Track your accomplishments as a boxer'}
      onBack={() => setActiveTab('mypage')}
    >
      <SpotlightCard className="px-6 py-3">
        <div className="text-center">
          <div className="text-sm text-gray-400">{t('hi') === '안녕하세요' ? '달성' : 'Unlocked'}</div>
          <div className="text-2xl font-bold text-yellow-400">
            {achievements.filter(a => a.unlocked).length}/{achievements.length}
          </div>
        </div>
      </SpotlightCard>
    </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map((achievement, i) => (
          <SpotlightCard key={i} className={`p-6 ${achievement.unlocked ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl ${
                achievement.unlocked ? 'bg-yellow-500/20' : 'bg-white/5'
              }`}>
                {achievement.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{t('hi') === '안녕하세요' ? achievement.name : achievement.nameEn}</h3>
                  {achievement.unlocked && (
                    <Icon type="star" size={20} className="text-yellow-400" fill="currentColor" />
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-3">{t('hi') === '안녕하세요' ? achievement.desc : achievement.descEn}</p>
                
                {achievement.unlocked ? (
                  <div className="text-xs text-green-400">
                    {t('hi') === '안녕하세요' ? `달성일: ${achievement.date}` : `Unlocked on ${achievement.date}`}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>{t('hi') === '안녕하세요' ? '진행도' : 'Progress'}</span>
                      <span>{achievement.progress}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${achievement.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
};

export { MyPageView, EditProfileView, PrivacySettingsView, NotificationsView, AccountSecurityView, ActivityHistoryView, OpponentProfileView, AchievementsView };
