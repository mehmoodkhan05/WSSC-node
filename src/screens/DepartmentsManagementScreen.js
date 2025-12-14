import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog, DialogContent } from '../components/ui/Dialog';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from '../lib/departmentsApi';
import { useAuth } from '../contexts/AuthContext';
import { hasFullControl } from '../lib/roles';
import { clearDepartmentsCache } from '../lib/departments';

export default function DepartmentsManagementScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    deptId: '',
    label: '',
    description: '',
  });
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const canAccess = hasFullControl(profile?.role);

  useEffect(() => {
    if (canAccess) {
      loadDepartments();
    }
  }, [canAccess]);

  const resetForm = () => {
    setFormData({
      deptId: '',
      label: '',
      description: '',
    });
    setEditingId(null);
  };

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await fetchDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Error loading departments:', error);
      Alert.alert('Error', 'Failed to load departments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.deptId || !formData.label || !formData.description) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const deptIdNum = parseInt(formData.deptId, 10);
      if (isNaN(deptIdNum) || deptIdNum <= 0) {
        Alert.alert('Error', 'Department ID must be a positive number');
        return;
      }

      setLoading(true);

      if (editingId) {
        await updateDepartment(editingId, {
          label: formData.label,
          description: formData.description,
        });
        Alert.alert('Success', 'Department updated successfully!');
      } else {
        await createDepartment({
          deptId: formData.deptId,
          label: formData.label,
          description: formData.description,
        });
        Alert.alert('Success', 'Department added successfully!');
      }

      await loadDepartments();
      clearDepartmentsCache(); // Clear cache so other components get fresh data
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving department:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save department. Please check your input and try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (department) => {
    setFormData({
      deptId: department.deptId.toString(),
      label: department.label,
      description: department.description,
    });
    setEditingId(department.id);
    setIsOpen(true);
  };

  const handleDelete = async (id) => {
    Alert.alert(
      'Deactivate Department',
      'Are you sure you want to deactivate this department? It will no longer be available for selection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDepartment(id);
              clearDepartmentsCache(); // Clear cache so other components get fresh data
              await loadDepartments();
              Alert.alert('Success', 'Department deactivated successfully');
            } catch (error) {
              console.error('Error deleting department:', error);
              const errorMessage = error.response?.data?.error || error.message || 'Failed to deactivate department.';
              Alert.alert('Error', errorMessage);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!canAccess) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Access denied. CEO/Super Admin access only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Departments Management</Text>
        <Text style={styles.subtitle}>Manage organization departments</Text>
      </View>

      <Button
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setIsOpen(true);
        }}
      >
        <Text style={styles.addButtonText}>Add Department</Text>
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent style={styles.dialogContent}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator
            bounces
          >
            <View style={styles.form}>
              <Text style={styles.dialogTitle}>
                {editingId ? 'Edit Department' : 'Add New Department'}
              </Text>

              <View style={styles.formField}>
                <Label style={styles.label}>Department ID *</Label>
                <Input
                  style={styles.input}
                  value={formData.deptId}
                  onChangeText={(text) => setFormData({ ...formData, deptId: text })}
                  placeholder="Enter a unique number (e.g., 1, 2, 3)"
                  keyboardType="numeric"
                  editable={!editingId}
                />
                {editingId ? (
                  <Text style={styles.helpText}>Department ID cannot be changed after creation</Text>
                ) : (
                  <Text style={styles.helpText}>Must be a unique positive number. This ID cannot be changed after creation.</Text>
                )}
              </View>

              <View style={styles.formField}>
                <Label style={styles.label}>Label *</Label>
                <Input
                  style={styles.input}
                  value={formData.label}
                  onChangeText={(text) => setFormData({ ...formData, label: text })}
                  placeholder="Enter department display name"
                />
                <Text style={styles.helpText}>This is the name that will be displayed throughout the app</Text>
              </View>

              <View style={styles.formField}>
                <Label style={styles.label}>Description *</Label>
                <Input
                  style={styles.input}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Enter department description"
                />
                <Text style={styles.helpText}>Description will be automatically converted to uppercase. Used for internal identification.</Text>
              </View>

              <View style={styles.formActions}>
                <Button variant="outline" onPress={() => setIsOpen(false)}>
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleSubmit} disabled={loading}>
                  <Text>{editingId ? 'Update' : 'Save'} Department</Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>

      {loading && !departments.length ? (
        <Card style={styles.card}>
          <CardContent style={styles.noDepartmentsCardContent}>
            <Text style={styles.loadingText}>Loading departments...</Text>
          </CardContent>
        </Card>
      ) : departments.length === 0 ? (
        <Card style={styles.card}>
          <CardContent style={styles.noDepartmentsCardContent}>
            <Text style={styles.noDepartmentsText}>No departments added yet</Text>
          </CardContent>
        </Card>
      ) : (
        <View style={styles.departmentsList}>
          {departments.map((department) => (
            <Card key={department.id} style={styles.departmentCard}>
              <CardHeader style={styles.cardHeader}>
                <CardTitle style={styles.departmentCardTitle}>
                  {department.label}
                </CardTitle>
                <CardDescription style={styles.cardDescription}>
                  ID: {department.deptId} | {department.description}
                </CardDescription>
              </CardHeader>
              <CardContent style={styles.cardContent}>
                <View style={styles.cardActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    style={styles.editButton}
                    onPress={() => handleEdit(department)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onPress={() => handleDelete(department.id)}
                  >
                    <Text style={styles.deleteButtonText}>Deactivate</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      <Card style={styles.howToUseCard}>
        <CardHeader style={styles.cardHeader}>
          <CardTitle style={styles.cardTitle}>How to use</CardTitle>
        </CardHeader>
        <CardContent style={styles.howToUseContent}>
          <Text style={styles.howToUseText}>
            • <Text style={styles.boldText}>Add departments:</Text> Click "Add Department" to create new departments
          </Text>
          <Text style={styles.howToUseText}>
            • <Text style={styles.boldText}>Edit departments:</Text> Update department labels and descriptions as needed
          </Text>
          <Text style={styles.howToUseText}>
            • <Text style={styles.boldText}>Deactivate:</Text> Deactivate departments that are no longer in use (they will be hidden from selection)
          </Text>
          <Text style={styles.howToUseText}>
            • <Text style={styles.boldText}>Department ID:</Text> Must be unique and cannot be changed after creation
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f8f8',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    width: '100%',
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dialogContent: {
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  formScroll: {
    flexGrow: 0,
  },
  formScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  form: {
    paddingVertical: 0,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardContent: {
    padding: 16,
    paddingTop: 8,
  },
  noDepartmentsCardContent: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDepartmentsText: {
    textAlign: 'center',
    color: '#999',
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
  },
  departmentsList: {
    flexDirection: 'column',
    gap: 16,
  },
  departmentCard: {
    marginBottom: 0,
  },
  departmentCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
  },
  editButtonText: {
    color: '#007bff',
    marginLeft: 4,
  },
  deleteButtonText: {
    color: 'white',
  },
  howToUseCard: {
    marginTop: 24,
  },
  howToUseContent: {
    paddingVertical: 16,
  },
  howToUseText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginTop: 20,
    padding: 20,
  },
});

