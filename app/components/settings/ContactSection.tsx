// components/settings/ContactSection.tsx
import SettingsField from './SettingsField';
import type { SettingsSectionProps } from './types';

export default function ContactSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <section className="panel" aria-labelledby="contact-heading">
      <div className="section-heading">
        <div>
          <h2 id="contact-heading">معلومات التواصل</h2>
          <p>القنوات الرسمية للتواصل مع المتجر</p>
        </div>
      </div>
      <div className="settings-grid">
        <SettingsField
          id="contactEmail"
          label="بريد التواصل الرسمي"
          type="email"
          ltr
          inputMode="email"
          value={settings.contactEmail}
          onChange={(value) => onChange('contactEmail', value)}
          placeholder="example@store.com"
          hint="يظهر في الفواتير ومراسلات العملاء"
        />
        <SettingsField
          id="socialLink"
          label="رابط التواصل الاجتماعي"
          type="url"
          ltr
          inputMode="url"
          value={settings.socialLink}
          onChange={(value) => onChange('socialLink', value)}
          placeholder="https://facebook.com/..."
          hint="رابط الصفحة الرسمية على وسائل التواصل"
        />
      </div>
    </section>
  );
}
