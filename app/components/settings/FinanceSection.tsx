// components/settings/FinanceSection.tsx
import SettingsField from './SettingsField';
import type { SettingsSectionProps } from './types';

export default function FinanceSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <section className="panel" aria-labelledby="finance-heading">
      <div className="section-heading">
        <div>
          <h2 id="finance-heading">الإعدادات المالية</h2>
          <p>سعر الصرف وأرصدة فتح الحساب للعملاء</p>
        </div>
      </div>
      <div className="settings-grid">
        <SettingsField
          id="dollarRate"
          label="سعر صرف الدولار"
          type="number"
          ltr
          full
          inputMode="decimal"
          min="0"
          step="any"
          value={settings.dollarRate}
          onChange={(value) => onChange('dollarRate', value)}
          placeholder="مثال: 12500"
          hint="القيمة بالليرة السورية مقابل 1 دولار أمريكي"
        />
        <SettingsField
          id="openingBalanceSyp"
          label="مبلغ فتح الحساب بالسوري"
          type="number"
          ltr
          inputMode="decimal"
          min="0"
          step="any"
          value={settings.openingBalanceSyp}
          onChange={(value) => onChange('openingBalanceSyp', value)}
          placeholder="0"
          hint="يُحتسب تلقائياً عند إنشاء حساب عميل جديد (ل.س)"
        />
        <SettingsField
          id="openingBalanceUsd"
          label="مبلغ فتح الحساب بالدولار"
          type="number"
          ltr
          inputMode="decimal"
          min="0"
          step="any"
          value={settings.openingBalanceUsd}
          onChange={(value) => onChange('openingBalanceUsd', value)}
          placeholder="0"
          hint="يُحتسب تلقائياً عند إنشاء حساب عميل جديد (USD)"
        />
        <SettingsField
          id="lowStockThreshold"
          label="حد تنبيه نقص المخزون"
          type="number"
          ltr
          full
          inputMode="decimal"
          min="0"
          step="1"
          value={settings.lowStockThreshold}
          onChange={(value) => onChange('lowStockThreshold', value)}
          placeholder="5"
          hint="تظهر شارة تنبيه في المنتجات ولوحة التحكم عند وصول مجموع قطع المنتج إلى هذا الحد أو دونه"
        />
      </div>
    </section>
  );
}
