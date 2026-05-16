// app/(dashboard)/fellowship/create/page.tsx
'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function CreateFellowshipPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. 从当前浏览器的 localStorage / Cookie 中直接暴力抓取全局 Supabase Auth 凭证
      let token = '';
      if (typeof window !== 'undefined') {
        // 尝试从本地存储中提取可能存在的 Supabase Session 缓存
        const storageKeys = Object.keys(localStorage);
        const authKey = storageKeys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        if (authKey) {
          const rawData = localStorage.getItem(authKey);
          if (rawData) {
            const parsed = JSON.parse(rawData);
            token = parsed?.access_token || '';
          }
        }
      }

      // 2. 初始化带有绝对访问权限的原生客户端
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      // 如果找到了 token，直接作为全局 Header 强行物理注入，绕过所有 auth-helpers 的载体干扰
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      });

      // 3. 再次向 Supabase 确认当前会话（如果 Header 注入成功，这里会完美回显）
      const { data: { session } } = await supabase.auth.getSession();
      
      // 容错机制：如果 RLS 允许或底层有依赖，直接提取 UID
      let userId = session?.user?.id;
      
      // 极端防御：如果客户端依然被沙盒隔离，直接解析刚才抓出来的 JWT Token 获取用户物理 ID
      if (!userId && token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          userId = JSON.parse(jsonPayload)?.sub;
        } catch (e) {
          console.error('解析本地 Token 失败:', e);
        }
      }

      if (!userId) {
        throw new Error('未检测到本地有效登录令牌，请先在设置页刷新登录状态');
      }

      // 4. 直连砸入：严格对齐 leader_id 字段
      const { error: insertError } = await supabase
        .from('fellowships')
        .insert([
          {
            name: name.trim(),
            leader_id: userId // 锁定物理字段
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      // 5. 成功后暴力重载，冲刷一切软路由缓存
      window.location.href = '/fellowship';

    } catch (err: any) {
      console.error('创建团契物理失败:', err);
      setErrorMsg(err.message || '数据库架构拦截或 RLS 鉴权未通过');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto mt-10">
      <div className="bg-white rounded-2xl p-8 shadow-xl border border-stone-100 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-stone-800 tracking-wide">✨ 创建新麦穗小组</h2>
          <p className="text-stone-400 text-xs mt-1">开启属于你们的全新属灵守望同行之旅</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium leading-relaxed">
            💥 运行状态反馈：{errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-stone-700">团契小组名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：恩典甘霖小组、Fontana 守望团契"
              className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-500 transition-all text-sm"
              maxLength={30}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full block py-4 text-center font-black text-white rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 shadow-md shadow-orange-500/10 active:scale-[0.99] transition-all tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⚡ 正在激活属灵疆界...' : '＋ 立即创建麦穗小组'}
          </button>
        </form>
      </div>
    </div>
  );
}