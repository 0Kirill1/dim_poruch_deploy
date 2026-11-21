import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest, formatApiError, formatPrice, toPage } from './api';
import { useAuth } from './auth';
import { Alert, AvailabilityCalendar, BookingDates, Button, EmptyState, FieldError, Icon, ListingCard, Loading, PageHeading, Pagination, PropertyImage, Rating, StatusPill } from './components';
import { attachPublicReviewerProfiles, reviewAuthorName } from './reviews';

const propertyNames = { APARTMENT: 'Квартира', HOUSE: 'Будинок', ROOM: 'Кімната' };
const amenityOptions = [['wifi', 'Wi-Fi'], ['parking', 'Паркінг'], ['balcony', 'Балкон'], ['furnished', 'Меблі'], ['pets_allowed', 'Можна з тваринами']];

function normalizeListingRating(data) {
  const summary = data?.data && typeof data.data === 'object' ? data.data : data;
  if (typeof summary === 'number') return { averageRating: summary };
  if (!summary || typeof summary !== 'object') return null;
  const average = summary.averageRating ?? summary.average ?? summary.avgRating ?? summary.rating;
  const count = summary.reviewCount ?? summary.reviewsCount ?? summary.totalReviews ?? summary.count;
  return {
    ...summary,
    averageRating: average === null || average === undefined || average === '' ? null : Number(average),
    reviewCount: count === null || count === undefined || count === '' ? undefined : Number(count),
  };
}

function queryFromFilters(filters, page) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(','));
    } else if (value !== '' && value !== null && value !== undefined) {
      query.set(key, value);
    }
  });
  query.set('page', String(page)); query.set('size', '8'); query.set('sort', filters.sort || 'createdAt,desc');
  return query.toString();
}

