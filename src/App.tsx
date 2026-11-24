import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { AdminAuthScreen } from './components/AdminAuthScreen';
import { AdminWorkspace } from './components/AdminWorkspace';
import { CertificatesSection } from './components/CertificatesSection';
import { ContactSection } from './components/ContactSection';
import { CustomPageView } from './components/CustomPageView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExtraBlocksSection } from './components/ExtraBlocksSection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Lightbox } from './components/Lightbox';
import { ProjectsSection } from './components/ProjectsSection';
import { SkillsSection } from './components/SkillsSection';
import { WorkGallery } from './components/WorkGallery';
import { DEFAULT_SITE_CONFIG } from './data/defaultSite';
import { auth, isAuthorizedAdmin } from './lib/firebase';
import { subscribeToSiteConfig } from './services/portfolioStore';
import type { PortfolioWork, SiteConfig } from './types/site';
import { applySiteTheme } from './utils/theme';

type RouteState =
  | { view: 'home' }
  | { view: 'page'; slug: string }
  | { view: 'admin' };

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

export default function App() {
  const [site, setSite] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [route, setRoute] = useState<RouteState>(() => parseCurrentRoute());

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [selectedWork, setSelectedWork] = useState<PortfolioWork | null>(null);
  const [lightboxList, setLightboxList] = useState<PortfolioWork[]>(DEFAULT_SITE_CONFIG.works);
  const pendingScrollRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      if (!user) {
        setAdminUser(null);
        setCheckingAuth(false);
        return;
      }
      setCheckingAuth(true);
      const allowed = await isAuthorizedAdmin(user);
      if (!active) return;
      setAdminUser(allowed ? user : null);
      setCheckingAuth(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSiteConfig((cloudSite) => {
      setSite(cloudSite);
      setLightboxList(cloudSite.works);
    });

    return () => unsubscribe();
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

  const handleAuthenticated = useCallback((user: User) => {
    setAuthNotice(null);
    setFirebaseUser(user);
    setAdminUser(user);
    setCheckingAuth(false);
  }, []);

  const handleLogout = useCallback(async (reason?: string) => {
    setAuthNotice(typeof reason === 'string' && reason ? reason : null);
    setAdminUser(null);
    await signOut(auth).catch(() => {});
  }, []);

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

  const content = (() => {
    if (route.view === 'admin') {
      if (!adminUser) {
        return (
          <AdminAuthScreen
            currentUser={firebaseUser}
            checkingAuth={checkingAuth}
            onAuthenticated={handleAuthenticated}
            onExit={() => navigateHome('beranda')}
            notice={authNotice}
          />
        );
      }

      return (
        <AdminWorkspace
          site={site}
          user={adminUser}
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
  })();

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
