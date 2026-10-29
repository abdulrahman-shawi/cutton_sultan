import SettingsForm from '../../components/settings/SettingsForm';
import BackupSection from '../../components/settings/BackupSection';

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
            تحكم بالمعلومات الأساسية للمتجر والإعدادات المالية وقنوات التواصل. إدارة المستخدمين
            والصلاحيات أصبحت في صفحاتها الخاصة من القائمة الجانبية.
          </p>
        </div>
      </div>

      <SettingsForm />
      <div className="settings-stack" style={{ marginTop: 20 }}>
        <BackupSection />
      </div>
    </main>
  );
}