function SearchFilters({ filters, onChange, onSubmit, onClear, compact = false, fieldErrors = {} }) {
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  const updatePropertyType = (event) => onChange({ ...filters, propertyType: event.target.value ? [event.target.value] : [] });
  const updateAmenity = (event) => onChange({ ...filters, amenity: event.target.value ? [event.target.value] : [] });
  return <form className={`search-filters ${compact ? 'search-filters-compact' : ''}`} onSubmit={onSubmit}>
    <label className="filter-field filter-city"><span>Місто</span><div className="input-with-icon"><Icon name="pin" size={18}/><input value={filters.city || ''} onChange={update('city')} placeholder="Київ, Львів, Одеса…"/></div><FieldError error={fieldErrors.city}/></label>
    <label className="filter-field"><span>Ціна, ₴ / міс.</span><div className="price-range"><input aria-label="Від якої ціни" type="number" min="0" value={filters.minPrice || ''} onChange={update('minPrice')} placeholder="Від"/><i/> <input aria-label="До якої ціни" type="number" min="0" value={filters.maxPrice || ''} onChange={update('maxPrice')} placeholder="До"/></div><FieldError error={fieldErrors.minPrice || fieldErrors.maxPrice}/></label>
    <label className="filter-field"><span>Кімнат</span><select value={filters.rooms || ''} onChange={update('rooms')}><option value="">Будь-яка</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 5 ? '+' : ''}</option>)}</select><FieldError error={fieldErrors.rooms}/></label>
    <label className="filter-field"><span>Тип житла</span><select value={Array.isArray(filters.propertyType) ? (filters.propertyType[0] || '') : (filters.propertyType || '')} onChange={updatePropertyType}><option value="">Будь-який</option>{Object.entries(propertyNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><FieldError error={fieldErrors.propertyType}/></label>
    <label className="filter-field"><span>Зручність</span><select value={Array.isArray(filters.amenity) ? (filters.amenity[0] || '') : (filters.amenity || '')} onChange={updateAmenity}><option value="">Не важливо</option>{amenityOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><FieldError error={fieldErrors.amenity}/></label>
    <div className="filter-actions"><button type="button" className="text-button" onClick={onClear}>Очистити</button><Button type="submit" icon="search">Знайти житло</Button></div>
  </form>;
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const splitFilter = (key) => searchParams.get(key)?.split(',').filter(Boolean) || [];
  const initialFilters = useMemo(() => ({
    city: searchParams.get('city') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    rooms: searchParams.get('rooms') || '',
    propertyType: splitFilter('propertyType'),
    amenity: splitFilter('amenity'),
    sort: searchParams.get('sort') || 'createdAt,desc',
  }), []);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [result, setResult] = useState(null);
  const [ratings, setRatings] = useState({});
  const [ratingStates, setRatingStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchFieldErrors, setSearchFieldErrors] = useState({});
  const activeQuery = searchParams.toString();

  useEffect(() => {
    const next = {};
    ['city', 'minPrice', 'maxPrice', 'rooms', 'propertyType', 'amenity'].forEach((key) => { next[key] = searchParams.get(key) || ''; });
    next.propertyType = searchParams.get('propertyType')?.split(',').filter(Boolean) || [];
    next.amenity = searchParams.get('amenity')?.split(',').filter(Boolean) || [];
    next.sort = searchParams.get('sort') || 'createdAt,desc';
    setFilters(next); setPage(Number(searchParams.get('page') || 0));
  }, [activeQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRatings({}); setRatingStates({});
    const urlQuery = new URLSearchParams(activeQuery);
    const apiQuery = new URLSearchParams();
    ['city', 'minPrice', 'maxPrice', 'rooms', 'propertyType', 'amenity'].forEach((key) => { if (urlQuery.get(key)) apiQuery.set(key, urlQuery.get(key)); });
    apiQuery.set('page', urlQuery.get('page') || '0'); apiQuery.set('size', '8'); apiQuery.set('sort', urlQuery.get('sort') || 'createdAt,desc');
    apiRequest(`/listings?${apiQuery.toString()}`, { auth: false, signal: controller.signal })
      .then((data) => setResult(toPage(data)))
      .catch((err) => { if (err.name !== 'AbortError') { setError(formatApiError(err)); setSearchFieldErrors(err.errors || {}); } })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeQuery]);

  useEffect(() => {
    const listings = result?.content || [];
    if (!listings.length) return;
    let active = true;
    const loadRatings = async () => {
      setRatingStates((current) => Object.fromEntries(listings.map((listing) => [listing.id, current[listing.id] || 'loading'])));
      const responses = await Promise.allSettled(listings.map((listing) => apiRequest(`/listings/${listing.id}/rating`, { auth: false })));
      if (!active) return;
      setRatings((current) => {
        const next = { ...current };
        responses.forEach((response, index) => {
          if (response.status === 'fulfilled') next[listings[index].id] = normalizeListingRating(response.value);
        });
        return next;
      });
      setRatingStates((current) => {
        const next = { ...current };
        responses.forEach((response, index) => { next[listings[index].id] = response.status === 'fulfilled' ? 'loaded' : 'error'; });
        return next;
      });
    };
    loadRatings();
    window.addEventListener('focus', loadRatings);
    const timer = window.setInterval(loadRatings, 45_000);
    return () => { active = false; window.removeEventListener('focus', loadRatings); window.clearInterval(timer); };
  }, [result]);

  const submit = (event) => {
    event.preventDefault();
    if (filters.minPrice && filters.maxPrice && Number(filters.minPrice) > Number(filters.maxPrice)) { setError('Мінімальна ціна не може бути більшою за максимальну.'); return; }
    setError(''); setSearchFieldErrors({}); setPage(0); setSearchParams(queryFromFilters(filters, 0)); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const changePage = (next) => { setPage(next); setSearchParams(queryFromFilters(filters, next)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const clear = () => { const empty = { city: '', minPrice: '', maxPrice: '', rooms: '', propertyType: [], amenity: [], sort: 'createdAt,desc' }; setError(''); setSearchFieldErrors({}); setFilters(empty); setPage(0); setSearchParams({ page: '0', sort: 'createdAt,desc' }); };
  const listings = result?.content || [];

  const setSort = (sort) => { const next = { ...filters, sort }; setFilters(next); setPage(0); setSearchParams(queryFromFilters(next, 0)); };
  const setProperty = (propertyType) => setFilters((current) => {
    const selected = Array.isArray(current.propertyType) ? current.propertyType : [];
    return { ...current, propertyType: selected.includes(propertyType) ? selected.filter((value) => value !== propertyType) : [...selected, propertyType] };
  });
  const setAmenity = (amenity) => setFilters((current) => {
    const selected = Array.isArray(current.amenity) ? current.amenity : [];
    return { ...current, amenity: selected.includes(amenity) ? selected.filter((value) => value !== amenity) : [...selected, amenity] };
  });
  return <div className="search-page page-container">
    <div className="search-breadcrumb"><Link to="/">Головна</Link><span>/</span><strong>Пошук житла</strong></div>
    <PageHeading eyebrow="ДімПоруч · Пошук житла" title="Житло для довгострокової оренди" description="Знайдіть помешкання, у якому буде добре жити."/>
    <section className="search-toolbar"><SearchFilters filters={filters} onChange={setFilters} onSubmit={submit} onClear={clear} fieldErrors={searchFieldErrors}/></section>
    {error && <Alert>{error}</Alert>}
    <div className="search-layout"><aside className="search-sidebar"><div className="search-sidebar-heading"><h2>Фільтри</h2><button type="button" className="text-button" onClick={clear}>Скинути</button></div>
      <section className="filter-group"><h3>Тип житла</h3>{Object.entries(propertyNames).map(([value, label]) => <label className="filter-check-row" key={value}><input type="checkbox" checked={filters.propertyType.includes(value)} onChange={() => setProperty(value)}/><span className="custom-check"><Icon name="check" size={13}/></span>{label}</label>)}</section>
      <section className="filter-group"><h3>Кількість кімнат</h3><div className="room-filter-options">{[1, 2, 3, 4].map((value) => <button type="button" className={filters.rooms === String(value) ? 'room-filter-active' : ''} key={value} onClick={() => setFilters((current) => ({ ...current, rooms: current.rooms === String(value) ? '' : String(value) }))}>{value}</button>)}<button type="button" className={filters.rooms === '5' ? 'room-filter-active' : ''} onClick={() => setFilters((current) => ({ ...current, rooms: current.rooms === '5' ? '' : '5' }))}>5+</button></div></section>
      <section className="filter-group"><h3>Ціна за місяць, ₴</h3><div className="sidebar-price-range"><label><span>Від</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))} placeholder="0"/></label><span className="price-divider"/><label><span>До</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="Без межі"/></label></div></section>
      <section className="filter-group"><h3>Зручності</h3>{amenityOptions.map(([value, label]) => <label className="filter-check-row" key={value}><input type="checkbox" checked={filters.amenity.includes(value)} onChange={() => setAmenity(value)}/><span className="custom-check"><Icon name="check" size={13}/></span>{label}</label>)}</section>
      <Button className="button-full" onClick={() => submit({ preventDefault() {} })}>Показати оголошення <Icon name="arrow" size={16}/></Button>
    </aside><section className="search-results"><div className="search-results-header"><div><span className="eyebrow">Оберіть своє місце</span><h2>Знайдені помешкання</h2><p>{result ? `${result.totalElements ?? listings.length} оголошень` : 'Підбираємо варіанти для вас'}</p></div><label className="sort-control"><span>Сортувати:</span><select value={filters.sort} onChange={(event) => setSort(event.target.value)}><option value="createdAt,desc">Спочатку нові</option><option value="monthlyPrice,asc">Спочатку дешевші</option><option value="monthlyPrice,desc">Спочатку дорожчі</option></select></label></div>
      {loading ? <div className="search-results-grid"><Loading label="Шукаємо житло…"/></div> : listings.length ? <><div className="search-results-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} rating={ratings[listing.id]} ratingState={ratingStates[listing.id]} returnTo={`/search?${activeQuery}`}/>)}</div><Pagination page={Number(result?.number ?? page)} totalPages={result?.totalPages} onChange={changePage}/></> : !error && <EmptyState icon="search" title="Поки нічого не знайшли" text="Спробуйте змінити фільтри або обрати інше місто." action={<Button variant="outline" onClick={clear}>Очистити фільтри</Button>}/>}
    </section></div>
  </div>;
}

function InteriorPhoto({ className = '', alt, src = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1500&q=85' }) {
  const [failed, setFailed] = useState(false);
  return <div className={`interior-photo ${className}`}>{!failed ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}/> : <div className="interior-photo-fallback"><Icon name="home" size={38}/><span>Простір, де добре бути вдома</span></div>}</div>;
}

export function HomePage() {
  const [openFaq, setOpenFaq] = useState(0);
  return <div className="marketing-home">
    <section className="landing-hero"><div className="page-container landing-hero-inner"><div className="landing-hero-copy"><span className="landing-kicker"><i/>Платформа для оренди житла</span><h1>Знайдіть місце,<br/>де хочеться бути<br/><span>вдома.</span></h1><p>ДімПоруч допомагає знайти своє помешкання або надійних орендарів — легко, прозоро й без зайвих клопотів.</p><div className="landing-hero-actions"><Link to="/search" className="button button-primary">Знайти житло <Icon name="arrow" size={17}/></Link><Link to="/register?role=LANDLORD" className="button button-outline">Я здаю житло</Link></div><div className="landing-trust"><span className="trust-mark"><Icon name="check" size={14}/></span><span>Перевірені оголошення</span><i/>Безпечна оренда поруч</div></div><div className="landing-hero-visual"><InteriorPhoto alt="Світла вітальня з великими вікнами та меблями"/><div className="hero-photo-caption"><span className="photo-caption-icon"><Icon name="home" size={18}/></span><span><strong>Місце, яке стане вашим</strong><small>Пошук починається поруч</small></span></div><span className="hero-photo-number">01 / 04</span></div></div></section>
    <section className="landing-benefits page-container" id="about"><div className="landing-section-heading"><span className="eyebrow">Ваша оренда — простіша</span><h2>Менше зайвого. Більше свого.</h2><p>Зосередьтеся на важливому — ми подбали про зручний шлях до вашого дому.</p></div><div className="benefit-grid"><article className="benefit-card"><span className="benefit-icon"><Icon name="search" size={21}/></span><h3>Шукайте зручно</h3><p>Фільтри допоможуть швидко знайти помешкання у потрібному місті та бюджеті.</p></article><article className="benefit-card"><span className="benefit-icon"><Icon name="check" size={21}/></span><h3>Обирайте впевнено</h3><p>Переглядайте деталі, зручності та відгуки перед тим, як надіслати запит.</p></article><article className="benefit-card"><span className="benefit-icon"><Icon name="heart" size={21}/></span><h3>Залишайтеся поруч</h3><p>Спілкуйтеся з власником і керуйте бронюванням в одному місці.</p></article></div></section>
    <section className="landing-steps" id="how-it-works"><div className="page-container"><div className="landing-section-heading"><span className="eyebrow">Просто від початку</span><h2>Від першого пошуку до нових ключів</h2><p>Усе необхідне для вашої оренди — у кількох зрозумілих кроках.</p></div><div className="steps-grid"><article><span className="step-number">01</span><h3>Знайдіть своє</h3><p>Оберіть місто, ціну та зручності, які важливі саме вам.</p><Link to="/search" className="text-link">Перейти до пошуку <Icon name="arrow" size={15}/></Link></article><article><span className="step-number">02</span><h3>Надішліть запит</h3><p>Оберіть бажані дати та розкажіть власнику трохи про себе.</p><span className="step-hint"><Icon name="calendar" size={15}/> Дати завжди під рукою</span></article><article><span className="step-number">03</span><h3>Почніть новий розділ</h3><p>Стежте за відповіддю, бронюванням і сповіщеннями у кабінеті.</p><span className="step-hint"><Icon name="spark" size={15}/> Ближче до вашого дому</span></article></div></div></section>
    <section className="owner-invite page-container"><div className="owner-invite-photo"><InteriorPhoto src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" alt="Затишний інтер’єр оселі"/></div><div className="owner-invite-copy"><span className="eyebrow">Для власників житла</span><h2>Вашій оселі потрібні свої люди.</h2><p>Створіть оголошення, додайте фото й керуйте запитами на оренду у своєму кабінеті.</p><Link to="/register?role=LANDLORD" className="button button-primary">Опублікувати житло <Icon name="arrow" size={17}/></Link><small><Icon name="check" size={14}/> Публікація оголошення безкоштовна</small></div></section>
    <section className="landing-faq page-container"><div className="faq-intro"><span className="eyebrow">Є запитання?</span><h2>Оренда без зайвих хвилювань</h2><p>Коротко відповіли на те, що важливо знати перед початком.</p><Link to="/search" className="text-link">Знайти своє житло <Icon name="arrow" size={15}/></Link></div><div className="faq-list">{[['Чи можна переглянути доступність житла?', 'Так. На сторінці кожного помешкання є календар доступності та форма запиту на оренду.'], ['Як зв’язатися з власником?', 'Надішліть запит із бажаними датами. Відповідь власника з’явиться у ваших сповіщеннях.'], ['Як опублікувати власне житло?', 'Створіть акаунт власника, додайте інформацію та фотографії. Після модерації оголошення стане доступним для пошуку.']].map(([question, answer], index) => <details className="faq-item" key={question} open={openFaq === index} onToggle={(event) => setOpenFaq(event.currentTarget.open ? index : null)}><summary><span>{question}</span><Icon name="plus" size={17}/></summary><p>{answer}</p></details>)}</div></section>
    <section className="landing-bottom-cta"><div className="page-container bottom-cta-inner"><div><span className="eyebrow">Ваш дім поруч</span><h2>Зробіть наступний крок до свого місця.</h2></div><Link to="/search" className="button button-primary">Знайти житло <Icon name="arrow" size={17}/></Link></div></section>
  </div>;
}

export function ListingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [images, setImages] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [rating, setRating] = useState(null);
  const [ratingState, setRatingState] = useState('loading');
  const [reviewsPage, setReviewsPage] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewPageIndex, setReviewPageIndex] = useState(0);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [extraErrors, setExtraErrors] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : null;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setExtraErrors([]);
    apiRequest(`/listings/${id}`, { auth: false }).then(async (data) => {
      if (!active) return;
      setListing(data);
      const tasks = [
        ['images', apiRequest(`/listings/${id}/images`, { auth: false })],
        ['availability', apiRequest(`/listings/${id}/availability`, { auth: false })],
        ...(data.ownerId ? [['owner', apiRequest(`/users/${data.ownerId}/public-profile`, { auth: false })]] : []),
      ];
      const secondary = await Promise.allSettled(tasks.map(([, promise]) => promise));
      if (!active) return;
      const nextErrors = [];
      secondary.forEach((response, index) => {
        const key = tasks[index][0];
        if (response.status === 'rejected') { nextErrors.push(key); return; }
        if (key === 'images') setImages(Array.isArray(response.value) ? response.value : []);
        if (key === 'availability') setAvailability(Array.isArray(response.value) ? response.value : []);
        if (key === 'owner') setOwner(response.value);
      });
      setExtraErrors(nextErrors);
    }).catch((err) => { if (active) setError(formatApiError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadReviews = async () => {
      setReviewsLoading(true);
      setRatingState((current) => current === 'loaded' ? 'loaded' : 'loading');
      const [ratingResult, reviewsResult] = await Promise.allSettled([
        apiRequest(`/listings/${id}/rating`, { auth: false }),
        apiRequest(`/listings/${id}/reviews?page=${reviewPageIndex}&size=5`, { auth: false }),
      ]);
      if (!active) return;
      if (ratingResult.status === 'fulfilled') { setRating(normalizeListingRating(ratingResult.value)); setRatingState('loaded'); }
      else setRatingState('error');
      if (reviewsResult.status === 'fulfilled') {
        const reviewPage = toPage(reviewsResult.value);
        const reviewsWithNames = await attachPublicReviewerProfiles(reviewPage.content || []);
        if (!active) return;
        setReviewsPage({ ...reviewPage, content: reviewsWithNames });
        setReviewsError('');
      } else setReviewsError(formatApiError(reviewsResult.reason));
      setReviewsLoading(false);
    };
    loadReviews();
    window.addEventListener('focus', loadReviews);
    const timer = window.setInterval(loadReviews, 45_000);
    return () => { active = false; window.removeEventListener('focus', loadReviews); window.clearInterval(timer); };
  }, [id, reviewPageIndex]);

  const gallery = useMemo(() => {
    if (images.length) return [...images].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))).map((image) => image.imageUrl);
    return listing?.imageUrls?.length ? listing.imageUrls : listing?.primaryImageUrl ? [listing.primaryImageUrl] : [];
  }, [images, listing]);

  useEffect(() => {
    if (!fullscreenOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFullscreenOpen(false);
      if (event.key === 'ArrowLeft') setActiveImage((current) => gallery.length ? (current - 1 + gallery.length) % gallery.length : 0);
      if (event.key === 'ArrowRight') setActiveImage((current) => gallery.length ? (current + 1) % gallery.length : 0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenOpen, gallery.length]);

  if (loading) return <div className="page-container page-section"><Loading label="Завантажуємо помешкання…"/></div>;
  if (error || !listing) return <div className="page-container page-section"><Alert>{error || 'Помешкання не знайдено.'}</Alert><Link className="text-link" to="/search">Повернутися до пошуку</Link></div>;
  const canBook = listing.status === 'ACTIVE' && user?.role !== 'LANDLORD';
  const startBooking = () => {
    const route = `/listings/${id}/book`;
    if (!user) navigate(`/login?returnTo=${encodeURIComponent(route)}`);
    else if (user.role === 'LANDLORD') navigate('/dashboard/landlord');
    else navigate(route);
  };
  const showPreviousImage = () => setActiveImage((current) => (current - 1 + gallery.length) % gallery.length);
  const showNextImage = () => setActiveImage((current) => (current + 1) % gallery.length);

  return <div className="page-container detail-page">
    <button type="button" className="back-link" onClick={() => returnTo ? navigate(returnTo) : navigate('/search')}><Icon name="back" size={17}/> До результатів пошуку</button>
    {extraErrors.length > 0 && <Alert tone="info">Деякі додаткові дані тимчасово недоступні. Основна інформація про помешкання завантажена.</Alert>}
    <div className="detail-title-row"><div><div className="listing-location"><Icon name="pin" size={15}/>{listing.city}{listing.address ? ` · ${listing.address}` : ''}</div><h1>{listing.title}</h1><div className="detail-title-meta"><Rating value={rating?.averageRating} count={rating?.reviewCount} state={ratingState}/><span>·</span><span>{listing.rooms} кімнати</span><span>·</span><span>{listing.area ? `${listing.area} м²` : 'Площа не вказана'}</span>{listing.status !== 'ACTIVE' && <StatusPill status={listing.status}/>}</div></div></div>
    <div className="detail-gallery"><div className="gallery-main"><PropertyImage src={gallery[activeImage]} alt={`${listing.title}, фото ${activeImage + 1}`} className="gallery-main-image"/>{gallery.length > 0 && <button type="button" className="gallery-fullscreen" onClick={() => setFullscreenOpen(true)} aria-label="Відкрити фото на весь екран"><Icon name="expand" size={20}/></button>}{gallery.length > 1 && <><button type="button" className="gallery-control gallery-control-previous" onClick={showPreviousImage} aria-label="Попереднє фото"><Icon name="back" size={20}/></button><button type="button" className="gallery-control gallery-control-next" onClick={showNextImage} aria-label="Наступне фото"><Icon name="back" size={20}/></button><span className="gallery-count">{activeImage + 1} / {gallery.length}</span></>}</div>{gallery.length > 1 && <div className="gallery-thumbnails" role="list">{gallery.map((src, index) => <button type="button" className={`gallery-thumbnail ${index === activeImage ? 'gallery-thumbnail-active' : ''}`} key={`${src}-${index}`} onClick={() => setActiveImage(index)} aria-label={`Показати фото ${index + 1}`} aria-current={index === activeImage ? 'true' : undefined}><PropertyImage src={src} alt="" compact/></button>)}</div>}</div>
    <div className="detail-layout"><div className="detail-main-column">
      <section className="detail-section detail-intro"><div><span className="eyebrow">Про помешкання</span><h2>Простір для вашого життя</h2></div><p className="description-copy">{listing.description || 'Детальний опис цього помешкання незабаром з’явиться.'}</p></section>
      <section className="detail-section"><div className="section-title-row"><div><span className="eyebrow">Усе необхідне</span><h2>Зручності</h2></div><span className="feature-icon"><Icon name="spark" size={18}/></span></div><div className="amenity-list">{(listing.amenities || []).length ? listing.amenities.map((item) => <span className="amenity-chip" key={item}><Icon name="check" size={15}/>{amenityOptions.find(([key]) => key === item)?.[1] || item}</span>) : <p className="muted-copy">Власник ще не додав список зручностей.</p>}</div><div className="property-facts"><div><span className="fact-icon"><Icon name="home"/></span><span><small>Тип помешкання</small><strong>{propertyNames[listing.propertyType] || listing.propertyType}</strong></span></div><div><span className="fact-icon"><Icon name="spark"/></span><span><small>Площа</small><strong>{listing.area ? `${listing.area} м²` : '—'}</strong></span></div><div><span className="fact-icon"><Icon name="user"/></span><span><small>Кімнати</small><strong>{listing.rooms || '—'}</strong></span></div></div></section>
      <section className="detail-section reviews-section"><div className="section-title-row"><div><span className="eyebrow">Досвід орендарів</span><h2>Відгуки <span className="review-count">({rating?.reviewCount ?? (ratingState === 'error' ? '—' : 0)})</span></h2></div><Rating value={rating?.averageRating} count={rating?.reviewCount} state={ratingState}/></div>{ratingState === 'error' && !rating && (reviewsPage?.content || []).length > 0 && <Alert>Не вдалося завантажити оцінку помешкання. Спробуйте оновити сторінку.</Alert>}{reviewsError && <Alert>{reviewsError}</Alert>}{reviewsLoading && !reviewsPage ? <Loading small label="Завантажуємо відгуки…"/> : (reviewsPage?.content || []).length ? <><div className="reviews-list">{reviewsPage.content.map((review) => <article className="review-card" key={review.id}><div className="review-person"><span className="avatar avatar-large">{reviewAuthorName(review).slice(0, 1).toUpperCase()}</span><div><strong>{reviewAuthorName(review)}</strong><small>{review.createdAt ? new Date(review.createdAt).toLocaleDateString('uk-UA') : 'Орендар'}</small></div><span className="review-rating"><Icon name="star" size={14}/>{review.rating}</span></div>{review.comment && <p>{review.comment}</p>}{review.reply && <div className="review-reply"><strong>Відповідь власника</strong><p>{review.reply}</p></div>}</article>)}</div><Pagination page={reviewsPage.number ?? reviewPageIndex} totalPages={reviewsPage.totalPages} onChange={setReviewPageIndex}/></> : reviewsError ? null : <p className="muted-copy">Залиште відгук після бронювання</p>}</section>
    </div><aside className="detail-side-column"><div className="booking-card"><div className="booking-card-heading"><span className="eyebrow">Оренда житла</span><h3>{formatPrice(listing.monthlyPrice)} <small>/ місяць</small></h3></div><div className="booking-calendar-note"><Icon name="calendar" size={17}/><span>Перевірте доступність та надішліть запит власнику.</span></div><div className="availability-summary">{availability.length ? <><span className="availability-dot"/>Доступність оновлено</> : <><span className="availability-dot availability-dot-neutral"/>Дати можна уточнити у власника</>}</div><Button className="button-full" disabled={!canBook} onClick={startBooking}>{listing.status !== 'ACTIVE' ? 'Оголошення недоступне' : user?.role === 'LANDLORD' ? 'Ви власник житла' : 'Запитати про оренду'} <Icon name="arrow" size={17}/></Button><small className="booking-card-footnote">Без комісії за запит · Відповідь напряму від власника</small></div>
      <div className="availability-panel"><div className="availability-panel-heading"><span className="eyebrow">Доступність</span><strong>Календар помешкання</strong></div><AvailabilityCalendar availability={availability} readOnly/><small className="muted-copy">Позначені дні вже зайняті або недоступні.</small></div>
      {owner && <Link className="owner-card" to={`/users/${owner.id}`}><span className="avatar avatar-large">{(owner.fullName || 'В').slice(0, 1).toUpperCase()}</span><span className="owner-details"><small>Власник помешкання</small><strong>{owner.fullName || 'Власник'}</strong><span>На ДімПоруч з {owner.memberSince ? new Date(owner.memberSince).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }) : '—'}</span></span><Icon name="arrow" size={17}/></Link>}
    </aside></div>
    {fullscreenOpen && gallery.length > 0 && <div className="gallery-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFullscreenOpen(false); }}><div className="gallery-modal-content" role="dialog" aria-modal="true" aria-label={`Фото помешкання ${activeImage + 1}`}><button type="button" className="gallery-modal-close" onClick={() => setFullscreenOpen(false)} aria-label="Закрити повноекранний перегляд"><Icon name="close" size={22}/></button><PropertyImage src={gallery[activeImage]} alt={`${listing.title}, фото ${activeImage + 1}`} className="gallery-modal-image"/>{gallery.length > 1 && <><button type="button" className="gallery-modal-control gallery-modal-control-previous" onClick={showPreviousImage} aria-label="Попереднє фото"><Icon name="back" size={24}/></button><button type="button" className="gallery-modal-control gallery-modal-control-next" onClick={showNextImage} aria-label="Наступне фото"><Icon name="back" size={24}/></button><span className="gallery-modal-count">{activeImage + 1} / {gallery.length}</span></>}</div></div>}
  </div>;
}

