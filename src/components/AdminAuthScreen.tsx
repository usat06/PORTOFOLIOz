import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { ArrowLeft, Check, Copy, ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIREBASE_PROJECT_ID,
  googleProvider,
  isAuthorizedAdmin,
} from '../lib/firebase';

interface AdminAuthScreenProps {
  currentUser: User | null;
  checkingAuth: boolean;
  onAuthenticated: (user: User) => void;
  onExit: () => void;
  notice?: string | null;
}

export function AdminAuthScreen({
  currentUser,
  checkingAuth,
  onAuthenticated,
  onExit,
  notice,
}: AdminAuthScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setUnauthorizedDomain(null);
    setSubmitting(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const allowed = await isAuthorizedAdmin(result.user);
      if (!allowed) {
        setError(
          `Akun Google (${result.user.email || 'tanpa email'}) belum terdaftar sebagai admin portofolio ini.`,
        );
        return;
      }
      onAuthenticated(result.user);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code === 'auth/unauthorized-domain') {
        const host = window.location.hostname;
        setUnauthorizedDomain(host);
        setError(
          `Domain "${host}" belum ditambahkan ke daftar Authorized Domains di Firebase Authentication.`,
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Jendela login Google ditutup sebelum proses selesai.');
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up login diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba lagi.');
      } else {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Gagal masuk dengan akun Google. Silakan coba lagi.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError(null);
    await signOut(auth).catch(() => {});
  };

  const handleCopyHostname = async () => {
    if (!unauthorizedDomain) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomain);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleCopyUid = async () => {
    if (!currentUser?.uid) return;
    try {
      await navigator.clipboard.writeText(currentUser.uid);
      setCopiedUid(true);
      window.setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between bg-[#f8f7f4] px-4 py-8 text-[#18181b] sm:px-6">
      <div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-xs font-semibold uppercase tracking-[0.16em] text-[#71717a] transition-colors hover:text-[#18181b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Situs
        </button>
      </div>

      <div className="mx-auto w-full max-w-[460px] border border-[#e4e4e7] bg-white p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3 text-[#18181b]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#e4e4e7] bg-[#fafafa]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#71717a]">
              Ruang Admin · Cloud Database
            </p>
            <h1 className="m-0 font-serif text-2xl font-normal tracking-tight">
              {checkingAuth ? 'Memeriksa Sesi Admin...' : 'Masuk Panel Admin'}
            </h1>
          </div>
        </div>

        {checkingAuth ? (
          <div className="py-6 text-sm text-[#71717a]">Menghubungkan ke autentikasi cloud...</div>
        ) : (
          <div className="space-y-5">
            {notice && !error && (
              <div
                role="status"
                className="border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800"
              >
                {notice}
              </div>
            )}

            <p className="m-0 text-sm leading-relaxed text-[#52525b]">
              Masuk dengan akun Google admin (<span className="font-semibold text-[#18181b]">{BOOTSTRAPPED_ADMIN_EMAIL}</span>) untuk mengelola teks, desain, proyek, sertifikat, dan mengunggah foto/video secara permanen ke semua tautan.
            </p>

            {currentUser && (
              <div className="border border-[#e4e4e7] bg-[#fafafa] p-3.5 text-xs text-[#3f3f46]">
                <div className="font-medium text-[#18181b]">
                  Sedang masuk sebagai: {currentUser.email || currentUser.uid}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#71717a]">
                  <span className="truncate font-mono">UID: {currentUser.uid}</span>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="inline-flex shrink-0 items-center gap-1 border border-[#d4d4d8] bg-white px-2 py-0.5 text-[10px] font-medium text-[#18181b]"
                  >
                    {copiedUid ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedUid ? 'Disalin' : 'Salin UID'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="mt-2.5 inline-flex items-center gap-1.5 border border-[#d4d4d8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                >
                  <LogOut className="h-3 w-3" />
                  Ganti Akun Google
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-700"
              >
                {error}
              </div>
            )}

            {unauthorizedDomain && (
              <div className="space-y-2.5 border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-950">
                <p className="m-0 font-semibold">Cara mengaktifkan login admin di domain ini:</p>
                <ol className="m-0 list-decimal space-y-1 pl-4">
                  <li>Salin nama domain saat ini:</li>
                </ol>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate border border-amber-300 bg-white px-2.5 py-1.5 font-mono text-[11px]">
                    {unauthorizedDomain}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHostname}
                    className="inline-flex shrink-0 items-center gap-1 border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#18181b]"
                  >
                    {copiedHost ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedHost ? 'Disalin' : 'Salin'}
                  </button>
                </div>
                <p className="m-0">
                  Buka Firebase Authentication Settings → <strong>Authorized domains</strong> →{' '}
                  <strong>Add domain</strong>, lalu tempel domain di atas.
                </p>
                <a
                  href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#18181b] underline"
                >
                  Buka Firebase Console
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-2.5 border-0 bg-[#18181b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#27272a] disabled:opacity-50"
            >
              {submitting ? 'Menghubungkan ke Google...' : 'Masuk dengan Google (Admin)'}
            </button>
          </div>
        )}
      </div>

      <p className="m-0 text-center text-xs text-[#71717a]">
        Akses tersembunyi · Tekan Ctrl+Shift+A atau buka #/admin kapan saja
      </p>
    </div>
  );
}
