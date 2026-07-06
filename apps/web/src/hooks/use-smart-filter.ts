import { useState, useEffect, useCallback } from 'react';

interface UseSmartFilterOptions<T> {
  initialData: T[];
  storageKey?: string; // Chave para persistir filtros no localStorage
}

interface FilterState {
  search: string;
  status: string[];
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: string;
  tags?: string[];
}

/**
 * useSmartFilter: Hook avançado para filtragem de listas com persistência e "Views Salvas".
 * 
 * Funcionalidades:
 * - Filtro de texto (search)
 * - Múltiplos filtros (status, data, tags)
 * - Persistência automática no localStorage
 * - Reset fácil
 */
export function useSmartFilter<T extends { id: string; [key: string]: any }>(
  options: UseSmartFilterOptions<T>
) {
  const { initialData, storageKey = 'app_smart_filter' } = options;

  // Carrega estado inicial do localStorage ou usa defaults
  const getInitialFilters = (): FilterState => {
    if (typeof window === 'undefined') return { search: '', status: [] };
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { search: '', status: [], tags: [] };
  };

  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [filteredData, setFilteredData] = useState<T[]>(initialData);

  // Persiste filtros sempre que mudarem
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    }
  }, [filters, storageKey]);

  // Lógica de Filtragem
  useEffect(() => {
    let result = [...initialData];

    // 1. Filtro de Texto (Search)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(item => {
        // Busca em campos comuns (ajustar conforme necessidade)
        const name = item.name?.toLowerCase() || '';
        const email = item.email?.toLowerCase() || '';
        const company = item.company?.toLowerCase() || '';
        return name.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower);
      });
    }

    // 2. Filtro por Status (Array)
    if (filters.status && filters.status.length > 0) {
      result = result.filter(item => filters.status.includes(item.status));
    }

    // 3. Filtro por Tags
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(item => 
        item.tags?.some((tag: string) => filters.tags?.includes(tag))
      );
    }

    // 4. Filtro por Data (Range)
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      result = result.filter(item => new Date(item.createdAt) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      // Ajusta para o fim do dia
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(item => new Date(item.createdAt) <= toDate);
    }

    setFilteredData(result);
  }, [filters, initialData]);

  // Actions
  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setFilters(prev => {
      const exists = prev.status.includes(status);
      return {
        ...prev,
        status: exists 
          ? prev.status.filter(s => s !== status) 
          : [...prev.status, status]
      };
    });
  }, []);

  const resetFilters = useCallback(() => {
    const empty = { search: '', status: [], tags: [], dateFrom: undefined, dateTo: undefined };
    setFilters(empty);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const saveView = useCallback((viewName: string) => {
    // Implementação futura: salvar objeto { name, filters } em um array no localStorage ou DB
    console.log(`Saving view "${viewName}" with filters:`, filters);
  }, [filters]);

  return {
    filters,
    filteredData,
    setSearch,
    toggleStatus,
    resetFilters,
    saveView,
    count: filteredData.length,
    totalCount: initialData.length,
  };
}