export function BookingRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [datesError, setDatesError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    Promise.all([apiRequest(`/listings/${id}`, { auth: false }), apiRequest(`/listings/${id}/availability`, { auth: false })])
      .then(([property, ranges]) => { setListing(property); setAvailability(Array.isArray(ranges) ? ranges : []); })
      .catch((err) => setError(formatApiError(err))).finally(() => setLoading(false));
  }, [id]);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setFieldErrors({}); setDatesError(false);
    const dateErrors = {};
    if (!startDate) dateErrors.startDate = 'Оберіть дату заїзду.';
    if (!endDate) dateErrors.endDate = 'Оберіть дату виїзду.';
    if (endDate && startDate && endDate <= startDate) dateErrors.endDate = 'Дата виїзду має бути пізніше за дату заїзду.';
    if (Object.keys(dateErrors).length) { setFieldErrors(dateErrors); setDatesError(true); setError('Перевірте вибраний період оренди.'); return; }
    const overlaps = availability.some((range) => {
      const from = range.startDate || range.from; const to = range.endDate || range.to;
      return from && to && startDate <= to && endDate >= from;
    });
    if (overlaps) { setDatesError(true); setError('Ці дати вже зайняті. Оберіть інший період.'); return; }
    setBusy(true);
    try { const response = await apiRequest('/bookings', { method: 'POST', body: { listing: id, startDate, endDate, message: message.trim() || undefined } }); setBookingId(response.id); }
    catch (err) { if (err.errors) setFieldErrors(err.errors); setError(formatApiError(err)); try { const ranges = await apiRequest(`/listings/${id}/availability`, { auth: false }); setAvailability(Array.isArray(ranges) ? ranges : []); } catch { /* Keep last known availability. */ } }
    finally { setBusy(false); }
  };

  if (loading) return <div className="page-container page-section"><Loading label="Перевіряємо доступність…"/></div>;
  if (error && !listing) return <div className="page-container page-section"><Alert>{error}</Alert></div>;
  if (bookingId) return <div className="page-container page-section booking-success"><span className="success-mark"><Icon name="check" size={28}/></span><span className="eyebrow">Запит надіслано</span><h1>Ви вже на крок ближче до нового дому</h1><p>Власник отримає ваш запит і відповість у сповіщеннях. Стежте за оновленнями у кабінеті.</p><div className="button-row"><Button onClick={() => navigate(user?.role === 'LANDLORD' ? '/dashboard/landlord' : '/dashboard/tenant')}>До бронювань</Button><Button variant="outline" onClick={() => navigate(`/listings/${id}`)}>Назад до житла</Button></div></div>;

  return <div className="page-container booking-request-page"><button type="button" className="back-link" onClick={() => navigate(`/listings/${id}`)}><Icon name="back" size={17}/> До помешкання</button><div className="booking-request-layout"><section className="booking-form-panel"><div className="eyebrow">Надішліть запит</div><h1>Запросити оренду</h1><p className="muted-copy">Вкажіть бажані дати та коротко розкажіть про себе.</p><Alert>{error}</Alert><form className="form-stack" onSubmit={submit}>
      <BookingDates startDate={startDate} endDate={endDate} onStartChange={(value) => { setStartDate(value); setFieldErrors((current) => ({ ...current, startDate: undefined })); }} onEndChange={(value) => { setEndDate(value); setFieldErrors((current) => ({ ...current, endDate: undefined })); }} availability={availability}/>
      {(fieldErrors.startDate || fieldErrors.endDate) && <div className="date-grid"><FieldError error={fieldErrors.startDate}/><FieldError error={fieldErrors.endDate}/></div>}
      {datesError && <small className="field-error">Перевірте вибраний період.</small>}
      <label className="form-field"><span>Повідомлення власнику <small>(необов’язково)</small></span><textarea rows="5" maxLength="1000" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Розкажіть, хто буде проживати та коли вам зручно переглянути помешкання…"/><FieldError error={fieldErrors.message}/></label>
      <Button type="submit" disabled={busy || listing?.status !== 'ACTIVE'}>{busy ? 'Надсилаємо запит…' : 'Надіслати запит'} <Icon name="arrow" size={18}/></Button>
    </form></section><aside className="booking-listing-summary"><PropertyImage src={listing?.primaryImageUrl || listing?.imageUrls?.[0]} alt={listing?.title}/><div><span className="listing-location"><Icon name="pin" size={15}/>{listing?.city}</span><h2>{listing?.title}</h2><div className="listing-card-meta"><span>{listing?.rooms} кімн.</span><span>{listing?.area ? `${listing.area} м²` : ''}</span></div><strong className="summary-price">{formatPrice(listing?.monthlyPrice)} <small>/ міс.</small></strong></div></aside></div></div>;
}

