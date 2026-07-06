import type { PermissionDefinition, PermissionsCatalog } from '../../lib/api/permissionsApi';

type Props = {
  catalog: PermissionsCatalog;
  selected: string[];
  onChange: (permissions: string[]) => void;
};

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

function groupPermissions(permissions: PermissionDefinition[]) {
  return permissions.reduce<Record<string, PermissionDefinition[]>>((groups, permission) => {
    const label = permission.kind === 'page' ? 'Páginas' : permission.group;
    groups[label] = [...(groups[label] ?? []), permission];
    return groups;
  }, {});
}

export function PermissionCheckboxMatrix({ catalog, selected, onChange }: Props) {
  const groups = groupPermissions(catalog.permissions);

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([group, permissions]) => (
        <section key={group} className="rounded-xl border border-warm-sand/50 bg-warm-sand/30 p-4">
          <h3 className="mb-3 text-sm font-bold text-graphite">{group}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {permissions.map((permission) => (
              <label key={permission.key} className="flex items-start gap-2 rounded-lg bg-warm-white p-3 text-sm shadow-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-solar-orange"
                  checked={selected.includes(permission.key)}
                  onChange={() => onChange(toggle(selected, permission.key))}
                />
                <span>
                  <span className="block font-medium text-graphite">{permission.label}</span>
                  <span className="block text-[11px] text-graphite-soft">{permission.key}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
