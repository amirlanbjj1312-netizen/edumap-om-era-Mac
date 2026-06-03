"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { getSupabase } from "@/lib/supabaseClient";
import { useLocale } from "@/lib/locale";

const emptyLogin = { email: "", password: "" };

const Field = ({ label, hint, children }) => (
  <label className={styles.field}>
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

export default function SchoolRegistrationPage() {
  const { locale, setLocale, t } = useLocale();
  const [session, setSession] = useState(null);
  const [login, setLogin] = useState(emptyLogin);
  const [loginStatus, setLoginStatus] = useState("");
  const [ecpFile, setEcpFile] = useState(null);
  const [ecpPassword, setEcpPassword] = useState("");
  const [ecpStatus, setEcpStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [ecpUploaded, setEcpUploaded] = useState(false);

  const adminSiteUrl =
    process.env.NEXT_PUBLIC_ADMIN_SITE_URL || "https://edumap-admin.vercel.app/login";
  const appDeepLink = "edumap://";

  const tSafe = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const user = session?.user;
  const profileKey = useMemo(() => user?.id || "guest", [user?.id]);
  const hasUploadedEcp =
    ecpUploaded ||
    user?.user_metadata?.ecpStatus === "uploaded" ||
    user?.user_metadata?.verificationStatus === "submitted" ||
    user?.user_metadata?.verificationStatus === "approved";

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginStatus("");
    const supabase = getSupabase();
    if (!supabase) {
      setLoginStatus(t("school.supabaseMissing"));
      return;
    }
    const email = login.email.trim().toLowerCase();
    if (!email || !login.password) {
      setLoginStatus(t("school.loginMissing"));
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: login.password,
    });
    if (error) {
      setLoginStatus(error.message);
      return;
    }
    setLoginStatus(t("school.loginSuccess"));
  };

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleEcpUpload = async (event) => {
    event.preventDefault();
    setEcpStatus("");
    const supabase = getSupabase();
    if (!supabase) {
      setEcpStatus(t("school.supabaseMissing"));
      return;
    }
    if (!user) {
      setEcpStatus(t("school.ecpSigninRequired"));
      return;
    }
    if (!ecpFile) {
      setEcpStatus(t("school.ecpMissing"));
      return;
    }
    if (ecpPassword.trim().length < 6) {
      setEcpStatus(t("school.ecpPassShort"));
      return;
    }
    setIsUploading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const { error } = await supabase.auth.updateUser({
        data: {
          ecpStatus: "uploaded",
          verificationStatus: "submitted",
          ecpFileName: ecpFile.name,
          ecpUploadedAt: new Date().toISOString(),
        },
      });
      if (error) {
        throw error;
      }
      setEcpFile(null);
      setEcpPassword("");
      setEcpStatus(t("school.ecpUploaded"));
      setEcpUploaded(true);
    } catch (err) {
      setEcpStatus(err?.message ?? t("school.ecpFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.localeToggle}>
        <button
          type="button"
          className={`${styles.localeButton} ${
            locale === "ru" ? styles.localeActive : ""
          }`}
          onClick={() => setLocale("ru")}
        >
          RU
        </button>
        <button
          type="button"
          className={`${styles.localeButton} ${
            locale === "en" ? styles.localeActive : ""
          }`}
          onClick={() => setLocale("en")}
        >
          EN
        </button>
      </div>
      <div className={styles.grid}>
        <aside className={styles.info}>
          <div className={styles.tag}>{t("school.tag")}</div>
          <h1>{t("school.title")}</h1>
          <p>{t("school.lede")}</p>
          <ul>
            <li>{t("school.bullet1")}</li>
            <li>{t("school.bullet2")}</li>
            <li>{t("school.bullet3")}</li>
          </ul>
          <div className={styles.note}>{t("school.note")}</div>
        </aside>

        <section className={styles.content}>
          <div className={styles.card}>
            <header>
              <h2>{t("school.account")}</h2>
              <p>{t("school.accountHint")}</p>
            </header>
            {user ? (
              <div className={styles.session}>
                <div>
                  <strong>{user.email}</strong>
                  <span>{t("school.signedIn")}</span>
                </div>
                <button className={styles.ghost} onClick={handleLogout}>
                  {t("school.signOut")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className={styles.loginForm}>
                <label>
                  {t("school.email")}
                  <input
                    type="email"
                    value={login.email}
                    onChange={(event) =>
                      setLogin((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    placeholder="school@email.kz"
                  />
                </label>
                <label>
                  {t("school.password")}
                  <input
                    type="password"
                    value={login.password}
                    onChange={(event) =>
                      setLogin((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="••••••••"
                  />
                </label>
                <button className={styles.primary} type="submit">
                  {t("school.signIn")}
                </button>
                {loginStatus ? <p className={styles.status}>{loginStatus}</p> : null}
              </form>
            )}
          </div>

          <div className={styles.card}>
            <header>
              <h2>{t("school.ecpTitle")}</h2>
              <p>{t("school.ecpHint")}</p>
            </header>
            <form onSubmit={handleEcpUpload} className={styles.form}>
              <div className={styles.actions}>
                <Field label={t("school.ecpFile")}>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(event) => setEcpFile(event.target.files?.[0] || null)}
                  />
                </Field>
                <Field label={t("school.ecpPassword")}>
                  <input
                    type="password"
                    value={ecpPassword}
                    onChange={(event) => setEcpPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </Field>
              </div>

              <div className={styles.actions}>
                <button className={styles.primary} type="submit" disabled={isUploading}>
                  {isUploading ? t("school.ecpUploading") : t("school.ecpButton")}
                </button>
                <button className={styles.ghost} type="button">
                  {t("school.needHelp")}
                </button>
              </div>

              {ecpStatus ? <p className={styles.status}>{ecpStatus}</p> : null}
            </form>
            {hasUploadedEcp ? (
              <div className={styles.nextSteps}>
                <h3>
                  {tSafe(
                    "school.nextStepsTitle",
                    locale === "ru" ? "Как продолжить" : "Next steps"
                  )}
                </h3>
                <p>
                  {tSafe(
                    "school.nextStepsHint",
                    locale === "ru"
                      ? "Выберите, где удобно закончить заполнение данных: в приложении или на сайте."
                      : "Choose where you want to complete the school profile: in the app or on the website."
                  )}
                </p>
                <div className={styles.actions}>
                  <a className={styles.primary} href={appDeepLink}>
                    {tSafe(
                      "school.continueApp",
                      locale === "ru" ? "Продолжить в приложении" : "Continue in the app"
                    )}
                  </a>
                  <a
                    className={styles.ghost}
                    href={adminSiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tSafe(
                      "school.continueWeb",
                      locale === "ru" ? "Продолжить на сайте" : "Continue on the website"
                    )}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
