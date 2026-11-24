import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';

interface AdminAuthScreenProps {
  onAuthenticated: (token: string) => void;
  onExit: () => void;
}

export function AdminAuthScreen({ onAuthenticated, onExit }: AdminAuthScreenProps) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [hasEnvPasscode, setHasEnvPasscode] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/auth-status')
      .then(async (res) => {
        if (!res.ok) throw new Error('Server error');
        return (await res.json()) as { needsSetup?: boolean; hasEnvPasscode?: boolean };
      })
      .then((data) => {
        if (!active) return;
        setNeedsSetup(Boolean(data.needsSetup));
        setHasEnvPasscode(Boolean(data.hasEnvPasscode));
      })
      .catch(() => {
        if (!active) return;
        setError('Gagal terhubung ke server.');
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
        setError(payload.error || 'Autentikasi gagal.');
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
                : needsSetup
                  ? 'Buat Kata Sandi Admin'
                  : 'Masuk Panel Admin'}
            </h1>
          </div>
        </div>

        {loadingStatus ? (
          <div className="py-8 text-sm text-[#71717a]">Memuat status keamanan server...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
          </form>
        )}
      </div>

      <p className="m-0 text-center text-xs text-[#71717a]">
        Akses tersembunyi · Tekan Ctrl+Shift+A atau buka #/admin kapan saja
      </p>
    </div>
  );
}
