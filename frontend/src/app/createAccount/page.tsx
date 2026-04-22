import type { Metadata } from "next";

import { CreateAccountForm } from "@/components/create-account/CreateAccountForm";

export const metadata: Metadata = {
    title: "Create Account | Curriculum Updater",
    description: "Create an account for the Material Enhancement Assistant.",
};

export default function CreateAccountPage() {
    return (
        <main className="min-h-screen bg-[#f3ede4] text-foreground">
            <div className="mx-auto flex min-h-screen w-full max-w-295 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                <div className="flex flex-1 flex-col justify-center">
                    <div className="overflow-hidden rounded-[24px] border border-[#e4d8c8] bg-[#faf7f2] shadow-[0_28px_80px_-48px_rgba(54,43,31,0.34)]">
                        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
                            <aside className="relative overflow-hidden bg-[#183326] p-7 text-white sm:p-8 lg:p-10">
                                <div
                                    className="absolute inset-0 opacity-80"
                                    style={{
                                        backgroundImage: [
                                            "linear-gradient(180deg, rgba(10, 20, 15, 0.22), rgba(10, 20, 15, 0.72))",
                                            "repeating-linear-gradient(90deg, rgba(203, 182, 132, 0.22) 0 8%, transparent 8% 18%, rgba(203, 182, 132, 0.16) 18% 28%, transparent 28% 38%, rgba(203, 182, 132, 0.14) 38% 48%, transparent 48% 58%, rgba(203, 182, 132, 0.14) 58% 68%, transparent 68% 78%, rgba(203, 182, 132, 0.1) 78% 88%, transparent 88% 100%)",
                                            "repeating-linear-gradient(180deg, rgba(236, 222, 193, 0.12) 0 2px, transparent 2px 54px)",
                                        ].join(", "),
                                    }}
                                />
                                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(27,53,39,0.22),rgba(12,24,18,0.7))]" />
                                <div className="absolute inset-x-0 top-0 h-16 opacity-70 [background-image:repeating-linear-gradient(145deg,rgba(223,214,191,0.38)_0_18px,transparent_18px_42px)]" />
                                <div className="absolute bottom-0 left-[42%] top-[22%] w-[18%] bg-[linear-gradient(180deg,rgba(223,197,120,0.14),rgba(223,197,120,0.02))] blur-sm" />
                                <div className="absolute inset-y-0 right-0 w-px bg-[rgba(255,255,255,0.06)]" />

                                <div className="relative flex h-full flex-col justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                                            Join the workspace
                                        </p>
                                        <h1 className="mt-4 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] sm:text-[2.7rem]">
                                            Create your account
                                        </h1>
                                        <p className="mt-4 max-w-[280px] text-sm leading-6 text-white/78">
                                            Set up your profile so the assistant can track your role and keep your course materials organized.
                                        </p>
                                    </div>

                                    <div className="mt-8 space-y-3 text-sm text-white/82">
                                        <p>1. Sign up with your academic email.</p>
                                        <p>2. Choose whether you are a student or professor.</p>
                                        <p>3. Start uploading course materials right away.</p>
                                    </div>
                                </div>
                            </aside>

                            <CreateAccountForm />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}