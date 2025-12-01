import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';

const AttendanceTable = ({ records, title, pageSize = 10, selectedDepartment = 'all' }) => {
  const [expandedTabs, setExpandedTabs] = useState(new Set()); // Track which tabs are expanded
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPages, setCurrentPages] = useState({
    all: 1,
    present: 1,
    absent: 1,
    'on-leave': 1,
  }); // Track current page per tab

  // Filter records by department first
  const departmentFilteredRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    if (selectedDepartment === 'all') return records;
    return records.filter(record => record.department === selectedDepartment);
  }, [records, selectedDepartment]);

  // Get records for a specific tab
  const getRecordsForTab = (tab) => {
    if (!departmentFilteredRecords || departmentFilteredRecords.length === 0) return [];
    
    let tabFiltered = departmentFilteredRecords;
    if (tab !== 'all') {
      tabFiltered = departmentFilteredRecords.filter(record => {
        const status = (record.status || '').toLowerCase();
        if (tab === 'present') {
          return status === 'present' || status === 'late';
        }
        return status === tab;
      });
    }
    
    // Filter by search query if provided
    if (!searchQuery.trim()) {
      return tabFiltered;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return tabFiltered.filter(record => {
      const name = (record.staffName || '').toLowerCase();
      const empNo = (record.empNo || '').toString().toLowerCase();
      return name.includes(query) || empNo.includes(query);
    });
  };

  // Count records by status for tabs (using department filtered records)
  const presentCount = useMemo(() => {
    if (!departmentFilteredRecords) return 0;
    return departmentFilteredRecords.filter(r => {
      const status = (r.status || '').toLowerCase();
      return status === 'present' || status === 'late';
    }).length;
  }, [departmentFilteredRecords]);

  const absentCount = useMemo(() => {
    if (!departmentFilteredRecords) return 0;
    return departmentFilteredRecords.filter(r => (r.status || '').toLowerCase() === 'absent').length;
  }, [departmentFilteredRecords]);

  const onLeaveCount = useMemo(() => {
    if (!departmentFilteredRecords) return 0;
    return departmentFilteredRecords.filter(r => (r.status || '').toLowerCase() === 'on-leave').length;
  }, [departmentFilteredRecords]);

  const toggleTab = (tab) => {
    setExpandedTabs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tab)) {
        newSet.delete(tab);
      } else {
        newSet.add(tab);
      }
      return newSet;
    });
  };

  // Reset page when search query changes
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    setCurrentPages({
      all: 1,
      present: 1,
      absent: 1,
      'on-leave': 1,
    });
  };

  // Get paginated records for a tab
  const getPaginatedRecords = (tab) => {
    const allRecords = getRecordsForTab(tab);
    const currentPage = currentPages[tab] || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return {
      records: allRecords.slice(startIndex, endIndex),
      totalRecords: allRecords.length,
      totalPages: Math.ceil(allRecords.length / pageSize),
      currentPage,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, allRecords.length),
    };
  };

  // Handle page change for a specific tab
  const handlePageChange = (tab, direction) => {
    setCurrentPages(prev => {
      const currentPage = prev[tab] || 1;
      const { totalPages } = getPaginatedRecords(tab);
      let newPage = currentPage;
      
      if (direction === 'next' && currentPage < totalPages) {
        newPage = currentPage + 1;
      } else if (direction === 'prev' && currentPage > 1) {
        newPage = currentPage - 1;
      }
      
      return { ...prev, [tab]: newPage };
    });
  };

  const tabOptions = [
    { value: 'all', label: 'All', count: departmentFilteredRecords?.length || 0 },
    { value: 'present', label: 'Present', count: presentCount },
    { value: 'absent', label: 'Absent', count: absentCount },
    { value: 'on-leave', label: 'On Leave', count: onLeaveCount },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => handleSearchChange('')}
            style={styles.clearButton}
          >
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Accordion Tabs */}
      <View style={styles.tabsAccordionContainer}>
        {tabOptions.map((tab) => {
          const isExpanded = expandedTabs.has(tab.value);
          const pagination = getPaginatedRecords(tab.value);
          const hasTabRecords = pagination.totalRecords > 0;

          return (
            <View key={tab.value} style={styles.tabAccordionItem}>
              <TouchableOpacity
                style={styles.tabAccordionHeader}
                onPress={() => toggleTab(tab.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.tabAccordionHeaderText}>
                  {tab.label} ({tab.count})
                </Text>
                <Feather
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.tabAccordionContent}>
                  {!hasTabRecords ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        {searchQuery.trim()
                          ? `No records found matching "${searchQuery}"`
                          : `No ${tab.label.toLowerCase()} records for today`}
                      </Text>
                    </View>
                  ) : (
                    <View>
                      {pagination.records.map((record, index) => {
                        const isLastItem = index === pagination.records.length - 1;
                        return (
                          <React.Fragment key={record.id ?? `${tab.value}-${index}`}>
                            <View style={styles.attendanceItem}>
                              <View style={styles.attendanceInfo}>
                                <View style={styles.staffNameRow}>
                                  <Text style={styles.staffName}>{record.staffName}</Text>
                                  {record.empNo && (
                                    <Text style={styles.empNo}>ID: {record.empNo}</Text>
                                  )}
                                </View>
                                <Text style={styles.location}>{record.nc}</Text>
                              </View>
                              <View style={styles.attendanceStatus}>
                                <Text
                                  style={[
                                    styles.statusText,
                                    {
                                      color:
                                        record.status === 'present'
                                          ? '#28a745'
                                          : record.status === 'late'
                                          ? '#ffc107'
                                          : record.status === 'on-leave'
                                          ? '#6c757d'
                                          : '#dc3545',
                                    },
                                  ]}
                                >
                                  {record.status?.toUpperCase().replace('-', ' ')}
                                </Text>
                                {record.clockIn && (
                                  <Text style={styles.timeText}>
                                    {new Date(record.clockIn).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                    {record.clockOut &&
                                      ` - ${new Date(record.clockOut).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}`}
                                  </Text>
                                )}
                              </View>
                            </View>
                            {!isLastItem && <View style={styles.separator} />}
                          </React.Fragment>
                        );
                      })}

                      {/* Pagination Controls */}
                      {pagination.totalPages > 1 && (
                        <View style={styles.paginationContainer}>
                          <TouchableOpacity
                            style={[
                              styles.paginationButton,
                              pagination.currentPage === 1 && styles.paginationButtonDisabled,
                            ]}
                            onPress={() => handlePageChange(tab.value, 'prev')}
                            disabled={pagination.currentPage === 1}
                          >
                            <Text
                              style={[
                                styles.paginationButtonText,
                                pagination.currentPage === 1 && styles.paginationButtonTextDisabled,
                              ]}
                            >
                              Previous
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.paginationInfo}>
                            <Text style={styles.paginationText}>
                              Page {pagination.currentPage} of {pagination.totalPages}
                            </Text>
                            <Text style={styles.paginationSubtext}>
                              Showing {pagination.startIndex}-{pagination.endIndex} of {pagination.totalRecords}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.paginationButton,
                              pagination.currentPage === pagination.totalPages && styles.paginationButtonDisabled,
                            ]}
                            onPress={() => handlePageChange(tab.value, 'next')}
                            disabled={pagination.currentPage === pagination.totalPages}
                          >
                            <Text
                              style={[
                                styles.paginationButtonText,
                                pagination.currentPage === pagination.totalPages && styles.paginationButtonTextDisabled,
                              ]}
                            >
                              Next
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      position: 'relative',
      isolation: 'isolate',
      contain: 'layout style paint',
      overflow: 'hidden',
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  attendanceItem: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  attendanceInfo: {
    flex: 1,
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  staffName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  empNo: {
    fontSize: 12,
    color: '#666',
    fontWeight: '400',
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tabsAccordionContainer: {
    marginBottom: 16,
  },
  tabAccordionItem: {
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  tabAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
  },
  tabAccordionHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  tabAccordionContent: {
    backgroundColor: 'white',
    paddingTop: 8,
  },
  attendanceStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
  },
  paginationContainer: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paginationButton: {
    opacity: 0.9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  paginationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#ECEFF1',
  },
  paginationInfo: {
    alignItems: 'center',
    flex: 1,
  },
  paginationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default AttendanceTable;
