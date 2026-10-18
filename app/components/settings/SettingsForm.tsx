// components/settings/SettingsForm.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { AlertCircle, Check, RotateCcw, Save } from 'lucide-react';
import StoreInfoSection from './StoreInfoSection';
import FinanceSection from './FinanceSection';
import ContactSection from './ContactSection';
import {
  defaultSettings,
  SETTINGS_STORAGE_KEY,
  type StoreSettings,
} from './types';

function loadSettings(): StoreSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export default function SettingsForm() {
  const [settings, setSettings] = useState<StoreSettings>(loadSettings);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleChange = (field: keyof StoreSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setFeedback(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (settings.contactEmail && !/^\S+@\S+\.\S+$/.test(settings.contactEmail)) {
      setFeedback({ kind: 'error', message: 'يرجى إدخال بريد إلكتروني صحيح' });
      return;
    }
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setFeedback({ kind: 'success', message: 'تم حفظ الإعدادات بنجاح' });
    } catch {
      setFeedback({ kind: 'error', message: 'تعذر حفظ الإعدادات في المتصفح' });
    }
  };

  return (
    <form className="settings-stack" onSubmit={handleSubmit}>
      <StoreInfoSection settings={settings} onChange={handleChange} />
      <FinanceSection settings={settings} onChange={handleChange} />
      <ContactSection settings={settings} onChange={handleChange} />

      <div className="form-actions">
        <button type="submit" className="primary-button">
          <Save size={15} aria-hidden="true" />
          حفظ الإعدادات
        </button>
        <button type="button" className="secondary-button" onClick={handleReset}>
          <RotateCcw size={14} aria-hidden="true" />
          استعادة الافتراضي
        </button>
        {feedback && (
          <p className={`form-feedback ${feedback.kind}`} role="status">
            {feedback.kind === 'success' ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <AlertCircle size={14} aria-hidden="true" />
            )}
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}
