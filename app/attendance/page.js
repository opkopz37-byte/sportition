'use client';

import { useState, useEffect } from 'react';
import { searchUserByPhone, checkAttendance, getUserProfile } from '@/lib/supabase';

export default function AttendancePage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key >= '0' && e.key <= '9' && phoneInput.length < 4) {
        setPhoneInput(phoneInput + e.key);
      } else if (e.key === 'Backspace') {
        setPhoneInput(phoneInput.slice(0, -1));
      } else if (e.key === 'Enter' && phoneInput.length === 4) {
        handleCheckIn();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          handleReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [phoneInput]);

  const handleNumberClick = (num) => {
    if (phoneInput.length < 4) {
      setPhoneInput(phoneInput + num);
    }
  };

  const handleBackspace = () => {
    setPhoneInput(phoneInput.slice(0, -1));
  };

  const handleReset = () => {
    setPhoneInput('');
    setSearchResults([]);
    setSelectedMember(null);
    setShowSuccess(false);
    setError('');
  };

  const handleCheckIn = async () => {
    if (phoneInput.length === 4) {
      setError('');
      
      const { data: users, error: searchError } = await searchUserByPhone(phoneInput);
      
      if (searchError) {
        setError('검색 중 오류가 발생했습니다.');
        return;
      }

      if (!users || users.length === 0) {
        setError('등록된 회원 정보가 없습니다.');
        setTimeout(() => {
          handleReset();
        }, 2000);
      } else if (users.length === 1) {
        await processAttendance(users[0]);
      } else {
        setSearchResults(users);
      }
    }
  };

  const processAttendance = async (member) => {
    const { data, error: attendanceError, message } = await checkAttendance(
      member.id,
      member.membership_type
    );

    if (attendanceError) {
      setError(message || '출석 체크에 실패했습니다.');
      setTimeout(() => {
        handleReset();
      }, 3000);
      return;
    }

    setSelectedMember(member);
    setShowSuccess(true);
    
    setTimeout(() => {
      handleReset();
    }, 3000);
  };

  const formatTime = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
  };

  if (showSuccess && selectedMember) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-black to-black relative">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={() => document.documentElement.requestFullscreen()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center gap-2"
            title="전체화면"
          >
            <span>⛶</span>
            <span className="hidden sm:inline">전체화면</span>
          </button>
        </div>

        <div className="text-center animate-fade-in">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <span className="text-8xl">✓</span>
          </div>
          <h2 className="text-6xl font-bold text-white mb-4">출석 완료!</h2>
          <p className="text-3xl text-emerald-400 mb-6">{selectedMember.full_name}님</p>
          <p className="text-2xl text-gray-400">오늘도 화이팅하세요! 💪</p>
        </div>
      </div>
    );
  }

  if (searchResults.length > 1) {
    return (
      <div className="h-screen flex bg-black relative">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={() => document.documentElement.requestFullscreen()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center gap-2"
            title="전체화면"
          >
            <span>⛶</span>
            <span className="hidden sm:inline">전체화면</span>
          </button>
        </div>

        <div className="w-full md:w-1/2 relative overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80"
            alt="Gym"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50" />
          
          <div className="absolute top-8 left-8">
            <h1 className="text-4xl font-bold text-white mb-2">Sportition</h1>
            <p className="text-lg text-gray-300">회원 출석 시스템</p>
          </div>
        </div>

        <div className="w-full md:w-1/2 flex flex-col p-12 bg-gradient-to-br from-black to-gray-900">
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-4xl font-bold text-white mb-3 text-center">본인을 선택해주세요</h2>
            <p className="text-xl text-gray-400 mb-12 text-center">동일한 번호의 회원이 {searchResults.length}명 있습니다</p>
            
            <div className="space-y-4 max-w-2xl mx-auto w-full">
              {searchResults.map((member) => (
                <button
                  key={member.id}
                  onClick={() => processAttendance(member)}
                  className="w-full p-6 bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-blue-500 rounded-2xl transition-all flex items-center gap-6"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-4xl">
                    👤
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-3xl font-bold text-white mb-1">{member.full_name}</h3>
                    <p className="text-xl text-gray-400">
                      {member.birth_date} • {member.membership_type}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleReset}
              className="mt-8 mx-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xl transition-all"
            >
              ← 다시 입력하기
            </button>
          </div>

          <div className="text-center text-gray-500 text-lg">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-black relative">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => document.documentElement.requestFullscreen()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center gap-2"
          title="전체화면"
        >
          <span>⛶</span>
          <span className="hidden sm:inline">전체화면</span>
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="w-10 h-10 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 hover:text-red-300 text-xl transition-all"
          title="홈으로"
        >
          ×
        </button>
      </div>

      <div className="w-full md:w-1/2 relative overflow-hidden hidden md:block">
        <img 
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80"
          alt="Gym"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50" />
        
        <div className="absolute top-8 left-8">
          <h1 className="text-4xl font-bold text-white mb-2">Sportition</h1>
          <p className="text-lg text-gray-300">회원 출석 시스템</p>
        </div>

        <div className="absolute bottom-12 left-8 right-8">
          <p className="text-3xl font-bold text-white mb-2">오늘도 800kcal 태워보자구요!!</p>
          <p className="text-xl text-gray-300">건강한 하루의 시작을 응원합니다 💪</p>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex flex-col p-6 sm:p-12 bg-gradient-to-br from-black to-gray-900">
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
          <div className="md:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Sportition</h1>
            <p className="text-sm text-gray-300">회원 출석 시스템</p>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
              휴대전화의 마지막 4자리를 입력
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-3 sm:gap-4 mb-8">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-16 h-20 sm:w-20 sm:h-24 rounded-2xl border-4 flex items-center justify-center text-4xl sm:text-5xl font-bold transition-all ${
                    phoneInput[idx]
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-white/20 bg-white/5 text-gray-600'
                  }`}
                >
                  {phoneInput[idx] || ''}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="aspect-square rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-blue-500 text-3xl sm:text-4xl font-bold text-white transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleNumberClick('0')}
              className="aspect-square rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-blue-500 text-3xl sm:text-4xl font-bold text-white transition-all col-start-2 active:scale-95"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="aspect-square rounded-2xl bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 hover:border-red-500 text-2xl sm:text-3xl font-bold text-red-400 transition-all active:scale-95"
            >
              ←
            </button>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={phoneInput.length !== 4}
            className={`w-full py-4 sm:py-6 rounded-2xl text-xl sm:text-2xl font-bold transition-all ${
              phoneInput.length === 4
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-2xl hover:scale-105'
                : 'bg-white/10 text-gray-600 cursor-not-allowed'
            }`}
          >
            체크인
          </button>
        </div>

        <div className="text-center text-gray-500 text-sm sm:text-lg mt-8">
          ⏰ {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
}
