import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, RotateCw, ShieldCheck } from 'lucide-react';

interface AdminAuthScreenProps {
  onAuthenticated: (token: string) => void;
  onExit: () => void;
  notice?: string | null;
}

interface AuthStatusResponse {
  needsSetup?: boolean;
  hasEnvPasscode?: boolean;
  isVercel?: boolean;
  error?: string;
}

export function AdminAuthScreen({ onAuthenticated, onExit, notice }: AdminAuthScreenProps) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [hasEnvPasscode, setHasEnvPasscode] = useState(false);
  const [isVercel, setIsVercel] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAuthStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/admin/auth-status');
      let data: AuthStatusResponse | null = null;
      try {
        data = (await res.json()) as AuthStatusResponse;
      } catch {
        data = null;
      }

      if (!res.ok || !data || typeof data.needsSetup !== 'boolean') {
        throw new Error(data?.error || `Server mengembalikan status ${res.status}.`);
      }

      setNeedsSetup(Boolean(data.needsSetup));
      setHasEnvPasscode(Boolean(data.hasEnvPasscode));
      setIsVercel(Boolean(data.isVercel));
    } catch (err) {
      setStatusError(
        err instanceof Error && err.message
          ? err.message
          : 'Gagal terhubung ke server admin.',
      );
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (needsSetup) {
      if (password.length < 6) {
        setError('Kata sandi minimal 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi kata sandi tidak cocok.');
        return;
      }
    } else if (!password) {
      setError('Masukkan kata sandi admin.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = needsSetup ? '/api/admin/setup' : '/api/admin/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      let payload: { token?: string; error?: string } = {};
      try {
        payload = (await response.json()) as { token?: string; error?: string };
      } catch {
        // Non-JSON response
      }

      if (!response.ok || !payload.token) {
        setError(payload.error || `Autentikasi gagal (${response.status}).`);
        return;
      }

      onAuthenticated(payload.token);
    } catch {
      setError('Terjadi kesalahan jaringan saat menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#f8f7f4] px-6 py-8 text-[#18181b]">
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

      <div className="mx-auto w-full max-w-[420px] border border-[#e4e4e7] bg-white p-8">
        <div className="mb-6 flex items-center gap-3 text-[#18181b]">
          <div className="flex h-10 w-10 items-center justify-center border border-[#e4e4e7] bg-[#fafafa]">
            {needsSetup ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#71717a]">
              Ruang Admin
            </p>
            <h1 className="m-0 font-serif text-2xl font-normal tracking-tight">
              {loadingStatus
                ? 'Memeriksa Akses...'
                : statusError
                  ? 'Koneksi Server Bermasalah'
                  : needsSetup
                    ? 'Buat Kata Sandi Admin'
                    : 'Masuk Panel Admin'}
            </h1>
          </div>
        </div>

        {loadingStatus ? (
          <div className="py-8 text-sm text-[#71717a]">Memuat status keamanan server...</div>
        ) : statusError ? (
          <div className="space-y-4">
            <div
              role="alert"
              className="border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-700"
            >
              {statusError}
            </div>
            <button
              type="button"
              onClick={() => void loadAuthStatus()}
              className="inline-flex w-full items-center justify-center gap-2 border-0 bg-[#18181b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#27272a]"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Coba Lagi
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {notice && !error && (
              <div
                role="status"
                className="border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800"
              >
                {notice}
              </div>
            )}

            {isVercel && !hasEnvPasscode && (
              <div className="border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900">
                Server berjalan di mode serverless Vercel. Agar login admin stabil di semua permintaan, tambahkan variabel{' '}
                <code>ADMIN_PASSCODE</code> dan <code>SESSION_SECRET</code> di Environment Variables Vercel.
              </div>
            )}

            <p className="m-0 text-sm leading-relaxed text-[#52525b]">
              {needsSetup
                ? 'Atur kata sandi admin pertama kali untuk mengunci panel pengelolaan desain, media, dan halaman.'
                : hasEnvPasscode
                  ? 'Masukkan kata sandi admin yang dikonfigurasi di server.'
                  : 'Masukkan kata sandi admin untuk membuka pengelola portofolio.'}
            </p>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3f3f46]"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={needsSetup ? 'new-password' : 'current-password'}
                  placeholder="Minimal 6 karakter"
                  className="w-full border border-[#d4d4d8] bg-white px-3.5 py-2.5 pr-11 text-sm text-[#18181b] outline-none transition-colors focus:border-[#18181b]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center border-0 bg-transparent text-[#71717a] hover:text-[#18181b]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {needsSetup && (
              <div>
                <label
                  htmlFor="admin-password-confirm"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3f3f46]"
                >
                  Konfirmasi Kata Sandi
                </label>
                <input
                  id="admin-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Ulangi kata sandi"
                  className="w-full border border-[#d4d4d8] bg-white px-3.5 py-2.5 text-sm text-[#18181b] outline-none transition-colors focus:border-[#18181b]"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full border-0 bg-[#18181b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#27272a] disabled:opacity-50"
            >
              {submitting
                ? 'Memproses...'
                : needsSetup
                  ? 'Simpan & Masuk Admin'
                  : 'Masuk ke Panel Admin'}
            </button>

            {!needsSetup && !hasEnvPasscode && (
              <p className="m-0 text-center text-[11px] leading-relaxed text-[#71717a]">
                Lupa kata sandi? Atur <code>ADMIN_PASSCODE</code> di environment server untuk menimpa akses admin.
              </p>
            )}
          </form>
        )}
      </div>

      <p className="m-0 text-center text-xs text-[#71717a]">
        Akses tersembunyi · Tekan Ctrl+Shift+A atau buka #/admin kapan saja
      </p>
    </div>
  );
}
