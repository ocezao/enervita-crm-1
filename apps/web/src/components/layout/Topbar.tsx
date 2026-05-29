import { Bell, Plus, Command } from 'lucide-react';
import { Button } from '../ui/Base';
import { SearchInput } from '../ui/LayoutComponents';

export const Topbar = () => {
  return (
    <header className="h-16 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative w-full max-w-md">
          <SearchInput placeholder="Busca global... (⌘K)" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-400">
            <Command size={10} /> K
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="relative rounded-xl">
          <Bell size={20} className="text-gray-500" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-alert-red rounded-full border-2 border-white"></span>
        </Button>
        <div className="h-8 w-[1px] bg-gray-100 mx-2"></div>
        <Button variant="primary" className="gap-2 rounded-xl">
          <Plus size={18} />
          <span>Novo Lead</span>
        </Button>
      </div>
    </header>
  );
};
