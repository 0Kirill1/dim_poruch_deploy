import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest, formatApiError, formatPrice, notifyNotificationsChanged, tokenStore } from './api';
import { useAuth } from './auth';

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  heart: <path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.8 2.4Z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  star: <path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2L3 9.5l6.2-.9L12 3Z"/>,
  edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15v5Z"/></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chevron: <path d="m7 10 5 5 5-5"/>,
  back: <><path d="M19 12H5M11 18l-6-6 6-6"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="M3 3l18 18"/><path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18.7 18.7 0 0 1-3.1 3.8M6.7 6.7C3.9 8.5 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 3.4-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  sliders: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  phone: <path d="M7 3H5a2 2 0 0 0-2 2 16 16 0 0 0 16 16 2 2 0 0 0 2-2v-2l-5-2-2 3a13 13 0 0 1-6-6l3-2-2-5Z"/>,
  expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><path d="m3 8 5-5M21 8l-5-5M3 16l5 5M21 16l-5 5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  spark: <><path d="m12 3 1.5 6.5L20 12l-6.5 1.5L12 20l-1.5-6.5L4 12l6.5-2.5L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
};

export function Icon({ name, size = 20, className = '' }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name] || iconPaths.spark}</svg>;
}

export function Logo({ compact = false }) {
  return <Link to="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="ДімПоруч — на головну">
    <span className="brand-mark"><Icon name="home" size={19}/></span>
    <span>Дім<span className="brand-accent">Поруч</span></span>
  </Link>;
}

export function Button({ children, variant = 'primary', className = '', icon, type = 'button', ...props }) {
  return <button type={type} className={`button button-${variant} ${className}`} {...props}>{icon && <Icon name={icon} size={18}/>}<span>{children}</span></button>;
}

export function Alert({ children, tone = 'error', onClose }) {
  if (!children) return null;
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}{onClose && <button type="button" className="alert-close" onClick={onClose} aria-label="Закрити">×</button>}</div>;
}

export function FieldError({ error }) { return error ? <small className="field-error">{error}</small> : null; }

export function Loading({ label = 'Завантажуємо…', small = false }) {
  return <div className={`loading ${small ? 'loading-small' : ''}`} role="status"><span className="spinner"/><span>{label}</span></div>;
}

export function EmptyState({ icon = 'home', title = 'Поки що тут порожньо', text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26}/></span><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages < 2) return null;
  return <nav className="pagination" aria-label="Сторінки">
    <Button variant="outline" disabled={page <= 0} onClick={() => onChange(page - 1)} icon="back">Назад</Button>
    <span>Сторінка <strong>{page + 1}</strong> з {totalPages}</span>
    <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>Далі <Icon name="arrow" size={17}/></Button>
  </nav>;
}

const statusLabels = {
  MODERATION: 'На модерації', ACTIVE: 'Активне', ARCHIVED: 'В архіві', REJECTED: 'Відхилене', BLOCKED: 'Заблокований',
  PENDING: 'Очікує', APPROVED: 'Підтверджено', CANCELLED: 'Скасовано', COMPLETED: 'Завершено',
  ACTIVE_BOOKING: 'Триває',
};
const statusTone = { MODERATION: 'warning', PENDING: 'warning', ACTIVE: 'success', APPROVED: 'success', COMPLETED: 'neutral', ARCHIVED: 'neutral', CANCELLED: 'neutral', REJECTED: 'danger', BLOCKED: 'danger' };
export function StatusPill({ status }) {
  const label = statusLabels[status] || status || '—';
  return <span className={`status-pill status-${statusTone[status] || 'neutral'}`}>{label}</span>;
}

