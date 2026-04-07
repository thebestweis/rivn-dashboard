"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type CurrentUserRow = {
  id: string;
  email: string;
  status: "active";
};

export function UsersSettingsTab() {
  const [users, setUsers] = useState<CurrentUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        setIsLoading(true);

        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (!isMounted) return;

        if (!user) {
          setUsers([]);
          return;
        }

        setUsers([
          {
            id: user.id,
            email: user.email ?? "Без email",
            status: "active",
          },
        ]);
      } catch (error) {
        console.error("Ошибка загрузки пользователя:", error);

        if (isMounted) {
          setUsers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Users</div>
      <h2 className="mt-1 text-xl font-semibold">Пользователь аккаунта</h2>
      <div className="mt-2 text-sm text-white/55">
        Здесь отображается текущий авторизованный пользователь.
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Статус</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-sm text-white/45"
                >
                  Загрузка пользователя...
                </td>
              </tr>
            ) : users.length > 0 ? (
              users.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium text-white/80">
                    <span className="inline-block max-w-[240px] truncate">
                      {item.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/75">{item.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                      Активен
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-sm text-white/45"
                >
                  Пользователь не найден.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}