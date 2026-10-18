// components/settings/StoreInfoSection.tsx
import SettingsField from './SettingsField';
import { currencyOptions, type SettingsSectionProps } from './types';

export default function StoreInfoSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <section className="panel" aria-labelledby="store-info-heading">
      <div className="section-heading">
        <div>
          <h2 id="store-info-heading">بيانات المتجر</h2>
          <p>الاسم التجاري والعملة المعتمدة في النظام</p>
        </div>
      </div>
      <div className="settings-grid">
        <SettingsField
          id="storeName"
          label="اسم المتجر"
          value={settings.storeName}
          onChange={(value) => onChange('storeName', value)}
          placeholder="مثال: قطنيات وبشاكير سلطان"
          required
        />
        <SettingsField
          id="currency"
          label="عملة المتجر"
          value={settings.currency}
          onChange={(value) => onChange('currency', value)}
          options={currencyOptions}
          hint="العملة الأساسية لعرض الأسعار والفواتير"
        />
      </div>
    </section>
  );
}
