import * as FileSystem from 'expo-file-system/legacy';

// Upload photo - returns base64 data URI for local storage
// Photos are stored as data URIs and sent to backend as photo URLs
export async function uploadPhoto(fileUri, staffId, type, attendanceDate) {
  try {
    // Read file as base64 using legacy API
    // Try to use EncodingType if available, otherwise use string literal
    let encoding;
    if (FileSystem.EncodingType && FileSystem.EncodingType.Base64) {
      encoding = FileSystem.EncodingType.Base64;
    } else {
      // Fallback: use string 'base64' if EncodingType is not available
      encoding = 'base64';
    }
    
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: encoding,
    });

    // Create file name
    const fileName = `${staffId}_${type}_${attendanceDate}_${Date.now()}.jpg`;

    // Return base64 data URI (can be stored directly or uploaded to backend)
    // Format: data:image/jpeg;base64,<base64data>
    const dataUri = `data:image/jpeg;base64,${base64}`;

    return {
      path: dataUri,
      name: fileName
    };
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
}

// Delete photo - no-op for data URIs (stored locally)
// If backend file storage is implemented, this can call a delete endpoint
export async function deletePhoto(photoUrl) {
  try {
    // For data URIs, no deletion needed (local storage)
    // If using backend file storage, implement API call here:
    // await apiClient.delete(`/files/${fileName}`);
    console.log('Photo deletion not implemented for local storage');
  } catch (error) {
    console.error('Error deleting photo:', error);
    // Don't throw error for delete failures
  }
}

// Get photo URL - returns the URL as-is (could be data URI or backend URL)
export function getPhotoUrl(fileName) {
  if (!fileName) return null;
  // If it's already a data URI or full URL, return as-is
  if (fileName.startsWith('data:') || fileName.startsWith('http://') || fileName.startsWith('https://')) {
    return fileName;
  }
  // Otherwise, assume it's a filename and construct backend URL
  // TODO: Implement backend file serving endpoint if needed
  return fileName;
}

// Upload profile photo - returns base64 data URI
export async function uploadProfilePhoto(fileUri, userId) {
  try {
    // Read file as base64 using legacy API
    let encoding;
    if (FileSystem.EncodingType && FileSystem.EncodingType.Base64) {
      encoding = FileSystem.EncodingType.Base64;
    } else {
      encoding = 'base64';
    }
    
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: encoding,
    });

    // Create file name for profile photo
    const fileName = `profile_${userId}_${Date.now()}.jpg`;

    // Return base64 data URI
    const dataUri = `data:image/jpeg;base64,${base64}`;

    return {
      url: dataUri,
      name: fileName
    };
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw error;
  }
}
