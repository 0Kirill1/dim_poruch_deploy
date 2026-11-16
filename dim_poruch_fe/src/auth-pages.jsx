import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { formatApiError } from './api';
import { useAuth } from './auth';
import { Alert, Button, FieldError, Icon, Logo } from './components';

function dashboardFor(role) {
  if (role === 'LANDLORD') return '/dashboard/landlord';
  if (role === 'ADMIN') return '/dashboard/admin';
  return '/dashboard/tenant';
}

function loginErrorMessage(error) {
  if (/bad credentials|неправильн.*(парол|дан)/i.test(error?.message || '')) {
    return 'Не вдалося увійти. Перевірте електронну пошту та пароль і спробуйте ще раз.';
  }
  return error?.status === 403 ? 'Акаунт вимкнено або заблоковано. Зверніться до підтримки.' : formatApiError(error);
}

function AuthFrame({ eyebrow, title, description, children, footer }) {
  return <div className="auth-page"><div className="auth-intro"><Logo/><span className="auth-kicker"><Icon name="spark" size={16}/> Простір для нового початку</span><h1>Дім — це місце,<br/><em>де добре бути.</em></h1><p>Знаходьте житло, у якому захочеться залишитися.</p><div className="auth-intro-bottom"><div className="auth-orbit orbit-one"/><div className="auth-orbit orbit-two"/><div className="auth-house-card"><div className="mini-window"/><div className="mini-door"/><span>ваш дім поруч</span></div></div></div>
    <section className="auth-panel"><div className="auth-form-wrap"><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p className="auth-description">{description}</p>{children}<div className="auth-footer">{footer}</div></div><span className="auth-panel-note">Безпечно та просто · для орендарів і власників</span></section></div>;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const returnTo = params.get('returnTo') || location.state?.returnTo;

  const submit = async (event) => {
    event.preventDefault();
    setError(''); setFieldErrors({});
    const nextErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'Вкажіть коректну електронну пошту.';
    if (!password) nextErrors.password = 'Введіть пароль.';
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); return; }
    setBusy(true);
    try {
      const profile = await login({ email: email.trim(), password });
      const safeReturnTo = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
      navigate(safeReturnTo || dashboardFor(profile.role), { replace: true });
    } catch (err) {
      if (err.errors) setFieldErrors(err.errors);
      setError(loginErrorMessage(err));
    } finally { setBusy(false); }
  };

  return <AuthFrame eyebrow="Раді вас бачити" title="Вхід до акаунту" description="Увійдіть, щоб керувати бронюваннями та оголошеннями." footer={<>Ще не маєте акаунту? <Link to={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}>Зареєструватися</Link></>}>
    {params.get('registered') && <Alert tone="success">{location.state?.successMessage || 'Акаунт створено. Тепер увійдіть, щоб продовжити.'}</Alert>}
    <Alert>{error}</Alert>
    <form className="form-stack auth-form" onSubmit={submit} noValidate>
      <label className="form-field"><span>Електронна пошта</span><div className="input-with-icon"><Icon name="mail" size={18}/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required/></div><FieldError error={fieldErrors.email}/></label>
      <label className="form-field"><span>Пароль</span><div className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ваш пароль" required/><button type="button" className={`password-toggle ${showPassword ? 'password-toggle-visible' : ''}`} aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><span className="password-toggle-icon"><Icon name="eye-off" size={18}/><Icon name="eye" size={18}/></span></button></div><FieldError error={fieldErrors.password}/></label>
      <Button type="submit" disabled={busy} className="auth-submit">{busy ? 'Входимо…' : 'Увійти'} <Icon name="arrow" size={18}/></Button>
    </form>
    <p className="auth-security"><Icon name="check" size={15}/> Ваші дані захищені</p>
  </AuthFrame>;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [fields, setFields] = useState({ email: '', password: '', confirm: '', role: params.get('role') === 'LANDLORD' ? 'LANDLORD' : 'TENANT' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const update = (key) => (event) => setFields((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault(); setError(''); setFieldErrors({});
    const nextErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(fields.email.trim())) nextErrors.email = 'Вкажіть коректну електронну пошту.';
    if (fields.password.length < 8) nextErrors.password = 'Пароль має містити щонайменше 8 символів.';
    if (fields.confirm !== fields.password) nextErrors.confirm = 'Паролі не збігаються.';
    if (!['TENANT', 'LANDLORD'].includes(fields.role)) nextErrors.role = 'Оберіть тип акаунту.';
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); return; }
    setBusy(true);
    try {
      const result = await register({ email: fields.email.trim(), password: fields.password, role: fields.role });
      navigate(`/login?registered=1${params.get('returnTo') ? `&returnTo=${encodeURIComponent(params.get('returnTo'))}` : ''}`, { replace: true, state: { email: fields.email.trim(), successMessage: result?.message } });
    } catch (err) {
      if (err.errors) setFieldErrors(err.errors);
      setError(err.status === 409 ? 'Ця електронна пошта вже зареєстрована.' : formatApiError(err));
    } finally { setBusy(false); }
  };

  return <AuthFrame eyebrow="Приєднуйтесь до спільноти" title="Створити акаунт" description="Один акаунт — і ви вже на крок ближче до свого дому." footer={<>Вже маєте акаунт? <Link to={`/login${params.get('returnTo') ? `?returnTo=${encodeURIComponent(params.get('returnTo'))}` : ''}`}>Увійти</Link></>}>
    <Alert>{error}</Alert>
    <form className="form-stack auth-form" onSubmit={submit} noValidate>
      <label className="form-field"><span>Я хочу</span><select value={fields.role} onChange={update('role')}><option value="TENANT">Знайти житло для оренди</option><option value="LANDLORD">Здавати власне житло</option></select><FieldError error={fieldErrors.role}/></label>
      <label className="form-field"><span>Електронна пошта</span><div className="input-with-icon"><Icon name="mail" size={18}/><input type="email" autoComplete="email" value={fields.email} onChange={update('email')} placeholder="name@example.com" required/></div><FieldError error={fieldErrors.email}/></label>
      <label className="form-field"><span>Пароль</span><div className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={fields.password} onChange={update('password')} placeholder="Щонайменше 8 символів" required/><button type="button" className={`password-toggle ${showPassword ? 'password-toggle-visible' : ''}`} aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><span className="password-toggle-icon"><Icon name="eye-off" size={18}/><Icon name="eye" size={18}/></span></button></div><FieldError error={fieldErrors.password}/></label>
      <label className="form-field"><span>Повторіть пароль</span><div className="password-input-wrap"><input type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={fields.confirm} onChange={update('confirm')} placeholder="Ще раз ваш пароль" required/><button type="button" className={`password-toggle ${showConfirm ? 'password-toggle-visible' : ''}`} aria-label={showConfirm ? 'Сховати пароль' : 'Показати пароль'} aria-pressed={showConfirm} onClick={() => setShowConfirm((current) => !current)}><span className="password-toggle-icon"><Icon name="eye-off" size={18}/><Icon name="eye" size={18}/></span></button></div><FieldError error={fieldErrors.confirm}/></label>
      <Button type="submit" disabled={busy} className="auth-submit">{busy ? 'Створюємо акаунт…' : 'Зареєструватися'} <Icon name="arrow" size={18}/></Button>
    </form>
    <p className="auth-terms">Реєструючись, ви погоджуєтеся з умовами користування сервісом.</p>
  </AuthFrame>;
}
