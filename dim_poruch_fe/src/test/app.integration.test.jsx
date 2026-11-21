import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Guarded } from '../App';
import { apiRequest } from '../api';
import { AuthProvider } from '../auth';
import { AdminDashboardPage, LandlordDashboardPage, ListingFormPage, ListingManagementPage, NotificationsPage, TenantDashboardPage } from '../dashboard-pages';
import { LoginPage, RegisterPage } from '../auth-pages';
import { AvailabilityCalendar, Header } from '../components';
import { BookingRequestPage, ListingDetailsPage, SearchPage } from '../public-pages';

const apiPath = (url) => url.pathname.replace('/api/v1', '');
const json = (value, status = 200) => new Response(value === null ? null : JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const page = (content, totalElements = content.length) => ({ content, totalElements, totalPages: content.length ? 1 : 0, number: 0, first: true, last: true, empty: !content.length });
const profile = (role = 'TENANT') => ({ id: 'user-1', email: 'person@example.com', fullName: 'Олена Тест', phone: null, role });

function stubApi(handler) {
  const fetchMock = vi.fn(async (input, init = {}) => handler(new URL(typeof input === 'string' ? input : input.url), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function setTokens() {
  localStorage.setItem('dimporuch.accessToken', 'access-test');
  localStorage.setItem('dimporuch.refreshToken', 'refresh-test');
}

function renderRoute(path, routePath, element, extraRoutes = null) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><Routes>
    <Route path={routePath} element={element}/>
    {extraRoutes}
    <Route path="*" element={<div>Маршрут призначення</div>}/>
  </Routes></AuthProvider></MemoryRouter>);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('frontend integration flows', () => {
  it('marks booked calendar days clearly and disables them', () => {
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    render(<AvailabilityCalendar availability={[{ startDate: localDate, endDate: localDate }]} onStartChange={vi.fn()} onEndChange={vi.fn()}/>);
    const bookedDay = screen.getByRole('button', { name: today.toLocaleDateString('uk-UA') });
    expect(bookedDay).toBeDisabled();
    expect(bookedDay).toHaveClass('calendar-booked');
  });

  it('logs in, stores both tokens, refreshes once after 401, and retries with the new access token', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(async (url, init) => {
      const path = apiPath(url);
      if (path === '/auth/login') return json({ jwt_token: 'access-one', refresh_token: 'refresh-one' });
      if (path === '/me') return json(profile());
      if (path === '/protected' && init.headers.get('Authorization') === 'Bearer access-one') return json({ message: 'expired' }, 401);
      if (path === '/auth/refresh') return json({ jwt_token: 'access-two', refresh_token: 'refresh-two' });
      if (path === '/protected' && init.headers.get('Authorization') === 'Bearer access-two') return json({ ok: true });
      return json({ message: `Unexpected request: ${path}` }, 404);
    });

    renderRoute('/login', '/login', <LoginPage/>);
    await user.type(screen.getByPlaceholderText('name@example.com'), 'person@example.com');
    await user.type(screen.getByPlaceholderText('Ваш пароль'), 'password123');
    await user.click(screen.getByRole('button', { name: /Увійти/ }));
    await waitFor(() => expect(localStorage.getItem('dimporuch.accessToken')).toBe('access-one'));
    expect(localStorage.getItem('dimporuch.refreshToken')).toBe('refresh-one');

    await expect(apiRequest('/protected')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.filter(([input]) => apiPath(new URL(input)) === '/auth/refresh')).toHaveLength(1);
    expect(fetchMock.mock.calls.at(-1)[1].headers.get('Authorization')).toBe('Bearer access-two');
  });

  it('shows a Ukrainian login message for invalid credentials returned by the API', async () => {
    const user = userEvent.setup();
    stubApi(async (url) => apiPath(url) === '/auth/login'
      ? json({ message: 'Internal Server Error: Bad credentials' }, 500)
      : json({}, 404));

    renderRoute('/login', '/login', <LoginPage/>);
    await user.type(screen.getByPlaceholderText('name@example.com'), 'person@example.com');
    await user.type(screen.getByPlaceholderText('Ваш пароль'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /Увійти/ }));

    expect(await screen.findByText('Не вдалося увійти. Перевірте електронну пошту та пароль і спробуйте ще раз.')).toBeInTheDocument();
    expect(screen.queryByText('Internal Server Error: Bad credentials')).not.toBeInTheDocument();
  });

  it('shows and hides passwords on login and registration pages', async () => {
    const user = userEvent.setup();
    const { unmount } = renderRoute('/login', '/login', <LoginPage/>);
    const loginPassword = screen.getByPlaceholderText('Ваш пароль');
    expect(loginPassword).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Показати пароль' }));
    expect(loginPassword).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Сховати пароль' }));
    expect(loginPassword).toHaveAttribute('type', 'password');

    unmount();
    renderRoute('/register', '/register', <RegisterPage/>);
    const registerPassword = screen.getByPlaceholderText('Щонайменше 8 символів');
    const confirmPassword = screen.getByPlaceholderText('Ще раз ваш пароль');
    const registerToggles = screen.getAllByRole('button', { name: 'Показати пароль' });
    await user.click(registerToggles[0]);
    await user.click(registerToggles[1]);
    expect(registerPassword).toHaveAttribute('type', 'text');
    expect(confirmPassword).toHaveAttribute('type', 'text');
  });

  it('redirects an authenticated user away from a route for the wrong role', async () => {
    setTokens();
    stubApi(async (url) => apiPath(url) === '/me' ? json(profile('LANDLORD')) : json({}, 404));
    renderRoute('/private', '/private', <Guarded roles={['TENANT']}><div>tenant-only content</div></Guarded>, <Route path="/dashboard/landlord" element={<div>landlord dashboard</div>}/>);
    expect(await screen.findByText('landlord dashboard')).toBeInTheDocument();
    expect(screen.queryByText('tenant-only content')).not.toBeInTheDocument();
  });

  it('shows only unread notifications in the bell dropdown', async () => {
    const user = userEvent.setup();
    setTokens();
    stubApi(async (url) => {
      const path = apiPath(url);
      if (path === '/me') return json(profile('TENANT'));
      if (path === '/me/notifications/unread-count') return json({ unreadCount: 1 });
      if (path === '/me/notifications') return json([
        { id: 'read-1', title: 'Прочитане сповіщення', body: 'Стара подія', readAt: '2026-11-20T10:00:00Z' },
        { id: 'unread-1', title: 'Нове сповіщення', body: 'Нова подія', readAt: null },
      ]);
      return json({}, 404);
    });

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><Header/></AuthProvider></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Сповіщення' }));
    expect(await screen.findByText('Нове сповіщення')).toBeInTheDocument();
    expect(screen.queryByText('Прочитане сповіщення')).not.toBeInTheDocument();
  });

  it('submits listing search filters and renders active results', async () => {
    const user = userEvent.setup();
    const listing = { id: 'listing-1', title: 'Світла квартира біля парку', city: 'Львів', monthlyPrice: 18000, rooms: 2, area: 58, propertyType: 'APARTMENT', status: 'ACTIVE' };
    const fetchMock = stubApi(async (url) => {
      const path = apiPath(url);
      if (path === '/listings') return json(page([listing], 1));
      if (path === '/listings/listing-1/rating') return json({ listingId: 'listing-1', averageRating: 4.8, reviewCount: 3 });
      return json({}, 404);
    });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SearchPage/></MemoryRouter>);
    expect(await screen.findByText(listing.title)).toBeInTheDocument();
    expect(await screen.findByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Київ, Львів, Одеса…'), 'Львів');
    await user.click(screen.getByRole('checkbox', { name: 'Квартира' }));
    await user.click(screen.getByRole('checkbox', { name: 'Будинок' }));
    await user.click(screen.getByRole('checkbox', { name: 'Wi-Fi' }));
    await user.click(screen.getByRole('checkbox', { name: 'Паркінг' }));
    await user.click(screen.getByRole('button', { name: /Знайти житло/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(input);
      return apiPath(url) === '/listings'
        && url.searchParams.get('city') === 'Львів'
        && url.searchParams.get('propertyType') === 'APARTMENT,HOUSE'
        && url.searchParams.get('amenity') === 'wifi,parking';
    })).toBe(true));
    expect(await screen.findByText(/18\s?000/)).toBeInTheDocument();
  });

  it('creates a booking from available dates and sends ISO date strings', async () => {
    const user = userEvent.setup();
    setTokens();
    let submittedBody;
    stubApi(async (url, init) => {
      const path = apiPath(url);
      if (path === '/me') return json(profile());
      if (path === '/listings/listing-1') return json({ id: 'listing-1', title: 'Квартира у центрі', city: 'Львів', monthlyPrice: 15000, rooms: 1, status: 'ACTIVE' });
      if (path === '/listings/listing-1/availability') return json([]);
      if (path === '/bookings' && init.method === 'POST') { submittedBody = JSON.parse(init.body); return json({ id: 'booking-created', createdAt: '2026-11-10T10:00:00Z' }, 201); }
      return json({}, 404);
    });
    renderRoute('/listings/listing-1/book', '/listings/:id/book', <BookingRequestPage/>);
    await screen.findByRole('heading', { name: 'Запросити оренду' });

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
    if (start.getMonth() !== today.getMonth()) await user.click(screen.getByRole('button', { name: 'Наступний місяць' }));
    await user.click(screen.getByRole('button', { name: start.toLocaleDateString('uk-UA') }));
    await user.click(screen.getByRole('button', { name: end.toLocaleDateString('uk-UA') }));
    await user.type(screen.getByPlaceholderText(/Розкажіть, хто буде проживати/), 'Переїжджаю на роботу');
    await user.click(screen.getByRole('button', { name: /Надіслати запит/ }));

    expect(await screen.findByRole('heading', { name: 'Ви вже на крок ближче до нового дому' })).toBeInTheDocument();
    expect(screen.queryByText('booking-created')).not.toBeInTheDocument();
    expect(submittedBody).toMatchObject({ listing: 'listing-1', message: 'Переїжджаю на роботу' });
    expect(submittedBody.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(submittedBody.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uploads, promotes, and deletes listing images through the landlord management page', async () => {
    const user = userEvent.setup();
    setTokens();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const listing = { id: 'listing-1', title: 'Затишна квартира на Подолі', city: 'Київ', address: 'Поділ', monthlyPrice: 17000, rooms: 2, status: 'ACTIVE' };
    let images = [
      { id: 'image-1', listingId: 'listing-1', imageUrl: '/listings/listing-1/images/image-1/content', isPrimary: true },
      { id: 'image-2', listingId: 'listing-1', imageUrl: '/listings/listing-1/images/image-2/content', isPrimary: false },
    ];
    const calls = [];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('LANDLORD'));
      if (path === '/listings/listing-1') return json(listing);
      if (path === '/listings/listing-1/images' && (!init.method || init.method === 'GET')) return json(images);
      if (path === '/listings/listing-1/images' && init.method === 'POST') {
        const uploaded = { id: 'image-3', listingId: 'listing-1', imageUrl: '/listings/listing-1/images/image-3/content', isPrimary: false };
        expect(init.body.get('file')).toBeInstanceOf(File); images = [...images, uploaded]; return json(uploaded, 201);
      }
      if (path === '/listings/listing-1/images/image-2/primary') { images = images.map((image) => ({ ...image, isPrimary: image.id === 'image-2' })); return json(images[1]); }
      if (path === '/listings/listing-1/images/image-1' && init.method === 'DELETE') { images = images.filter((image) => image.id !== 'image-1').map((image, index) => ({ ...image, isPrimary: index === 0 })); return json({ message: 'deleted' }); }
      if (path === '/listings/listing-1/reviews') return json(page([]));
      if (path === '/bookings/landlord') return json(page([]));
      if (path.endsWith('/content')) return new Response(new Blob(['image-bytes'], { type: 'image/jpeg' }), { status: 200 });
      return json({}, 404);
    });

    const { container } = renderRoute('/landlord/listings/listing-1/manage', '/landlord/listings/:id/manage', <ListingManagementPage/>);
    await screen.findByRole('heading', { name: listing.title });
    await user.click(await screen.findByRole('button', { name: 'Зробити головним' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/listings/listing-1/images/image-2/primary' && init.method === 'PATCH')).toBe(true));

    const file = new File(['rental-image'], 'living-room.jpg', { type: 'image/jpeg' });
    await user.upload(container.querySelector('input[type="file"]'), file);
    await user.click(await screen.findByRole('button', { name: 'Завантажити фото' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/listings/listing-1/images' && init.method === 'POST')).toBe(true));

    const firstCard = container.querySelector('.managed-image-card');
    await user.click(within(firstCard).getByTitle('Видалити фото'));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/listings/listing-1/images/image-1' && init.method === 'DELETE')).toBe(true));
    await waitFor(() => expect(within(container.querySelector('.image-management-grid')).getByText('Головне фото')).toBeInTheDocument());
  });

  it('creates a listing, stores the returned id, then uploads selected images to that listing', async () => {
    const user = userEvent.setup();
    setTokens();
    const calls = [];
    let createdImages = [];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('LANDLORD'));
      if (path === '/me/notifications/unread-count') return json({ unreadCount: 0 });
      if (path === '/listings' && init.method === 'POST') return json({ id: 'new-listing-42', message: 'created' }, 201);
      if (path === '/listings/new-listing-42/images' && (!init.method || init.method === 'GET')) return json(createdImages);
      if (path === '/listings/new-listing-42/images' && init.method === 'POST') {
        expect(init.body.get('file')).toBeInstanceOf(File);
        const image = { id: 'new-image-1', listingId: 'new-listing-42', imageUrl: '/listings/new-listing-42/images/new-image-1/content', isPrimary: true };
        createdImages = [image];
        return json(image, 201);
      }
      return json({}, 404);
    });

    const { container } = renderRoute('/landlord/listings/new', '/landlord/listings/new', <ListingFormPage/>);
    await user.type(screen.getByPlaceholderText('Наприклад: Світла квартира біля парку'), 'Затишна квартира біля парку');
    await user.type(screen.getByPlaceholderText('Розкажіть про планування, стан та особливості житла…'), 'Світла квартира з ремонтом та меблями.');
    await user.type(screen.getByPlaceholderText('Київ'), 'Київ');
    await user.type(screen.getByPlaceholderText('Вулиця та номер будинку'), 'вул. Садова, 12');
    await user.type(screen.getByPlaceholderText('2'), '2');
    await user.type(screen.getByPlaceholderText('15000'), '15000');
    await user.upload(container.querySelector('input[type="file"]'), new File(['apartment-photo'], 'apartment.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Створити оголошення/ }));

    await waitFor(() => expect(calls.some(({ path, init }) => path === '/listings/new-listing-42/images' && init.method === 'POST')).toBe(true));
    const createIndex = calls.findIndex(({ path, init }) => path === '/listings' && init.method === 'POST');
    const uploadIndex = calls.findIndex(({ path, init }) => path === '/listings/new-listing-42/images' && init.method === 'POST');
    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(uploadIndex).toBeGreaterThan(createIndex);
    const verifyIndex = calls.findIndex(({ path, init }, index) => index > uploadIndex && path === '/listings/new-listing-42/images' && (!init.method || init.method === 'GET'));
    expect(verifyIndex).toBeGreaterThan(uploadIndex);
    expect(await screen.findByText(/Оголошення створено й надіслано на модерацію/)).toBeInTheDocument();
    expect(screen.queryByText('Фото, отримані від сервера')).not.toBeInTheDocument();
    expect(screen.queryByText(/\/api\/v1\/listings\/new-listing-42\/images\//)).not.toBeInTheDocument();
  });

  it('does not report a listing image as saved when the image list does not contain it', async () => {
    const user = userEvent.setup();
    setTokens();
    const calls = [];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('LANDLORD'));
      if (path === '/me/notifications/unread-count') return json({ unreadCount: 0 });
      if (path === '/listings' && init.method === 'POST') return json({ id: 'listing-with-missing-image' }, 201);
      if (path === '/listings/listing-with-missing-image/images' && init.method === 'POST') {
        return json({ id: 'image-not-persisted', listingId: 'listing-with-missing-image', imageUrl: '/images/image-not-persisted', isPrimary: true }, 201);
      }
      if (path === '/listings/listing-with-missing-image/images') return json([]);
      return json({}, 404);
    });

    const { container } = renderRoute('/landlord/listings/new', '/landlord/listings/new', <ListingFormPage/>);
    await user.type(screen.getByPlaceholderText('Наприклад: Світла квартира біля парку'), 'Затишна квартира біля парку');
    await user.type(screen.getByPlaceholderText('Розкажіть про планування, стан та особливості житла…'), 'Світла квартира з ремонтом та меблями.');
    await user.type(screen.getByPlaceholderText('Київ'), 'Київ');
    await user.type(screen.getByPlaceholderText('Вулиця та номер будинку'), 'вул. Садова, 12');
    await user.type(screen.getByPlaceholderText('2'), '2');
    await user.type(screen.getByPlaceholderText('15000'), '15000');
    await user.upload(container.querySelector('input[type="file"]'), new File(['apartment-photo'], 'apartment.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Створити оголошення/ }));

    expect(await screen.findByText(/Частину фото не вдалося зберегти або перевірити/)).toBeInTheDocument();
    expect(screen.getByText(/Сервер не показав збережене фото/)).toBeInTheDocument();
    expect(calls.some(({ path, init }) => path === '/listings/listing-with-missing-image/images' && (!init.method || init.method === 'GET'))).toBe(true);
    expect(screen.queryByText(/Оголошення створено й надіслано на модерацію/)).not.toBeInTheDocument();
  });

  it('moderates a pending listing and refreshes the admin queue', async () => {
    const user = userEvent.setup();
    setTokens();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const listing = { id: 'pending-1', title: 'Квартира чекає на перевірку', city: 'Одеса', address: 'Центр', rooms: 1, monthlyPrice: 12000, status: 'MODERATION' };
    let moderated = false;
    const calls = [];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('ADMIN'));
      if (path === '/admin/dashboard/stats') return json({ totalUsers: 4, totalLandlords: 2, totalTenants: 2, blockedUsers: 0, totalListings: 1, activeListings: 0, pendingListings: moderated ? 0 : 1, totalReviews: 0, pendingReviews: 0 });
      if (path === '/admin/listings/pending') return json(page(moderated ? [] : [listing], moderated ? 0 : 1));
      if (path === '/admin/listings/pending-1/approve') { moderated = true; return json({ ...listing, status: 'ACTIVE' }); }
      return json({}, 404);
    });

    renderRoute('/dashboard/admin', '/dashboard/admin', <AdminDashboardPage/>);
    expect(await screen.findByText(listing.title)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Схвалити' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/admin/listings/pending-1/approve' && init.method === 'POST')).toBe(true));
    expect(await screen.findByText('Усе перевірено')).toBeInTheDocument();
  });

  it('renders the landlord request table and confirms a pending booking', async () => {
    const user = userEvent.setup();
    setTokens();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const tenantId = '9f40ed38-e134-4c8a-93de-1b55edfa2280';
    let booking = { id: 'booking-landlord-1', listing: 'listing-1', tenant: tenantId, tenantEmail: 'olena@example.com', startDate: '2026-12-01', endDate: '2027-01-01', status: 'PENDING' };
    const listing = { id: 'listing-1', title: 'Світла квартира у центрі', city: 'Львів', address: 'Вул. Городоцька, 8' };
    const calls = [];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('LANDLORD'));
      if (path === '/me/notifications/unread-count') return json({ unreadCount: 0 });
      if (path === '/listings/my') return json(page([]));
      if (path === '/listings/listing-1') return json(listing);
      if (path === `/users/${tenantId}/public-profile`) return json({ id: tenantId, fullName: 'Олена Коваль', role: 'TENANT' });
      if (path === '/bookings/landlord') {
        const status = url.searchParams.get('status');
        if (status === 'PENDING') return json(page(booking.status === 'PENDING' ? [booking] : [], booking.status === 'PENDING' ? 1 : 0));
        if (status === 'APPROVED') return json(page(booking.status === 'APPROVED' ? [booking] : [], booking.status === 'APPROVED' ? 1 : 0));
        if (status === 'COMPLETED') return json(page([]));
        if (status === 'ACTIVE') return json(page(booking.status === 'ACTIVE' ? [booking] : [], booking.status === 'ACTIVE' ? 1 : 0));
        return json(page(url.searchParams.get('size') === '1' ? [] : [booking], url.searchParams.get('size') === '1' ? 1 : 1));
      }
      if (path === '/bookings/booking-landlord-1/confirm') { booking = { ...booking, status: 'APPROVED' }; return json(booking); }
      if (path === '/bookings/booking-landlord-1/complete') { booking = { ...booking, status: 'COMPLETED' }; return json(booking); }
      return json({}, 404);
    });

    const { container } = renderRoute('/dashboard/landlord', '/dashboard/landlord', <LandlordDashboardPage/>);
    expect(await screen.findByRole('heading', { name: 'Заявки на оренду' })).toBeInTheDocument();
    expect(await screen.findByText(listing.title)).toBeInTheDocument();
    expect(await screen.findByText('Олена Коваль')).toBeInTheDocument();
    expect(calls.some(({ path }) => path === `/users/${tenantId}/public-profile`)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Підтвердити' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/bookings/booking-landlord-1/confirm' && init.method === 'POST')).toBe(true));
    await waitFor(() => expect(within(container.querySelector('#booking-booking-landlord-1')).getByText('Підтверджено')).toBeInTheDocument());

    booking = { ...booking, status: 'ACTIVE' };
    await user.selectOptions(screen.getByLabelText('Інші статуси'), 'ACTIVE');
    await user.click(await screen.findByRole('button', { name: 'Завершити' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/bookings/booking-landlord-1/complete' && init.method === 'POST')).toBe(true));
    await waitFor(() => expect(within(container.querySelector('#booking-booking-landlord-1')).getByText('Завершено')).toBeInTheDocument());
  });

  it('deletes only read notifications', async () => {
    const user = userEvent.setup();
    setTokens();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const calls = [];
    let notifications = [
      { id: 'read-1', title: 'Прочитане', body: 'Старе сповіщення', createdAt: '2026-11-20T10:00:00Z', readAt: '2026-11-20T11:00:00Z' },
      { id: 'unread-1', title: 'Непрочитане', body: 'Нове сповіщення', createdAt: '2026-11-21T10:00:00Z', readAt: null },
    ];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('TENANT'));
      if (path === '/me/notifications') return json(notifications);
      if (path === '/me/notifications/delete-read' && init.method === 'DELETE') {
        notifications = notifications.filter((item) => !item.readAt);
        return json({ message: 'Усі прочитані сповіщення видалено' });
      }
      return json({}, 404);
    });

    renderRoute('/notifications', '/notifications', <NotificationsPage/>);

    await user.click(await screen.findByRole('button', { name: 'Видалити прочитані' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/me/notifications/delete-read' && init.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('Непрочитане')).toBeInTheDocument();
    expect(screen.queryByText('Прочитане')).not.toBeInTheDocument();
  });

  it('lets a tenant complete an active booking', async () => {
    const user = userEvent.setup();
    setTokens();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let booking = { id: 'tenant-active-1', listing: 'listing-1', startDate: '2026-11-01', endDate: '2026-12-01', status: 'ACTIVE' };
    const calls = [];
    stubApi(async (url, init) => {
      const path = apiPath(url); calls.push({ path, init });
      if (path === '/me') return json(profile('TENANT'));
      if (path === '/bookings') return json([booking]);
      if (path === '/me/notifications') return json([]);
      if (path === '/listings/listing-1') return json({ id: 'listing-1', title: 'Помешкання для оренди', city: 'Київ' });
      if (path === '/bookings/tenant-active-1/review') return json([], 404);
      if (path === '/bookings/tenant-active-1/complete') { booking = { ...booking, status: 'COMPLETED' }; return json(booking); }
      return json({}, 404);
    });

    renderRoute('/dashboard/tenant', '/dashboard/tenant', <TenantDashboardPage/>);
    await screen.findByText('Помешкання для оренди');
    await user.click(screen.getByRole('button', { name: 'Завершити' }));
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/bookings/tenant-active-1/complete' && init.method === 'POST')).toBe(true));
    await waitFor(() => expect(screen.getByText('Завершено')).toBeInTheDocument());
    await waitFor(() => expect(calls.some(({ path, init }) => path === '/bookings/tenant-active-1/complete' && init.method === 'POST')).toBe(true));
  });

  it('refreshes listing reviews on focus so newly approved reviews appear', async () => {
    let approved = false;
    const reviewerId = '9f40ed38-e134-4c8a-93de-1b55edfa2280';
    const review = { id: 'review-1', tenantUserId: reviewerId, rating: 5, comment: 'Дуже затишне помешкання', status: 'APPROVED', createdAt: '2026-11-10T10:00:00Z' };
    const calls = [];
    stubApi(async (url) => {
      const path = apiPath(url); calls.push(path);
      if (path === '/listings/listing-1') return json({ id: 'listing-1', title: 'Світла квартира', city: 'Львів', rooms: 2, monthlyPrice: 15000, status: 'ACTIVE' });
      if (path === '/listings/listing-1/images') return json([
        { id: 'image-1', listingId: 'listing-1', imageUrl: '/listings/listing-1/images/image-1/content', isPrimary: true },
      ]);
      if (path === '/listings/listing-1/availability') return json([]);
      if (path === '/listings/listing-1/rating') {
        if (!approved) return Promise.reject(new Error('rating unavailable'));
        return json({ listingId: 'listing-1', averageRating: 5, reviewCount: 1 });
      }
      if (path === '/listings/listing-1/reviews') return json(page(approved ? [review] : [], approved ? 1 : 0));
      if (path === `/users/${reviewerId}/public-profile`) return json({ id: reviewerId, fullName: 'Ольга Мельник', role: 'TENANT', memberSince: '2025-01-01' });
      return json({}, 404);
    });

    renderRoute('/listings/listing-1', '/listings/:id', <ListingDetailsPage/>);
    const fullscreenButton = await screen.findByRole('button', { name: 'Відкрити фото на весь екран' });
    await userEvent.setup().click(fullscreenButton);
    expect(await screen.findByRole('dialog', { name: 'Фото помешкання 1' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Закрити повноекранний перегляд' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByText('Залиште відгук після бронювання');
    await waitFor(() => expect(screen.getAllByText('Оцінка недоступна')).toHaveLength(2));
    expect(screen.queryByText('Не вдалося завантажити оцінку помешкання. Спробуйте оновити сторінку.')).not.toBeInTheDocument();
    approved = true;
    fireEvent.focus(window);
    expect(await screen.findByText(review.comment)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('5.0')).toHaveLength(2));
    expect(screen.getAllByText('(1)')).toHaveLength(3);
    expect(screen.getByText('Ольга Мельник')).toBeInTheDocument();
    expect(calls.filter((path) => path === '/listings/listing-1/reviews').length).toBeGreaterThanOrEqual(2);
    expect(calls).toContain(`/users/${reviewerId}/public-profile`);
  });
});
