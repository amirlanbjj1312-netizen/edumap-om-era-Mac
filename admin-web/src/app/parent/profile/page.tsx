'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isGuestMode } from '@/lib/guestMode';
import { localeOptions, useParentLocale } from '@/lib/parentLocale';
import { getAccessToken, loadActiveRatingSurveys, loadSchools, submitRatingSurveyResponse } from '@/lib/api';
import { getFavoriteIds, subscribeFavoriteIds } from '@/lib/parentFavorites';
import { rankSearchCandidates } from '@/lib/textSearch';

type UserState = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

type SchoolRow = {
  school_id?: string;
  basic_info?: {
    display_name?: unknown;
    brand_name?: unknown;
    short_name?: unknown;
    name?: unknown;
  };
};

type ActiveSurveyCampaign = {
  id: string;
  title: string;
  description?: string;
  school_options: Array<{ id: string; name: string; answered: boolean }>;
  questions: Array<{
    id: string;
    text: string;
    description?: string;
    type?: 'rating' | 'single_choice' | 'text';
    required?: boolean;
    options?: Array<{ id?: string; label: string; score?: number }>;
  }>;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const getSchoolTitle = (row: SchoolRow): string =>
  toText(row.basic_info?.display_name).trim() ||
  toText(row.basic_info?.brand_name).trim() ||
  toText(row.basic_info?.short_name).trim() ||
  toText(row.basic_info?.name).trim() ||
  'Школа';

export default function ParentProfilePage() {
  const [guest] = useState(() => isGuestMode());
  const { locale, setLocale, t } = useParentLocale();
  const [profile, setProfile] = useState<UserState>({
    email: '',
    firstName: '',
    lastName: '',
    role: '',
  });
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [surveyCampaigns, setSurveyCampaigns] = useState<ActiveSurveyCampaign[]>([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyMessage, setSurveyMessage] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedSurveySchoolId, setSelectedSurveySchoolId] = useState('');
  const [surveySchoolQuery, setSurveySchoolQuery] = useState('');
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, { score?: number; optionId?: string; optionLabel?: string; text?: string }>>({});
  const [surveyComment, setSurveyComment] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data?.session?.user;
      const email = String(user?.email || '');
      const firstName = String(user?.user_metadata?.firstName || user?.user_metadata?.name || '');
      const lastName = String(user?.user_metadata?.lastName || '');
      setProfile({
        email,
        firstName,
        lastName,
        role: String(user?.user_metadata?.role || user?.app_metadata?.role || 'user'),
      });
      setDraftFirstName(firstName);
      setDraftLastName(lastName);
      setDraftEmail(email);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSchools().then((payload) => {
      if (!mounted) return;
      setSchools(Array.isArray(payload?.data) ? payload.data : []);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeFavoriteIds((ids) => setFavoriteIds(ids));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSurveys = async () => {
      if (guest) return;
      try {
        setSurveyLoading(true);
        const token = await getAccessToken();
        if (!token) return;
        const payload = await loadActiveRatingSurveys(token);
        if (!mounted) return;
        const campaigns = Array.isArray(payload?.data) ? payload.data : [];
        setSurveyCampaigns(campaigns);
        const firstCampaign = campaigns[0];
        if (firstCampaign) {
          setSelectedCampaignId(firstCampaign.id);
          const firstSchool = firstCampaign.school_options?.find((item) => !item.answered)
            || firstCampaign.school_options?.[0];
          setSelectedSurveySchoolId(firstSchool?.id || '');
          setSurveySchoolQuery(firstSchool?.name || '');
        } else {
          setSelectedCampaignId('');
          setSelectedSurveySchoolId('');
          setSurveySchoolQuery('');
        }
      } catch (error) {
        if (!mounted) return;
        setSurveyMessage((error as Error)?.message || 'Не удалось загрузить анкеты');
      } finally {
        if (mounted) setSurveyLoading(false);
      }
    };
    loadSurveys();
    return () => {
      mounted = false;
    };
  }, [guest]);

  const favoriteSchools = favoriteIds
    .map((id) => schools.find((school) => String(school.school_id || '') === id))
    .filter(Boolean) as SchoolRow[];

  const activeCampaign = surveyCampaigns.find((item) => item.id === selectedCampaignId) || null;
  const availableSurveySchools = useMemo(() => {
    if (!activeCampaign) return [];
    return activeCampaign.school_options.filter(
      (school) => !school.answered || school.id === selectedSurveySchoolId
    );
  }, [activeCampaign, selectedSurveySchoolId]);
  const surveySchoolSuggestions = useMemo(
    () => rankSearchCandidates(availableSurveySchools, surveySchoolQuery, (school) => school.name, 4),
    [availableSurveySchools, surveySchoolQuery]
  );

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || t('parent_default');
  const initial = (profile.firstName || profile.lastName || profile.email || 'U').trim().charAt(0).toUpperCase() || 'U';
  const avatarLabel = guest ? t('guest') : initial;
  const ui =
    locale === 'en'
      ? {
          greeting: 'Welcome',
          cabinet: 'Parent account',
          editProfile: 'Edit profile',
          firstName: 'First name',
          lastName: 'Last name',
          email: 'Email',
          save: 'Save',
          cancel: 'Cancel',
          profileSaved: 'Profile updated.',
          profileSaveError: 'Failed to update profile.',
          contactSupport: 'Contact support',
          notifications: 'Notifications',
          faq: 'Frequently asked questions',
        }
      : locale === 'kk'
        ? {
            greeting: 'Қош келдіңіз',
            cabinet: 'Ата-ана кабинеті',
            editProfile: 'Профильді өңдеу',
            firstName: 'Аты',
            lastName: 'Тегі',
            email: 'Email',
            save: 'Сақтау',
            cancel: 'Бас тарту',
            profileSaved: 'Профиль жаңартылды.',
            profileSaveError: 'Профильді жаңарту мүмкін болмады.',
            contactSupport: 'Қолдауға жазу',
            notifications: 'Хабарламалар',
            faq: 'Жиі қойылатын сұрақтар',
          }
        : {
            greeting: 'Здравствуйте',
            cabinet: 'Личный кабинет родителя',
            editProfile: 'Редактировать профиль',
            firstName: 'Имя',
            lastName: 'Фамилия',
            email: 'Email',
            save: 'Сохранить',
            cancel: 'Отмена',
            profileSaved: 'Профиль обновлён.',
            profileSaveError: 'Не удалось обновить профиль.',
            contactSupport: 'Связаться с поддержкой',
            notifications: 'Уведомления',
            faq: 'Часто задаваемые вопросы',
          };
  const surveyUi =
    locale === 'en'
      ? {
          title: 'Satisfaction survey',
          subtitle: 'Help improve school cards: rate schools from 1 to 5.',
          campaign: 'Campaign',
          school: 'School',
          schoolSearchTitle: 'School (required)',
          schoolSearchPlaceholder: 'Start typing school name',
          schoolSearchEmpty: 'No schools found for this query.',
          schoolRequired: 'Choose a school from the list.',
          comment: 'Comment (optional)',
          submit: 'Send survey',
          loading: 'Loading surveys...',
          empty: 'No active surveys right now.',
          requiredQuestions: 'Fill all required questions.',
          authRequired: 'Sign in required.',
          sent: 'Thank you! Survey sent.',
          sendError: 'Failed to submit survey',
        }
      : locale === 'kk'
        ? {
            title: 'Қанағаттану сауалнамасы',
            subtitle: 'Мектеп карталарын жақсартуға көмектесіңіз: 1-ден 5-ке дейін бағалаңыз.',
            campaign: 'Кампания',
            school: 'Мектеп',
            schoolSearchTitle: 'Қай мектепте оқисыз? (міндетті)',
            schoolSearchPlaceholder: 'Мектеп атауын жаза бастаңыз',
            schoolSearchEmpty: 'Сұрау бойынша мектеп табылмады.',
            schoolRequired: 'Тізімнен мектепті таңдаңыз.',
            comment: 'Пікір (міндетті емес)',
            submit: 'Сауалнаманы жіберу',
            loading: 'Сауалнамалар жүктелуде...',
            empty: 'Белсенді сауалнама әзірше жоқ.',
            requiredQuestions: 'Барлық міндетті сұрақтарды толтырыңыз.',
            authRequired: 'Авторизация қажет.',
            sent: 'Рақмет! Сауалнама жіберілді.',
            sendError: 'Сауалнаманы жіберу мүмкін болмады',
          }
        : {
            title: 'Анкета удовлетворенности',
            subtitle: 'Помогите улучшить карточки школ: оцените школу по шкале 1–5.',
            campaign: 'Кампания',
            school: 'Школа',
            schoolSearchTitle: 'В какой школе учитесь? (обязательно)',
            schoolSearchPlaceholder: 'Начните вводить название школы',
            schoolSearchEmpty: 'По вашему запросу школы не найдены.',
            schoolRequired: 'Выберите школу из списка.',
            comment: 'Комментарий (необязательно)',
            submit: 'Отправить анкету',
            loading: 'Загружаем анкеты...',
            empty: 'Сейчас нет активных анкет.',
            requiredQuestions: 'Заполните все обязательные вопросы.',
            authRequired: 'Нужна авторизация.',
            sent: 'Спасибо! Анкета отправлена.',
            sendError: 'Не удалось отправить анкету',
          };

  const onSaveProfile = async () => {
    if (guest || saving) return;
    setSaving(true);
    setSaveStatus('');
    try {
      const firstName = draftFirstName.trim();
      const lastName = draftLastName.trim();
      const nextEmail = draftEmail.trim();
      const payload: { email?: string; data: Record<string, unknown> } = {
        data: {
          firstName,
          lastName,
          name: [firstName, lastName].filter(Boolean).join(' ').trim(),
        },
      };
      if (nextEmail && nextEmail !== profile.email) payload.email = nextEmail;
      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;
      setProfile((prev) => ({ ...prev, firstName, lastName, email: nextEmail || prev.email }));
      setSaveStatus(ui.profileSaved);
      setIsEditing(false);
    } catch {
      setSaveStatus(ui.profileSaveError);
    } finally {
      setSaving(false);
    }
  };

  const onSubmitSurvey = async () => {
    if (guest || surveyLoading || !activeCampaign) return;
    const answers = activeCampaign.questions
      .map((question) => {
        const answer = surveyAnswers[question.id] || {};
        const questionType = question.type || 'rating';
        if (questionType === 'rating') {
          const score = Number(answer.score || 0);
          return { questionId: question.id, questionType, score };
        }
        if (questionType === 'single_choice') {
          return {
            questionId: question.id,
            questionType,
            optionId: String(answer.optionId || ''),
            optionLabel: String(answer.optionLabel || ''),
          };
        }
        return {
          questionId: question.id,
          questionType,
          text: String(answer.text || ''),
        };
      })
      .filter((item) => item.questionId);
    if (!selectedSurveySchoolId) {
      setSurveyMessage(surveyUi.schoolRequired);
      return;
    }
    const missingRequired = activeCampaign.questions.some((question) => {
      if (question.required === false) return false;
      const answer = surveyAnswers[question.id] || {};
      const questionType = question.type || 'rating';
      if (questionType === 'rating') {
        const score = Number(answer.score || 0);
        return !(score >= 1 && score <= 5);
      }
      if (questionType === 'single_choice') {
        return !String(answer.optionId || answer.optionLabel || '').trim();
      }
      return !String(answer.text || '').trim();
    });
    if (missingRequired) {
      setSurveyMessage(surveyUi.requiredQuestions);
      return;
    }
    try {
      setSurveyLoading(true);
      setSurveyMessage('');
      const token = await getAccessToken();
      if (!token) {
        setSurveyMessage(surveyUi.authRequired);
        return;
      }
      await submitRatingSurveyResponse(token, {
        campaignId: activeCampaign.id,
        schoolId: selectedSurveySchoolId,
        answers,
        comment: surveyComment,
      });
      setSurveyAnswers({});
      setSurveyComment('');
      const payload = await loadActiveRatingSurveys(token);
      const campaigns = Array.isArray(payload?.data) ? payload.data : [];
      setSurveyCampaigns(campaigns);
      const nextCampaign = campaigns.find((item) =>
        item.school_options?.some((school) => !school.answered)
      ) || campaigns[0];
      setSelectedCampaignId(nextCampaign?.id || '');
      setSelectedSurveySchoolId(
        nextCampaign?.school_options?.find((school) => !school.answered)?.id ||
          nextCampaign?.school_options?.[0]?.id ||
          ''
      );
      const nextSchoolName =
        nextCampaign?.school_options?.find((school) => !school.answered)?.name ||
        nextCampaign?.school_options?.[0]?.name ||
        '';
      setSurveySchoolQuery(nextSchoolName);
      setSurveyMessage(surveyUi.sent);
    } catch (error) {
      setSurveyMessage((error as Error)?.message || surveyUi.sendError);
    } finally {
      setSurveyLoading(false);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          borderRadius: 16,
          padding: '22px 20px',
          background: 'linear-gradient(135deg, #1f4db7 0%, #4f5fff 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: guest ? '3px solid #f59e0b' : '3px solid #ffc107',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: guest ? 18 : 34,
            fontWeight: 800,
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
            color: '#fff',
            lineHeight: 1,
            textTransform: guest ? 'none' : 'uppercase',
          }}
        >
          {avatarLabel}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {ui.greeting}, {fullName}!
          </p>
          <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{ui.cabinet}</p>
        </div>
      </div>
      {guest ? <p className="muted">{t('guest_note')}</p> : null}

      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {!guest ? (
          <div style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{ui.editProfile}</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setDraftFirstName(profile.firstName);
                  setDraftLastName(profile.lastName);
                  setDraftEmail(profile.email);
                  setIsEditing((prev) => !prev);
                  setSaveStatus('');
                }}
              >
                {ui.editProfile}
              </button>
            </div>
            {isEditing ? (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <label className="field">
                  <span>{ui.firstName}</span>
                  <input className="input" value={draftFirstName} onChange={(e) => setDraftFirstName(e.target.value)} />
                </label>
                <label className="field">
                  <span>{ui.lastName}</span>
                  <input className="input" value={draftLastName} onChange={(e) => setDraftLastName(e.target.value)} />
                </label>
                <label className="field">
                  <span>{ui.email}</span>
                  <input
                    className="input"
                    type="email"
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="button" onClick={onSaveProfile} disabled={saving}>
                    {saving ? '...' : ui.save}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setDraftFirstName(profile.firstName);
                      setDraftLastName(profile.lastName);
                      setDraftEmail(profile.email);
                      setIsEditing(false);
                      setSaveStatus('');
                    }}
                    disabled={saving}
                  >
                    {ui.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{fullName}</p>
                <p className="muted" style={{ margin: '4px 0 0' }}>{profile.email || '—'}</p>
              </div>
            )}
            {saveStatus ? (
              <p
                style={{
                  margin: '8px 0 0',
                  color: saveStatus === ui.profileSaved ? '#15803d' : '#b91c1c',
                }}
              >
                {saveStatus}
              </p>
            ) : null}
          </div>
        ) : null}

        <div style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{t('language')}</p>
          <p className="muted" style={{ margin: '4px 0 8px' }}>{t('language_subtitle')}</p>
          <div className="locale-toggle" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
            {localeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`locale-chip ${locale === item.value ? 'active' : ''}`}
                onClick={() => setLocale(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/parent/support">
            {ui.contactSupport}
          </Link>
          <Link className="button secondary" href="/parent/notifications">
            {ui.notifications}
          </Link>
          <Link className="button secondary" href="/parent/faq">
            {ui.faq}
          </Link>
          {guest ? (
            <Link className="button secondary" href="/login">
              {t('sign_in_account')}
            </Link>
          ) : null}
        </div>

        {!guest ? (
          <div style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{surveyUi.title}</p>
            <p className="muted" style={{ margin: '6px 0 10px' }}>
              {surveyUi.subtitle}
            </p>
            {surveyLoading && !surveyCampaigns.length ? (
              <p className="muted" style={{ margin: 0 }}>
                {surveyUi.loading}
              </p>
            ) : surveyCampaigns.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <label className="field">
                  <span>{surveyUi.campaign}</span>
                  <select
                    className="select"
                    value={selectedCampaignId}
                    onChange={(event) => {
                      const nextCampaignId = event.target.value;
                      setSelectedCampaignId(nextCampaignId);
                      const nextCampaign = surveyCampaigns.find((item) => item.id === nextCampaignId);
                      const nextSchool = nextCampaign?.school_options?.find((item) => !item.answered)
                        || nextCampaign?.school_options?.[0];
                      setSelectedSurveySchoolId(nextSchool?.id || '');
                      setSurveySchoolQuery(nextSchool?.name || '');
                      setSurveyAnswers({});
                      setSurveyComment('');
                      setSurveyMessage('');
                    }}
                  >
                    {surveyCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.title}
                      </option>
                    ))}
                  </select>
                </label>

                {activeCampaign ? (
                  <>
                    <label className="field">
                      <span>{surveyUi.schoolSearchTitle}</span>
                      <input
                        className="input"
                        value={surveySchoolQuery}
                        placeholder={surveyUi.schoolSearchPlaceholder}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSurveySchoolQuery(nextValue);
                          const exact = availableSurveySchools.find((school) => school.name === nextValue);
                          setSelectedSurveySchoolId(exact?.id || '');
                        }}
                      />
                      <div
                        style={{
                          marginTop: 8,
                          border: '1px solid rgba(120,106,255,0.2)',
                          borderRadius: 12,
                          overflow: 'hidden',
                        }}
                      >
                        {surveySchoolSuggestions.length ? (
                          surveySchoolSuggestions.map((school) => {
                            const isSelected = selectedSurveySchoolId === school.id;
                            return (
                              <button
                                key={school.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSurveySchoolId(school.id);
                                  setSurveySchoolQuery(school.name);
                                  setSurveyMessage('');
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  border: 0,
                                  borderBottom: '1px solid rgba(120,106,255,0.14)',
                                  background: isSelected ? 'rgba(79,95,255,0.10)' : '#fff',
                                  padding: '10px 12px',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                }}
                              >
                                {school.name}
                              </button>
                            );
                          })
                        ) : (
                          <p className="muted" style={{ margin: 0, padding: '10px 12px' }}>
                            {surveyUi.schoolSearchEmpty}
                          </p>
                        )}
                      </div>
                    </label>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {activeCampaign.questions.map((question) => (
                        <label key={question.id} className="field">
                          <span>
                            {question.text}
                            {question.description ? ` — ${question.description}` : ''}
                          </span>
                          {(question.type || 'rating') === 'rating' ? (
                            <select
                              className="select"
                              value={String(surveyAnswers[question.id]?.score || 0)}
                              onChange={(event) =>
                                setSurveyAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: {
                                    ...(prev[question.id] || {}),
                                    score: Number(event.target.value || 0),
                                  },
                                }))
                              }
                            >
                              <option value="0">—</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                            </select>
                          ) : null}
                          {question.type === 'single_choice' ? (
                            <select
                              className="select"
                              value={String(surveyAnswers[question.id]?.optionId || '')}
                              onChange={(event) => {
                                const selectedOption = (question.options || []).find(
                                  (option) => String(option.id || '') === event.target.value
                                );
                                setSurveyAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: {
                                    ...(prev[question.id] || {}),
                                    optionId: event.target.value,
                                    optionLabel: String(selectedOption?.label || ''),
                                  },
                                }));
                              }}
                            >
                              <option value="">—</option>
                              {(question.options || []).map((option, index) => (
                                <option key={`${option.id || index}-${index}`} value={String(option.id || '')}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {question.type === 'text' ? (
                            <textarea
                              className="input"
                              rows={3}
                              value={String(surveyAnswers[question.id]?.text || '')}
                              onChange={(event) =>
                                setSurveyAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: {
                                    ...(prev[question.id] || {}),
                                    text: event.target.value,
                                  },
                                }))
                              }
                            />
                          ) : null}
                        </label>
                      ))}
                    </div>

                    <label className="field">
                      <span>{surveyUi.comment}</span>
                      <textarea
                        className="input"
                        rows={3}
                        value={surveyComment}
                        onChange={(event) => setSurveyComment(event.target.value)}
                      />
                    </label>

                    <button
                      type="button"
                      className="button"
                      onClick={onSubmitSurvey}
                      disabled={surveyLoading}
                    >
                      {surveyLoading ? '...' : surveyUi.submit}
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {surveyUi.empty}
              </p>
            )}
            {surveyMessage ? (
              <p
                style={{
                  margin: '10px 0 0',
                  color: surveyMessage.includes('Спасибо') || surveyMessage.includes('Thank')
                    ? '#15803d'
                    : '#b91c1c',
                }}
              >
                {surveyMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {!guest ? (
          <div style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {t('favorite_schools')}
            </p>
            {favoriteSchools.length ? (
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {favoriteSchools.map((school) => (
                  <Link
                    key={String(school.school_id)}
                    href={`/parent/schools/${encodeURIComponent(String(school.school_id || ''))}`}
                    className="profile-favorite-link"
                  >
                    ♥ {getSchoolTitle(school)}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: '6px 0 0' }}>
                {t('no_favorite_schools')}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
