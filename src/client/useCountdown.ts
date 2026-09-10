/**
 * 倒计时工厂 hook：以给定间隔重渲染，供倒计时文本与紧急度判断使用。
 * @module dsh-session-scheduler/client/useCountdown
 */
import { useEffect, useRef, useState } from 'react';

/** 每秒 tick。 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** 相对目标时间的剩余毫秒。 */
export function useRemaining(targetEpoch: number | undefined, now: number | undefined = useNow()): number {
  if (targetEpoch === undefined) return 0;
  return Math.max(0, targetEpoch - (now ?? Date.now()));
}
