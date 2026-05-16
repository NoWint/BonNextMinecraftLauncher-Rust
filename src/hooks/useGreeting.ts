import { useMemo } from 'react';

interface Greeting {
  emoji: string;
  title: string;
  subtitle: string;
}

const GREETINGS: Record<string, Greeting[]> = {
  morning: [
    { emoji: '🌅', title: '早安，方块人', subtitle: '新的一天，新的冒险' },
    { emoji: '☀️', title: 'MINECRAFT 在等你', subtitle: '昨晚的红石机器还好吗？' },
    { emoji: '⛏', title: '早上好，矿工', subtitle: '今天挖到钻石了吗？' },
    { emoji: '🌄', title: '太阳升起了', subtitle: '僵尸已经烧光了，安全了' },
  ],
  afternoon: [
    { emoji: '🏗', title: '建造时间到', subtitle: '你的城堡还需要多少方块？' },
    { emoji: '⚡', title: '能量满满', subtitle: '来一场酣畅淋漓的建造吧' },
    { emoji: '🎯', title: '继续冒险', subtitle: '末影龙还在等你' },
    { emoji: '🔮', title: '附魔时刻', subtitle: '今天运气不会太差' },
  ],
  evening: [
    { emoji: '🌙', title: '深夜挖矿时间', subtitle: '带上火把，小心苦力怕' },
    { emoji: '🏕', title: '篝火已点燃', subtitle: '在安全的基地里放松一下' },
    { emoji: '🌌', title: '星空下的方块世界', subtitle: '信标的光芒指引着方向' },
    { emoji: '🕯', title: '夜深了', subtitle: '只有你的镐子发出微弱的光' },
  ],
  night: [
    { emoji: '🌃', title: '午夜矿工', subtitle: '钻石在 Y=-58 深处闪烁' },
    { emoji: '🐺', title: '狼群在嚎叫', subtitle: '还好你带了骨头' },
    { emoji: '🦇', title: '洞穴回声', subtitle: '这是你的专属采矿时光' },
    { emoji: '✨', title: '下界星光', subtitle: '猪灵已经睡着了，安全了' },
  ],
};

export function useGreeting(): Greeting {
  return useMemo(() => {
    const hour = new Date().getHours();
    let period: string;
    if (hour >= 5 && hour < 12) period = 'morning';
    else if (hour >= 12 && hour < 17) period = 'afternoon';
    else if (hour >= 17 && hour < 22) period = 'evening';
    else period = 'night';

    const list = GREETINGS[period];
    return list[Math.floor(Math.random() * list.length)];
  }, []);
}

/**
 * Returns a random Minecraft-themed loading message.
 */
const LOADING_MESSAGES = [
  '正在召唤末影龙...',
  '正在打开地狱门...',
  '正在合成工作台...',
  '正在附魔钻石镐...',
  '正在繁殖村民...',
  '正在寻找要塞...',
  '正在酿造药水...',
  '正在驯服野狼...',
  '正在种植小麦...',
  '正在探索下界...',
  '正在收集经验值...',
  '正在激活信标...',
];

export function getRandomLoadingMessage(): string {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}
