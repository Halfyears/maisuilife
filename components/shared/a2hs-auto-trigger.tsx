'use client'

import { useEffect, useState } from 'react'
import { AddToHomeScreen, shouldShowA2HS, markA2HSShown } from './add-to-home-screen'

/**
 * 在首页静默检测并自动弹出「添加到主屏幕」引导。
 * 覆盖所有登录入口（Google OAuth / Apple / 密码 / 魔术链接），
 * 因为它们最终都会落到首页。
 * 注册页自带相同逻辑，两者通过 localStorage a2hs_shown 去重，不会重复弹出。
 */
export function A2HSAutoTrigger() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (shouldShowA2HS()) setShow(true)
  }, [])

  if (!show) return null

  return (
    <AddToHomeScreen
      onClose={() => {
        markA2HSShown()
        setShow(false)
      }}
    />
  )
}
