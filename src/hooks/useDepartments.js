import { useState, useEffect } from 'react';
import { loadDepartmentsFromAPI, FALLBACK_DEPARTMENTS } from '../lib/departments';

/**
 * Hook to fetch and use departments from API
 * @returns {Object} { departments, loading, error, refresh }
 */
export function useDepartments() {
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadDepartmentsFromAPI();
      setDepartments(data);
    } catch (err) {
      console.error('Error loading departments:', err);
      setError(err);
      setDepartments(FALLBACK_DEPARTMENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  return {
    departments,
    loading,
    error,
    refresh: loadDepartments
  };
}

