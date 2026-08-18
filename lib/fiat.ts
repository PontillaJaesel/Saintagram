import type { FiatCategory, FiatLeaderboardPeriod, FiatStats, ReflectionPost } from "@/types";

export const FIAT_CATEGORIES: readonly { value: FiatCategory; label: string }[] = [
  { value: "prayer", label: "Prayer" }, { value: "forgiveness", label: "Forgiveness" },
  { value: "service", label: "Service" }, { value: "sacrifice", label: "Sacrifice" },
  { value: "act-of-love", label: "Act of Love" }, { value: "responsible-choice", label: "Responsible Choice" },
  { value: "other", label: "Other" }
] as const;
const categorySet = new Set<string>(FIAT_CATEGORIES.map((item) => item.value));
export function isFiatCategory(value: unknown): value is FiatCategory { return typeof value === "string" && categorySet.has(value); }
export function fiatCategoryLabel(value: FiatCategory): string { return FIAT_CATEGORIES.find((item) => item.value === value)?.label ?? "Other"; }
export function localDateKey(value: Date | string = new Date()): string { const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return"";const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return`${y}-${m}-${d}`; }
export function reflectionFiatDateKey(post: Pick<ReflectionPost,"createdAt"|"fiatDateKey">): string { return /^\d{4}-\d{2}-\d{2}$/.test(post.fiatDateKey??"")?post.fiatDateKey!:localDateKey(post.createdAt); }
const atNoon=(key:string)=>new Date(`${key}T12:00:00`);
const addDays=(key:string,amount:number)=>{const d=atNoon(key);d.setDate(d.getDate()+amount);return localDateKey(d);};
export function fiatPeriodBounds(period: FiatLeaderboardPeriod, today=localDateKey()):{start:string;end:string}{if(period==="today")return{start:today,end:today};const date=atNoon(today);if(period==="week"){const offset=(date.getDay()+6)%7;return{start:addDays(today,-offset),end:addDays(today,6-offset)};}return{start:`${today.slice(0,7)}-01`,end:localDateKey(new Date(date.getFullYear(),date.getMonth()+1,0,12))};}
export function calculateFiatStats(posts: readonly ReflectionPost[], today=localDateKey()):FiatStats{const fiat=posts.filter((p)=>!p.isPrivate&&p.fiatCategory&&reflectionFiatDateKey(p));const days=new Set(fiat.map(reflectionFiatDateKey));const sorted=[...days].sort();let longest=0,run=0,previous="";for(const key of sorted){run=previous&&addDays(previous,1)===key?run+1:1;longest=Math.max(longest,run);previous=key;}const last=sorted.at(-1);let current=0;if(last===today||last===addDays(today,-1)){let cursor=last!;while(days.has(cursor)){current++;cursor=addDays(cursor,-1);}}const week=fiatPeriodBounds("week",today);return{currentStreak:current,longestStreak:longest,activeToday:days.has(today),totalFiatEntries:fiat.length,totalFiatDays:days.size,thisWeekEntries:fiat.filter(p=>{const k=reflectionFiatDateKey(p);return k>=week.start&&k<=week.end;}).length};}
export function eligibleFiatCount(posts: readonly ReflectionPost[],start:string,end:string):number{return posts.filter(post=>{if(post.isPrivate||!post.fiatCategory)return false;const key=reflectionFiatDateKey(post);return key>=start&&key<=end;}).length;}
