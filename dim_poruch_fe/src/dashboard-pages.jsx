import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest, formatApiError, formatPrice, notifyNotificationsChanged, toPage } from './api';
import { useAuth } from './auth';
import { Alert, Button, EmptyState, FieldError, Icon, Loading, PageHeading, Pagination, PropertyImage, StatusPill } from './components';
import { attachPublicReviewerProfiles, reviewAuthorName } from './reviews';

const listingStatuses = [['', 'Усі оголошення'], ['MODERATION', 'На модерації'], ['ACTIVE', 'Активні'], ['ARCHIVED', 'В архіві'], ['REJECTED', 'Відхилені']];
const bookingStatuses = [['', 'Усі запити'], ['PENDING', 'Очікують'], ['APPROVED', 'Підтверджені'], ['ACTIVE', 'Активні'], ['COMPLETED', 'Завершені'], ['REJECTED', 'Відхилені'], ['CANCELLED', 'Скасовані']];

function getCreatedListingId(response) {
  if (typeof response === 'string' && response.trim()) return response.trim();
  const candidates = [
    response?.listingId,
    response?.id,
    response?.listing_id,
    response?.listingID,
    response?.listing?.id,
    response?.data?.listingId,
    response?.data?.id,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function DashboardFrame({ children, active }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const links = role === 'LANDLORD' ? [['/dashboard/landlord?tab=listings', 'Мої оголошення', 'home'], ['/dashboard/landlord?tab=bookings', 'Заявки на оренду', 'calendar'], ['/notifications', 'Повідомлення', 'bell'], ['/settings', 'Налаштування', 'user']] : role === 'ADMIN' ? [['/dashboard/admin', 'Модерація', 'sliders'], ['/settings', 'Налаштування', 'user']] : [['/dashboard/tenant', 'Мої бронювання', 'calendar'], ['/notifications', 'Сповіщення', 'bell'], ['/settings', 'Налаштування', 'user']];
  return <div className={`dashboard-layout dashboard-layout-${role?.toLowerCase()}`}><aside className="dashboard-sidebar"><div className="sidebar-user"><span className="avatar avatar-large">{(user?.fullName || user?.email || 'К').slice(0, 1).toUpperCase()}</span><div><strong>{role === 'LANDLORD' ? 'Мій кабінет' : user?.fullName || user?.email}</strong><small>{role === 'LANDLORD' ? 'Керуйте орендою в одному місці' : role === 'ADMIN' ? 'Адміністратор' : 'Ваш простір на ДімПоруч'}</small></div></div><nav className="dashboard-nav">{links.map(([to, label, icon]) => <Link key={to} to={to} className={`dashboard-nav-link ${active === to ? 'dashboard-nav-active' : ''}`}><Icon name={icon} size={18}/><span>{label}</span>{role === 'LANDLORD' && label === 'Мої оголошення' && <span className="sidebar-count">{user?.listingCount ?? ''}</span>}</Link>)}</nav>{role === 'LANDLORD' ? <button type="button" className="sidebar-search-link sidebar-logout-link" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={16}/> Вийти з акаунта</button> : <Link to="/search" className="sidebar-search-link"><Icon name="search" size={16}/> Перейти до пошуку</Link>}</aside><div className="dashboard-main">{children}</div></div>;
}

function notificationHref(item, role) {
  if (item.link) return item.link;
  if (item.relatedListingId || item.listingId) return `/listings/${item.relatedListingId || item.listingId}`;
  if (item.bookingId) return `${role === 'LANDLORD' ? '/dashboard/landlord?tab=bookings' : '/dashboard/tenant'}#booking-${item.bookingId}`;
  if (item.reviewId) return `/dashboard/admin?tab=reviews#review-${item.reviewId}`;
  return '';
}

function notificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await apiRequest('/me/notifications'); setItems(Array.isArray(data) ? data : []); }
    catch (err) { setError(formatApiError(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const focus = () => load(); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load]);

  const markOne = async (item) => {
    if (item.readAt) return;
    setBusy(true); setError('');
    try { const updated = await apiRequest(`/me/notifications/${item.id}/read`, { method: 'PATCH' }); setItems((current) => current.map((row) => row.id === item.id ? updated : row)); notifyNotificationsChanged(); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(false); }
  };
  const markAll = async () => {
    setBusy(true); setError('');
    try { await apiRequest('/me/notifications/read-all', { method: 'PATCH' }); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); notifyNotificationsChanged(); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(false); }
  };
  const deleteRead = async () => {
    if (!window.confirm('Видалити всі прочитані сповіщення?')) return;
    setBusy(true); setError('');
    try { await apiRequest('/me/notifications/delete-read', { method: 'DELETE' }); setItems((current) => current.filter((item) => !item.readAt)); notifyNotificationsChanged(); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(false); }
  };
  const unreadCount = items.filter((item) => !item.readAt).length;
  const readCount = items.filter((item) => item.readAt).length;

  return <DashboardFrame active="/notifications"><PageHeading eyebrow="Ваші оновлення" title="Сповіщення" description="Запити, відповіді та важливі новини про ваші помешкання." action={(unreadCount > 0 || readCount > 0) && <div className="notifications-actions">{unreadCount > 0 && <Button variant="outline" disabled={busy} onClick={markAll}>Позначити всі прочитаними</Button>}{readCount > 0 && <Button variant="danger" disabled={busy} onClick={deleteRead}>Видалити прочитані</Button>}</div>}/><Alert>{error}</Alert>{loading ? <Loading/> : items.length ? <div className="notifications-list">{items.map((item) => {
    const href = notificationHref(item, user?.role);
    const row = <><span className={`notification-symbol ${!item.readAt ? 'notification-symbol-unread' : ''}`}><Icon name={item.type?.toLowerCase().includes('booking') ? 'calendar' : 'bell'} size={18}/></span><span className="notification-content"><strong>{item.title}</strong><span>{item.body}</span><small>{notificationTime(item.createdAt)}</small></span>{!item.readAt && <span className="notification-unread-dot"/>}</>;
    return href ? <Link to={href} key={item.id} className={`notification-row ${!item.readAt ? 'notification-row-unread' : ''}`} onClick={() => markOne(item)}>{row}</Link> : <button type="button" key={item.id} className={`notification-row notification-row-button ${!item.readAt ? 'notification-row-unread' : ''}`} onClick={() => markOne(item)} disabled={busy}>{row}</button>;
  })}</div> : !error && <EmptyState icon="bell" title="Сповіщень поки немає" text="Коли з’являться нові запити чи відповіді, ви побачите їх тут."/>}</DashboardFrame>;
}

function ReviewForm({ booking, onCancel, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const review = await apiRequest(`/bookings/${booking.id}/review`, { method: 'POST', body: { rating: Number(rating), comment: comment.trim() || undefined } }); onSubmitted(review); }
    catch (err) { setError(err.status === 409 ? 'Ви вже залишили відгук для цього бронювання' : formatApiError(err)); }
    finally { setBusy(false); }
  };
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="review-title"><button type="button" className="modal-close icon-button" aria-label="Закрити" onClick={onCancel}><Icon name="close"/></button><div className="eyebrow">Ваш досвід важливий</div><h2 id="review-title">Залишити відгук</h2><p className="muted-copy">Поділіться враженням про проживання.</p><Alert>{error}</Alert><form className="form-stack" onSubmit={submit}><label className="form-field"><span>Оцінка</span><div className="star-picker">{[1, 2, 3, 4, 5].map((number) => <button type="button" key={number} className={number <= rating ? 'star-active' : ''} aria-label={`${number} з 5`} onClick={() => setRating(number)}><Icon name="star" size={26}/></button>)}</div></label><label className="form-field"><span>Коментар <small>(необов’язково)</small></span><textarea rows="4" maxLength="1000" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Що сподобалося у помешканні?"/></label><div className="modal-actions"><Button variant="outline" onClick={onCancel}>Скасувати</Button><Button type="submit" disabled={busy}>{busy ? 'Надсилаємо…' : 'Надіслати відгук'}</Button></div></form></section></div>;
}

function bookingListingId(booking) {
  return typeof booking.listing === 'string' ? booking.listing : booking.listing?.id;
}

function bookingTenantId(booking) {
  const candidates = [
    typeof booking.tenant === 'string' ? booking.tenant : '',
    booking.tenantUserId,
    booking.tenantId,
    booking.tenant_user_id,
    booking.tenant_id,
    booking.tenant?.userId,
    booking.tenant?.id,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

async function attachBookingTenantProfiles(bookings) {
  const ids = [...new Set(bookings.map(bookingTenantId).filter(Boolean))];
  const profiles = await Promise.allSettled(ids.map((id) => apiRequest(`/users/${encodeURIComponent(id)}/public-profile`, { auth: false })));
  const profilesById = new Map();
  profiles.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const profile = result.value;
      profilesById.set(ids[index], {
        ...profile,
        fullName: profile?.fullName || profile?.full_name || profile?.name || profile?.displayName,
      });
    }
  });
  return bookings.map((booking) => ({ ...booking, tenantProfile: profilesById.get(bookingTenantId(booking)) || null }));
}

