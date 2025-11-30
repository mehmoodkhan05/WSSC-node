import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';

const SearchableDropdown = ({
  options,
  selectedValue,
  onValueChange,
  placeholder,
  style,
  disabled = false,
  searchPlaceholder = 'Search...',
  searchFields = ['label'], // Fields to search in (for custom objects)
  getSearchText = null, // Optional function to extract searchable text from option
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find(option => option.value === selectedValue);

  useEffect(() => {
    if (disabled && modalVisible) {
      setModalVisible(false);
    }
  }, [disabled, modalVisible]);

  useEffect(() => {
    if (!modalVisible) {
      setSearchQuery('');
    }
  }, [modalVisible]);

  const getSearchableText = (option) => {
    if (getSearchText) {
      return getSearchText(option);
    }
    // Default: search in label and any additional search fields
    const texts = [option.label || ''];
    searchFields.forEach(field => {
      if (option[field] !== undefined && option[field] !== null) {
        texts.push(String(option[field]));
      }
    });
    return texts.join(' ').toLowerCase();
  };

  const filteredOptions = options.filter(option => {
    if (!searchQuery.trim()) return true;
    const searchText = getSearchableText(option);
    return searchText.includes(searchQuery.toLowerCase());
  });

  const handleSelect = (value) => {
    onValueChange(value);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => {
          if (!disabled) {
            setModalVisible(true);
          }
        }}
        disabled={disabled}
      >
        <Text style={styles.dropdownText}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible && !disabled}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
                placeholderTextColor="#999"
              />
            </View>
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No results found</Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    minHeight: 50,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  arrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    maxHeight: '70%',
    width: '80%',
    padding: 10,
  },
  searchContainer: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  optionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default SearchableDropdown;