export function useProtectedImage(path) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl;
    setSrc('');
    if (!path) return undefined;
    apiRequest(path, { responseType: 'blob', auth: Boolean(tokenStore.access) })
      .then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setSrc(objectUrl); else URL.revokeObjectURL(objectUrl); })
      .catch(() => { if (active) setSrc(''); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return src;
}

export function PropertyImage({ src, className = '', alt = '', compact = false }) {
  const protectedSrc = useProtectedImage(src);
  return <div className={`property-image ${compact ? 'property-image-compact' : ''} ${className}`}>
    {protectedSrc ? <img src={protectedSrc} alt={alt}/> : <div className="image-placeholder"><span className="placeholder-sun"/><span className="placeholder-building"><i/><i/><i/><i/></span><Icon name="home" size={26}/></div>}
  </div>;
}

export function Rating({ value, count, state }) {
  if ((value === null || value === undefined) && state === 'loading') return <span className="rating rating-muted"><Icon name="star" size={15}/> Завантажуємо оцінку…</span>;
  if ((value === null || value === undefined) && state === 'error') return <span className="rating rating-muted"><Icon name="star" size={15}/> Оцінка недоступна</span>;
  if (value === null || value === undefined) return <span className="rating rating-muted"><Icon name="star" size={15}/> Ще без оцінок</span>;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return <span className="rating rating-muted"><Icon name="star" size={15}/> Оцінка недоступна</span>;
  return <span className="rating"><Icon name="star" size={15}/><strong>{numericValue.toFixed(1)}</strong>{count !== undefined && <span>({count})</span>}</span>;
}

export function ListingCard({ listing, rating, ratingState = 'loading', returnTo }) {
  const detailUrl = `/listings/${listing.id}`;
  const to = returnTo ? `${detailUrl}?returnTo=${encodeURIComponent(returnTo)}` : detailUrl;
  return <article className="listing-card">
    <Link to={to} className="listing-card-image-link" aria-label={`Переглянути: ${listing.title}`}><PropertyImage src={listing.primaryImageUrl || listing.imageUrls?.[0]} alt={listing.title}/><span className="image-tag">Оренда</span></Link>
    <div className="listing-card-body">
      <div className="listing-card-top"><span className="listing-location"><Icon name="pin" size={15}/>{listing.city || 'Україна'}</span><Rating value={rating?.averageRating} count={rating?.reviewCount} state={ratingState}/></div>
      <Link to={to} className="listing-title-link"><h3>{listing.title}</h3></Link>
      <div className="listing-card-meta"><span>{listing.rooms || '—'} кімн.</span><span>{listing.area ? `${listing.area} м²` : 'Площа не вказана'}</span><span className="listing-price">{formatPrice(listing.monthlyPrice)} <small>/ міс.</small></span></div>
    </div>
  </article>;
}

function roleHome(role) {
  if (role === 'LANDLORD') return '/dashboard/landlord';
  if (role === 'ADMIN') return '/dashboard/admin';
  return '/dashboard/tenant';
}

export function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const refreshUnread = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    try { const result = await apiRequest('/me/notifications/unread-count'); setUnread(result?.unreadCount || 0); }
    catch { /* The page-level error state handles notification failures. */ }
  }, [user]);

  useEffect(() => {
    refreshUnread();
    if (!user) return undefined;
    const onFocus = () => refreshUnread();
    const onNotificationsChanged = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    window.addEventListener('dimporuch:notifications-changed', onNotificationsChanged);
    const timer = window.setInterval(refreshUnread, 60_000);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('dimporuch:notifications-changed', onNotificationsChanged); window.clearInterval(timer); };
  }, [refreshUnread, user, location.key]);

  useEffect(() => { setPanelOpen(false); setMenuOpen(false); }, [location.pathname, location.search]);

  const togglePanel = async () => {
    const next = !panelOpen;
    setPanelOpen(next);
    if (next && user) {
      try {
        const result = await apiRequest('/me/notifications');
        setNotifications(Array.isArray(result) ? result.filter((item) => !item.readAt) : []);
      }
      catch { setNotifications([]); }
    }
  };

  const markOne = async (notification) => {
    try {
      await apiRequest(`/me/notifications/${notification.id}/read`, { method: 'PATCH' });
      setNotifications((items) => items.filter((item) => item.id !== notification.id));
      refreshUnread();
      notifyNotificationsChanged();
    } catch { /* A full refresh will show the authoritative state. */ }
  };

  return <header className="site-header"><div className="header-inner">
    <Logo/>
    <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`}>
      <NavLink to="/search">Знайти житло</NavLink>
      <Link to="/#about">Про нас</Link>
      <Link to="/#how-it-works">Як це працює</Link>
      {user && <NavLink to={roleHome(user.role)} className="nav-account">{user.role === 'LANDLORD' ? 'Мій кабінет' : user.role === 'ADMIN' ? 'Адміністрування' : 'Мої бронювання'}</NavLink>}
      {user?.role === 'LANDLORD' && <Link to="/landlord/listings/new" className="nav-add"><Icon name="plus" size={16}/>Додати житло</Link>}
    </nav>
    <div className="header-actions">
      {user ? <>
        <div className="notification-wrap">
          <button type="button" className={`icon-button notification-trigger ${panelOpen ? 'active' : ''}`} aria-label="Сповіщення" onClick={togglePanel}><Icon name="bell"/>{unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}</button>
          {panelOpen && <div className="notification-popover"><div className="popover-heading"><strong>Сповіщення</strong><Link to="/notifications">Усі</Link></div>
            {notifications.length ? notifications.slice(0, 5).map((item) => <button key={item.id} type="button" className={`popover-notification ${!item.readAt ? 'unread' : ''}`} onClick={() => { if (!item.readAt) markOne(item); if (item.link) navigate(item.link); else navigate('/notifications'); }}><strong>{item.title}</strong><span>{item.body}</span><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('uk-UA') : ''}</small></button>) : <p className="popover-empty">Нових сповіщень немає</p>}
          </div>}
        </div>
        <Link to="/settings" className="avatar-link" title="Налаштування профілю"><span className="avatar">{(user.fullName || user.email || 'К').slice(0, 1).toUpperCase()}</span><span className="avatar-name">{user.fullName?.split(' ')[0] || 'Профіль'}</span></Link>
        <button type="button" className="icon-button logout-button" title="Вийти" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout"/></button>
      </> : <><Link className="header-login" to="/login">Увійти</Link><Link className="button button-primary header-register" to="/register">Зареєструватися</Link></>}
    </div>
    <button type="button" className="mobile-menu-button icon-button" aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'}/></button>
  </div></header>;
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-inner"><div className="footer-brand-column"><Logo compact/><p>Знаходьте свій дім поруч.</p><span>© {new Date().getFullYear()} ДімПоруч</span></div><div className="footer-link-column"><strong>Орендарям</strong><Link to="/search">Знайти житло</Link><Link to="/dashboard/tenant">Мої бронювання</Link></div><div className="footer-link-column"><strong>Власникам</strong><Link to="/register?role=LANDLORD">Здати житло</Link><Link to="/dashboard/landlord">Кабінет власника</Link></div><div className="footer-link-column"><strong>ДімПоруч</strong><Link to="/#about">Про нас</Link><Link to="/#how-it-works">Як це працює</Link></div><div className="footer-link-column"><strong>Технічна підтримка</strong><a href="mailto:dimporuchtech@gmail.com">dimporuchtech@gmail.com</a></div></div></footer>;
}

export function AppShell({ children }) {
  return <><Header/><main className="app-main">{children}</main><Footer/></>;
}

function dateIso(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function overlapsUnavailable(from, to, availability = []) {
  return availability.some((range) => {
    const lower = range.startDate || range.from;
    const upper = range.endDate || range.to;
    return lower && upper && from <= upper && to >= lower;
  });
}

export function AvailabilityCalendar({ availability = [], startDate, endDate, onStartChange, onEndChange, readOnly = false }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);
  const today = dateIso(new Date());
  const weekNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const stepDate = (amount) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  const selectDay = (iso) => {
    if (readOnly) return;
    if (!startDate || endDate || iso <= startDate) { onStartChange(iso); onEndChange(''); }
    else onEndChange(iso);
  };
  return <div className={`availability-calendar ${readOnly ? 'availability-calendar-readonly' : ''}`}>
    <div className="calendar-header"><button type="button" className="calendar-nav" aria-label="Попередній місяць" disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()} onClick={() => stepDate(-1)}>‹</button><strong>{month.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}</strong><button type="button" className="calendar-nav" aria-label="Наступний місяць" onClick={() => stepDate(1)}>›</button></div>
    <div className="calendar-grid calendar-weekdays">{weekNames.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid calendar-days">{Array.from({ length: weeks * 7 }, (_, index) => {
      const number = index - mondayOffset + 1;
      const inMonth = number > 0 && number <= daysInMonth;
      const date = new Date(month.getFullYear(), month.getMonth(), number);
      const iso = inMonth ? dateIso(date) : '';
      const past = inMonth && iso < today;
      const unavailable = inMonth && overlapsUnavailable(iso, iso, availability);
      const rangeUnavailable = Boolean(inMonth && startDate && iso > startDate && overlapsUnavailable(startDate, iso, availability));
      const booked = unavailable || rangeUnavailable;
      const blocked = past || booked;
      const selected = iso && (iso === startDate || iso === endDate);
      const between = iso && startDate && endDate && iso > startDate && iso < endDate;
      return <button type="button" key={index} className={`${inMonth ? '' : 'calendar-outside'} ${blocked ? 'calendar-blocked' : ''} ${past ? 'calendar-past' : ''} ${booked ? 'calendar-booked' : ''} ${selected ? 'calendar-selected' : ''} ${between ? 'calendar-between' : ''}`} disabled={!inMonth || blocked || readOnly} onClick={() => selectDay(iso)} aria-label={inMonth ? date.toLocaleDateString('uk-UA') : undefined}>{inMonth ? number : ''}</button>;
    })}</div>
    <div className="calendar-legend"><span><i className="legend-available"/>Доступно</span><span><i className="legend-blocked"/>Зайнято</span></div>
  </div>;
}

export function BookingDates({ startDate, endDate, onStartChange, onEndChange, availability = [], disabled = false }) {
  const invalid = startDate && endDate && endDate <= startDate;
  const overlaps = startDate && endDate && overlapsUnavailable(startDate, endDate, availability);
  return <div className="date-picker-wrap"><div className="date-grid"><label className="form-field"><span>Заїзд</span><div className="input-with-icon"><Icon name="calendar" size={17}/><input type="text" readOnly value={startDate || ''} placeholder="Оберіть дату" disabled={disabled}/></div></label><label className="form-field"><span>Виїзд</span><div className="input-with-icon"><Icon name="calendar" size={17}/><input type="text" readOnly value={endDate || ''} placeholder="Оберіть дату" disabled={disabled}/></div></label>{invalid && <small className="field-error date-error">Дата виїзду має бути пізніше за дату заїзду.</small>}{overlaps && <small className="field-error date-error">Обрані дати перетинаються з недоступним періодом.</small>}</div><AvailabilityCalendar availability={availability} startDate={startDate} endDate={endDate} onStartChange={onStartChange} onEndChange={onEndChange} readOnly={disabled}/></div>;
}

export function errorMessage(error) { return formatApiError(error); }
