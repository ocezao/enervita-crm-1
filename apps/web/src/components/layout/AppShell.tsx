import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { applyAppearanceSettings, loadAppearanceSettings } from '../../lib/appearance';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell = () => {
  useEffect(() => {
    applyAppearanceSettings(loadAppearanceSettings());
  }, []);

  return (
    <div className="min-h-screen bg-warm-white">
      <Sidebar />
      <div data-crm-content className="pl-64 flex flex-col min-h-screen">
        <Topbar />
        <main data-crm-app-main className="crm-scroll-panel flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