function loadBookingsWithListings(bookings) {
  return Promise.all(bookings.map(async (booking) => {
    const listing = booking.listing && typeof booking.listing === 'object' ? booking.listing : null;
    const listingId = bookingListingId(booking);
    if (listing || !listingId) return { ...booking, listingData: listing };
    try { return { ...booking, listingData: await apiRequest(`/listings/${listingId}`, { auth: false }) }; }
    catch { return { ...booking, listingData: null }; }
  }));
}

export function TenantDashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reviewsByBooking, setReviewsByBooking] = useState({});
  const [modalBooking, setModalBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [bookingResult, notificationResult] = await Promise.allSettled([apiRequest('/bookings'), apiRequest('/me/notifications')]);
      if (bookingResult.status === 'rejected') throw bookingResult.reason;
      const withListings = await loadBookingsWithListings(Array.isArray(bookingResult.value) ? bookingResult.value : []);
      setBookings(withListings); setNotifications(notificationResult.status === 'fulfilled' && Array.isArray(notificationResult.value) ? notificationResult.value.slice(0, 3) : []);
      const eligible = withListings.filter((booking) => booking.status === 'COMPLETED');
      const reviews = await Promise.allSettled(eligible.map((booking) => apiRequest(`/bookings/${booking.id}/review`, { auth: false })));
      setReviewsByBooking(Object.fromEntries(reviews.flatMap((response, index) => {
        if (response.status !== 'fulfilled') return [];
        const value = response.value;
        const existing = Array.isArray(value) ? value.length > 0 : Boolean(value?.id);
        return existing ? [[eligible[index].id, value]] : [];
      })));
    } catch (err) { setError(formatApiError(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const transition = async (booking, action) => {
    const label = action === 'cancel' ? 'Скасувати це бронювання?' : 'Позначити проживання як завершене?';
    if (!window.confirm(label)) return;
    setBusyId(booking.id); setError('');
    try { const updated = await apiRequest(`/bookings/${booking.id}/${action}`, { method: 'POST' }); const rows = await loadBookingsWithListings([updated]); setBookings((current) => current.map((item) => item.id === booking.id ? rows[0] : item)); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusyId(''); }
  };

  const sorted = useMemo(() => [...bookings].sort((a, b) => String(b.createdAt || b.startDate).localeCompare(String(a.createdAt || a.startDate))), [bookings]);

    return <DashboardFrame active="/dashboard/tenant"><PageHeading eyebrow={`Вітаємо${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}`} title="Ваші бронювання" description="Слідкуйте за запитами та повертайтеся до помешкань, які обрали." action={<Link className="button button-primary" to="/search"><Icon name="search" size={17}/> Знайти житло</Link>}/><Alert>{error}</Alert>{loading ? <Loading label="Завантажуємо ваші бронювання…"/> : <>
    <div className="dashboard-stat-row"><div className="stat-card"><span>Усього бронювань</span><strong>{bookings.length}</strong><small>За весь час</small></div><div className="stat-card"><span>Очікують відповіді</span><strong>{bookings.filter((b) => b.status === 'PENDING').length}</strong><small>Власник скоро відповість</small></div><div className="stat-card"><span>Тривають зараз</span><strong>{bookings.filter((b) => b.status === 'ACTIVE').length}</strong><small>Ваші активні оренди</small></div></div>
    <section className="dashboard-section"><div className="section-title-row"><div><span className="eyebrow">Ваші запити</span><h2>Історія бронювань</h2></div></div>{sorted.length ? <div className="booking-list">{sorted.map((booking) => <article className="booking-row" id={`booking-${booking.id}`} key={booking.id}><PropertyImage src={booking.listingData?.primaryImageUrl || booking.listingData?.imageUrls?.[0]} alt={booking.listingData?.title || 'Помешкання'} compact/><div className="booking-row-main"><span className="listing-location"><Icon name="pin" size={14}/>{booking.listingData?.city || 'Помешкання'}</span><Link to={`/listings/${bookingListingId(booking)}`}><h3>{booking.listingData?.title || 'Переглянути помешкання'}</h3></Link><div className="booking-row-meta"><span><Icon name="calendar" size={14}/>{booking.startDate} — {booking.endDate}</span>{booking.message && <span className="booking-message">«{booking.message}»</span>}</div></div><div className="booking-row-side"><StatusPill status={booking.status}/><div className="booking-actions">{['PENDING', 'APPROVED', 'ACTIVE'].includes(booking.status) && <Button variant="outline" disabled={busyId === booking.id} onClick={() => transition(booking, 'cancel')}>Скасувати</Button>}{booking.status === 'ACTIVE' && <Button variant="outline" disabled={busyId === booking.id} onClick={() => transition(booking, 'complete')}>Завершити</Button>}{booking.status === 'COMPLETED' && !reviewsByBooking[booking.id] && <Button variant="outline" onClick={() => setModalBooking(booking)}>Залишити відгук</Button>}{reviewsByBooking[booking.id] && <span className="review-sent"><Icon name="check" size={15}/>Відгук надіслано</span>}</div></div></article>)}</div> : <EmptyState icon="calendar" title="Бронювань ще немає" text="Коли ви надішлете запит власнику, він з’явиться тут." action={<Link className="button button-primary" to="/search">Знайти житло</Link>}/>}</section>
    <section className="dashboard-section notification-preview"><div className="section-title-row"><div><span className="eyebrow">Будьте в курсі</span><h2>Останні сповіщення</h2></div><Link className="text-link" to="/notifications">Усі сповіщення <Icon name="arrow" size={15}/></Link></div>{notifications.length ? <div className="notifications-list compact-notifications">{notifications.map((item) => <div className={`notification-row ${!item.readAt ? 'notification-row-unread' : ''}`} key={item.id}><span className="notification-symbol"><Icon name="bell" size={17}/></span><span className="notification-content"><strong>{item.title}</strong><span>{item.body}</span><small>{notificationTime(item.createdAt)}</small></span></div>)}</div> : <p className="muted-copy">Нових сповіщень немає.</p>}</section>
  </>}{modalBooking && <ReviewForm booking={modalBooking} onCancel={() => setModalBooking(null)} onSubmitted={() => { setReviewsByBooking((prev) => ({ ...prev, [modalBooking.id]: true })); setModalBooking(null); }}/>}</DashboardFrame>;
}

function BookingManagementRow({ booking, landlord = false, onChanged }) {
  const listingId = bookingListingId(booking);
  const [listing, setListing] = useState(booking.listing && typeof booking.listing === 'object' ? booking.listing : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (listing || !listingId) return; apiRequest(`/listings/${listingId}`, { auth: false }).then(setListing).catch(() => {}); }, [listingId, listing]);
  const transition = async (action) => {
    const title = action === 'confirm' ? 'Підтвердити запит на оренду?' : action === 'reject' ? 'Відхилити цей запит?' : action === 'cancel' ? 'Скасувати бронювання?' : 'Позначити оренду як завершену?';
    if (!window.confirm(title)) return;
    setBusy(true); setError('');
    try { const result = await apiRequest(`/bookings/${booking.id}/${action}`, { method: 'POST' }); onChanged(result); notifyNotificationsChanged(); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(false); }
  };
  return <article className="incoming-booking-row" id={`booking-${booking.id}`}><PropertyImage src={listing?.primaryImageUrl || listing?.imageUrls?.[0]} alt={listing?.title || 'Помешкання'} compact/><div className="incoming-booking-info"><Link to={`/listings/${listingId}`}><strong>{listing?.title || 'Помешкання'}</strong></Link><span>{booking.startDate} — {booking.endDate}</span><small>Орендар: {booking.tenantName || booking.tenant?.fullName || booking.tenantEmail || 'Користувач'}</small>{booking.message && <p>«{booking.message}»</p>}{error && <small className="field-error">{error}</small>}</div><div className="incoming-booking-actions"><StatusPill status={booking.status}/>{landlord && booking.status === 'PENDING' && <div className="button-row"><Button disabled={busy} onClick={() => transition('confirm')}>Підтвердити</Button><Button variant="outline" disabled={busy} onClick={() => transition('reject')}>Відхилити</Button></div>}{landlord && booking.status === 'ACTIVE' && <Button variant="outline" disabled={busy} onClick={() => transition('complete')}>Завершити оренду</Button>}{!landlord && ['PENDING', 'APPROVED', 'ACTIVE'].includes(booking.status) && <Button variant="outline" disabled={busy} onClick={() => transition('cancel')}>Скасувати</Button>}{!landlord && booking.status === 'ACTIVE' && <Button variant="outline" disabled={busy} onClick={() => transition('complete')}>Завершити</Button>}</div></article>;
}

function LandlordBookingTableRow({ booking, onChanged }) {
  const listingId = bookingListingId(booking);
  const [listing, setListing] = useState(booking.listing && typeof booking.listing === 'object' ? booking.listing : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!listing && listingId) apiRequest(`/listings/${listingId}`, { auth: false }).then(setListing).catch(() => {}); }, [listing, listingId]);
  const transition = async (action) => {
    const confirmation = action === 'confirm' ? 'Підтвердити запит на оренду?' : action === 'complete' ? 'Позначити цю оренду як завершену?' : 'Відхилити цей запит?';
    if (!window.confirm(confirmation)) return;
    setBusy(true); setError('');
    try { const updated = await apiRequest(`/bookings/${booking.id}/${action}`, { method: 'POST' }); onChanged(updated); notifyNotificationsChanged(); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(false); }
  };
  const tenant = booking.tenantProfile?.fullName || booking.tenantName || booking.tenant?.fullName || booking.tenantEmail || 'Користувач';
  return <tr id={`booking-${booking.id}`}>
    <td><div className="table-property"><span className="table-property-icon"><Icon name="home" size={17}/></span><span><Link to={`/listings/${listingId}`}>{listing?.title || 'Помешкання'}</Link><small>{listing?.address || listing?.city || 'Адресу не вказано'}</small></span></div></td>
    <td><strong className="table-tenant-name">{tenant}</strong><small>{booking.tenantEmail || 'Запит на оренду'}</small></td>
    <td><strong className="table-dates">{booking.startDate} — {booking.endDate}</strong><small>Період оренди</small></td>
    <td><StatusPill status={booking.status}/></td>
    <td><div className="table-action-cell">{booking.status === 'PENDING' ? <><Button disabled={busy} onClick={() => transition('confirm')}>Підтвердити</Button><Button variant="danger" disabled={busy} onClick={() => transition('reject')}>Відхилити</Button></> : booking.status === 'ACTIVE' ? <Button variant="outline" disabled={busy} onClick={() => transition('complete')}>Завершити</Button> : <Link to={`/listings/${listingId}`} className="text-link">Переглянути</Link>}{error && <small className="field-error">{error}</small>}</div></td>
  </tr>;
}

