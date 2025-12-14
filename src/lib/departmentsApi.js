import apiClient from './apiClient';

// Fetch all departments
export async function fetchDepartments() {
  try {
    const response = await apiClient.get('/departments');
    return (response.data || []).map(dept => ({
      id: dept.id,
      deptId: dept.deptId,
      label: dept.label,
      description: dept.description,
      isActive: dept.isActive
    }));
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
}

// Fetch a single department
export async function fetchDepartment(deptId) {
  try {
    const response = await apiClient.get(`/departments/${deptId}`);
    return {
      id: response.data.id,
      deptId: response.data.deptId,
      label: response.data.label,
      description: response.data.description,
      isActive: response.data.isActive
    };
  } catch (error) {
    console.error('Error fetching department:', error);
    throw error;
  }
}

// Create a new department
export async function createDepartment(departmentData) {
  try {
    const response = await apiClient.post('/departments', {
      deptId: parseInt(departmentData.deptId, 10),
      label: departmentData.label.trim(),
      description: departmentData.description.trim().toUpperCase()
    });
    return {
      success: true,
      data: {
        id: response.data.id,
        deptId: response.data.deptId,
        label: response.data.label,
        description: response.data.description,
        isActive: response.data.isActive
      }
    };
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
}

// Update an existing department
export async function updateDepartment(deptId, departmentData) {
  try {
    const response = await apiClient.put(`/departments/${deptId}`, {
      label: departmentData.label?.trim(),
      description: departmentData.description?.trim().toUpperCase(),
      isActive: departmentData.isActive
    });
    return {
      success: true,
      data: {
        id: response.data.id,
        deptId: response.data.deptId,
        label: response.data.label,
        description: response.data.description,
        isActive: response.data.isActive
      }
    };
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
}

// Delete (deactivate) a department
export async function deleteDepartment(deptId) {
  try {
    await apiClient.delete(`/departments/${deptId}`);
    return { success: true, message: 'Department deactivated successfully' };
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
}

