"use client";

import Link from "next/link";

type UpcomingItem = {
  date: string;
  title: string;
  value: string;
  href?: string;
};

interface UpcomingActionsProps {
  items: UpcomingItem[];
}

export function UpcomingActions({ items }: UpcomingActionsProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Ближайшие действия</div>
          <h2 className="mt-1 text-xl font-semibold">Что идёт следующим</h2>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const content = (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-white/45">{item.date}</div>
                  <div className="mt-1 font-medium text-white">{item.title}</div>
                </div>

                <div className="text-right text-sm font-medium text-white/85">
                  {item.value}
                </div>
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link key={`${item.date}_${item.title}`} href={item.href}>
                {content}
              </Link>
            );
          }

          return (
            <div key={`${item.date}_${item.title}`}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}