export function PublicProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiRequest(`/users/${id}/public-profile`, { auth: false }).then(setProfile).catch((err) => setError(formatApiError(err))).finally(() => setLoading(false)); }, [id]);
  if (loading) return <div className="page-container page-section"><Loading label="Завантажуємо профіль…"/></div>;
  if (!profile) return <div className="page-container page-section"><Alert>{error || 'Профіль не знайдено.'}</Alert></div>;
  return <div className="page-container public-profile-page"><Link to="/search" className="back-link"><Icon name="back" size={17}/> До пошуку</Link><section className="public-profile-card"><span className="avatar avatar-profile">{(profile.fullName || 'В').slice(0, 1).toUpperCase()}</span><div className="eyebrow">Профіль на ДімПоруч</div><h1>{profile.fullName || 'Користувач'}</h1><p>{profile.role === 'LANDLORD' ? 'Власник житла' : profile.role === 'TENANT' ? 'Орендар' : profile.role}</p>{profile.role === 'LANDLORD' && profile.phone && <a className="profile-phone"><Icon name="phone" size={17}/><span><small>Телефон</small>{profile.phone}</span></a>}<div className="profile-member"><Icon name="calendar" size={17}/> З нами з {profile.memberSince ? new Date(profile.memberSince).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }) : '—'}</div></section></div>;
}