export function LandlordDashboardPage() {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const location = useLocation();
  const [listingFilter, setListingFilter] = useState('');
  const [bookingFilter, setBookingFilter] = useState('');
  const [listings, setListings] = useState([]);
  const [bookingPage, setBookingPage] = useState(null);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [allBookingCount, setAllBookingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(requestedTab === 'listings' ? 'listings' : 'bookings');
  const [listPage, setListPage] = useState(0);
  const [bookingPageNumber, setBookingPageNumber] = useState(0);
  const [bookingStatusCounts, setBookingStatusCounts] = useState({ PENDING: 0, APPROVED: 0, COMPLETED: 0 });

  useEffect(() => { if (requestedTab === 'bookings' || requestedTab === 'listings') setTab(requestedTab); }, [requestedTab]);
  useEffect(() => { if (bookingPage?.content?.length && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [bookingPage, location.hash]);

  const loadListings = useCallback(async () => {
    const result = await apiRequest('/listings/my?page=0&size=100');
    setListings(toPage(result).content || []);
  }, []);
  const loadBookings = useCallback(async () => {
    const query = new URLSearchParams({ page: String(bookingPageNumber), size: '8', sort: 'createdAt,desc' });
    if (bookingFilter) query.set('status', bookingFilter);
    const [pageResult, allResult, pendingResult, approvedResult, completedResult] = await Promise.allSettled([
      apiRequest(`/bookings/landlord?${query.toString()}`),
      apiRequest('/bookings/landlord?page=0&size=1'),
      apiRequest('/bookings/landlord?status=PENDING&page=0&size=1'),
      apiRequest('/bookings/landlord?status=APPROVED&page=0&size=1'),
      apiRequest('/bookings/landlord?status=COMPLETED&page=0&size=1'),
    ]);
    if (pageResult.status === 'rejected') throw pageResult.reason;
    const nextPage = toPage(pageResult.value);
    setBookingPage({ ...nextPage, content: await attachBookingTenantProfiles(nextPage.content || []) });
    if (allResult.status === 'fulfilled') setAllBookingCount(toPage(allResult.value).totalElements || 0);
    const pendingCount = pendingResult.status === 'fulfilled' ? toPage(pendingResult.value).totalElements || 0 : 0;
    const approvedCount = approvedResult.status === 'fulfilled' ? toPage(approvedResult.value).totalElements || 0 : 0;
    const completedCount = completedResult.status === 'fulfilled' ? toPage(completedResult.value).totalElements || 0 : 0;
    setPendingBookingCount(pendingCount); setBookingStatusCounts({ PENDING: pendingCount, APPROVED: approvedCount, COMPLETED: completedCount });
  }, [bookingFilter, bookingPageNumber]);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { await Promise.all([loadListings(), loadBookings()]); }
    catch (err) { setError(formatApiError(err)); }
    finally { setLoading(false); }
  }, [loadListings, loadBookings]);
  useEffect(() => { refresh(); }, [refresh]);

  const visibleListings = useMemo(() => listings.filter((listing) => !listingFilter || listing.status === listingFilter).slice(listPage * 6, listPage * 6 + 6), [listings, listingFilter, listPage]);
  const filteredCount = listings.filter((listing) => !listingFilter || listing.status === listingFilter).length;
  const listingPageCount = Math.ceil(filteredCount / 6);
  const updateBooking = (updated) => { setBookingPage((current) => ({ ...current, content: (current?.content || []).map((item) => item.id === updated.id ? { ...item, ...updated } : item) })); loadListings().catch(() => {}); };

  return <DashboardFrame active={tab === 'bookings' ? '/dashboard/landlord?tab=bookings' : '/dashboard/landlord?tab=listings'}>
    <PageHeading eyebrow="Кабінет орендодавця" title={tab === 'bookings' ? 'Заявки на оренду' : 'Мої оголошення'} description={tab === 'bookings' ? 'Переглядайте запити та обирайте майбутніх орендарів.' : 'Керуйте своїми помешканнями та їхньою видимістю.'} action={<Link to="/landlord/listings/new" className="button button-primary"><Icon name="plus" size={17}/> Додати житло</Link>}/>
    <Alert>{error}</Alert>
    {loading ? <Loading label="Оновлюємо ваш кабінет…"/> : tab === 'bookings' ? <>
      <div className="dashboard-stat-row landlord-stats"><div className="stat-card"><span>Очікують рішення</span><strong>{bookingStatusCounts.PENDING}</strong><small>Потрібна ваша відповідь</small></div><div className="stat-card"><span>Підтверджено</span><strong>{bookingStatusCounts.APPROVED}</strong><small>Узгоджені заявки</small></div><div className="stat-card"><span>Завершено</span><strong>{bookingStatusCounts.COMPLETED}</strong><small>Успішні оренди</small></div></div>
      <div className="booking-status-tabs" role="tablist" aria-label="Фільтр заявок"><button type="button" className={!bookingFilter ? 'booking-status-active' : ''} onClick={() => { setBookingFilter(''); setBookingPageNumber(0); }}>Усі заявки <span>{allBookingCount}</span></button><button type="button" className={bookingFilter === 'PENDING' ? 'booking-status-active' : ''} onClick={() => { setBookingFilter('PENDING'); setBookingPageNumber(0); }}>Очікують <span>{bookingStatusCounts.PENDING}</span></button><button type="button" className={bookingFilter === 'APPROVED' ? 'booking-status-active' : ''} onClick={() => { setBookingFilter('APPROVED'); setBookingPageNumber(0); }}>Підтверджено <span>{bookingStatusCounts.APPROVED}</span></button><button type="button" className={bookingFilter === 'COMPLETED' ? 'booking-status-active' : ''} onClick={() => { setBookingFilter('COMPLETED'); setBookingPageNumber(0); }}>Завершено <span>{bookingStatusCounts.COMPLETED}</span></button><label className="booking-other-filter"><span className="sr-only">Інші статуси</span><select value={['ACTIVE', 'REJECTED', 'CANCELLED'].includes(bookingFilter) ? bookingFilter : ''} onChange={(event) => { setBookingFilter(event.target.value); setBookingPageNumber(0); }}><option value="">Інші статуси</option><option value="ACTIVE">Активні</option><option value="REJECTED">Відхилені</option><option value="CANCELLED">Скасовані</option></select></label></div>
      <section className="dashboard-section booking-table-section"><div className="section-title-row"><div><span className="eyebrow">Ваші звернення</span><h2>Запити на бронювання</h2></div><span className="table-total">Показано {bookingPage?.numberOfElements ?? bookingPage?.content?.length ?? 0} із {bookingPage?.totalElements ?? 0} заявок</span></div>{bookingPage?.content?.length ? <><div className="booking-table-wrap"><table className="landlord-bookings-table"><thead><tr><th>Об’єкт</th><th>Орендар</th><th>Період оренди</th><th>Статус</th><th>Дія</th></tr></thead><tbody>{bookingPage.content.map((booking) => <LandlordBookingTableRow key={booking.id} booking={booking} onChanged={updateBooking}/>)}</tbody></table></div><Pagination page={bookingPage.number || 0} totalPages={bookingPage.totalPages} onChange={setBookingPageNumber}/></> : <EmptyState icon="calendar" title="Запитів поки немає" text="Нові запити на оренду з’являтимуться тут."/>}</section>
    </> : <>
      <div className="dashboard-stat-row landlord-stats"><div className="stat-card"><span>Усього оголошень</span><strong>{listings.length}</strong><small>Ваші помешкання</small></div><div className="stat-card"><span>Активні</span><strong>{listings.filter((item) => item.status === 'ACTIVE').length}</strong><small>Видимі для орендарів</small></div><div className="stat-card"><span>Очікують модерації</span><strong>{listings.filter((item) => item.status === 'MODERATION').length}</strong><small>Перевіряємо інформацію</small></div><div className="stat-card"><span>Нові заявки</span><strong>{pendingBookingCount}</strong><small>Потрібна ваша відповідь</small></div></div>
      <section className="dashboard-section"><div className="section-title-row"><div><span className="eyebrow">Ваші помешкання</span><h2>Оголошення</h2></div><label className="inline-select"><span className="sr-only">Фільтр за статусом</span><select value={listingFilter} onChange={(event) => { setListingFilter(event.target.value); setListPage(0); }}>{listingStatuses.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></div>{visibleListings.length ? <><div className="manage-listings-grid">{visibleListings.map((listing) => <article className="manage-listing-card" key={listing.id}><Link className="manage-listing-image" to={`/landlord/listings/${listing.id}/manage`}><PropertyImage src={listing.primaryImageUrl || listing.imageUrls?.[0]} alt={listing.title}/><StatusPill status={listing.status}/></Link><div className="manage-listing-content"><span className="listing-location"><Icon name="pin" size={14}/>{listing.city}</span><Link to={`/landlord/listings/${listing.id}/manage`}><h3>{listing.title}</h3></Link><div className="manage-listing-meta"><strong>{formatPrice(listing.monthlyPrice)} <small>/ міс.</small></strong><span>{listing.rooms} кімн. · {listing.area ? `${listing.area} м²` : '—'}</span></div><div className="manage-listing-actions"><Link to={`/landlord/listings/${listing.id}/edit`} className="text-link"><Icon name="edit" size={15}/> Редагувати</Link><Link to={`/landlord/listings/${listing.id}/manage`} className="text-link">Керувати <Icon name="arrow" size={15}/></Link></div></div></article>)}</div>{listingPageCount > 1 && <Pagination page={listPage} totalPages={listingPageCount} onChange={setListPage}/>}</> : <EmptyState icon="home" title="Оголошень поки немає" text={listingFilter ? 'У цьому статусі оголошень немає.' : 'Додайте перше помешкання, щоб орендарі могли його знайти.'} action={!listingFilter && <Link to="/landlord/listings/new" className="button button-primary">Додати оголошення</Link>}/>}</section>
    </>}
  </DashboardFrame>;
}

export function ListingFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', city: '', address: '', monthlyPrice: '', rooms: '', area: '', propertyType: 'APARTMENT', amenities: [] });
  const [original, setOriginal] = useState(null);
  const [files, setFiles] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState('');
  const [creationComplete, setCreationComplete] = useState(false);
  const createdListingId = useRef('');

  useEffect(() => {
    if (!editing) return;
    apiRequest(`/listings/${id}`).then((data) => { setListing(data); const next = { title: data.title || '', description: data.description || '', city: data.city || '', address: data.address || '', monthlyPrice: data.monthlyPrice ?? '', rooms: data.rooms ?? '', area: data.area ?? '', propertyType: data.propertyType || 'APARTMENT', amenities: data.amenities || [] }; setForm(next); setOriginal(next); }).catch((err) => setError(formatApiError(err))).finally(() => setLoading(false));
  }, [editing, id]);

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const toggleAmenity = (amenity) => setForm((current) => ({ ...current, amenities: current.amenities.includes(amenity) ? current.amenities.filter((item) => item !== amenity) : [...current.amenities, amenity] }));
  const addFiles = (event) => {
    const accepted = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const next = [...event.target.files].map((file) => ({ key: `${file.name}-${file.lastModified}-${Math.random()}`, file, status: 'queued', error: '' }));
    const rejected = next.filter(({ file }) => !accepted.includes(file.type) || file.size > 10 * 1024 * 1024);
    const valid = next.filter(({ file }) => accepted.includes(file.type) && file.size <= 10 * 1024 * 1024);
    setFiles((current) => [...current, ...valid]);
    if (rejected.length) setError(rejected.map(({ file }) => `${file.name}: ${!accepted.includes(file.type) ? 'підтримуються JPEG, PNG, GIF або WebP.' : 'максимальний розмір — 10 МБ.'}`).join(' '));
    event.target.value = '';
  };

  const uploadFiles = async (listingId, selected = files) => {
    const targetListingId = listingId || createdListingId.current || createdId;
    if (!targetListingId) {
      setError('Не вдалося визначити ID оголошення. Фото можна завантажити після повторного відкриття оголошення з кабінету.');
      return { failures: selected.length, uploaded: [] };
    }
    let first = !files.some((file) => file.status === 'uploaded');
    let failures = 0;
    const uploaded = [];
    for (const item of selected) {
      if (item.status === 'uploaded') continue;
      setFiles((current) => current.map((file) => file.key === item.key ? { ...file, status: 'uploading', error: '' } : file));
      const body = new FormData(); body.append('file', item.file); if (first) body.append('isPrimary', 'true');
      try { const image = await apiRequest(`/listings/${encodeURIComponent(targetListingId)}/images`, { method: 'POST', body }); first = false; uploaded.push({ fileKey: item.key, image }); setFiles((current) => current.map((file) => file.key === item.key ? { ...file, status: 'uploaded' } : file)); }
      catch (err) { failures += 1; setFiles((current) => current.map((file) => file.key === item.key ? { ...file, status: 'failed', error: formatApiError(err) } : file)); }
    }
    return { failures, uploaded };
  };

  const validate = () => {
    const errors = {};
    ['title', 'description', 'city', 'address', 'propertyType'].forEach((key) => { if (!String(form[key]).trim()) errors[key] = 'Це поле обов’язкове.'; });
    if (form.title.trim().length < 10) errors.title = 'Назва має містити щонайменше 10 символів.';
    if (!(Number(form.monthlyPrice) > 0)) errors.monthlyPrice = 'Ціна має бути більшою за нуль.';
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(form.monthlyPrice))) errors.monthlyPrice = 'Вкажіть суму з не більш ніж двома знаками після коми.';
    if (!(Number(form.rooms) > 0) || !Number.isInteger(Number(form.rooms))) errors.rooms = 'Вкажіть цілу кількість кімнат, більшу за нуль.';
    if (form.area !== '' && !(Number(form.area) > 0)) errors.area = 'Площа має бути більшою за нуль.';
    setFieldErrors(errors); return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setFieldErrors({});
    if (!validate()) return;
    setSaving(true);
    const payload = { title: form.title.trim(), description: form.description.trim(), city: form.city.trim(), address: form.address.trim(), monthlyPrice: Number(form.monthlyPrice), rooms: Number(form.rooms), propertyType: form.propertyType, amenities: form.amenities };
    if (form.area !== '') payload.area = Number(form.area);
    else if (editing && original?.area !== '') payload.area = null;
    try {
      let listingId = id;
      if (editing) {
        const changed = Object.fromEntries(Object.entries(payload).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original?.[key])));
        const result = await apiRequest(`/listings/${id}`, { method: 'PATCH', body: changed }); setListing(result);
        const moderationTriggered = ['city', 'address', 'monthlyPrice'].some((key) => Object.hasOwn(changed, key));
        setSuccess(moderationTriggered ? 'Оголошення оновлено. Зміна міста, адреси або ціни повернула його на модерацію.' : 'Зміни збережено.'); setOriginal(form); setTimeout(() => navigate(`/landlord/listings/${id}/manage`), 800);
      } else {
        const result = await apiRequest('/listings', { method: 'POST', body: payload });
        setCreationComplete(true);
        listingId = getCreatedListingId(result);
        if (!listingId) {
          setError('Оголошення створено, але сервер не повернув його ID. Фото не завантажено; оновіть кабінет перед повторною спробою.');
          return;
        }
        createdListingId.current = listingId;
        setCreatedId(listingId);
        setListing({ ...result, id: listingId });
        const uploadResult = files.length ? await uploadFiles(listingId) : { failures: 0, uploaded: [] };
        let imageListUnavailable = false;
        let unpersistedUploads = [];
        if (files.length && uploadResult.uploaded.length) {
          try {
            const savedImages = await apiRequest(`/listings/${encodeURIComponent(listingId)}/images`);
            if (Array.isArray(savedImages)) {
              const savedIds = new Set(savedImages.flatMap((image) => [image.id, image.imageUrl].filter(Boolean)));
              unpersistedUploads = uploadResult.uploaded.filter(({ image }) => !savedIds.has(image.id) && !savedIds.has(image.imageUrl));
              if (unpersistedUploads.length) {
                const missingKeys = new Set(unpersistedUploads.map(({ fileKey }) => fileKey));
                setFiles((current) => current.map((file) => missingKeys.has(file.key) ? { ...file, status: 'failed', error: 'Сервер не показав збережене фото. Спробуйте завантажити його ще раз.' } : file));
              }
            } else imageListUnavailable = true;
          } catch { imageListUnavailable = true; }
        }
        const anyFailed = uploadResult.failures > 0 || unpersistedUploads.length > 0 || imageListUnavailable;
        setSuccess(anyFailed ? 'Оголошення створено. Частину фото не вдалося зберегти або перевірити — повторіть спробу чи відкрийте оголошення з кабінету.' : 'Оголошення створено й надіслано на модерацію.');
      }
    } catch (err) { if (err.errors) setFieldErrors(err.errors); setError(formatApiError(err)); }
    finally { setSaving(false); }
  };

  const retryUploads = () => uploadFiles(createdListingId.current || createdId, files.filter((file) => file.status === 'failed'));
  if (loading) return <div className="page-container page-section"><Loading label="Завантажуємо оголошення…"/></div>;
  return <div className="page-container form-page"><Link to="/dashboard/landlord" className="back-link"><Icon name="back" size={17}/> До кабінету</Link><PageHeading eyebrow={editing ? 'Оновіть інформацію' : 'Розкажіть про помешкання'} title={editing ? 'Редагувати оголошення' : 'Нове оголошення'} description={editing ? 'Внесіть зміни до свого оголошення.' : 'Заповніть деталі — орендарі зможуть швидше знайти свій дім.'}/><Alert>{error}</Alert>{success && <Alert tone="success">{success}{createdId && <div className="alert-action"><Link className="text-link" to={`/landlord/listings/${createdId}/manage`}>Перейти до оголошення <Icon name="arrow" size={15}/></Link>{files.some((file) => file.status === 'failed') && <Button variant="outline" onClick={retryUploads}>Повторити завантаження фото</Button>}</div>}</Alert>}
    <form className="listing-form form-stack" onSubmit={submit} noValidate><section className="form-section"><div className="form-section-heading"><span className="form-step">01</span><div><h2>Основна інформація</h2><p>Почніть із найважливішого про ваше помешкання.</p></div></div><div className="form-grid"><label className="form-field form-field-wide"><span>Назва оголошення</span><input value={form.title} onChange={change('title')} placeholder="Наприклад: Світла квартира біля парку" maxLength="120" required/><FieldError error={fieldErrors.title}/></label><label className="form-field form-field-wide"><span>Опис помешкання</span><textarea rows="6" value={form.description} onChange={change('description')} placeholder="Розкажіть про планування, стан та особливості житла…" required/><FieldError error={fieldErrors.description}/></label><label className="form-field"><span>Місто</span><input value={form.city} onChange={change('city')} placeholder="Київ" required/><FieldError error={fieldErrors.city}/></label><label className="form-field"><span>Адреса</span><input value={form.address} onChange={change('address')} placeholder="Вулиця та номер будинку" required/><FieldError error={fieldErrors.address}/></label><label className="form-field"><span>Тип помешкання</span><select value={form.propertyType} onChange={change('propertyType')}><option value="APARTMENT">Квартира</option><option value="HOUSE">Будинок</option><option value="ROOM">Кімната</option></select><FieldError error={fieldErrors.propertyType}/></label><label className="form-field"><span>Кількість кімнат</span><input type="number" min="1" step="1" value={form.rooms} onChange={change('rooms')} placeholder="2" required/><FieldError error={fieldErrors.rooms}/></label><label className="form-field"><span>Місячна оренда, ₴</span><input type="number" min="0.01" step="0.01" value={form.monthlyPrice} onChange={change('monthlyPrice')} placeholder="15000" required/><FieldError error={fieldErrors.monthlyPrice}/></label><label className="form-field"><span>Площа, м² <small>(необов’язково)</small></span><input type="number" min="0.1" step="0.1" value={form.area} onChange={change('area')} placeholder="55"/><FieldError error={fieldErrors.area}/></label></div></section>
    <section className="form-section"><div className="form-section-heading"><span className="form-step">02</span><div><h2>Зручності</h2><p>Що робить це місце особливим?</p></div></div><div className="amenity-options">{[['wifi', 'Wi-Fi'], ['parking', 'Паркінг'], ['balcony', 'Балкон'], ['furnished', 'Меблі'], ['pets_allowed', 'Можна з тваринами'], ['air_conditioning', 'Кондиціонер'], ['elevator', 'Ліфт']].map(([value, label]) => <label className={`amenity-option ${form.amenities.includes(value) ? 'amenity-option-selected' : ''}`} key={value}><input type="checkbox" checked={form.amenities.includes(value)} onChange={() => toggleAmenity(value)}/><span className="amenity-checkbox"><Icon name="check" size={14}/></span>{label}</label>)}</div></section>
    {!editing && <section className="form-section"><div className="form-section-heading"><span className="form-step">03</span><div><h2>Фотографії</h2><p>Додайте до 10 МБ на фото у форматі JPEG, PNG, GIF або WebP.</p></div></div><label className="upload-dropzone"><input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" onChange={addFiles}/><span className="upload-icon"><Icon name="plus" size={21}/></span><strong>Перетягніть фото сюди або оберіть файли</strong><small>Перше фото стане головним</small></label>{files.length > 0 && <div className="upload-queue"><div className="upload-progress-label">Завантажено {files.filter((file) => file.status === 'uploaded').length} з {files.length}</div>{files.map((item) => <div className="upload-queue-row" key={item.key}><span className="upload-file-icon"><Icon name="home" size={16}/></span><span><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(1)} МБ</small></span><span className={`upload-status upload-${item.status}`}>{item.status === 'uploaded' ? 'Завантажено' : item.status === 'uploading' ? 'Завантаження…' : item.status === 'failed' ? `Помилка: ${item.error}` : 'Очікує'}</span></div>)}</div>}</section>}
    {editing && <Alert tone="info">Зміна міста, адреси або ціни автоматично поверне оголошення на модерацію.</Alert>}
    <div className="form-submit-row"><span><Icon name="clock" size={16}/> Нові оголошення проходять модерацію перед публікацією.</span><div className="button-row"><Link className="button button-outline" to="/dashboard/landlord">Скасувати</Link><Button type="submit" disabled={saving || creationComplete}>{saving ? 'Зберігаємо…' : creationComplete ? 'Оголошення створено' : editing ? 'Зберегти зміни' : 'Створити оголошення'} <Icon name="arrow" size={17}/></Button></div></div>
    </form></div>;
}

