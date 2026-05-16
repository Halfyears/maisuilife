// app/(dashboard)/fellowship/create/page.tsx
'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js'; // 1. 改用绝对通用的原生 JS 客户端，避开所有 Next.js 助手包陷阱

// 从环境变量直接读取，这在 Vercel 生产环境是绝对标准的操作
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      // 2. 原生获取 Session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('未检测到有效登录，请尝试重新登录');
      }

      // 3. 直连架构：前端带着真实的 leader_id 物理砸进 Supabase
      const { error: insertError } = await supabase
        .from('fellowships')
        .insert([
          {
            name: name.trim(),
            leader_id: session.user.id // 彻底锁定物理表字段名！
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      // 4. 创建成功后，全页重载，强制刷新软缓存
      window.location.href = '/fellowship';

    } catch (err: any) {
      console.error('创建团契物理失败:', err);
      setErrorMsg(err.message || '数据库架构拦截，请检查字段约束或 RLS 权限');
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
            💥 架构拦截错误：{errorMsg}
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