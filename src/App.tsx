import { useCallback, useEffect, useRef, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { AdminAuthScreen } from './components/AdminAuthScreen';
import { AdminWorkspace } from './components/AdminWorkspace';
import { CertificatesSection } from './components/CertificatesSection';
import { ContactSection } from './components/ContactSection';
import { CustomPageView } from './components/CustomPageView';
import { ExtraBlocksSection } from './components/ExtraBlocksSection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Lightbox } from './components/Lightbox';
import { ProjectsSection } from './components/ProjectsSection';
import { SkillsSection } from './components/SkillsSection';
import { WorkGallery } from './components/WorkGallery';
import { DEFAULT_SITE_CONFIG } from './data/defaultSite';
import type { PortfolioWork, SiteConfig } from './types/site';
import { applySiteTheme } from './utils/theme';

type RouteState =
  | { view: 'home' }
  | { view: 'page'; slug: string }
  | { view: 'admin' };

const ADMIN_TOKEN_STORAGE_KEY = 'uj_admin_session_token';

function parseCurrentRoute(): RouteState {
  const hash = window.location.hash;
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const normalizedHash = hash.replace(/\/+$/, '');

  if (normalizedHash === '#/admin' || pathname === '/admin') {
    return { view: 'admin' };
  }

  if (hash.startsWith('#/p/')) {
    const rawSlug = hash.slice(4).trim();
    try {
      const slug = decodeURIComponent(rawSlug).trim();
      if (slug) return { view: 'page', slug };
    } catch {
      if (rawSlug) return { view: 'page', slug: rawSlug };
    }
  }

  return { view: 'home' };
}

function readStoredAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [site, setSite] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [route, setRoute] = useState<RouteState>(() => parseCurrentRoute());
  const [adminToken, setAdminToken] = useState<string | null>(() => readStoredAdminToken());
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [selectedWork, setSelectedWork] = useState<PortfolioWork | null>(null);
  const [lightboxList, setLightboxList] = useState<PortfolioWork[]>(DEFAULT_SITE_CONFIG.works);
  const pendingScrollRef = useRef<string | null>(null);
  const freshLoginTokenRef = useRef<string | null>(null);

  const handleAuthenticated = useCallback((token: string) => {
    freshLoginTokenRef.current = token;
    setAuthNotice(null);
    try {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } catch {
      // sessionStorage unavailable
    }
    setAdminToken(token);
  }, []);

  const handleLogout = useCallback((reason?: string) => {
    freshLoginTokenRef.current = null;
    setAuthNotice(typeof reason === 'string' && reason ? reason : null);
    try {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // sessionStorage unavailable
    }
    setAdminToken(null);
  }, []);

  useEffect(() => {
    if (!adminToken) return;
    if (freshLoginTokenRef.current === adminToken) {
      freshLoginTokenRef.current = null;
      return;
    }
    let active = true;
    fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((res) => {
        if (active && res.status === 401) {
          handleLogout('Sesi admin sudah berakhir atau tidak valid. Silakan masuk kembali.');
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [adminToken, handleLogout]);

  useEffect(() => {
    let active = true;
    fetch('/api/site')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SiteConfig | null) => {
        if (!active || !data) return;
        setSite(data);
        setLightboxList(data.works);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applySiteTheme(site);
  }, [site]);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(parseCurrentRoute());
    };

    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  const openHiddenAdmin = useCallback(() => {
    window.history.pushState(null, '', '#/admin');
    setRoute({ view: 'admin' });
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        openHiddenAdmin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openHiddenAdmin]);

  useEffect(() => {
    if (route.view !== 'home' || !pendingScrollRef.current) return;
    const sectionId = pendingScrollRef.current;
    pendingScrollRef.current = null;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [route]);

  const navigateHome = useCallback((sectionId?: string) => {
    const targetHash = sectionId ? `#${sectionId}` : '#beranda';
    const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath === '/admin') {
      window.history.pushState(null, '', `/${sectionId ? targetHash : ''}`);
    } else if (window.location.hash.startsWith('#/')) {
      window.history.pushState(null, '', targetHash);
    }
    setRoute({ view: 'home' });

    if (sectionId) {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        pendingScrollRef.current = sectionId;
      }
    } else {
      pendingScrollRef.current = null;
      window.scrollTo({ top: 0 });
    }
  }, []);

  const navigateToPage = useCallback((slug: string) => {
    window.history.pushState(null, '', `#/p/${encodeURIComponent(slug)}`);
    setRoute({ view: 'page', slug });
    window.scrollTo({ top: 0 });
  }, []);

  const handleSelectWork = useCallback((work: PortfolioWork, visibleWorks: PortfolioWork[]) => {
    setLightboxList(visibleWorks);
    setSelectedWork(work);
  }, []);

  const handleInspectSingle = useCallback((work: PortfolioWork) => {
    setLightboxList([work]);
    setSelectedWork(work);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setSelectedWork(null);
  }, []);

  if (route.view === 'admin') {
    if (!adminToken) {
      return (
        <AdminAuthScreen
          onAuthenticated={handleAuthenticated}
          onExit={() => navigateHome('beranda')}
          notice={authNotice}
        />
      );
    }

    return (
      <AdminWorkspace
        site={site}
        token={adminToken}
        onSiteSaved={(updated) => {
          setSite(updated);
          setLightboxList(updated.works);
        }}
        onLogout={handleLogout}
        onExit={() => navigateHome('beranda')}
      />
    );
  }

  const activeCustomPage =
    route.view === 'page'
      ? site.pages.find((p) => p.slug === route.slug && p.published) ?? null
      : null;

  return (
    <div className="min-h-screen bg-paper text-ink transition-colors duration-200">
      <Header
        site={site}
        activePageSlug={activeCustomPage?.slug ?? null}
        onNavigateHome={navigateHome}
        onNavigatePage={navigateToPage}
      />
      <main>
        {activeCustomPage ? (
          <CustomPageView
            page={activeCustomPage}
            site={site}
            onBackHome={() => navigateHome('beranda')}
            onSelectWork={handleSelectWork}
          />
        ) : (
          <>
            <Hero site={site} />
            <ExtraBlocksSection site={site} placement="after-hero" />

            {(site.sections?.about ?? true) && <AboutSection site={site} />}
            <ExtraBlocksSection site={site} placement="after-about" />

            {(site.sections?.skills ?? true) && <SkillsSection site={site} />}
            <ExtraBlocksSection site={site} placement="after-skills" />

            {(site.sections?.projects ?? true) && (
              <ProjectsSection site={site} onInspectMedia={handleInspectSingle} />
            )}
            <ExtraBlocksSection site={site} placement="after-projects" />

            {(site.sections?.certificates ?? true) && (
              <CertificatesSection site={site} onInspectCertificate={handleSelectWork} />
            )}
            <ExtraBlocksSection site={site} placement="after-certificates" />

            {(site.sections?.gallery ?? true) && (
              <WorkGallery site={site} onSelectWork={handleSelectWork} />
            )}
            <ExtraBlocksSection site={site} placement="after-gallery" />

            {(site.sections?.contact ?? true) && <ContactSection site={site} />}
          </>
        )}
      </main>
      <Footer
        site={site}
        onNavigateHome={navigateHome}
        onHiddenAdminTrigger={openHiddenAdmin}
      />
      <Lightbox
        work={selectedWork}
        works={lightboxList}
        onClose={handleCloseLightbox}
        onNavigate={setSelectedWork}
      />
    </div>
  );
}
