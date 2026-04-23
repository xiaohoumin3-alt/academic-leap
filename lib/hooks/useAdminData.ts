import { useState, useEffect } from 'react';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

interface KnowledgePoint {
  id: string;
  name: string;
  subject: string;
  category: string;
  weight: number;
  inAssess: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface Template {
  id: string;
  name: string;
  type: string;
  structure: Record<string, unknown>;
  params: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  version: number;
  status: string;
  knowledgeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface DifficultyLevel {
  level: number;
  accuracy: number;
  avgTime: number;
  retryRate: number;
  sampleCount: number;
}

interface DifficultyAnomaly {
  from: number;
  to: number;
  dropRate: number;
  severity: string;
}

export function useKnowledgePoints(page = 1, limit = 20, filters?: { subject?: string; status?: string; search?: string }) {
  const [data, setData] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (filters?.subject) params.append('subject', filters.subject);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);

      const res = await fetch(`/api/admin/knowledge?${params.toString()}`);
      const json: ApiResponse<KnowledgePoint[]> = await res.json();

      if (json.success && json.data) {
        setData(json.data);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge points:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, limit, filters?.subject, filters?.status, filters?.search]);

  const create = async (data: Partial<KnowledgePoint>) => {
    const res = await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json: ApiResponse<KnowledgePoint> = await res.json();
    if (json.success) {
      fetchData();
      return json.data;
    }
    throw new Error(json.error);
  };

  const update = async (id: string, data: Partial<KnowledgePoint>) => {
    const res = await fetch(`/api/admin/knowledge/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json: ApiResponse<KnowledgePoint> = await res.json();
    if (json.success) {
      fetchData();
      return json.data;
    }
    throw new Error(json.error);
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' });
    const json: ApiResponse<unknown> = await res.json();
    if (json.success) {
      fetchData();
      return true;
    }
    throw new Error(json.error);
  };

  const restore = async (id: string) => {
    const res = await fetch(`/api/admin/knowledge/${id}/restore`, { method: 'POST' });
    const json: ApiResponse<KnowledgePoint> = await res.json();
    if (json.success) {
      fetchData();
      return json.data;
    }
    throw new Error(json.error);
  };

  return { data, loading, total, totalPages, refetch: fetchData, create, update, remove, restore };
}

export function useTemplates(page = 1, limit = 20, filters?: { status?: string; type?: string }) {
  const [data, setData] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);

      const res = await fetch(`/api/admin/templates?${params.toString()}`);
      const json: ApiResponse<Template[]> = await res.json();

      if (json.success && json.data) {
        setData(json.data);
        setTotal(json.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, limit, filters?.status, filters?.type]);

  return { data, loading, total, refetch: fetchData };
}

export function useDifficultyMatrix() {
  const [levels, setLevels] = useState<DifficultyLevel[]>([]);
  const [anomalies, setAnomalies] = useState<DifficultyAnomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics/difficulty-matrix');
      const json: ApiResponse<{ levels: DifficultyLevel[]; anomalies: DifficultyAnomaly[] }> = await res.json();

      if (json.success && json.data) {
        setLevels(json.data.levels);
        setAnomalies(json.data.anomalies);
      }
    } catch (error) {
      console.error('Failed to fetch difficulty matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return { levels, anomalies, loading, refetch: fetchData };
}

export function useWeightValidation(excludeId?: string) {
  const [isValid, setIsValid] = useState(true);
  const [total, setTotal] = useState(0);
  const [points, setPoints] = useState<Array<{ id: string; name: string; weight: number; inAssess: boolean }>>([]);

  const validate = async () => {
    try {
      const res = await fetch('/api/admin/knowledge/weight-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeId })
      });
      const json: ApiResponse<{ isValid: boolean; total: number; points: unknown[] }> = await res.json();

      if (json.success && json.data) {
        setIsValid(json.data.isValid);
        setTotal(json.data.total);
        setPoints(json.data.points as typeof points);
      }
    } catch (error) {
      console.error('Failed to validate weights:', error);
    }
  };

  useEffect(() => { validate(); }, [excludeId]);

  return { isValid, total, points, validate };
}

interface AdminUser {
  id: string;
  userId: string;
  role: string;
  email?: string;
  name?: string;
}

export function useAdminUser() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/admin/me');
        if (res.ok) {
          const json: ApiResponse<AdminUser> = await res.json();
          if (json.success && json.data) {
            setUser(json.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch admin user:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return { user, loading, canEdit: user?.role === 'admin' || user?.role === 'editor', canDelete: user?.role === 'admin' };
}