export function ListingManagementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [images, setImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [files, setFiles] = useState([]);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const tasks = await Promise.allSettled([
      apiRequest(`/listings/${id}`), apiRequest(`/listings/${id}/images`), apiRequest(`/listings/${id}/reviews?page=0&size=50`), apiRequest('/bookings/landlord?page=0&size=100'),
    ]);
    const firstError = tasks.find((item) => item.status === 'rejected');
    if (firstError) setError(formatApiError(firstError.reason));
    if (tasks[0].status === 'fulfilled') setListing(tasks[0].value);
    if (tasks[1].status === 'fulfilled') setImages(Array.isArray(tasks[1].value) ? tasks[1].value : []);
    if (tasks[2].status === 'fulfilled') setReviews(await attachPublicReviewerProfiles(toPage(tasks[2].value).content || []));
    if (tasks[3].status === 'fulfilled') {
      const rows = toPage(tasks[3].value).content || [];
      setBookings(rows.filter((booking) => (typeof booking.listing === 'string' ? booking.listing : booking.listing?.id) === id));
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const chooseFiles = (event) => {
    const accepted = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const selected = [...event.target.files];
    const invalid = selected.filter((file) => !accepted.includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid.length) setError(invalid.map((file) => `${file.name}: ${!accepted.includes(file.type) ? 'формат не підтримується.' : 'файл більший за 10 МБ.'}`).join(' '));
    setFiles((current) => [...current, ...selected.filter((file) => accepted.includes(file.type) && file.size <= 10 * 1024 * 1024).map((file) => ({ key: `${file.name}-${file.lastModified}-${Math.random()}`, file, status: 'queued', error: '' }))]);
    event.target.value = '';
  };

  const uploadSelected = async (queued = files.filter((item) => item.status !== 'uploaded')) => {
    if (busy === 'upload' || !queued.length) return;
    setBusy('upload');
    let primaryAssigned = images.some((image) => image.isPrimary);
    try {
      for (const item of queued) {
        setFiles((current) => current.map((row) => row.key === item.key ? { ...row, status: 'uploading', error: '' } : row));
        const body = new FormData(); body.append('file', item.file); if (!primaryAssigned) body.append('isPrimary', 'true');
        try {
          const response = await apiRequest(`/listings/${id}/images`, { method: 'POST', body });
          primaryAssigned = primaryAssigned || Boolean(response.isPrimary);
          setFiles((current) => current.map((row) => row.key === item.key ? { ...row, status: 'uploaded' } : row));
          setImages((current) => [...current, response]);
        } catch (err) { setFiles((current) => current.map((row) => row.key === item.key ? { ...row, status: 'failed', error: formatApiError(err) } : row)); }
      }
    } finally { setBusy(''); }
  };

  const setPrimary = async (image) => {
    setBusy(`primary-${image.id}`); setError(''); setSuccess('');
    try { const updated = await apiRequest(`/listings/${id}/images/${image.id}/primary`, { method: 'PATCH' }); setImages((current) => current.map((row) => ({ ...row, isPrimary: row.id === updated.id }))); setSuccess('Головне фото оновлено.'); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(''); }
  };
  const removeImage = async (image) => {
    if (!window.confirm('Видалити це фото з оголошення?')) return;
    setBusy(`delete-${image.id}`); setError(''); setSuccess('');
    try { await apiRequest(`/listings/${id}/images/${image.id}`, { method: 'DELETE' }); const remaining = images.filter((row) => row.id !== image.id); setImages(remaining); try { const refreshed = await apiRequest(`/listings/${id}/images`); setImages(Array.isArray(refreshed) ? refreshed : remaining); } catch { /* Keep the local delete and retry refresh on next visit. */ } setSuccess('Фото видалено.'); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(''); }
  };
  const changeStatus = async (status) => {
    const message = status === 'ARCHIVED' ? 'Перемістити оголошення в архів?' : 'Знову опублікувати оголошення?';
    if (!window.confirm(message)) return;
    setBusy('status'); setError('');
    try { setListing(await apiRequest(`/listings/${id}/status?status=${status}`, { method: 'PATCH' })); setSuccess(status === 'ACTIVE' ? 'Оголошення активовано.' : 'Оголошення в архіві.'); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(''); }
  };
  const archiveDelete = async () => {
    if (!window.confirm('Архівувати оголошення? Його буде прибрано з пошуку, але воно залишиться у вашому кабінеті.')) return;
    setBusy('status'); setError('');
    try { await apiRequest(`/listings/${id}`, { method: 'DELETE' }); navigate('/dashboard/landlord', { replace: true }); }
    catch (err) { setError(formatApiError(err)); setBusy(''); }
  };
  const replyToReview = async (review) => {
    const reply = (replies[review.id] ?? review.reply ?? '').trim();
    if (!reply) { setError('Напишіть відповідь перед надсиланням.'); return; }
    setBusy(`reply-${review.id}`); setError('');
    try { const updated = await apiRequest(`/reviews/${review.id}/reply`, { method: 'POST', body: { reply } }); const [enriched] = await attachPublicReviewerProfiles([updated]); setReviews((current) => current.map((row) => row.id === review.id ? enriched : row)); setSuccess('Відповідь надіслано.'); }
    catch (err) { setError(formatApiError(err)); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="page-container page-section"><Loading label="Завантажуємо керування помешканням…"/></div>;
  if (!listing) return <div className="page-container page-section"><Alert>{error || 'Оголошення не знайдено.'}</Alert><Link className="text-link" to="/dashboard/landlord">До кабінету</Link></div>;
  return <div className="page-container management-page"><Link to="/dashboard/landlord" className="back-link"><Icon name="back" size={17}/> До кабінету</Link><PageHeading eyebrow="Керування оголошенням" title={listing.title} description={`${listing.city}${listing.address ? ` · ${listing.address}` : ''}`} action={<div className="button-row"><Link to={`/landlord/listings/${id}/edit`} className="button button-outline"><Icon name="edit" size={16}/> Редагувати</Link><Link to={`/listings/${id}`} className="button button-outline"><Icon name="eye" size={16}/> Переглянути</Link></div>}/><Alert>{error}</Alert>{success && <Alert tone="success">{success}</Alert>}
    <div className="management-summary"><div className="management-summary-price"><span>Місячна оренда</span><strong>{formatPrice(listing.monthlyPrice)}</strong></div><div><span>Статус оголошення</span><StatusPill status={listing.status}/></div><div><span>Тип помешкання</span><strong>{listing.propertyType === 'APARTMENT' ? 'Квартира' : listing.propertyType === 'HOUSE' ? 'Будинок' : 'Кімната'}</strong></div><div className="status-control">{listing.status === 'ACTIVE' ? <Button variant="outline" disabled={busy === 'status'} onClick={() => changeStatus('ARCHIVED')}>В архів</Button> : ['ARCHIVED', 'REJECTED'].includes(listing.status) ? <Button disabled={busy === 'status'} onClick={() => changeStatus('ACTIVE')}>Активувати</Button> : <span className="muted-copy">Оголошення очікує модерації.</span>}</div></div>
    <section className="dashboard-section management-section"><div className="section-title-row"><div><span className="eyebrow">Галерея помешкання</span><h2>Фотографії <span className="review-count">({images.length})</span></h2></div><label className="button button-outline upload-choose"><Icon name="plus" size={17}/> Додати фото<input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" onChange={chooseFiles}/></label></div><p className="muted-copy">JPEG, PNG, GIF або WebP · до 10 МБ на файл. Головне фото показується в результатах пошуку.</p><div className="image-management-grid">{images.map((image) => <article className="managed-image-card" key={image.id}><PropertyImage src={image.imageUrl} alt={listing.title}/>{image.isPrimary && <span className="primary-image-tag"><Icon name="star" size={13}/>Головне фото</span>}<div className="managed-image-actions">{!image.isPrimary && <Button variant="outline" disabled={busy === `primary-${image.id}`} onClick={() => setPrimary(image)}>Зробити головним</Button>}<button type="button" className="icon-button danger-icon" disabled={busy === `delete-${image.id}`} title="Видалити фото" onClick={() => removeImage(image)}><Icon name="trash" size={17}/></button></div></article>)}</div>{files.length > 0 && <div className="upload-queue">{files.map((item) => <div className="upload-queue-row" key={item.key}><Icon name="home" size={16}/><span><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(1)} МБ</small></span><span className={`upload-status upload-${item.status}`}>{item.status === 'uploaded' ? 'Завантажено' : item.status === 'uploading' ? 'Завантаження…' : item.status === 'failed' ? `Помилка: ${item.error}` : 'Очікує'}</span></div>)}<div className="button-row"><Button onClick={() => uploadSelected()} disabled={busy === 'upload'}>{files.some((item) => item.status === 'failed') ? 'Повторити невдалі фото' : 'Завантажити фото'}</Button></div></div>}{images.length === 0 && files.length === 0 && <EmptyState icon="home" title="Фотографій поки немає" text="Додайте фото, щоб орендарям було легше уявити помешкання."/>}</section>
    <section className="dashboard-section management-section"><div className="section-title-row"><div><span className="eyebrow">Спілкування з орендарями</span><h2>Запити на бронювання</h2></div></div>{bookings.length ? <div className="incoming-booking-list">{bookings.map((booking) => <BookingManagementRow key={booking.id} booking={booking} landlord onChanged={(updated) => { setBookings((current) => current.map((item) => item.id === updated.id ? updated : item)); }}/>)}</div> : <p className="muted-copy">Поки що немає запитів на це помешкання.</p>}</section>
    <section className="dashboard-section management-section"><div className="section-title-row"><div><span className="eyebrow">Враження гостей</span><h2>Відгуки та відповіді</h2></div></div>{reviews.length ? <div className="reviews-list">{reviews.map((review) => <article className="review-card landlord-review" key={review.id}><div className="review-person"><span className="avatar">{reviewAuthorName(review).slice(0, 1).toUpperCase()}</span><div><strong>{reviewAuthorName(review)}</strong><small>{review.createdAt ? new Date(review.createdAt).toLocaleDateString('uk-UA') : ''}</small></div><span className="review-rating"><Icon name="star" size={14}/>{review.rating}</span><StatusPill status={review.status}/></div>{review.comment && <p>{review.comment}</p>}{review.reply && <div className="review-reply"><strong>Ваша відповідь</strong><p>{review.reply}</p></div>}<div className="reply-form"><label className="form-field"><span>{review.reply ? 'Оновити відповідь' : 'Ваша відповідь'}</span><textarea rows="3" value={replies[review.id] ?? review.reply ?? ''} onChange={(event) => setReplies((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Дякуємо за відгук…"/></label><Button disabled={busy === `reply-${review.id}`} onClick={() => replyToReview(review)}>{busy === `reply-${review.id}` ? 'Надсилаємо…' : 'Надіслати відповідь'}</Button></div></article>)}</div> : <p className="muted-copy">Відгуки про це помешкання з’являться тут.</p>}</section>
    <div className="archive-danger-zone"><div><strong>Архівувати помешкання</strong><p>Приберіть оголошення з пошуку. Ви зможете активувати його пізніше.</p></div><Button variant="danger" onClick={archiveDelete}>Архівувати оголошення</Button></div>
  </div>;
}

export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ email: '', fullName: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [profileBusy, setProfileBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [profileMessage, setProfileMessage] = useState('');

  useEffect(() => { apiRequest('/me').then((data) => { setProfile({ email: data.email || '', fullName: data.fullName || '', phone: data.phone || '' }); updateUser(data); }).catch((err) => setError(formatApiError(err))).finally(() => setLoading(false)); }, [updateUser]);
  const changeProfile = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const saveProfile = async (event) => {
    event.preventDefault(); setError(''); setFieldErrors({}); setProfileMessage('');
    const errors = {};
    if (!/^\S+@\S+\.\S+$/.test(profile.email.trim())) errors.email = 'Вкажіть коректну електронну пошту.';
    if (profile.fullName.length > 120) errors.fullName = 'Ім’я має містити не більше 120 символів.';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setProfileBusy(true);
    try { const updated = await apiRequest('/me', { method: 'PUT', body: { email: profile.email.trim(), fullName: profile.fullName.trim(), phone: profile.phone.trim() || null } }); updateUser(updated); setProfile({ email: updated.email || '', fullName: updated.fullName || '', phone: updated.phone || '' }); setProfileMessage('Профіль оновлено.'); }
    catch (err) { if (err.errors) setFieldErrors(err.errors); setError(formatApiError(err)); }
    finally { setProfileBusy(false); }
  };
  if (loading) return <div className="page-container page-section"><Loading label="Завантажуємо налаштування…"/></div>;
  return <DashboardFrame active="/settings"><PageHeading eyebrow="Ваш профіль" title="Налаштування" description="Оновлюйте особисті дані та налаштування безпеки."/><Alert>{error}</Alert><div className="settings-grid"><section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><Icon name="user"/></span><div><h2>Особисті дані</h2><p>Змініть інформацію, яку бачите тільки ви.</p></div></div>{profileMessage && <Alert tone="success">{profileMessage}</Alert>}<form className="form-stack" onSubmit={saveProfile}><label className="form-field"><span>Електронна пошта</span><input type="email" value={profile.email} onChange={changeProfile('email')} required/><FieldError error={fieldErrors.email}/></label><label className="form-field"><span>Повне ім’я</span><input maxLength="120" value={profile.fullName} onChange={changeProfile('fullName')} placeholder="Ваше ім’я"/><FieldError error={fieldErrors.fullName}/></label><label className="form-field"><span>Номер телефону</span><input type="tel" value={profile.phone} onChange={changeProfile('phone')} placeholder="+380 00 000 00 00"/><FieldError error={fieldErrors.phone}/></label><div className="form-field"><span>Тип акаунту</span><div className="readonly-field">{user?.role === 'LANDLORD' ? 'Власник житла' : user?.role === 'ADMIN' ? 'Адміністратор' : 'Орендар'} <small>Не можна змінити</small></div></div><Button type="submit" disabled={profileBusy}>{profileBusy ? 'Зберігаємо…' : 'Зберегти зміни'}</Button></form></section><section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><Icon name="eye"/></span><div><h2>Безпека акаунту</h2><p>Керуйте паролем і деактивацією акаунту окремо.</p></div></div><Link className="button button-outline" to="/settings/security">Відкрити налаштування безпеки</Link></section></div></DashboardFrame>;
}

export function AccountSecurityPage() {
  const { clear } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [passwordMessage, setPasswordMessage] = useState('');

  const changePassword = async (event) => {
    event.preventDefault(); setError(''); setPasswordMessage(''); setFieldErrors({});
    if (password.newPassword.length < 8) { setFieldErrors({ newPassword: 'Новий пароль має містити щонайменше 8 символів.' }); return; }
    setPasswordBusy(true);
    try { const result = await apiRequest('/me/password', { method: 'PATCH', body: password }); setPasswordMessage(result?.message || 'Пароль змінено.'); setPassword({ currentPassword: '', newPassword: '' }); }
    catch (err) { if (err.errors) setFieldErrors(err.errors); setError(formatApiError(err)); }
    finally { setPasswordBusy(false); }
  };
  const deactivate = async () => {
    const confirmation = window.prompt('Щоб деактивувати акаунт, введіть ДЕАКТИВУВАТИ');
    if (confirmation !== 'ДЕАКТИВУВАТИ') return;
    setDeactivateBusy(true); setError('');
    try { await apiRequest('/me', { method: 'DELETE' }); clear(); navigate('/', { replace: true }); window.history.replaceState(null, '', '/'); }
    catch (err) { setError(formatApiError(err)); setDeactivateBusy(false); }
  };

  return <DashboardFrame active="/settings"><Link to="/settings" className="back-link"><Icon name="back" size={17}/> До налаштувань</Link><PageHeading eyebrow="Безпека акаунту" title="Налаштування безпеки" description="Змініть пароль або деактивуйте свій акаунт."/><Alert>{error}</Alert><div className="settings-right-column"><section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><Icon name="eye"/></span><div><h2>Змінити пароль</h2><p>Використовуйте надійний пароль щонайменше з 8 символів.</p></div></div>{passwordMessage && <Alert tone="success">{passwordMessage}</Alert>}<form className="form-stack" onSubmit={changePassword}><label className="form-field"><span>Поточний пароль</span><input type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} required/></label><label className="form-field"><span>Новий пароль</span><input type="password" autoComplete="new-password" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} minLength="8" required/><FieldError error={fieldErrors.newPassword}/></label><Button variant="outline" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Оновлюємо…' : 'Змінити пароль'}</Button></form></section><section className="danger-settings-card"><div><span className="eyebrow">Небезпечна зона</span><h2>Деактивувати акаунт</h2><p>Цю дію не можна скасувати. Ваші дані профілю буде видалено.</p></div><Button variant="danger" disabled={deactivateBusy} onClick={deactivate}>{deactivateBusy ? 'Деактивуємо…' : 'Деактивувати акаунт'}</Button></section></div></DashboardFrame>;
}

function AdminListingRow({ listing, onAction, onForbidden, denied }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = async (decision) => {
    const label = decision === 'approve' ? 'Схвалити це оголошення?' : 'Відхилити це оголошення?';
    if (!window.confirm(label)) return;
    setBusy(true); setError('');
    try { const result = await apiRequest(`/admin/listings/${listing.id}/${decision}`, { method: 'POST' }); onAction(listing.id, result); }
    catch (err) { setError(formatApiError(err)); if (err.status === 403) onForbidden(); }
    finally { setBusy(false); }
  };
  return <article id={`listing-${listing.id}`} className="admin-listing-row"><PropertyImage src={listing.primaryImageUrl || listing.imageUrls?.[0]} alt={listing.title} compact/><div className="admin-listing-info"><span className="listing-location"><Icon name="pin" size={14}/>{listing.city}</span><Link to={`/listings/${listing.id}`}><strong>{listing.title}</strong></Link><span>{listing.address} · {listing.rooms} кімн. · {formatPrice(listing.monthlyPrice)} / міс.</span>{error && <small className="field-error">{error}</small>}</div>{!denied && <div className="admin-row-actions"><Button disabled={busy} onClick={() => action('approve')}>Схвалити</Button><Button variant="danger" disabled={busy} onClick={() => action('reject')}>Відхилити</Button></div>}</article>;
}

function AdminReviewRow({ review, onAction, onForbidden, denied }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = async (decision) => {
    if (!window.confirm(decision === 'approve' ? 'Схвалити цей відгук?' : 'Відхилити цей відгук?')) return;
    setBusy(true); setError('');
    try { const result = await apiRequest(`/admin/reviews/${review.id}/${decision}`, { method: 'POST' }); onAction(review.id, result); }
    catch (err) { setError(formatApiError(err)); if (err.status === 403) onForbidden(); }
    finally { setBusy(false); }
  };
  return <article id={`review-${review.id}`} className="admin-review-row"><div className="review-person"><span className="avatar">{reviewAuthorName(review).slice(0, 1).toUpperCase()}</span><div><strong>{reviewAuthorName(review)}</strong><small>{review.createdAt ? new Date(review.createdAt).toLocaleDateString('uk-UA') : 'Відгук'}</small></div><span className="review-rating"><Icon name="star" size={14}/>{review.rating}</span></div><p>{review.comment || 'Оцінка без коментаря.'}</p>{!denied && <div className="admin-row-actions"><Button disabled={busy} onClick={() => action('approve')}>Схвалити</Button><Button variant="danger" disabled={busy} onClick={() => action('reject')}>Відхилити</Button></div>}{error && <small className="field-error">{error}</small>}</article>;
}

export function AdminDashboardPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState(requestedTab === 'reviews' ? 'reviews' : 'listings');
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminDenied, setAdminDenied] = useState(false);

  useEffect(() => { if (requestedTab === 'reviews' || requestedTab === 'listings' || requestedTab === 'users') setTab(requestedTab); }, [requestedTab]);
  useEffect(() => { if (data?.content?.length && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [data, location.hash]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const statsPromise = apiRequest('/admin/dashboard/stats');
    const query = new URLSearchParams({ page: String(page), size: '8', sort: 'createdAt,desc' });
    if (tab === 'users') { if (statusFilter) query.set('status', statusFilter); if (roleFilter) query.set('role', roleFilter); }
    const endpoint = tab === 'listings' ? `/admin/listings/pending?${query}` : tab === 'reviews' ? `/admin/reviews/pending?${query}` : `/admin/users?${query}`;
    Promise.allSettled([statsPromise, apiRequest(endpoint)]).then(async ([statsResult, listResult]) => {
      if (!active) return;
      if (statsResult.status === 'fulfilled') setStats(statsResult.value); else setError(formatApiError(statsResult.reason));
      if (listResult.status === 'fulfilled') {
        const pageData = toPage(listResult.value);
        if (tab === 'reviews') pageData.content = await attachPublicReviewerProfiles(pageData.content || []);
        if (active) setData(pageData);
      } else setError((current) => current || formatApiError(listResult.reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, page, statusFilter, roleFilter, refreshKey]);

  const afterAction = () => setRefreshKey((current) => current + 1);
  const replaceRow = (id) => setData((current) => current ? { ...current, content: (current.content || []).filter((item) => item.id !== id), totalElements: Math.max((current.totalElements || 1) - 1, 0) } : current);
  const forbidAdminActions = () => { setAdminDenied(true); setError('У вас немає прав для цієї дії.'); };
  const filteredUsers = useMemo(() => (data?.content || []).filter((person) => `${person.fullName || ''} ${person.email || ''}`.toLocaleLowerCase('uk-UA').includes(userSearch.trim().toLocaleLowerCase('uk-UA'))), [data, userSearch]);
  const moderateUser = async (user) => {
    const blocked = user.status === 'BLOCKED' || user.blocked === true;
    if (!window.confirm(blocked ? 'Розблокувати акаунт?' : 'Заблокувати цей акаунт?')) return;
    try { await apiRequest(`/admin/users/${user.id}/${blocked ? 'unblock' : 'block'}`, { method: 'POST' }); afterAction(); }
    catch (err) { setError(formatApiError(err)); if (err.status === 403) setAdminDenied(true); }
  };

  return <DashboardFrame active="/dashboard/admin"><PageHeading eyebrow="Панель адміністратора" title="Модерація та керування" description="Стежте за сервісом і допомагайте спільноті залишатися надійною."/><Alert>{error}</Alert>{stats && <div className="admin-stats-grid">{[['Учасники', stats.totalUsers], ['Власники', stats.totalLandlords], ['Орендарі', stats.totalTenants], ['Заблоковані', stats.blockedUsers], ['Оголошення', stats.totalListings], ['Активні', stats.activeListings], ['На модерації', stats.pendingListings], ['Відгуки', stats.totalReviews], ['Відгуки на перевірці', stats.pendingReviews]].map(([label, value]) => <div className="admin-stat-card" key={label}><span>{label}</span><strong>{value ?? 0}</strong></div>)}</div>}
    <div className="dashboard-tabs admin-tabs"><button type="button" className={tab === 'listings' ? 'dashboard-tab-active' : ''} onClick={() => { setTab('listings'); setPage(0); }}>Оголошення <span>{stats?.pendingListings ?? '—'}</span></button><button type="button" className={tab === 'reviews' ? 'dashboard-tab-active' : ''} onClick={() => { setTab('reviews'); setPage(0); }}>Відгуки <span>{stats?.pendingReviews ?? '—'}</span></button><button type="button" className={tab === 'users' ? 'dashboard-tab-active' : ''} onClick={() => { setTab('users'); setPage(0); }}>Користувачі <span>{stats?.totalUsers ?? '—'}</span></button></div>
    <section className="dashboard-section admin-table-section"><div className="section-title-row"><div><span className="eyebrow">{tab === 'listings' ? 'Перед публікацією' : tab === 'reviews' ? 'Перевірка вражень' : 'Учасники платформи'}</span><h2>{tab === 'listings' ? 'Оголошення на модерації' : tab === 'reviews' ? 'Відгуки на модерації' : 'Усі користувачі'}</h2></div>{tab === 'users' && <div className="admin-filter-row"><input type="search" className="admin-search-input" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Пошук на цій сторінці" aria-label="Пошук за іменем або електронною поштою"/><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}><option value="">Усі статуси</option><option value="ACTIVE">Активні</option><option value="BLOCKED">Заблоковані</option></select><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(0); }}><option value="">Усі ролі</option><option value="TENANT">Орендар</option><option value="LANDLORD">Власник</option><option value="ADMIN">Адміністратор</option></select></div>}</div>
      {loading ? <Loading label="Оновлюємо список…"/> : data?.content?.length && (tab !== 'users' || filteredUsers.length) ? <>{tab === 'listings' && <div className="admin-listing-list">{data.content.map((listing) => <AdminListingRow key={listing.id} listing={listing} onAction={(...args) => { replaceRow(...args); afterAction(); }} onForbidden={forbidAdminActions} denied={adminDenied}/>)}</div>}{tab === 'reviews' && <div className="admin-review-list">{data.content.map((review) => <AdminReviewRow key={review.id} review={review} onAction={(...args) => { replaceRow(...args); afterAction(); }} onForbidden={forbidAdminActions} denied={adminDenied}/>)}</div>}{tab === 'users' && <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Користувач</th><th>Роль</th><th>Статус</th><th>Дія</th></tr></thead><tbody>{filteredUsers.map((person) => <tr key={person.id}><td><strong>{person.fullName || 'Без імені'}</strong><small>{person.email}</small></td><td>{person.role === 'LANDLORD' ? 'Власник' : person.role === 'TENANT' ? 'Орендар' : 'Адміністратор'}</td><td><StatusPill status={person.status === 'BLOCKED' || person.blocked ? 'BLOCKED' : 'ACTIVE'}/></td><td>{!adminDenied && <Button variant={person.status === 'BLOCKED' || person.blocked ? 'outline' : 'danger'} onClick={() => moderateUser(person)}>{person.status === 'BLOCKED' || person.blocked ? 'Розблокувати' : 'Заблокувати'}</Button>}</td></tr>)}</tbody></table></div>}<Pagination page={data.number || page} totalPages={data.totalPages} onChange={setPage}/></> : !error && <EmptyState icon={tab === 'users' ? 'user' : 'check'} title={tab === 'users' ? 'Користувачів не знайдено' : 'Усе перевірено'} text={tab === 'users' ? 'Змініть фільтри або поверніться пізніше.' : 'Немає матеріалів, що очікують на модерацію.'}/>}</section>
  </DashboardFrame>;
}
