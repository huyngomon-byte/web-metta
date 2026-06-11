import { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import PublicLayout from '@/pages/public/PublicLayout';
import PublicHomePage from '@/pages/public/PublicHomePage';

const CHUNK_RELOAD_KEY = 'metta_chunk_reload_started_at';
const CHUNK_RELOAD_COOLDOWN_MS = 10000;

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported module/i.test(message);
}

function lazyWithRetry<T extends { default: React.ComponentType<unknown> }>(loader: () => Promise<T>) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      if (isChunkLoadError(error)) {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (!lastReload || Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return new Promise<T>(() => undefined);
        }
      }
      throw error;
    }
  });
}

type RouteErrorBoundaryState = { error: Error | null };

class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[App] Route render failed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-5">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-extrabold text-slate-900">Không tải được trang</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Phiên admin có thể đang dùng phiên bản cũ sau khi deploy. Tải lại trang để lấy bản mới nhất.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-[#F45A0A] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            Tải lại
          </button>
        </div>
      </div>
    );
  }
}

const PublicLegalPage = lazyWithRetry(() => import('@/pages/public/PublicLegalPage'));
const PublicContactPage = lazyWithRetry(() => import('@/pages/public/PublicContactPage'));
const PublicBlogDetailPage = lazyWithRetry(() => import('@/pages/public/PublicBlogDetailPage'));
const PublicNewsPage = lazyWithRetry(() => import('@/pages/public/PublicNewsPage'));
const PublicProgramDetailPage = lazyWithRetry(() => import('@/pages/public/PublicProgramDetailPage'));
const PublicPageRouter = lazyWithRetry(() => import('@/pages/public/PublicPageRouter'));
const PublicEbookLanding = lazyWithRetry(() => import('@/pages/public/PublicEbookLanding'));
const MettaPlusLanding = lazyWithRetry(() => import('@/pages/public/MettaPlusLanding'));

const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'));

const DashboardPage = lazyWithRetry(() => import('@/pages/DashboardPage'));
const CmsPagesPage = lazyWithRetry(() => import('@/pages/CmsPagesPage'));
const PageEditorPage = lazyWithRetry(() => import('@/pages/PageEditorPage'));
const ThemeSettingsPage = lazyWithRetry(() => import('@/pages/ThemeSettingsPage'));
const ProgramsCmsPage = lazyWithRetry(() => import('@/pages/ProgramsCmsPage'));
const HeaderMenuPage = lazyWithRetry(() => import('@/pages/HeaderMenuPage'));
const FooterPage = lazyWithRetry(() => import('@/pages/FooterPage'));
const LegalPagesPage = lazyWithRetry(() => import('@/pages/LegalPagesPage'));
const BlogAdminPage = lazyWithRetry(() => import('@/pages/BlogAdminPage'));
const MediaLibraryPage = lazyWithRetry(() => import('@/pages/MediaLibraryPage'));
const LeadsPage = lazyWithRetry(() => import('@/pages/LeadsPage'));
const LeadAssignmentPage = lazyWithRetry(() => import('@/pages/LeadAssignmentPage'));
const LeadDatabasePage = lazyWithRetry(() => import('@/pages/LeadDatabasePage'));
const LeadDetailPage = lazyWithRetry(() => import('@/pages/LeadDetailPage'));
const SalesTasksPage = lazyWithRetry(() => import('@/pages/SalesTasksPage'));
const AppointmentsPage = lazyWithRetry(() => import('@/pages/AppointmentsPage'));
const CapiSettingsPage = lazyWithRetry(() => import('@/pages/CapiSettingsPage'));
const CapiEventsPage = lazyWithRetry(() => import('@/pages/CapiEventsPage'));
const SourceEnginePage = lazyWithRetry(() => import('@/pages/SourceEnginePage'));
const ReportsPage = lazyWithRetry(() => import('@/pages/ReportsPage'));
const UsersPage = lazyWithRetry(() => import('@/pages/UsersPage'));
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);
  return null;
}

function PageFallback() {
  return <div className="grid min-h-screen place-items-center text-slate-400">Đang tải...</div>;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <RouteErrorBoundary key={location.pathname}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/p/landing-page-phonics" element={<PublicEbookLanding />} />
            <Route path="/p/ebook-mam-non" element={<PublicEbookLanding />} />
            <Route path="/lp/sach-tien-tieu-hoc" element={<PublicEbookLanding />} />
            <Route path="/metta-plus" element={<MettaPlusLanding />} />
            <Route path="/lp/metta-plus" element={<MettaPlusLanding />} />
            <Route path="/p/metta-plus" element={<MettaPlusLanding />} />
            <Route path="/p/:slug" element={<PublicPageRouter />} />
            <Route element={<PublicLayout />}>
              <Route path="/" element={<PublicHomePage />} />
              <Route path="/programs/:slug" element={<PublicProgramDetailPage />} />
              <Route path="/tin-tuc" element={<PublicNewsPage />} />
              <Route path="/tin-tuc/:slug" element={<PublicBlogDetailPage />} />
              <Route path="/contact" element={<PublicContactPage />} />
              <Route path="/phap-ly/:slug" element={<PublicLegalPage />} />
              <Route path="/chinh-sach-bao-mat" element={<PublicLegalPage />} />
              <Route path="/dieu-khoan-su-dung" element={<PublicLegalPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/cms/pages" element={<CmsPagesPage />} />
                <Route path="/cms/pages/:id" element={<PageEditorPage />} />
                <Route path="/cms/theme" element={<ThemeSettingsPage />} />
                <Route path="/cms/programs" element={<ProgramsCmsPage />} />
                <Route path="/cms/header-menu" element={<HeaderMenuPage />} />
                <Route path="/cms/footer" element={<FooterPage />} />
                <Route path="/cms/legal" element={<LegalPagesPage />} />
                <Route path="/cms/blog" element={<BlogAdminPage />} />
                <Route path="/media" element={<MediaLibraryPage />} />
                <Route path="/crm/leads" element={<LeadsPage />} />
                <Route path="/crm/lead-assignment" element={<LeadAssignmentPage />} />
                <Route path="/crm/tasks" element={<SalesTasksPage />} />
                <Route path="/crm/database" element={<LeadDatabasePage />} />
                <Route path="/crm/leads/:id" element={<LeadDetailPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/capi" element={<CapiSettingsPage />} />
                <Route path="/capi/events" element={<CapiEventsPage />} />
                <Route path="/marketing/source-engine" element={<SourceEnginePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </>
  );
}
