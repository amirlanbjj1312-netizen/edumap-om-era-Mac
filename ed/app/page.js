"use client";

import Link from "next/link";
import styles from "./page.module.css";
import { useLocale } from "@/lib/locale";

export default function Home() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
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

        <div className={styles.badge}>{t("home.badge")}</div>
        <h1>{t("home.title")}</h1>
        <p className={styles.lede}>{t("home.lede")}</p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/school-registration">
            {t("home.primary")}
          </Link>
          <a className={styles.secondary} href="#steps">
            {t("home.secondary")}
          </a>
        </div>

        <div className={styles.panel} id="steps">
          <div>
            <span>01</span>
            <h3>{t("home.step1.title")}</h3>
            <p>{t("home.step1.text")}</p>
          </div>
          <div>
            <span>02</span>
            <h3>{t("home.step2.title")}</h3>
            <p>{t("home.step2.text")}</p>
          </div>
          <div>
            <span>03</span>
            <h3>{t("home.step3.title")}</h3>
            <p>{t("home.step3.text")}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
