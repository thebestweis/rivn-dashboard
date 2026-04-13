import { Suspense } from "react";
import { RegisterPageContent } from "./register-page-content";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0F1A] px-4 py-8 text-white">
          <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
            <div className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(10,14,26,0.96))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="text-sm text-white/45">RIVN Control</div>
              <h1 className="mt-2 text-3xl font-semibold">Регистрация</h1>
              <p className="mt-2 text-sm text-white/60">Загрузка...</p>
            </div>
          </div>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}