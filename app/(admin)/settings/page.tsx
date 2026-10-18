import SettingsForm from '../../components/settings/SettingsForm';

export const metadata = {
  title: 'الإعدادات | نظام إدارة العملاء',
};

export default function SettingsPage() {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">إعدادات النظام</p>
          <h1>إعدادات المتجر</h1>
          <p className="page-description">
            تحكم بالمعلومات الأساسية للمتجر والإعدادات المالية وقنوات التواصل.
          </p>
        </div>
      </div>

      <SettingsForm />
    </main>
  );
}
