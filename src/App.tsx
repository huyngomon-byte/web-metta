import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import PublicLayout from '@/pages/public/PublicLayout';
import PublicHomePage from '@/pages/public/PublicHomePage';

const PublicLegalPage = lazy(() => import('@/pages/public/PublicLegalPage'));
const PublicContactPage = lazy(() => import('@/pages/public/PublicContactPage'));
const PublicBlogDetailPage = lazy(() => import('@/pages/public/PublicBlogDetailPage'));
const PublicNewsPage = lazy(() => import('@/pages/public/PublicNewsPage'));
const PublicProgramDetailPage = lazy(() => import('@/pages/public/PublicProgramDetailPage'));
const PublicPageRouter = lazy(() => import('@/pages/public/PublicPageRouter'));

const PublicEbookLanding = lazy(() => import('@/pages/public/PublicEbookLanding'));

const LoginPage = lazy(() => import('@/pages/LoginPage'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CmsPagesPage = lazy(() => import('@/pages/CmsPagesPage'));
const PageEditorPage = lazy(() => import('@/pages/PageEditorPage'));
const ThemeSettingsPage = lazy(() => import('@/pages/ThemeSettingsPage'));
const ProgramsCmsPage = lazy(() => import('@/pages/ProgramsCmsPage'));
const HeaderMenuPage = lazy(() => import('@/pages/HeaderMenuPage'));
const FooterPage = lazy(() => import('@/pages/FooterPage'));
const LegalPagesPage = lazy(() => import('@/pages/LegalPagesPage'));
const BlogAdminPage = lazy(() => import('@/pages/BlogAdminPage'));
const MediaLibraryPage = lazy(() => import('@/pages/MediaLibraryPage'));
const LeadsPage = lazy(() => import('@/pages/LeadsPage'));
const LeadAssignmentPage = lazy(() => import('@/pages/LeadAssignmentPage'));
const LeadDatabasePage = lazy(() => import('@/pages/LeadDatabasePage'));
const LeadDetailPage = lazy(() => import('@/pages/LeadDetailPage'));
const SalesTasksPage = lazy(() => import('@/pages/SalesTasksPage'));
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage'));
const CapiSettingsPage = lazy(() => import('@/pages/CapiSettingsPage'));
const CapiEventsPage = lazy(() => import('@/pages/CapiEventsPage'));
const SourceEnginePage = lazy(() => import('@/pages/SourceEnginePage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

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
  return <div className="grid min-h-screen place-items-center text-slate-400">Dang tai...</div>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Landing "Sách tiền tiểu học" — render từ CMS, không header/menu site */}
          <Route path="/p/landing-page-phonics" element={<PublicEbookLanding />} />
          <Route path="/p/ebook-mam-non" element={<PublicEbookLanding />} />
          <Route path="/lp/sach-tien-tieu-hoc" element={<PublicEbookLanding />} />
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
    </>
  );
}
