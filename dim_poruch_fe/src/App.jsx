import { useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { AccountSecurityPage, AdminDashboardPage, LandlordDashboardPage, ListingFormPage, ListingManagementPage, NotificationsPage, SettingsPage, TenantDashboardPage } from './dashboard-pages';
import { LoginPage, RegisterPage } from './auth-pages';
import { AppShell, Icon, Loading } from './components';
import { BookingRequestPage, HomePage, ListingDetailsPage, PublicProfilePage, SearchPage } from './public-pages';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      window.setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } else window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);
  return null;
}

function rolePath(role) {
  if (role === 'LANDLORD') return '/dashboard/landlord';
  if (role === 'ADMIN') return '/dashboard/admin';
  return '/dashboard/tenant';
}

export function Guarded({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="route-loading"><Loading label="Перевіряємо сесію…"/></div>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace/>;
  if (roles && !roles.includes(user.role)) return <Navigate to={rolePath(user.role)} replace/>;
  return <AppShell>{children}</AppShell>;
}

function PublicPage({ children }) { return <AppShell>{children}</AppShell>; }

function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading"><Loading label="Завантажуємо кабінет…"/></div>;
  return user ? <Navigate to={rolePath(user.role)} replace/> : <Navigate to="/login" replace/>;
}

function NotFound() {
  return <div className="not-found-page"><span className="not-found-icon"><Icon name="home" size={31}/></span><div className="eyebrow">Сторінку не знайдено</div><h1>Схоже, тут поки немає дому.</h1><p>Перевірте адресу або поверніться до пошуку житла.</p><Link className="button button-primary" to="/search"><Icon name="search" size={17}/> Перейти до пошуку</Link></div>;
}

function RoutesView() {
  return <><ScrollToTop/><Routes>
    <Route path="/" element={<PublicPage><HomePage/></PublicPage>}/>
    <Route path="/search" element={<PublicPage><SearchPage/></PublicPage>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/register" element={<RegisterPage/>}/>
    <Route path="/listings/:id" element={<PublicPage><ListingDetailsPage/></PublicPage>}/>
    <Route path="/listings/:id/book" element={<Guarded><BookingRequestPage/></Guarded>}/>
    <Route path="/users/:id" element={<PublicPage><PublicProfilePage/></PublicPage>}/>
    <Route path="/dashboard" element={<DashboardRedirect/>}/>
    <Route path="/dashboard/tenant" element={<Guarded roles={['TENANT']}><TenantDashboardPage/></Guarded>}/>
    <Route path="/dashboard/landlord" element={<Guarded roles={['LANDLORD']}><LandlordDashboardPage/></Guarded>}/>
    <Route path="/dashboard/admin" element={<Guarded roles={['ADMIN']}><AdminDashboardPage/></Guarded>}/>
    <Route path="/landlord/listings/new" element={<Guarded roles={['LANDLORD']}><ListingFormPage/></Guarded>}/>
    <Route path="/landlord/listings/:id/edit" element={<Guarded roles={['LANDLORD']}><ListingFormPage/></Guarded>}/>
    <Route path="/landlord/listings/:id/manage" element={<Guarded roles={['LANDLORD']}><ListingManagementPage/></Guarded>}/>
    <Route path="/settings" element={<Guarded><SettingsPage/></Guarded>}/>
    <Route path="/settings/security" element={<Guarded><AccountSecurityPage/></Guarded>}/>
    <Route path="/notifications" element={<Guarded><NotificationsPage/></Guarded>}/>
    <Route path="*" element={<PublicPage><NotFound/></PublicPage>}/>
  </Routes></>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><RoutesView/></AuthProvider></BrowserRouter>;
}
