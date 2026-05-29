import type { StageDefinition } from '../../lib/api/permissionsApi';

type Props = {
  stages: StageDefinition[];
  selected: string[];
  onChange: (stages: string[]) => void;
};

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

export function StagePermissionCheckboxes({ stages, selected, onChange }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[...stages].sort((a, b) => a.order - b.order).map((stage) => (
        <label key={stage.key} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-3 text-sm shadow-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-solar-orange"
            checked={selected.includes(stage.key)}
            onChange={() => onChange(toggle(selected, stage.key))}
          />
          <span>
            <span className="block font-medium text-graphite">{stage.label}</span>
            <span className="block text-[11px] text-gray-400">{stage.key}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
